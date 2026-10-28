// Piezas compartidas por las pantallas.
import { locale, t } from './i18n';

export const STATUS = {
  pendiente: 'Pendiente',
  en_proceso: 'En proceso',
  completada: 'Completada',
  cancelada: 'Cancelada',
};
export const PRIORITY = { baja: 'Baja', media: 'Media', alta: 'Alta', urgente: 'Urgente' };
export const ROLE = { admin: 'Administrador', tecnico: 'Técnico', cliente: 'Cliente' };

export const StatusTag = ({ status }) => <span className={`status-tag ${status}`}>{t(STATUS[status] || status)}</span>;

export const PriorityTag = ({ priority }) =>
  priority === 'alta' || priority === 'urgente' ? <span className={`priority-tag ${priority}`}>{t(PRIORITY[priority])}</span> : null;

// Fechas de calendario (fecha límite): se muestran tal cual se guardaron, sin correr el día por la zona horaria.
export const formatDay = (value) =>
  value ? new Date(value).toLocaleDateString(locale(), { timeZone: 'UTC', day: 'numeric', month: 'short' }) : '';

export const formatDateTime = (value) =>
  value ? new Date(value).toLocaleString(locale(), { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }) : '';

// Vencida según el día de Colombia, no el de UTC (ver dates.js).
export { isOverdue } from './dates';

export const mapsLink = (address) => `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(address)}`;

// Enlace de WhatsApp al cliente con el indicativo del país de la empresa (`lang`): en (EE. UU.) +1 a los números de 10
// dígitos; es (Colombia) +57 a los celulares de 10 dígitos que empiezan por 3. Un número con «+» o «00» ya trae su
// indicativo. Si no se sabe con certeza a qué país va (un fijo, un número incompleto), WhatsApp se abre sin número para
// elegir el contacto, en vez de mandarle el mensaje a un desconocido.
// Una empresa de Estados Unidos (mercado us, o en inglés de antes): sus celulares son de +1 y cotiza en dólares,
// aunque use la app en español. Una de México (mercado mx): celulares de +52 y cotiza en pesos mexicanos.
export const usCompany = (company) => Boolean(company && (company.market === 'us' || company.lang === 'en'));
export const companyMarket = (company) => (usCompany(company) ? 'us' : company && company.market === 'mx' ? 'mx' : 'co');
export const colombiaCompany = (company) => companyMarket(company) === 'co';
// La moneda de sus cotizaciones (la misma regla de src/utils/money.js).
export const companyCurrency = (company) => ({ co: 'COP', us: 'USD', mx: 'MXN' })[companyMarket(company)];
// El tercer parámetro dice el país de los celulares: 'en' = Estados Unidos (+1), 'mx' = México (+52), 'es' = Colombia (+57).
export const phoneRegion = (company) => ({ co: 'es', us: 'en', mx: 'mx' })[companyMarket(company)];

export const whatsappLink = (phone, text, lang = 'es') => {
  const raw = String(phone || '').trim();
  const d = raw.replace(/\D/g, '');
  let number = '';
  if (/^(\+|00)/.test(raw)) number = raw.startsWith('00') ? d.slice(2) : d;
  else if (lang === 'en') number = d.length === 10 && /^[2-9]/.test(d) ? `1${d}` : (d.length === 11 && d.startsWith('1') ? d : '');
  // México: los celulares son de 10 dígitos (81… Monterrey, 55… Ciudad de México) y van con 52; el «521» de antes también.
  else if (lang === 'mx') number = d.length === 10 ? `52${d}` : (/^52\d{10}$/.test(d) || /^521\d{10}$/.test(d) ? d : '');
  else number = d.length === 10 && d.startsWith('3') ? `57${d}` : (d.length === 12 && d.startsWith('573') ? d : '');
  if (number.length < 8 || number.length > 15) number = '';
  return `https://wa.me/${number}?text=${encodeURIComponent(text)}`;
};

