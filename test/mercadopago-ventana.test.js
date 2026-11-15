// Orden 41: la vigencia del ts de la firma, igual a la de GABY-OS (Orden 37): 15 días atrás (configurable) y 5 minutos adelante.
const { test, afterEach } = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('crypto');
const mp = require('../src/services/mercadopago');

const SECRET = 'claveSecretaDePruebasDeLaEmpresa01';
const firma = (ts, dataId = '123', requestId = 'r-1') => {
  const text = mp.manifest({ dataId, requestId, ts: String(ts) });
  return `ts=${ts},v1=${crypto.createHmac('sha256', SECRET).update(text).digest('hex')}`;
};
const vale = (ts, now) => mp.validSignature({ header: firma(ts), requestId: 'r-1', dataId: '123', secret: SECRET, now });
afterEach(() => { delete process.env.MERCADOPAGO_FIRMA_ANTIGUEDAD_MAX_S; });

test('un reintento de Mercado Pago con el ts de hace días sigue valiendo; uno de hace más de 15 días o adelantado no', () => {
  const now = Date.UTC(2026, 10, 15, 12, 0, 0);
  const s = Math.floor(now / 1000);
  assert.equal(vale(s, now), true);
  assert.equal(vale(s - 3 * 86400, now), true);              // reintento de hace 3 días
  assert.equal(vale(s - 15 * 86400, now), true);             // el borde
  assert.equal(vale(s - 15 * 86400 - 1, now), false);
  assert.equal(vale(s + 5 * 60, now), true);                 // relojes: hasta 5 minutos adelante
  assert.equal(vale(s + 5 * 60 + 1, now), false);
  assert.equal(vale((s - 3 * 86400) * 1000, now), true);     // en milisegundos también
});

test('MERCADOPAGO_FIRMA_ANTIGUEDAD_MAX_S ajusta la antigüedad (60 s a 30 días); otro valor deja los 15 días', () => {
  const now = Date.UTC(2026, 10, 15, 12, 0, 0);
  const s = Math.floor(now / 1000);
  process.env.MERCADOPAGO_FIRMA_ANTIGUEDAD_MAX_S = '600';
  assert.equal(vale(s - 599, now), true);
  assert.equal(vale(s - 601, now), false);
  for (const raro of ['59', String(31 * 86400), 'diez', '1.5', '']) {
    process.env.MERCADOPAGO_FIRMA_ANTIGUEDAD_MAX_S = raro;
    assert.equal(mp.signatureMaxAgeMs(), 15 * 86400 * 1000, raro);
  }
});
