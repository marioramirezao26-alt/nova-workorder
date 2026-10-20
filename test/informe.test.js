// Informe de servicio (Mejora 1): plantillas de checklist, fotos de antes y después, firma del cliente, reglas para
// completar y el enlace público del informe.
const { test, before, after, beforeEach } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const mongoose = require('mongoose');
const { start, stop, reset, call, company, login, origin } = require('./helpers');

before(start);
after(stop);
beforeEach(reset);

// Imágenes mínimas válidas: un JPEG (solo la cabecera basta para reconocerlo) y un PNG de 1×1.
const JPEG = Buffer.concat([Buffer.from([0xff, 0xd8, 0xff, 0xe0]), Buffer.alloc(200, 7)]);
const PNG_1PX = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==', 'base64');
const FIRMA = `data:image/png;base64,${PNG_1PX.toString('base64')}`;
const files = () => mongoose.connection.collection('workorderfiles');

// Las marcas del checklist van con el nombre de cada punto de la plantilla de `setup`.
const LABELS = ['Limpiar filtros', 'Medir presión del gas', 'Revisar desagüe'];
const marks = (...states) => states.map((s, i) => ({ label: LABELS[i], ...s }));

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
  return { a, tech, beto, client, order, template: template.data, templateStatus: template.status };
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
    body: { items: marks({ done: true }, { done: true, note: '62 psi' }, { done: false }) } });
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

test('firma del cliente: obligatoria si la empresa la pide (para el técnico), reemplazable y con la anterior conservada', async () => {
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
  // la que reemplaza el técnico se conserva; la que reemplaza el administrador se borra
  assert.equal((await raw('GET', `/workorders/${order._id}/files/${first.data.signature.file}`, { as: a.token })).status, 200);
  const third = await call('POST', `/workorders/${order._id}/signature`, { as: a.token, body: { name: 'Carlos Pérez', image: FIRMA } });
  assert.equal(third.status, 200);
  assert.equal((await raw('GET', `/workorders/${order._id}/files/${second.data.signature.file}`, { as: a.token })).status, 404);
  // una firma muy pesada se rechaza con un mensaje que dice qué hacer
  const heavy = Buffer.concat([PNG_1PX.subarray(0, 8), Buffer.alloc(61 * 1024, 1)]);
  const tooBig = await call('POST', `/workorders/${order._id}/signature`, { as: tech, body: { name: 'Carlos', image: `data:image/png;base64,${heavy.toString('base64')}` } });
  assert.equal(tooBig.status, 413);
  assert.match(tooBig.data.message, /pesada/);
  assert.equal((await call('PATCH', `/workorders/${order._id}/status`, { as: tech, body: { status: 'completada' } })).status, 200);
});

test('el informe público: con el enlace se ve sin sesión, solo sus archivos; una llave inventada no abre nada', async () => {
  const { a, tech, order, template } = await setup();
  await call('PUT', `/workorders/${order._id}/checklist`, { as: tech, body: { template: template._id } });
  await call('PATCH', `/workorders/${order._id}/checklist`, { as: tech, body: { items: marks({ done: true }, { done: true }, { done: false }) } });
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
  assert.equal(await files().countDocuments({ _id: new mongoose.Types.ObjectId(photo) }), 1);
  assert.equal((await call('DELETE', `/workorders/${order._id}`, { as: a.token })).status, 200);
  assert.equal(await files().countDocuments({}), 0);
});

test('el técnico no saca una orden de «completada» ni la cambia debajo de la firma; el administrador sí la reabre', async () => {
  const { a, tech, order } = await setup();
  const photo = (await raw('POST', `/workorders/${order._id}/files?kind=antes`, { as: tech, body: JPEG, type: 'image/jpeg' })).data.attachments[0].file;
  await call('POST', `/workorders/${order._id}/signature`, { as: tech, body: { name: 'Carlos Cliente', image: FIRMA } });
  const done = await call('PATCH', `/workorders/${order._id}/status`, { as: tech, body: { status: 'completada' } });
  assert.equal(done.status, 200);
  const reopen = await call('PATCH', `/workorders/${order._id}/status`, { as: tech, body: { status: 'en_proceso' } });
  assert.equal(reopen.status, 403);
  assert.equal((await call('DELETE', `/workorders/${order._id}/files/${photo}`, { as: tech })).status, 409);
  assert.equal((await call('POST', `/workorders/${order._id}/signature`, { as: tech, body: { name: 'Firma falsa', image: FIRMA } })).status, 409);
  // tampoco la «completa» otra vez con una nota ni la edita: el informe que firmó el cliente sigue igual
  assert.equal((await call('PATCH', `/workorders/${order._id}/status`, { as: tech, body: { status: 'completada', note: 'El cliente aceptó el cobro adicional' } })).status, 403);
  assert.equal((await call('PUT', `/workorders/${order._id}`, { as: tech, body: { title: 'Instalación completa', description: 'Se instalaron 3 equipos nuevos' } })).status, 403);
  const same = (await call('GET', `/workorders/${order._id}`, { as: a.token })).data;
  assert.deepEqual([same.title, same.description, same.completedAt], ['Mantenimiento aire', 'Mantenimiento preventivo', done.data.completedAt]);
  assert.doesNotMatch(same.notes || '', /cobro adicional/);
  const byAdmin = await call('PATCH', `/workorders/${order._id}/status`, { as: a.token, body: { status: 'en_proceso' } });
  assert.equal(byAdmin.status, 200);
  assert.equal(byAdmin.data.completedAt, null);
});

