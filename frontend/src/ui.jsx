// Piezas compartidas por las pantallas.
export const STATUS = {
  pendiente: 'Pendiente',
  en_proceso: 'En proceso',
  completada: 'Completada',
  cancelada: 'Cancelada',
};
export const PRIORITY = { baja: 'Baja', media: 'Media', alta: 'Alta', urgente: 'Urgente' };
export const ROLE = { admin: 'Administrador', tecnico: 'Técnico', cliente: 'Cliente' };

export const StatusTag = ({ status }) => <span className={`status-tag ${status}`}>{STATUS[status] || status}</span>;

export const PriorityTag = ({ priority }) =>
  priority === 'alta' || priority === 'urgente' ? <span className={`priority-tag ${priority}`}>{PRIORITY[priority]}</span> : null;

// Fechas de calendario (fecha límite): se muestran tal cual se guardaron, sin correr el día por la zona horaria.
export const formatDay = (value) =>
  value ? new Date(value).toLocaleDateString('es-CO', { timeZone: 'UTC', day: 'numeric', month: 'short' }) : '';

export const formatDateTime = (value) =>
  value ? new Date(value).toLocaleString('es-CO', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }) : '';

export const isOverdue = (order) =>
  order.dueDate && !['completada', 'cancelada'].includes(order.status)
  && new Date(order.dueDate).toISOString().slice(0, 10) < new Date().toISOString().slice(0, 10);

export const mapsLink = (address) => `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(address)}`;

export const Empty = ({ children }) => <p className="muted empty">{children}</p>;
