// Informe de servicio (Mejora 1): plantillas de checklist, fotos de antes y después, firma del cliente, reglas para
// completar y el enlace público del informe.
const { test, before, after, beforeEach } = require('node:test');
const assert = require('node:assert/strict');
const { start, stop, reset, call, company, login, origin } = require('./helpers');

before(start);
after(stop);
beforeEach(reset);

// Imágenes mínimas válidas: un JPEG (solo la cabecera basta para reconocerlo) y un PNG de 1×1.
const JPEG = Buffer.concat([Buffer.from([0xff, 0xd8, 0xff, 0xe0]), Buffer.alloc(200, 7)]);
const PNG_1PX = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==', 'base64');
const FIRMA = `data:image/png;base64,${PNG_1PX.toString('base64')}`;

const raw = async (method, path, { as, body, type } = {}) => {
  const headers = {};
  if (as) headers.Authorization = `Bearer ${as}`;
  if (type) headers['Content-Type'] = type;
  const res = await fetch(`${origin()}/api${path}`, { method, headers, body });
  const buf = Buffer.from(await res.arrayBuffer());
  let data = null;
  try { data = JSON.parse(buf.toString()); } catch { data = buf; }
  return { status: res.status, data, type: res.headers.get('content-type') };
};

const setup = async (name = 'Frío Ruta') => {
  const a = await company(name);
  const slug = name.toLowerCase().replace(/\W+/g, '');
  const made = await call('POST', '/users', { as: a.token, body: { name: 'Ana Técnica', email: `ana@${slug}.com`, role: 'tecnico' } });
  const tech = await login(`ana@${slug}.com`, made.data.temporaryPassword);
  const other = await call('POST', '/users', { as: a.token, body: { name: 'Beto Técnico', email: `beto@${slug}.com`, role: 'tecnico' } });
  const beto = await login(`beto@${slug}.com`, other.data.temporaryPassword);
  const client = (await call('POST', '/clients', { as: a.token, body: { name: 'Hotel Norte', email: `hotel@${slug}.com`, address: 'Cra 15 # 93' } })).data;
  const order = (await call('POST', '/workorders', { as: a.token,
    body: { title: 'Mantenimiento aire', description: 'Mantenimiento preventivo', client: client._id, assignedTo: made.data.user._id } })).data;
  const template = await call('POST', '/checklists', { as: a.token, body: { name: 'Mantenimiento de aire', items: [
    { label: 'Limpiar filtros', required: true }, { label: 'Medir presión del gas', required: true }, { label: 'Revisar desagüe' },
  ] } });
  return { a, tech, beto, order, template: template.data, templateStatus: template.status };
};

test('el administrador arma plantillas; el técnico las ve pero no las cambia; otra empresa no las ve', async () => {
  const { a, tech, template, templateStatus } = await setup();
  assert.equal(templateStatus, 201);
  assert.equal(template.items.length, 3);
  assert.equal((await call('GET', '/checklists', { as: tech })).data.items.length, 1);
  assert.equal((await call('POST', '/checklists', { as: tech, body: { name: 'X', items: [{ label: 'a' }] } })).status, 403);
  assert.equal((await call('POST', '/checklists', { as: a.token, body: { name: 'Vacía', items: [] } })).status, 400);
  const b = await company('Otra Empresa');
  assert.equal((await call('GET', '/checklists', { as: b.token })).data.items.length, 0);
  assert.equal((await call('PUT', `/checklists/${template._id}`, { as: b.token, body: { name: 'Robada' } })).status, 404);
  // desactivada: el técnico ya no la ve, el administrador sí con ?all=1
  await call('PUT', `/checklists/${template._id}`, { as: a.token, body: { active: false } });
  assert.equal((await call('GET', '/checklists', { as: tech })).data.items.length, 0);
  assert.equal((await call('GET', '/checklists?all=1', { as: a.token })).data.items.length, 1);
});

