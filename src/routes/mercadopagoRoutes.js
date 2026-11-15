const express = require('express');
const Company = require('../models/Company');
const mp = require('../services/mercadopago');
const { applyMercadoPago } = require('../services/quotePayments');

// Avisos de Mercado Pago (la URL que cada empresa pone en su cuenta: «Tus integraciones» → Webhooks, evento Pagos). Uno
// por empresa: el slug dice de cuál, y solo vale con la firma de SU clave secreta. Del aviso solo se usa el id del pago
// (el que va firmado); el pago se consulta a la API con el token de esa empresa y se decide con lo que responda.
const router = express.Router();

// El id que firmó Mercado Pago: el `data.id` de la dirección. Si el cuerpo trae otro, el aviso no vale.
const dataIdFrom = (req) => {
  const q = req.query || {};
  const fromUrl = q['data.id'] ?? (q.data && typeof q.data === 'object' ? q.data.id : undefined);
  const fromBody = req.body && req.body.data && typeof req.body.data === 'object' ? req.body.data.id : undefined;
  const id = fromUrl ?? fromBody;
  if (id === undefined || id === null || typeof id === 'object') return { id: '' };
  if (fromUrl !== undefined && fromBody !== undefined && String(fromUrl) !== String(fromBody)) return { id: '', clash: true };
  return { id: String(id).trim() };
};

router.post('/:slug/avisos', async (req, res) => {
  try {
    if (!mp.enabled()) return res.status(404).json({ message: mp.OFF });
    const slug = String(req.params.slug || '').toLowerCase();
    if (!/^[a-z0-9-]{1,80}$/.test(slug)) return res.status(404).json({ message: 'Empresa sin Mercado Pago' });
    const company = await Company.findOne({ slug }).select('+mercadopago.accessTokenSealed +mercadopago.webhookSecretSealed');
    if (!company || !mp.connected(company)) return res.status(404).json({ message: 'Empresa sin Mercado Pago' });
    const { id, clash } = dataIdFrom(req);
    if (clash) return res.status(400).json({ message: 'El aviso trae dos pagos distintos' });
    const signed = mp.validSignature({ header: req.get('x-signature'), requestId: req.get('x-request-id'), dataId: id, secret: mp.openSecret(company) });
    if (!signed) return res.status(401).json({ message: 'Firma inválida' });
    const type = String(req.query.type || req.query.topic || (req.body && req.body.type) || '');
    if (type !== 'payment') return res.status(200).json({ ok: true, ignorado: true });   // otros eventos: nada que hacer
    if (!/^\d{1,20}$/.test(id)) return res.status(400).json({ message: 'El id del pago no es válido' });
    // una cuenta que el servidor ya no deja usar (por ejemplo APP_USR- sin MERCADOPAGO_PRODUCCION): no se consulta nada
    if (!mp.usable(company)) return res.status(409).json({ message: mp.TEST_ONLY });
    let pay;
    try {
      pay = await mp.fetchPayment(company, id);
    } catch (error) {
      if (!(error instanceof mp.MercadoPagoError)) throw error;
      return res.status(502).json({ message: 'No se pudo consultar el pago en Mercado Pago' });   // Mercado Pago reintenta
    }
    const { result } = await applyMercadoPago(company, pay);
    await Company.updateOne({ _id: company._id }, { $set: { 'mercadopago.lastEventAt': new Date() } });
    return res.status(200).json({ ok: true, result });
  } catch (error) {
    return res.status(500).json({ message: 'No se pudo procesar el aviso' });
  }
});

module.exports = router;