test('completar por «Editar» (PUT) o crear una orden ya completada sigue la regla de completar y pone la fecha de cierre', async () => {
  const { a, tech, order, template } = await setup();
  await call('PUT', `/workorders/${order._id}/checklist`, { as: tech, body: { template: template._id } });
  const body = { title: 'Mantenimiento aire', description: 'Mantenimiento preventivo', status: 'completada' };
  const blocked = await call('PUT', `/workorders/${order._id}`, { as: a.token, body });
  assert.equal(blocked.status, 409);
  assert.equal(blocked.data.missing, '«Limpiar filtros», «Medir presión del gas»');   // aparte, para traducir la frase
  assert.equal((await call('GET', `/workorders/${order._id}`, { as: a.token })).data.status, 'pendiente');
  await call('PATCH', `/workorders/${order._id}/checklist`, { as: tech, body: { items: marks({ done: true }, { done: true }, {}) } });
  const done = await call('PUT', `/workorders/${order._id}`, { as: a.token, body });
  assert.equal(done.status, 200);
  assert.equal(done.data.status, 'completada');
  assert.ok(done.data.completedAt);
  // editar otra cosa de una orden completada no le cambia la fecha de cierre; reabrirla se la quita
  const edited = await call('PUT', `/workorders/${order._id}`, { as: a.token, body: { ...body, priority: 'alta' } });
  assert.equal(edited.data.completedAt, done.data.completedAt);
  const reopened = await call('PUT', `/workorders/${order._id}`, { as: a.token, body: { ...body, status: 'en_proceso' } });
  assert.equal(reopened.data.completedAt, null);
  assert.ok(reopened.data.startedAt);

  // nacer completada: el técnico, con la firma obligatoria, no puede; el administrador sí, con su fecha de cierre
  await call('PUT', '/company/require-signature', { as: a.token, body: { enabled: true } });
  const ready = { title: 'Ya hecha', description: 'Se hizo antes de registrarla', status: 'completada' };
  const byTech = await call('POST', '/workorders', { as: tech, body: { ...ready, assignedTo: order.assignedTo._id } });
  assert.equal(byTech.status, 409);
  assert.match(byTech.data.message, /firma/);
  const byAdmin = await call('POST', '/workorders', { as: a.token, body: ready });
  assert.equal(byAdmin.status, 201);
  assert.ok(byAdmin.data.completedAt);
});

test('un usuario cliente sin ficha de cliente no ve ninguna orden (ni las internas, sin cliente)', async () => {
  const { a } = await setup();
  const internal = (await call('POST', '/workorders', { as: a.token, body: { title: 'Orden interna', description: 'Sin cliente asignado' } })).data;
  const photo = (await raw('POST', `/workorders/${internal._id}/files?kind=antes`, { as: a.token, body: JPEG, type: 'image/jpeg' })).data.attachments[0].file;
  const made = await call('POST', '/users', { as: a.token, body: { name: 'Sin Ficha', email: 'sinficha@frioruta.com', role: 'cliente' } });
  assert.equal(made.status, 201);
  const loose = await login('sinficha@frioruta.com', made.data.temporaryPassword);
  assert.equal((await call('GET', '/workorders', { as: loose })).data.items.length, 0);
  assert.equal((await call('GET', `/workorders/${internal._id}`, { as: loose })).status, 404);
  assert.equal((await raw('GET', `/workorders/${internal._id}/files/${photo}`, { as: loose })).status, 404);
  assert.equal((await call('POST', `/workorders/${internal._id}/report-link`, { as: loose })).status, 404);
  assert.equal((await call('GET', '/dashboard/summary', { as: loose })).data.total, 0);
});