test('sin los puntos obligatorios marcados no se completa; con ellos sí', async () => {
  const { tech, order, template } = await setup();
  const put = await call('PUT', `/workorders/${order._id}/checklist`, { as: tech, body: { template: template._id } });
  assert.equal(put.status, 200);
  assert.equal(put.data.checklistName, 'Mantenimiento de aire');
  assert.equal(put.data.checklist.length, 3);
  const blocked = await call('PATCH', `/workorders/${order._id}/status`, { as: tech, body: { status: 'completada' } });
  assert.equal(blocked.status, 409);
  assert.match(blocked.data.message, /Limpiar filtros/);
  assert.equal((await call('PATCH', `/workorders/${order._id}/checklist`, { as: tech, body: { items: [{ done: true }] } })).status, 400);
  const marked = await call('PATCH', `/workorders/${order._id}/checklist`, { as: tech,
    body: { items: [{ done: true }, { done: true, note: '62 psi' }, { done: false }] } });
  assert.equal(marked.data.checklist[1].note, '62 psi');
  const done = await call('PATCH', `/workorders/${order._id}/status`, { as: tech, body: { status: 'completada' } });
  assert.equal(done.status, 200);
  // ya completada, el técnico no la cambia (el administrador sí)
  assert.equal((await call('PATCH', `/workorders/${order._id}/checklist`, { as: tech, body: { items: [{}, {}, {}] } })).status, 409);
});

test('fotos de antes y después: solo imágenes reales, con peso y cupo; otro técnico u otra empresa no las tocan', async () => {
  const { a, tech, beto, order } = await setup();
  const up = await raw('POST', `/workorders/${order._id}/files?kind=antes`, { as: tech, body: JPEG, type: 'image/jpeg' });
  assert.equal(up.status, 201);
  assert.equal(up.data.attachments.length, 1);
  assert.equal(up.data.attachments[0].kind, 'antes');
  const fileId = up.data.attachments[0].file;
  // un archivo que dice ser JPEG pero no lo es
  assert.equal((await raw('POST', `/workorders/${order._id}/files?kind=antes`, { as: tech, body: Buffer.from('<script>alert(1)</script>'), type: 'image/jpeg' })).status, 400);
  assert.equal((await raw('POST', `/workorders/${order._id}/files`, { as: tech, body: JPEG, type: 'image/jpeg' })).status, 400);
  assert.equal((await raw('POST', `/workorders/${order._id}/files?kind=despues`, { as: tech, body: Buffer.concat([JPEG, Buffer.alloc(420 * 1024)]), type: 'image/jpeg' })).status, 413);
  assert.equal((await raw('POST', `/workorders/${order._id}/files?kind=despues`, { as: beto, body: JPEG, type: 'image/jpeg' })).status, 403);
  const b = await company('Otra Empresa');
  assert.equal((await raw('GET', `/workorders/${order._id}/files/${fileId}`, { as: b.token })).status, 404);
  const got = await raw('GET', `/workorders/${order._id}/files/${fileId}`, { as: a.token });
  assert.equal(got.status, 200);
  assert.equal(got.type, 'image/jpeg');
  assert.ok(got.data.equals(JPEG));
  // cupo de 12 fotos
  for (let i = 1; i < 12; i += 1) {
    assert.equal((await raw('POST', `/workorders/${order._id}/files?kind=despues`, { as: tech, body: JPEG, type: 'image/jpeg' })).status, 201);
  }
  assert.equal((await raw('POST', `/workorders/${order._id}/files?kind=despues`, { as: tech, body: JPEG, type: 'image/jpeg' })).status, 409);
  const del = await call('DELETE', `/workorders/${order._id}/files/${fileId}`, { as: tech });
  assert.equal(del.status, 200);
  assert.equal(del.data.attachments.length, 11);
  assert.equal((await raw('GET', `/workorders/${order._id}/files/${fileId}`, { as: a.token })).status, 404);
});

test('firma del cliente: obligatoria si la empresa la pide (para el técnico), y reemplazable', async () => {
  const { a, tech, order } = await setup();
  assert.equal((await call('PUT', '/company/require-signature', { as: tech, body: { enabled: true } })).status, 403);
  const on = await call('PUT', '/company/require-signature', { as: a.token, body: { enabled: true } });
  assert.equal(on.data.company.requireSignature, true);
  const blocked = await call('PATCH', `/workorders/${order._id}/status`, { as: tech, body: { status: 'completada' } });
  assert.equal(blocked.status, 409);
  assert.match(blocked.data.message, /firma/);
  assert.equal((await call('POST', `/workorders/${order._id}/signature`, { as: tech, body: { name: 'Carlos Pérez', image: 'data:image/png;base64,AAAA' } })).status, 400);
  assert.equal((await call('POST', `/workorders/${order._id}/signature`, { as: tech, body: { name: '', image: FIRMA } })).status, 400);
  const first = await call('POST', `/workorders/${order._id}/signature`, { as: tech, body: { name: 'Carlos Pérez', image: FIRMA } });
  assert.equal(first.status, 200);
  assert.equal(first.data.signature.name, 'Carlos Pérez');
  const second = await call('POST', `/workorders/${order._id}/signature`, { as: tech, body: { name: 'Carlos A. Pérez', image: FIRMA } });
  assert.notEqual(String(second.data.signature.file), String(first.data.signature.file));
  assert.equal((await raw('GET', `/workorders/${order._id}/files/${first.data.signature.file}`, { as: a.token })).status, 404);   // la anterior se borró
  assert.equal((await call('PATCH', `/workorders/${order._id}/status`, { as: tech, body: { status: 'completada' } })).status, 200);
});

