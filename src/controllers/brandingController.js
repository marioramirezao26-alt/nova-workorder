const Company = require('../models/Company');
const { parseBranding, publicBranding } = require('../utils/branding');

// PUT /api/company/branding — solo el administrador: colores y logo de su empresa. logo: null lo quita.
const updateBranding = async (req, res) => {
  try {
    const parsed = parseBranding(req.body);
    if (parsed.error) return res.status(400).json({ message: parsed.error });
    const company = await Company.findById(req.company._id).select('+branding.logo');
    const b = company.branding || {};
    const v = parsed.value;
    if (v.primary !== undefined) b.primary = v.primary;
    if (v.accent !== undefined) b.accent = v.accent;
    if (v.logo !== undefined) {
      b.logo = v.logo ? v.logo.data : null;
      b.logoType = v.logo ? v.logo.type : null;
    }
    b.updatedAt = new Date();
    company.branding = b;
    await company.save();
    return res.status(200).json(publicBranding(company));
  } catch (error) {
    return res.status(500).json({ message: 'No se pudo guardar la marca' });
  }
};

// GET /api/public/logo/:id — el logo de una empresa (público: es lo que muestra su app; nunca un dato privado).
const getLogo = async (req, res) => {
  try {
    const company = await Company.findById(req.params.id).select('+branding.logo branding.logoType');
    const b = company && company.branding;
    if (!b || !b.logo || !b.logoType) return res.status(404).json({ message: 'Sin logo' });
    res.set({ 'Content-Type': b.logoType, 'Cache-Control': 'public, max-age=86400', 'Content-Security-Policy': "default-src 'none'" });
    return res.status(200).send(b.logo);
  } catch (error) {
    return res.status(404).json({ message: 'Sin logo' });
  }
};

module.exports = { updateBranding, getLogo };
