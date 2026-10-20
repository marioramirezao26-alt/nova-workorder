const { seal, open } = require('../utils/secretBox');

// Factura electrónica DIAN (Mejora 3) por medio de Factus, proveedor tecnológico autorizado: la empresa conecta SU cuenta
// (sus credenciales van cifradas) y su rango de numeración. NOVA arma la factura con los renglones de la cotización
// aprobada y Factus la valida ante la DIAN en una sola llamada (POST /v2/bills/validate), devolviendo número, CUFE y
// representación gráfica. La referencia es NWO-COT-<id>: si se repite, Factus devuelve la misma (no se factura dos veces).
// Caso abierto: si Factus responde 409 (una factura con esa referencia quedó pendiente de envío a la DIAN), se avisa y
// no se hace nada más; la salida es borrarla en Factus (DELETE por referencia) y volver a facturar, sin automatizar aún.

const BASE = (env) => process.env.FACTUS_API_URL
  || (env === 'produccion' ? 'https://api.factus.com.co' : 'https://api-sandbox.factus.com.co');

const IVA_RATES = [0, 5, 19];
// Tipos de documento del comprador (tabla DIAN): 13 cédula, 31 NIT, 22 cédula de extranjería, 41 pasaporte.
const DOC_TYPES = { CC: '13', NIT: '31', CE: '22', PP: '41' };
const CONSUMIDOR_FINAL = { identification_document_code: '13', identification: '222222222222', names: 'Consumidor Final' };

class FactusError extends Error {}

// Solo empresas en pesos (la factura DIAN es colombiana).
const connected = (company) => Boolean(company && company.factus && company.factus.username && company.factus.numberingRangeId && company.lang !== 'en');

const sealCredentials = ({ clientId, clientSecret, username, password }) => ({
  clientId, username, clientSecretSealed: seal(clientSecret), passwordSealed: seal(password),
});

// Token por empresa, ambiente y usuario, en memoria hasta que vence (lo que diga expires_in; con varias instancias cada
// una pide el suyo: es barato). Al conectar, cambiar los datos o desconectar se olvidan los de la empresa.
const tokens = new Map();
const tokenKey = (company) => `${company._id}|${company.factus.env}|${company.factus.username}`;
const forget = (companyId) => {
  for (const key of tokens.keys()) if (key.startsWith(`${companyId}|`)) tokens.delete(key);
};
const token = async (company, { fresh = false } = {}) => {
  const f = company.factus;
  const cached = tokens.get(tokenKey(company));
  if (!fresh && cached && cached.until > Date.now()) return cached.value;
  const body = new URLSearchParams({
    grant_type: 'password', client_id: f.clientId, client_secret: open(f.clientSecretSealed),
    username: f.username, password: open(f.passwordSealed),
  });
  let res;
  try {
    res = await fetch(`${BASE(f.env)}/oauth/token`, {
      method: 'POST', headers: { Accept: 'application/json', 'Content-Type': 'application/x-www-form-urlencoded' }, body,
      signal: AbortSignal.timeout(15000),
    });
  } catch {
    throw new FactusError('No pudimos hablar con Factus en este momento. Inténtalo de nuevo en un rato.');
  }
  const data = await res.json().catch(() => ({}));
  if (!res.ok || !data.access_token) throw new FactusError('Factus no aceptó las credenciales. Revísalas en «Integraciones».');
  tokens.set(tokenKey(company), { value: data.access_token, until: Date.now() + (Number(data.expires_in) || 600) * 1000 - 30000 });
  return data.access_token;
};

// Dígito de verificación de un NIT (algoritmo de la DIAN, módulo 11). Es opcional: si no va, Factus lo calcula; si va,
// tiene que ser este.
const NIT_WEIGHTS = [3, 7, 13, 17, 19, 23, 29, 37, 41, 43, 47, 53, 59, 67, 71];
const nitDv = (nit) => {
  const digits = String(nit).replace(/\D/g, '').split('').reverse();
  const r = digits.reduce((sum, d, k) => sum + Number(d) * NIT_WEIGHTS[k], 0) % 11;
  return String(r > 1 ? 11 - r : r);
};

