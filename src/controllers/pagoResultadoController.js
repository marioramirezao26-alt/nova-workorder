// Orden 65: el resultado de un pago de Mercado Pago para la página /pago/resultado (landing/pago/resultado.html), a la
// que Mercado Pago devuelve a la persona después de pagar una mensualidad. Este servidor es un proxy hacia GABY
// (`GET /api/mercadopago/resultado`, mismo servidor), que consulta el pago a Mercado Pago y responde solo el estado:
// aprobado | pendiente | rechazado | desconocido. Nunca se confía en el `status` que Mercado Pago pone en la URL de
// retorno (cualquiera puede escribirlo) y nunca se devuelve nada de quien paga. Sin GABY_MP_RESULTADO_KEY, 503.
const DEFAULT_URL = 'http://127.0.0.1:8000/api/mercadopago/resultado';
const TIMEOUT_MS = 25000;                 // GABY le pregunta a Mercado Pago con 20 s de espera: margen
const ID = /^\d{1,20}$/;
const REF = /^[A-Za-z0-9._:-]{1,120}$/;
const ESTADOS = ['aprobado', 'pendiente', 'rechazado', 'desconocido'];

const url = () => String(process.env.GABY_MP_RESULTADO_URL || DEFAULT_URL).replace(/\/+$/, '');
const key = () => process.env.GABY_MP_RESULTADO_KEY || '';

// GET /api/public/pago/resultado?payment_id=&referencia= → { estado }
const resultadoPago = async (req, res) => {
  const pid = typeof req.query.payment_id === 'string' ? req.query.payment_id.trim() : '';
  const ref = typeof req.query.referencia === 'string' ? req.query.referencia.trim() : '';
  if (!ID.test(pid) || !REF.test(ref)) return res.status(400).json({ message: 'Faltan los datos del pago' });
  if (!key()) return res.status(503).json({ estado: 'desconocido', message: 'La consulta del pago no está disponible' });
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), TIMEOUT_MS);
  try {
    const r = await fetch(`${url()}?payment_id=${encodeURIComponent(pid)}&referencia=${encodeURIComponent(ref)}`, {
      headers: { 'x-mp-resultado-key': key(), Accept: 'application/json' },
      signal: ctrl.signal,
    });
    let data = {};
    try { data = await r.json(); } catch { data = {}; }
    const estado = r.ok && data && ESTADOS.includes(data.estado) ? data.estado : 'desconocido';
    return res.json({ estado });
  } catch {
    return res.json({ estado: 'desconocido' });    // GABY no responde: la página dice que vuelva a consultar
  } finally {
    clearTimeout(timer);
  }
};

module.exports = { resultadoPago };
