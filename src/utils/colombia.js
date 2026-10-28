// Días de calendario en hora de Colombia (America/Bogota). El servidor corre en UTC: «hoy», los reportes por día y
// «válida hasta» se calculan aquí, nunca con la zona del servidor ni con `toISOString()` del instante.
// Es la misma regla que frontend/src/dates.js en la interfaz.

const TZ = 'America/Bogota';
const OFFSET = '-05:00';                       // Colombia no tiene horario de verano

const dayFormat = new Intl.DateTimeFormat('en-CA', { timeZone: TZ, year: 'numeric', month: '2-digit', day: '2-digit' });

// El día de Colombia de un instante (ahora, si no se da), «AAAA-MM-DD».
const colombiaDay = (date = new Date()) => {
  const p = Object.fromEntries(dayFormat.formatToParts(new Date(date)).map(({ type, value }) => [type, value]));
  return `${p.year}-${p.month}-${p.day}`;
};

// «AAAA-MM-DD» más (o menos) `days` días de calendario.
const addDays = (day, days) => new Date(Date.parse(`${day}T00:00:00Z`) + days * 86400000).toISOString().slice(0, 10);

// Primer y último instante de un día de Colombia.
const startOfDay = (day) => new Date(`${day}T00:00:00.000${OFFSET}`);
const endOfDay = (day) => new Date(`${day}T23:59:59.999${OFFSET}`);

module.exports = { TZ, colombiaDay, addDays, startOfDay, endOfDay };
