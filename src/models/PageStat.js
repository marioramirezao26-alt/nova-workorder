const mongoose = require('mongoose');

const MARKETS = ['co', 'us', 'us-en', 'mx'];
const OLD_INDEX = 'day_1_path_1_channel_1_device_1_event_1';
const INDEX = 'dia_ruta_canal_equipo_evento_mercado';

// Analítica de la página de ventas, sin cookies y sin datos personales: solo contadores por día (hora de Colombia),
// página, canal, tipo de equipo y mercado (el país de la página, sacado de la ruta; nunca de la IP). No se guarda la IP, el navegador ni ningún identificador del visitante.
const pageStatSchema = new mongoose.Schema(
  {
    day: { type: String, required: true },                        // YYYY-MM-DD en Colombia (UTC-5)
    path: { type: String, required: true, maxlength: 60 },
    channel: { type: String, required: true, maxlength: 20 },
    device: { type: String, enum: ['movil', 'pc'], required: true },
    // visita: abrió la página · clic: tocó «Empieza gratis» o «Pide tu demo» (una vez por visita)
    event: { type: String, enum: ['visita', 'clic'], required: true },
    // co: novaworkorder.com/ · us: /es-us/ (EE. UU. en español) · us-en: /en/ (EE. UU. en inglés) · mx: /es-mx/.
    // Los contadores de antes de este campo no lo tienen (ver marketOfStat en analyticsController).
    market: { type: String, enum: MARKETS },
    count: { type: Number, default: 0 },
  },
  { timestamps: false, versionKey: false }
);

// Un contador por día, página, canal, equipo, evento y mercado. Lleva otro nombre que el índice viejo (sin mercado):
// con el viejo puesto, la primera visita de un mercado chocaría con la de otro el mismo día.
pageStatSchema.index({ day: 1, path: 1, channel: 1, device: 1, event: 1, market: 1 }, { unique: true, name: INDEX });

const PageStat = mongoose.model('PageStat', pageStatSchema);

// Al arrancar: quita el índice viejo (sin mercado) y crea el nuevo. Es idempotente y no toca los datos.
PageStat.syncMarketIndex = async () => {
  const indexes = await PageStat.collection.indexes().catch(() => []);
  if (indexes.some((i) => i.name === OLD_INDEX)) {
    await PageStat.collection.dropIndex(OLD_INDEX);
    console.log('Analítica: índice de contadores cambiado (ahora separa por mercado)');
  }
  await PageStat.createIndexes();
};

PageStat.MARKETS = MARKETS;
PageStat.OLD_INDEX = OLD_INDEX;

module.exports = PageStat;
