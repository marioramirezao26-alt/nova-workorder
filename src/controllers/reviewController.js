const Review = require('../models/Review');
const { audit } = require('../utils/audit');

const { CONSENT_TEXT, LIMITS } = Review;

// Lo que ve el administrador de la empresa en la app (su propia reseña y en qué va).
const ownView = (r) => (r ? {
  _id: r._id, name: r.name, role: r.role, city: r.city, rating: r.rating, text: r.text, companyName: r.companyName,
  status: r.status, reason: r.status === 'rechazada' ? r.reason : '', consentAt: r.consentAt, submittedAt: r.submittedAt,
  decidedAt: r.decidedAt, withdrawnAt: r.withdrawnAt,
} : null);

// Lo que lee GABY para que Mario decida (con la constancia de la autorización).
const platformView = (r) => ({
  _id: r._id, tenant: r.tenant, companyName: r.companyName, name: r.name, role: r.role, city: r.city, rating: r.rating,
  text: r.text, status: r.status, reason: r.reason, consentText: r.consentText, consentAt: r.consentAt,
  submittedAt: r.submittedAt, decidedAt: r.decidedAt, withdrawnAt: r.withdrawnAt,
});

// El mes en que la escribió, en hora de Colombia (el servidor corre en UTC): «2026-10».
const monthOf = (date) => {
  const parts = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Bogota', year: 'numeric', month: '2-digit' }).formatToParts(date);
  const get = (type) => parts.find((p) => p.type === type).value;
  return `${get('year')}-${get('month')}`;
};

// Lo único que sale en novaworkorder.com: nombre, cargo, empresa, ciudad, calificación, texto y mes.
const publicView = (r) => ({
  name: r.name, role: r.role, company: r.companyName, city: r.city, rating: r.rating, text: r.text, month: monthOf(r.submittedAt),
});

// Saltos de línea normales y sin párrafos vacíos de sobra (el resto del texto queda como lo escribió).
const cleanText = (value) => String(value || '').replace(/\r\n?/g, '\n').replace(/\n{3,}/g, '\n\n').trim();

// GET /api/company/review — la reseña de la empresa (o null), el texto de la autorización y los límites del formulario.
const getOwnReview = async (req, res) => {
  try {
    const review = await Review.findOne({ tenant: req.user.tenant });
    res.status(200).json({ review: ownView(review), consentText: CONSENT_TEXT, limits: LIMITS });
  } catch (error) {
    res.status(500).json({ message: 'No se pudo cargar tu recomendación' });
  }
};

// PUT /api/company/review — envía (o reemplaza) la reseña de la empresa. Siempre queda «pendiente»: el estado no lo
// decide la empresa. Reemplazar crea un documento nuevo (otro _id), así una aprobación pedida sobre el texto anterior
// no aprueba el nuevo sin que Mario lo lea.
const saveOwnReview = async (req, res) => {
  try {
    const now = new Date();
    const data = {
      tenant: req.user.tenant,
      companyName: req.company.name,
      name: req.body.name,
      role: req.body.role || '',
      city: req.body.city || '',
      rating: req.body.rating,
      text: cleanText(req.body.text),
      status: 'pendiente',
      consentText: CONSENT_TEXT,
      consentAt: now,
      submittedAt: now,
      submittedBy: req.user._id,
    };
    if (data.text.length < LIMITS.textMin || data.text.length > LIMITS.textMax) {
      return res.status(400).json({ message: `La opinión va de ${LIMITS.textMin} a ${LIMITS.textMax} caracteres` });
    }
    const before = await Review.findOneAndDelete({ tenant: req.user.tenant });
    const review = await Review.create(data);
    await audit(req, before ? 'resena.reemplazar' : 'resena.enviar',
      before ? 'Reemplazó la recomendación para novaworkorder.com (vuelve a revisión)' : 'Envió una recomendación para novaworkorder.com',
      { entityId: review._id });
    return res.status(before ? 200 : 201).json({ review: ownView(review), consentText: CONSENT_TEXT, limits: LIMITS });
  } catch (error) {
    if (error && error.code === 11000) return res.status(409).json({ message: 'Se envió otra recomendación al mismo tiempo. Intenta de nuevo.' });
    if (error && error.name === 'ValidationError') return res.status(400).json({ message: 'Revisa los datos de la recomendación' });
    return res.status(500).json({ message: 'No se pudo guardar tu recomendación' });
  }
};

