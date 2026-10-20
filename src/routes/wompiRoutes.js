const express = require('express');
const Company = require('../models/Company');
const wompi = require('../services/wompi');
const { applyTransaction } = require('../services/quotePayments');

// Eventos de Wompi (la URL que cada empresa pone en su panel de Wompi): solo valen con la firma de SU secreto de eventos.
const router = express.Router();

router.post('/:slug/eventos', async (req, res) => {
  try {
    const slug = String(req.params.slug || '').toLowerCase();
    if (!/^[a-z0-9-]{1,80}$/.test(slug)) return res.status(404).json({ message: 'Empresa sin Wompi' });
    const company = await Company.findOne({ slug }).select('+wompi.eventsSealed');
    if (!company || !company.wompi || !company.wompi.publicKey) return res.status(404).json({ message: 'Empresa sin Wompi' });
    if (!wompi.validEvent(req.body, wompi.openEvents(company))) return res.status(401).json({ message: 'Firma inválida' });
    if (req.body.event === 'transaction.updated') {
      await applyTransaction(company, req.body.data && req.body.data.transaction);
      await Company.updateOne({ _id: company._id }, { $set: { 'wompi.lastEventAt': new Date() } });
    }
    return res.status(200).json({ ok: true });
  } catch (error) {
    return res.status(500).json({ message: 'No se pudo procesar el evento' });
  }
});

module.exports = router;
