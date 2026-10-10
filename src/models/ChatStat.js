const mongoose = require('mongoose');

// El chat de la página de ventas, contado por día (hora de Colombia): conversaciones y mensajes. Sirve de tope de gasto
// diario. No se guarda lo que escribe el visitante, ni su IP, ni nada que lo identifique.
const chatStatSchema = new mongoose.Schema(
  {
    day: { type: String, required: true, unique: true },        // YYYY-MM-DD en Colombia (UTC-5)
    conversations: { type: Number, default: 0 },
    messages: { type: Number, default: 0 },
  },
  { timestamps: false, versionKey: false }
);

module.exports = mongoose.model('ChatStat', chatStatSchema);
