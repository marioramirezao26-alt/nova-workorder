// Días de calendario en hora de Colombia (America/Bogota), sin importar la zona del celular o del computador.
// Sin JSX ni dependencias: lo prueban también las pruebas del backend (test/hora-colombia.test.js).
//
// La fecha límite de una orden (`dueDate`) es un día de calendario: el formulario manda «AAAA-MM-DD» y el servidor la
// guarda como la medianoche UTC de ese día. Su día es, entonces, el de la fecha en UTC (`calendarDay`); compararla con
// `new Date().toISOString()` (el día en UTC) la daba por vencida desde las 7 p. m. de Colombia del mismo día.

export const TZ = 'America/Bogota';

const dayFormat = new Intl.DateTimeFormat('en-CA', { timeZone: TZ, year: 'numeric', month: '2-digit', day: '2-digit' });

// El día de Colombia de un instante (hoy, si no se da), «AAAA-MM-DD».
export const colombiaDay = (date = new Date()) => {
  const p = Object.fromEntries(dayFormat.formatToParts(new Date(date)).map(({ type, value }) => [type, value]));
  return `${p.year}-${p.month}-${p.day}`;
};

// «AAAA-MM-DD» más (o menos) `days` días de calendario.
export const addDays = (day, days) => new Date(Date.parse(`${day}T00:00:00Z`) + days * 86400000).toISOString().slice(0, 10);

// El día de una fecha de calendario guardada a medianoche UTC (la fecha límite), «AAAA-MM-DD».
export const calendarDay = (value) => (value ? new Date(value).toISOString().slice(0, 10) : '');

const CLOSED = ['completada', 'cancelada'];

// Vencida: sigue abierta y el día de Colombia ya pasó su fecha límite. El mismo día de la fecha límite todavía no lo está.
export const isOverdue = (order, now = new Date()) =>
  Boolean(order && order.dueDate) && !CLOSED.includes(order.status) && calendarDay(order.dueDate) < colombiaDay(now);