test('el checklist se marca por sus puntos: si la orden cambió de plantilla, las marcas viejas no caen en otros', async () => {
  const { a, tech, order, template } = await setup();
  await call('PUT', `/workorders/${order._id}/checklist`, { as: tech, body: { template: template._id } });
  const other = (await call('POST', '/checklists', { as: a.token, body: { name: 'Instalación', items: [
    { label: 'Fijar soporte', required: true }, { label: 'Conectar tubería', required: true }, { label: 'Probar' },
  ] } })).data;
  await call('PUT', `/workorders/${order._id}/checklist`, { as: a.token, body: { template: other._id } });
  // el técnico aún ve la plantilla anterior: mismo largo, otros puntos
  const stale = await call('PATCH', `/workorders/${order._id}/checklist`, { as: tech, body: { items: marks({ done: true }, { done: true }, { done: true }) } });
  assert.equal(stale.status, 400);
  assert.match(stale.data.message, /cambió/);
  assert.equal((await call('GET', `/workorders/${order._id}`, { as: tech })).data.checklist.filter((i) => i.done).length, 0);
  // quitar el checklist (plantilla elegida por error) deja la orden sin puntos
  const removed = await call('PUT', `/workorders/${order._id}/checklist`, { as: tech, body: { template: null } });
  assert.equal(removed.data.checklist.length, 0);
});

test('fotos y firmas al mismo tiempo: no se pisan y no quedan archivos sueltos ni rotos', async () => {
  const { tech, order } = await setup();
  const up = () => raw('POST', `/workorders/${order._id}/files?kind=antes`, { as: tech, body: JPEG, type: 'image/jpeg' });
  const del = (id) => call('DELETE', `/workorders/${order._id}/files/${id}`, { as: tech });
  for (let i = 0; i < 4; i += 1) await up();
  for (let round = 0; round < 3; round += 1) {
    const ids = (await call('GET', `/workorders/${order._id}`, { as: tech })).data.attachments.map((x) => x.file);
    const results = await Promise.all([del(ids[0]), up(), del(ids[1]), up()]);
    assert.deepEqual(results.map((r) => r.status), [200, 201, 200, 201]);
  }
  const final = (await call('GET', `/workorders/${order._id}`, { as: tech })).data;
  assert.equal(final.attachments.length, 4);
  const stored = (await files().find({ kind: { $ne: 'firma' } }).toArray()).map((f) => String(f._id)).sort();
  assert.deepEqual(stored, final.attachments.map((x) => String(x.file)).sort());
  for (const x of final.attachments) assert.equal((await raw('GET', `/workorders/${order._id}/files/${x.file}`, { as: tech })).status, 200);

  // varias firmas a la vez: queda una vigente, y cada otra firma guardada es una que se reemplazó (está en la bitácora
  // como «reemplazada»); ninguna queda suelta por la carrera
  const signs = await Promise.all([1, 2, 3].map((n) => call('POST', `/workorders/${order._id}/signature`, { as: tech, body: { name: `Cliente ${n}`, image: FIRMA } })));
  assert.ok(signs.some((r) => r.status === 200) && signs.every((r) => r.status === 200 || r.status === 409));
  const signed = (await call('GET', `/workorders/${order._id}`, { as: tech })).data.signature;
  const replaced = (await mongoose.connection.collection('auditlogs').find({ action: 'orden.firma' }).toArray()).map((e) => e.meta && e.meta.reemplazada).filter(Boolean);
  const kept = (await files().find({ kind: 'firma' }).toArray()).map((f) => String(f._id));
  assert.deepEqual(kept.sort(), [String(signed.file), ...replaced].sort());
  assert.equal(kept.length, signs.filter((r) => r.status === 200).length);
  assert.equal((await raw('GET', `/workorders/${order._id}/files/${signed.file}`, { as: tech })).status, 200);
});

test('las firmas que reemplaza el técnico tienen cupo; al reemplazarla el administrador se borran las anteriores', async () => {
  const { a, tech, order } = await setup();
  const signAs = (as, name) => call('POST', `/workorders/${order._id}/signature`, { as, body: { name, image: FIRMA } });
  for (let n = 1; n <= 5; n += 1) assert.equal((await signAs(tech, `Cliente ${n}`)).status, 200);
  const over = await signAs(tech, 'Cliente 6');
  assert.equal(over.status, 409);
  assert.match(over.data.message, /administrador/);
  assert.equal(await files().countDocuments({ kind: 'firma' }), 5);
  const fixed = await signAs(a.token, 'Cliente final');
  assert.equal(fixed.status, 200);
  assert.deepEqual((await files().find({ kind: 'firma' }).toArray()).map((f) => String(f._id)), [String(fixed.data.signature.file)]);
  assert.equal((await signAs(tech, 'Cliente otra vez')).status, 200);       // el cupo vuelve a empezar
});