const two = (n) => (Math.round(Number(n) * 100) / 100).toFixed(2);
// Fecha en Colombia (la de `from`, hoy si no, más `days`), AAAA-MM-DD (el servidor corre en UTC).
const colombiaDate = (days = 0, from = null) => new Date(new Date(from || Date.now()).getTime() - 5 * 3600000 + days * 86400000).toISOString().slice(0, 10);
// Medio de pago (tabla DIAN) según cómo pagó en Wompi: tarjeta 48; PSE o transferencia 47 (Nequi y Daviplata debitan
// una cuenta: transferencia); otro medio, ZZZ. El efectivo que registra la oficina va con 10.
const WOMPI_METHOD = { CARD: '48', PSE: '47', BANCOLOMBIA_TRANSFER: '47', NEQUI: '47', DAVIPLATA: '47' };
const pesos = (n) => Number(two(n)).toLocaleString('es-CO');
const MAX_ROUNDING = 500;           // lo máximo que Factus acepta en cash_rounding_amount (±)

// Los precios de una cotización van SIN IVA: a Factus va el precio unitario tal cual y la tarifa de cada renglón (un
// renglón excluido de IVA va marcado is_excluded; al 0 % sin marca es exento). La diferencia de redondeo frente al total
// de la cotización va en cash_rounding_amount, que Factus acepta hasta ±500: si es mayor, la factura no se envía.
const buildBill = (company, quote, buyer) => {
  const bad = quote.items.find((i) => !IVA_RATES.includes(Number(i.taxRate)));
  if (bad) throw new FactusError(`El renglón «${bad.description}» tiene un IVA de ${bad.taxRate} %: la DIAN solo acepta 0 %, 5 % o 19 %.`);
  const items = quote.items.map((i, k) => ({
    code_reference: `COT${quote.number}-${k + 1}`,
    name: i.description.slice(0, 200),
    quantity: two(i.qty),
    discount_rate: '0.00',
    price: two(i.unitPrice),
    unit_measure_code: '94',          // unidad
    standard_code: '999',             // estándar de adopción del contribuyente
    taxes: [{ code: '01', rate: two(i.taxRate), ...(i.excluded ? { is_excluded: true } : {}) }],
  }));
  const computed = items.reduce((sum, it) => {
    const base = Number(it.price) * Number(it.quantity);
    return sum + Math.round(base * (1 + Number(it.taxes[0].rate) / 100) * 100) / 100;
  }, 0);
  const rounding = Math.round((quote.total - computed) * 100) / 100;
  if (Math.abs(rounding) > MAX_ROUNDING) {
    throw new FactusError(`Los renglones suman $ ${pesos(computed)} y la cotización $ ${pesos(quote.total)}: Factus acepta hasta $ ${MAX_ROUNDING} de redondeo. Revisa los precios con decimales.`);
  }
  // De contado solo si está pagada del todo con plata real: un renglón por medio (lo de Wompi con su medio y lo que
  // registró la oficina, en efectivo). Si no (por cobrar, con anticipo o con un pago de prueba de Wompi), a crédito a 30
  // días por lo que falta, por acuerdo (ZZZ), y el anticipo pagado en prepayment_details.
  const p = quote.payment || {};
  const reference = `cotizacion-${quote.number}`;
  let payments;
  let prepaid = 0;
  if (p.status === 'pagado' && !p.test) {
    const office = p.method === 'wompi' ? Math.min(p.officeAmount || 0, quote.total) : quote.total;
    const parts = p.method === 'wompi' ? [[WOMPI_METHOD[p.methodType] || 'ZZZ', quote.total - office], ['10', office]] : [['10', quote.total]];
    payments = parts.filter(([, amount], k) => amount > 0 || k === 0)
      .map(([code, amount]) => ({ payment_form: '1', payment_method_code: code, reference_code: reference, amount: two(amount) }));
  } else {
    if (p.status === 'anticipo' && !p.test) prepaid = Math.min(p.amountPaid || 0, quote.total);
    payments = [{ payment_form: '2', payment_method_code: 'ZZZ', reference_code: reference, amount: two(quote.total - prepaid), due_date: colombiaDate(30) }];
  }
  return {
    reference_code: `NWO-COT-${quote._id}`,
    document: '01',
    numbering_range_id: Number(company.factus.numberingRangeId),
    operation_type: '10',
    observation: `Cotización #${quote.number}: ${quote.title}`.slice(0, 250),
    payment_details: payments,
    ...(prepaid > 0 ? { prepayment_details: [{
      reference_code: p.txId ? `wompi-${p.txId}` : `${reference}-anticipo`, received_date: colombiaDate(0, p.paidAt), amount: two(prepaid),
      note: `Anticipo de la cotización #${quote.number} pagado con Wompi`,
    }] } : {}),
    cash_rounding_amount: two(rounding),
    customer: buyer,
    items,
  };
};

