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

export const isOverdue = (order) =>
  order.dueDate && !['completada', 'cancelada'].includes(order.status)
  && new Date(order.dueDate).toISOString().slice(0, 10) < new Date().toISOString().slice(0, 10);

export const mapsLink = (address) => `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(address)}`;

// Enlace de WhatsApp al cliente con el indicativo del país de la empresa (`lang`): en (EE. UU.) +1 a los números de 10
// dígitos; es (Colombia) +57 a los celulares de 10 dígitos que empiezan por 3. Un número con «+» o «00» ya trae su
// indicativo. Si no se sabe con certeza a qué país va (un fijo, un número incompleto), WhatsApp se abre sin número para
// elegir el contacto, en vez de mandarle el mensaje a un desconocido.
export const whatsappLink = (phone, text, lang = 'es') => {
  const raw = String(phone || '').trim();
  const d = raw.replace(/\D/g, '');
  let number = '';
  if (/^(\+|00)/.test(raw)) number = raw.startsWith('00') ? d.slice(2) : d;
  else if (lang === 'en') number = d.length === 10 && /^[2-9]/.test(d) ? `1${d}` : (d.length === 11 && d.startsWith('1') ? d : '');
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
export const novaLink = (source, companyName, lang = 'es') => {
  const ref = refCode(companyName);
  return `https://novaworkorder.com/${lang === 'en' ? 'en/' : ''}?utm_source=${source}${ref ? `&ref=${ref}` : ''}`;
};

export const Empty = ({ children }) => <p className="muted empty">{children}</p>;

// Plata: pesos enteros (COP) o dólares con centavos (USD).
export const money = (value, currency = 'COP') => new Intl.NumberFormat(currency === 'USD' ? 'en-US' : 'es-CO', {
  style: 'currency', currency, minimumFractionDigits: currency === 'USD' ? 2 : 0, maximumFractionDigits: currency === 'USD' ? 2 : 0,
}).format(Number(value) || 0);

// Los mismos totales que calcula el servidor (cada renglón redondeado y luego sumado), para verlos mientras se escribe.
// El mismo redondeo de src/utils/money.js: sin el ruido del punto flotante (85 × 9,5 % = 8,08, no 8,07).
const round = (v, currency) => {
  const scale = currency === 'USD' ? 100 : 1;
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
