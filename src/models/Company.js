const mongoose = require('mongoose');

// Cada empresa que compra NOVA WORKORDER es una "empresa": sus usuarios, clientes y órdenes viven aislados del resto.
const companySchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, 'El nombre de la empresa es obligatorio'],
      trim: true,
      maxlength: 150,
    },
    slug: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
    },
    // prueba: periodo de prueba · activa: al día · suspendida: sin acceso (por ejemplo, pago vencido)
    status: {
      type: String,
      enum: ['prueba', 'activa', 'suspendida'],
      default: 'activa',
    },
    // Técnicos activos que permite el plan; null = sin límite.
    maxTechnicians: {
      type: Number,
      default: null,
      min: 0,
    },
    contactEmail: {
      type: String,
      default: '',
      lowercase: true,
      trim: true,
    },
    // Idioma de la app para toda la empresa: es (Colombia) o en (Estados Unidos). Cada usuario puede cambiarlo en su
    // celular; esto es solo el idioma con el que arranca.
    lang: {
      type: String,
      enum: ['es', 'en'],
      default: 'es',
    },
    // Mercado, aparte del idioma: co (Colombia: pesos, IVA, Wompi y Factus), us (Estados Unidos: dólares, hora del Este)
    // o mx (México: pesos mexicanos, IVA del 16 %, hora de Ciudad de México, celulares +52). Una empresa de /es-us/ es us
    // y una de /es-mx/ es mx, las dos con la app en español. Las empresas en inglés de antes (lang en) cuentan como us.
    market: {
      type: String,
      enum: ['co', 'us', 'mx'],
      default: 'co',
    },
    // Registrar la ubicación del técnico al iniciar y al completar cada orden (lo activa el administrador; cada
    // técnico además la autoriza en su celular).
    locationTracking: {
      type: Boolean,
      default: false,
    },
    // Mapa en vivo: dónde va cada técnico mientras tiene una orden en proceso (aparte del anterior; cada técnico
    // también lo autoriza por separado).
    liveTracking: {
      type: Boolean,
      default: false,
    },
    // Informe de servicio: el técnico no puede completar una orden sin la firma del cliente (lo activa el administrador).
    requireSignature: {
      type: Boolean,
      default: false,
    },
    // Cobro en línea con Wompi (la cuenta de la empresa): llave pública, secretos cifrados y qué porcentaje de una
    // cotización aprobada se cobra en línea (100 = todo; 50 = anticipo del 50 %).
    wompi: {
      publicKey: { type: String, default: '' },
      integritySealed: { type: String, default: '', select: false },
      eventsSealed: { type: String, default: '', select: false },
      merchantName: { type: String, default: '' },
      depositPercent: { type: Number, default: 100, min: 10, max: 100 },
      connectedAt: { type: Date, default: null },
      lastEventAt: { type: Date, default: null },
    },
    // Factura electrónica DIAN con Factus (la cuenta de la empresa): ambiente, credenciales cifradas y rango de numeración.
    factus: {
      env: { type: String, enum: ['pruebas', 'produccion'], default: 'pruebas' },
      clientId: { type: String, default: '' },
      clientSecretSealed: { type: String, default: '', select: false },
      username: { type: String, default: '' },
      passwordSealed: { type: String, default: '', select: false },
      numberingRangeId: { type: Number, default: null },
      connectedAt: { type: Date, default: null },
    },
    // Cuenta de demostración (src/scripts/crearDemoServicios.js, para grabar videos): datos inventados, no es un cliente.
    // La API de plataforma no la lista para GABY (ni uso, ni cobros, ni crecimiento) y, pedida por su id, sale marcada.
    demo: {
      type: Boolean,
      default: false,
      index: true,
    },
    // Último ingreso (login) de cualquier usuario de la empresa, para el uso que lee GABY. Se escribe como mucho una vez
    // por minuto (ver authController) y no toca `updatedAt`.
    lastLoginAt: {
      type: Date,
      default: null,
    },
    // Consecutivo de las cotizaciones de la empresa (#1, #2…).
    quoteSeq: {
      type: Number,
      default: 0,
    },
    // «Mi marca»: el logo y los colores que la empresa ve en su app (los pone su administrador).
    branding: {
      primary: { type: String, default: null },
      accent: { type: String, default: null },
      logo: { type: Buffer, default: null, select: false },
      logoType: { type: String, default: null },
      updatedAt: { type: Date, default: null },
    },
  },
  {
    timestamps: true,
  }
);

module.exports = mongoose.model('Company', companySchema);
