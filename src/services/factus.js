const { seal, open } = require('../utils/secretBox');

// Factura electrónica DIAN (Mejora 3) por medio de Factus, proveedor tecnológico autorizado: la empresa conecta SU cuenta
// (sus credenciales van cifradas) y su rango de numeración. NOVA arma la factura con los renglones de la cotización
// aprobada y Factus la valida ante la DIAN en una sola llamada (POST /v2/bills/validate), devolviendo número, CUFE y
// representación gráfica. La referencia es NWO-COT-<id>: si se repite, Factus devuelve la misma (no se factura dos veces).

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

// Token por empresa, en memoria hasta que vence (con varias instancias cada una pide el suyo: es barato).
const tokens = new Map();
const token = async (company) => {
  const f = company.factus;
  const cached = tokens.get(String(company._id));
  if (cached && cached.until > Date.now() && cached.user === f.username) return cached.value;
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
  tokens.set(String(company._id), { value: data.access_token, user: f.username, until: Date.now() + (Number(data.expires_in) || 600) * 1000 - 30000 });
  return data.access_token;
};

const two = (n) => (Math.round(Number(n) * 100) / 100).toFixed(2);
// Fecha de hoy (más `days`) en Colombia, AAAA-MM-DD (el servidor corre en UTC).
const colombiaDate = (days = 0) => new Date(Date.now() - 5 * 3600000 + days * 86400000).toISOString().slice(0, 10);

// Los precios de una cotización van SIN IVA: a Factus va el precio unitario tal cual y la tarifa de cada renglón.
// La diferencia de redondeo frente al total de la cotización va en cash_rounding_amount.
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
    taxes: [{ code: '01', rate: two(i.taxRate) }],
  }));
  const computed = items.reduce((sum, it) => {
    const base = Number(it.price) * Number(it.quantity);
    return sum + Math.round(base * (1 + Number(it.taxes[0].rate) / 100) * 100) / 100;
  }, 0);
  // Pagada: de contado, por el medio con que se pagó. Sin pagar: a crédito, a 30 días.
  const paid = quote.payment && quote.payment.status === 'pagado';
  const payment = paid
    ? { payment_form: '1', payment_method_code: quote.payment.method === 'wompi' ? '48' : '10' }
    : { payment_form: '2', payment_method_code: '10', payment_due_date: colombiaDate(30) };
  return {
    reference_code: `NWO-COT-${quote._id}`,
    document: '01',
    numbering_range_id: Number(company.factus.numberingRangeId),
    operation_type: '10',
    observation: `Cotización #${quote.number}: ${quote.title}`.slice(0, 250),
    payment_details: [{ ...payment, reference_code: `cotizacion-${quote.number}`, amount: two(quote.total) }],
    cash_rounding_amount: two(quote.total - computed),
    customer: buyer,
    items,
  };
};

// El comprador: consumidor final, o a su nombre con su documento (cédula, NIT…).
const buyerFrom = (input) => {
  if (!input || !input.identification) return { ...CONSUMIDOR_FINAL };
  const code = DOC_TYPES[input.docType] || DOC_TYPES.CC;
  const out = {
    identification_document_code: code,
    identification: String(input.identification).replace(/\D/g, ''),
    legal_organization_code: code === DOC_TYPES.NIT ? '1' : '2',      // 1 persona jurídica · 2 persona natural
    tribute_code: 'ZZ',
    country_code: 'CO',
  };
  if (code === DOC_TYPES.NIT) out.company = input.name; else out.names = input.name;
  if (input.dv) out.dv = String(input.dv);
  if (input.email) out.email = input.email;
  if (input.address) out.address = input.address;
  if (input.phone) out.phone = String(input.phone).replace(/\D/g, '');
  return out;
};

const emit = async (company, bill) => {
  const access = await token(company);
  let res;
  try {
    res = await fetch(`${BASE(company.factus.env)}/v2/bills/validate`, {
      method: 'POST',
      headers: { Accept: 'application/json', 'Content-Type': 'application/json', Authorization: `Bearer ${access}` },
      body: JSON.stringify(bill),
      signal: AbortSignal.timeout(45000),
    });
  } catch {
    throw new FactusError('Factus no respondió a tiempo. Inténtalo de nuevo: la factura no se duplica.');
  }
  const data = await res.json().catch(() => ({}));
  if (!res.ok || !data.data) {
    const detail = data.message || (data.data && data.data.errors && JSON.stringify(data.data.errors)) || `respondió ${res.status}`;
    throw new FactusError(`La DIAN o Factus rechazó la factura: ${String(detail).slice(0, 300)}`);
  }
  const d = data.data;
  return { number: d.number || '', cufe: d.cufe || '', publicUrl: (d.links && d.links.public_url) || '', qr: (d.links && d.links.qr) || '' };
};

// Solo pruebas: olvida los tokens guardados.
const _reset = () => tokens.clear();

module.exports = { connected, sealCredentials, buildBill, buyerFrom, emit, token, FactusError, IVA_RATES, DOC_TYPES, CONSUMIDOR_FINAL, _reset };
