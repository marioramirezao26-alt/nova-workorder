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
    // Dónde estaba el técnico al iniciar y al completar (solo si la empresa lo activó y el técnico lo autorizó).
    startLocation: {
      type: {
      lat: Number,
      lng: Number,
      accuracy: Number,
      at: Date,
      distanceM: Number,
      offSite: Boolean,
    },
      default: null,
    },
    endLocation: {
      type: {
      lat: Number,
      lng: Number,
      accuracy: Number,
      at: Date,
      distanceM: Number,
      offSite: Boolean,
    },
      default: null,
    },
    // Recorrido mientras la orden está en proceso (mapa en vivo): un punto cada minuto como mucho, los últimos 200.
    // Solo con la empresa de acuerdo y el técnico con su autorización; al completar o cancelar deja de llenarse.
    trail: {
      type: [{
        _id: false,
        lat: Number,
        lng: Number,
        accuracy: Number,
        at: Date,
        distanceM: Number,
        offSite: Boolean,
      }],
      default: [],
      select: false,
    },
    // El último punto del recorrido y desde cuándo está lejos del cliente (null si está cerca o no hay datos).
    lastPoint: {
      type: {
      lat: Number,
      lng: Number,
      accuracy: Number,
      at: Date,
      distanceM: Number,
      offSite: Boolean,
    },
      default: null,
    },
    offSiteSince: {
      type: Date,
      default: null,
    },
    // Informe de servicio (Mejora 1): el checklist copiado de una plantilla, las fotos y la firma del cliente.
    checklistName: { type: String, default: '' },
    checklist: {
      type: [{
        _id: false,
        label: { type: String, required: true },
        required: { type: Boolean, default: false },
        done: { type: Boolean, default: false },
        note: { type: String, default: '', maxlength: 300 },
      }],
      default: [],
    },
    attachments: {
      type: [{
        file: { type: mongoose.Schema.Types.ObjectId, ref: 'WorkOrderFile', required: true },
        kind: { type: String, enum: ['antes', 'despues'], required: true },
        at: { type: Date, default: Date.now },
      }],
      default: [],
    },
    // Quién firmó al recibir el servicio (nombre escrito por el cliente) y el archivo con el trazo.
    signature: {
      type: {
        name: String,
        signedAt: Date,
        file: { type: mongoose.Schema.Types.ObjectId, ref: 'WorkOrderFile' },
      },
      default: null,
    },
    // La cotización aprobada de la que salió esta orden (si salió de una).
    quote: { type: mongoose.Schema.Types.ObjectId, ref: 'Quote', default: null },
    // Llave del enlace público del informe (/informe/<token>): se crea al compartirlo; sin ella no hay informe público.
    reportToken: { type: String, default: undefined },
  },
  {
    timestamps: true,
  }
);

// Índices de las consultas reales (todas empiezan por la empresa): listados por estado y fecha, «mis órdenes» del
// técnico, las órdenes de un cliente, el mapa en vivo y los reportes por fecha de cierre. Los de `updatedAt` y
// `startedAt` son para el uso que lee GABY (última actividad y técnicos activos en 7 días).
workOrderSchema.index({ tenant: 1, createdAt: -1 });
workOrderSchema.index({ tenant: 1, updatedAt: -1 });
workOrderSchema.index({ tenant: 1, startedAt: -1 });
workOrderSchema.index({ tenant: 1, status: 1, createdAt: -1 });
workOrderSchema.index({ tenant: 1, assignedTo: 1, status: 1 });
workOrderSchema.index({ tenant: 1, client: 1, createdAt: -1 });
workOrderSchema.index({ tenant: 1, completedAt: -1 });
workOrderSchema.index({ reportToken: 1 }, { unique: true, sparse: true });

// Defensa en profundidad: toda consulta de órdenes debe acotar por empresa (tenant) o fallar ruidosamente.
workOrderSchema.plugin(require('./tenantGuard'));

module.exports = mongoose.model('WorkOrder', workOrderSchema);