// El comprador: consumidor final, o a su nombre con su documento (cédula, NIT…). La cédula de extranjería y el pasaporte
// llevan letras; el país es el que se indique (CO si no). El DV solo va con NIT.
const ALPHANUMERIC = [DOC_TYPES.CE, DOC_TYPES.PP];
const buyerFrom = (input) => {
  if (!input || !input.identification) return { ...CONSUMIDOR_FINAL };
  const code = DOC_TYPES[input.docType] || DOC_TYPES.CC;
  const country = String(input.country || '').trim().toUpperCase();
  const out = {
    identification_document_code: code,
    identification: ALPHANUMERIC.includes(code)
      ? String(input.identification).toUpperCase().replace(/[^A-Z0-9]/g, '')
      : String(input.identification).replace(/\D/g, ''),
    legal_organization_code: code === DOC_TYPES.NIT ? '1' : '2',      // 1 persona jurídica · 2 persona natural
    tribute_code: 'ZZ',
    country_code: /^[A-Z]{2}$/.test(country) ? country : 'CO',
  };
  if (code === DOC_TYPES.NIT) out.company = input.name; else out.names = input.name;
  if (code === DOC_TYPES.NIT && input.dv) out.dv = String(input.dv);
  if (input.email) out.email = input.email;
  if (input.address) out.address = input.address;
  if (input.phone) out.phone = String(input.phone).replace(/\D/g, '');
  return out;
};

// Envía la factura. Un 401 es del token (venció antes de tiempo, se revocó o es de otro ambiente): se olvida y se
// reintenta una vez con uno nuevo. Devuelve también el comprador con que quedó la factura en Factus (con una referencia
// ya procesada, Factus devuelve esa factura y no la que se acaba de pedir).
const emit = async (company, bill) => {
  const send = async (access) => {
    try {
      return await fetch(`${BASE(company.factus.env)}/v2/bills/validate`, {
        method: 'POST',
        headers: { Accept: 'application/json', 'Content-Type': 'application/json', Authorization: `Bearer ${access}` },
        body: JSON.stringify(bill),
        signal: AbortSignal.timeout(45000),
      });
    } catch {
      throw new FactusError('Factus no respondió a tiempo. Inténtalo de nuevo: la factura no se duplica.');
    }
  };
  let res = await send(await token(company));
  if (res.status === 401) {
    forget(company._id);
    res = await send(await token(company, { fresh: true }));
    if (res.status === 401) throw new FactusError('Factus no aceptó la sesión. Revisa las credenciales en «Integraciones».');
  }
  const data = await res.json().catch(() => ({}));
  if (res.status === 409) {
    throw new FactusError(`Factus tiene una factura pendiente de envío a la DIAN con la referencia ${bill.reference_code}. Hay que borrarla en Factus y volver a facturar.`);
  }
  if (!res.ok || !data.data) {
    const detail = data.message || (data.data && data.data.errors && JSON.stringify(data.data.errors)) || `respondió ${res.status}`;
    throw new FactusError(`La DIAN o Factus rechazó la factura: ${String(detail).slice(0, 300)}`);
  }
  const d = data.data;
  const c = d.customer || {};
  return {
    number: d.number || '', cufe: d.cufe || '', publicUrl: (d.links && d.links.public_url) || '', qr: (d.links && d.links.qr) || '',
    validated: d.is_validated !== false,                  // false: la DIAN aún no la valida
    buyerName: String(c.names || c.company || c.graphic_representation_name || '').slice(0, 200),
    buyerId: c.identification ? String(c.identification) : '',
  };
};

// Solo pruebas: olvida los tokens guardados.
const _reset = () => tokens.clear();

module.exports = { connected, sealCredentials, buildBill, buyerFrom, emit, token, forget, nitDv, FactusError, IVA_RATES, DOC_TYPES, CONSUMIDOR_FINAL, _reset };