test('el informe público: con el enlace se ve sin sesión, solo sus archivos; una llave inventada no abre nada', async () => {
  const { a, tech, order, template } = await setup();
  await call('PUT', `/workorders/${order._id}/checklist`, { as: tech, body: { template: template._id } });
  await call('PATCH', `/workorders/${order._id}/checklist`, { as: tech, body: { items: [{ done: true }, { done: true }, { done: false }] } });
  const photo = (await raw('POST', `/workorders/${order._id}/files?kind=despues`, { as: tech, body: JPEG, type: 'image/jpeg' })).data.attachments[0].file;
  const signed = (await call('POST', `/workorders/${order._id}/signature`, { as: tech, body: { name: 'Carlos Pérez', image: FIRMA } })).data;
  await call('PATCH', `/workorders/${order._id}/status`, { as: tech, body: { status: 'completada' } });

  const link = await call('POST', `/workorders/${order._id}/report-link`, { as: tech });
  assert.equal(link.status, 200);
  assert.match(link.data.path, /^\/informe\/[A-Za-z0-9_-]{20,40}$/);
  const again = await call('POST', `/workorders/${order._id}/report-link`, { as: a.token });
  assert.equal(again.data.token, link.data.token);                       // siempre el mismo enlace

  const pub = await call('GET', `/informes/${link.data.token}`);
  assert.equal(pub.status, 200);
  assert.equal(pub.data.company.name, 'Frío Ruta');
  assert.equal(pub.data.order.title, 'Mantenimiento aire');
  assert.equal(pub.data.order.technician, 'Ana Técnica');
  assert.equal(pub.data.order.checklist.filter((i) => i.done).length, 2);
  assert.equal(pub.data.order.photos.length, 1);
  assert.equal(pub.data.order.signature.name, 'Carlos Pérez');
  assert.equal(pub.data.order.startLocation, undefined);                  // nada de ubicación ni datos internos
  assert.equal(pub.data.order.reportToken, undefined);

  assert.equal((await raw('GET', `/informes/${link.data.token}/archivos/${photo}`)).status, 200);
  assert.equal((await raw('GET', `/informes/${link.data.token}/archivos/${signed.signature.file}`)).status, 200);
  // un archivo de otra orden no sale por este enlace
  const other = (await call('POST', '/workorders', { as: a.token, body: { title: 'Otra', description: 'Otra orden' } })).data;
  const foreign = (await raw('POST', `/workorders/${other._id}/files?kind=antes`, { as: a.token, body: JPEG, type: 'image/jpeg' })).data.attachments[0].file;
  assert.equal((await raw('GET', `/informes/${link.data.token}/archivos/${foreign}`)).status, 404);
  assert.equal((await call('GET', '/informes/llave-inventada-que-no-existe-123')).status, 404);
  assert.equal((await call('GET', '/informes/x')).status, 404);
});

test('otro técnico no comparte el informe de una orden ajena; borrar la orden borra sus fotos', async () => {
  const { a, beto, tech, order } = await setup();
  assert.equal((await call('POST', `/workorders/${order._id}/report-link`, { as: beto })).status, 403);
  const photo = (await raw('POST', `/workorders/${order._id}/files?kind=antes`, { as: tech, body: JPEG, type: 'image/jpeg' })).data.attachments[0].file;
  const mongoose = require('mongoose');
  assert.equal(await mongoose.connection.collection('workorderfiles').countDocuments({ _id: new mongoose.Types.ObjectId(photo) }), 1);
  assert.equal((await call('DELETE', `/workorders/${order._id}`, { as: a.token })).status, 200);
  assert.equal(await mongoose.connection.collection('workorderfiles').countDocuments({}), 0);
});