test('el enlace del informe se puede cambiar (el anterior deja de servir); las horas van en la zona de la empresa', async () => {
  const { a, tech, beto, client, order } = await setup();
  const made = await call('POST', '/users', { as: a.token, body: { name: 'Gerente Hotel', email: 'gerente@hotelnorte.com', role: 'cliente', client: client._id } });
  const viewer = await login('gerente@hotelnorte.com', made.data.temporaryPassword);
  const first = (await call('POST', `/workorders/${order._id}/report-link`, { as: viewer })).data.token;   // el cliente lo comparte…
  assert.ok(first);
  assert.equal((await call('POST', `/workorders/${order._id}/report-link`, { as: viewer, body: { rotate: true } })).status, 403);   // …pero no lo cambia
  assert.equal((await call('POST', `/workorders/${order._id}/report-link`, { as: beto, body: { rotate: true } })).status, 403);
  const rotated = await call('POST', `/workorders/${order._id}/report-link`, { as: tech, body: { rotate: true } });
  assert.equal(rotated.status, 200);
  assert.notEqual(rotated.data.token, first);
  assert.equal((await call('GET', `/informes/${first}`)).status, 404);
  assert.equal(await mongoose.connection.collection('auditlogs').countDocuments({ action: 'orden.enlace' }), 1);

  // la nota lleva la hora de Colombia (UTC-5), no la del servidor
  const bogota = () => new Date(Date.now() - 5 * 3600 * 1000).toISOString().slice(0, 16).replace('T', ' ');
  const before = bogota();
  const started = await call('PATCH', `/workorders/${order._id}/status`, { as: tech, body: { status: 'en_proceso', note: 'Llegué al sitio' } });
  const stamps = [before, bogota()].map((s) => `[${s} · Ana Técnica] Llegué al sitio`);
  assert.ok(stamps.includes(started.data.notes), started.data.notes);

  const pub = await call('GET', `/informes/${rotated.data.token}`);
  assert.equal(pub.data.company.timeZone, 'America/Bogota');
  await mongoose.connection.collection('companies').updateOne({ _id: new mongoose.Types.ObjectId(a.id) }, { $set: { lang: 'en' } });
  assert.equal((await call('GET', `/informes/${rotated.data.token}`)).data.company.timeZone, 'America/New_York');
});

// El enlace de WhatsApp se arma en el navegador (frontend/src/ui.jsx). La función no depende de nada más del archivo,
// así que se prueba tal cual, sin compilar el JSX que la rodea.
const whatsappLink = (() => {
  const source = fs.readFileSync(path.join(__dirname, '..', 'frontend', 'src', 'ui.jsx'), 'utf8');
  return new Function(`return ${/export const whatsappLink = ([\s\S]*?\n};)/.exec(source)[1]}`)();
})();

test('WhatsApp: el indicativo sale del país de la empresa y, si no es claro, se abre sin número', () => {
  const to = (phone, lang) => whatsappLink(phone, 'Hola', lang).replace(/\?text=.*$/, '');
  assert.equal(to('300 123 4567', 'es'), 'https://wa.me/573001234567');           // celular colombiano
  assert.equal(to('+57 300 123 4567', 'es'), 'https://wa.me/573001234567');
  assert.equal(to('601 234 5678', 'es'), 'https://wa.me/');                       // fijo de Bogotá: sin adivinar
  assert.equal(to('(305) 555-1234', 'en'), 'https://wa.me/13055551234');          // Miami, no un celular de Colombia
  assert.equal(to('(212) 555-1234', 'en'), 'https://wa.me/12125551234');          // Nueva York, no Marruecos
  assert.equal(to('1 212 555 1234', 'en'), 'https://wa.me/12125551234');
  assert.equal(to('+57 300 123 4567', 'en'), 'https://wa.me/573001234567');       // con indicativo, se respeta
  assert.equal(to('555-1234', 'en'), 'https://wa.me/');
  assert.equal(to('', 'es'), 'https://wa.me/');
  assert.equal(whatsappLink('3001234567', 'Hola Ana & Co: https://x/informe/abc', 'es'),
    `https://wa.me/573001234567?text=${encodeURIComponent('Hola Ana & Co: https://x/informe/abc')}`);
});