// DELETE /api/company/review — la empresa la retira: deja de salir en la página al instante. Queda guardada como
// «retirada» (con la fecha) para que GABY sepa que no se puede volver a publicar.
const withdrawOwnReview = async (req, res) => {
  try {
    const review = await Review.findOne({ tenant: req.user.tenant });
    if (!review) return res.status(404).json({ message: 'Tu empresa no tiene una recomendación' });
    if (review.status !== 'retirada') {
      review.status = 'retirada';
      review.withdrawnAt = new Date();
      await review.save();
      await audit(req, 'resena.retirar', 'Retiró su recomendación de novaworkorder.com', { entityId: review._id });
    }
    return res.status(200).json({ review: ownView(review), consentText: CONSENT_TEXT, limits: LIMITS });
  } catch (error) {
    return res.status(500).json({ message: 'No se pudo retirar tu recomendación' });
  }
};

// GET /api/platform/reviews?status=pendiente — para GABY (llave de plataforma). Por defecto, las pendientes.
const listReviews = async (req, res) => {
  try {
    const status = Review.STATUSES.includes(req.query.status) ? req.query.status : 'pendiente';
    const items = await Review.find({ status }).sort({ submittedAt: 1 }).limit(100);
    res.status(200).json({ items: items.map(platformView) });
  } catch (error) {
    res.status(500).json({ message: 'Error al listar las reseñas' });
  }
};

// Cambia el estado solo si la reseña sigue en uno de los estados de `from` (atómico: una retirada o reemplazada en el
// camino no se publica por error).
const decide = (to, from) => async (req, res) => {
  try {
    const set = { status: to, decidedAt: new Date(), reason: to === 'rechazada' ? String(req.body?.reason || '').trim() : '' };
    const review = await Review.findOneAndUpdate({ _id: req.params.id, status: { $in: from } }, set, { new: true });
    if (review) return res.status(200).json(platformView(review));
    const current = await Review.findById(req.params.id);
    if (!current) return res.status(404).json({ message: 'Reseña no encontrada (si la empresa la reemplazó, tiene otro id)' });
    return res.status(409).json({ message: `La reseña está ${current.status}: no se puede pasar a ${to}`, status: current.status });
  } catch (error) {
    return res.status(500).json({ message: 'No se pudo cambiar la reseña' });
  }
};
// POST /api/platform/reviews/:id/approve — solo una pendiente.
const approveReview = decide('aprobada', ['pendiente']);
// POST /api/platform/reviews/:id/reject — una pendiente, o una aprobada que Mario decide despublicar.
const rejectReview = decide('rechazada', ['pendiente', 'aprobada']);

// GET /api/public/reviews — las aprobadas para novaworkorder.com, sin datos de contacto. Caché corta: una aprobación
// o un retiro se ven en la página en unos minutos.
const PUBLIC_LIMIT = 12;
const publicReviews = async (req, res) => {
  try {
    const items = await Review.find({ status: 'aprobada' }).sort({ decidedAt: -1 }).limit(PUBLIC_LIMIT);
    res.set('Cache-Control', 'public, max-age=300');
    res.status(200).json({ items: items.map(publicView) });
  } catch (error) {
    res.set('Cache-Control', 'no-store');
    res.status(500).json({ items: [] });
  }
};

module.exports = {
  getOwnReview, saveOwnReview, withdrawOwnReview, listReviews, approveReview, rejectReview, publicReviews, monthOf,
};
