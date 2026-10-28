const mongoose = require('mongoose');

// El código de la ficha de GABY que trae el enlace de prueba (?l=): letras y números, de 8 a 32.
const LEAD_TOKEN = /^[A-Za-z0-9]{8,32}$/;

// Una empresa que pidió una demo desde la página de ventas (novaworkorder.com). GABY las lee por la API de plataforma,
// las convierte en prospectos de NOVA · Ventas y las marca como recibidas.
const demoRequestSchema = new mongoose.Schema(
  {
    company: { type: String, required: true, trim: true, maxlength: 150 },
    name: { type: String, required: true, trim: true, maxlength: 100 },
    email: { type: String, required: true, trim: true, lowercase: true, maxlength: 200 },
    phone: { type: String, trim: true, maxlength: 40, default: '' },
    // App que le interesa: servicios (órdenes de trabajo, app.novaworkorder.com) o pedidos (tienda al detal).
    product: { type: String, enum: ['servicios', 'pedidos'], default: 'servicios' },
    // Idioma de la página donde la pidió: es (Colombia, novaworkorder.com) o en (Estados Unidos, novaworkorder.com/en).
    // GABY lo usa para atenderla en inglés y en dólares.
    lang: { type: String, enum: ['es', 'en'], default: 'es' },
    // Mercado (dónde está el negocio y cómo se le cobra), aparte del idioma: co (Colombia, pesos), us (Estados Unidos,
    // dólares por PayPal) o mx (México, pesos mexicanos por PayPal). /en/ siempre es us; /es-us/ es us en español;
    // /es-mx/ es mx. GABY lo lee para cobrarle en su moneda.
    market: { type: String, enum: ['co', 'us', 'mx'], default: 'co' },
    technicians: { type: Number, min: 1, max: 10000, default: null },
    message: { type: String, trim: true, maxlength: 1000, default: '' },
    source: { type: String, trim: true, maxlength: 60, default: 'web' },
    // Canal por el que llegó a la página (instagram, facebook, linkedin, tiktok, youtube, whatsapp, buscador, correo, directo, otro).
    channel: { type: String, trim: true, maxlength: 20, default: null },
    // Código de recomendación del cliente que compartió su enlace (?ref=…): GABY le regala un mes cuando este pague.
    referral: { type: String, trim: true, lowercase: true, maxlength: 20, default: null },
    // La ficha de GABY de quien llegó con el enlace de prueba del chat (?l=…): un código opaco (no dice quién es), corto y
    // solo con letras y números. GABY une la prueba a esa ficha antes que por correo o celular.
    leadToken: { type: String, trim: true, maxlength: 32, match: LEAD_TOKEN, default: null },
    // demo: quiere que le muestren la app · prueba: quiere empezar ya; GABY le crea la cuenta y le envía el acceso.
    kind: { type: String, enum: ['demo', 'prueba'], default: 'demo' },
    // Una prueba exige aceptar los términos y la política de privacidad: cuándo los aceptó.
    consentAt: { type: Date, default: null },
    // nueva: aún no la lee GABY · recibida: ya es un prospecto en NOVA · Ventas
    status: { type: String, enum: ['nueva', 'recibida'], default: 'nueva', index: true },
    receivedAt: { type: Date, default: null },
  },
  { timestamps: true }
);

module.exports = mongoose.model('DemoRequest', demoRequestSchema);
module.exports.LEAD_TOKEN = LEAD_TOKEN;
