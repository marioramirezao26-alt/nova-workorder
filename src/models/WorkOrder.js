const mongoose = require('mongoose');

const workOrderSchema = new mongoose.Schema(
  {
    title: {
      type: String,
      required: [true, 'El título es obligatorio'],
      trim: true,
    },
    description: {
      type: String,
      required: [true, 'La descripción es obligatoria'],
      trim: true,
    },
    status: {
      type: String,
      enum: ['pendiente', 'en_proceso', 'completada', 'cancelada'],
      default: 'pendiente',
    },
    priority: {
      type: String,
      enum: ['baja', 'media', 'alta', 'urgente'],
      default: 'media',
    },
    // Nombre del cliente tal como se mostró al crear la orden (se toma de la ficha si viene `client`).
    customerName: {
      type: String,
      trim: true,
    },
    client: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Client',
      default: null,
    },
    // Empresa dueña del dato (multiempresa). No confundir con `company` del cliente, que es su razón social.
    tenant: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Company',
      required: [true, 'La empresa es obligatoria'],
      index: true,
    },
    assignedTo: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    dueDate: {
      type: Date,
      default: null,
    },
    notes: {
      type: String,
      default: '',
    },
    // Lo marca el técnico desde «Mis órdenes» (Fase 2).
    startedAt: {
      type: Date,
      default: null,
    },
    completedAt: {
      type: Date,
      default: null,
    },
  },
  {
    timestamps: true,
  }
);

module.exports = mongoose.model('WorkOrder', workOrderSchema);