// «Hecho con NOVAWORKORDER · Prueba gratis» del informe y la cotización públicos: lleva a la página de ventas diciendo
// de dónde viene (`utm_source`: informe o cotizacion) y qué empresa lo mandó (`ref`). El `ref` es el nombre de la
// empresa normalizado, el mismo que ya se ve en la página (nada interno), con la forma que acepta la página de ventas
// (3 a 20 letras, números o guiones); si no da para eso, el enlace va sin `ref`.
export const refCode = (name) => {
  const code = String(name || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase()
    .replace(/[^a-z0-9]+/g, '-').replace(/^-+/, '').slice(0, 20).replace(/-+$/, '');
  return /^[a-z0-9-]{3,20}$/.test(code) ? code : '';
};
export const novaLink = (source, companyName, lang = 'es', market = 'co') => {
  const ref = refCode(companyName);
  // utm_content, not ref: the landing reads «ref» as a customer referral code (GABY's referral channel)
  // la página de su mercado: /en/ (EE. UU. en inglés), /es-us/ (EE. UU. en español) o la de Colombia
  return `https://novaworkorder.com/${lang === 'en' ? 'en/' : market === 'us' ? 'es-us/' : market === 'mx' ? 'es-mx/' : ''}?utm_source=${source}${ref ? `&utm_content=${ref}` : ''}`;
};

export const Empty = ({ children }) => <p className="muted empty">{children}</p>;

// Plata: pesos colombianos enteros (COP), dólares (USD) o pesos mexicanos (MXN, «$1,250.00») con centavos.
export const withCents = (currency) => currency === 'USD' || currency === 'MXN';
const MONEY_LOCALE = { USD: 'en-US', MXN: 'es-MX', COP: 'es-CO' };
export const money = (value, currency = 'COP') => new Intl.NumberFormat(MONEY_LOCALE[currency] || 'es-CO', {
  style: 'currency', currency, minimumFractionDigits: withCents(currency) ? 2 : 0, maximumFractionDigits: withCents(currency) ? 2 : 0,
}).format(Number(value) || 0);

// Los mismos totales que calcula el servidor (cada renglón redondeado y luego sumado), para verlos mientras se escribe.
// El mismo redondeo de src/utils/money.js: sin el ruido del punto flotante (85 × 9,5 % = 8,08, no 8,07).
const round = (v, currency) => {
  const scale = currency === 'USD' || currency === 'MXN' ? 100 : 1;   // con centavos: dólares y pesos mexicanos
  return Math.round(Number((Number(v) * scale).toPrecision(15))) / scale;
};
export const quoteTotals = (items, currency) => {
  let subtotal = 0;
  let tax = 0;
  items.forEach((i) => {
    const amount = round((Number(i.qty) || 0) * (Number(i.unitPrice) || 0), currency);
    subtotal += amount;
    tax += round(amount * ((Number(i.taxRate) || 0) / 100), currency);
  });
  return { subtotal: round(subtotal, currency), tax: round(tax, currency), total: round(subtotal + tax, currency) };
};

// Dígito de verificación de un NIT: el mismo algoritmo de la DIAN (módulo 11) que valida el servidor
// (src/services/factus.js), para avisar en el formulario antes de facturar.
export const nitDv = (nit) => {
  const weights = [3, 7, 13, 17, 19, 23, 29, 37, 41, 43, 47, 53, 59, 67, 71];
  const r = String(nit).replace(/\D/g, '').split('').reverse().reduce((sum, d, k) => sum + Number(d) * weights[k], 0) % 11;
  return String(r > 1 ? 11 - r : r);
};

export const QUOTE_STATUS = { borrador: 'Borrador', enviada: 'Enviada', aprobada: 'Aprobada', rechazada: 'Rechazada', vencida: 'Vencida' };
export const QuoteTag = ({ status }) => <span className={`status-tag q-${status}`}>{t(QUOTE_STATUS[status] || status)}</span>;
