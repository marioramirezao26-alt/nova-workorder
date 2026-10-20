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

export const Empty = ({ children }) => <p className="muted empty">{children}</p>;

// Plata: pesos enteros (COP) o dólares con centavos (USD).
export const money = (value, currency = 'COP') => new Intl.NumberFormat(currency === 'USD' ? 'en-US' : 'es-CO', {
  style: 'currency', currency, minimumFractionDigits: currency === 'USD' ? 2 : 0, maximumFractionDigits: currency === 'USD' ? 2 : 0,
}).format(Number(value) || 0);

// Los mismos totales que calcula el servidor (cada renglón redondeado y luego sumado), para verlos mientras se escribe.
const round = (v, currency) => (currency === 'USD' ? Math.round((Number(v) + Number.EPSILON) * 100) / 100 : Math.round(Number(v)));
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

export const QUOTE_STATUS = { borrador: 'Borrador', enviada: 'Enviada', aprobada: 'Aprobada', rechazada: 'Rechazada', vencida: 'Vencida' };
export const QuoteTag = ({ status }) => <span className={`status-tag q-${status}`}>{t(QUOTE_STATUS[status] || status)}</span>;
