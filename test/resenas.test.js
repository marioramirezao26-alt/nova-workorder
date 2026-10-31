// «Recomiéndanos»: las recomendaciones reales de los clientes para novaworkorder.com. La deja el administrador desde la
// app, Mario la aprueba o rechaza desde GABY (llave de plataforma) y la página solo lee las aprobadas.
const { test, before, after, beforeEach } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { start, stop, reset, call, company, login, KEY, origin } = require('./helpers');
const { resetLimits } = require('../src/utils/rateStore');
const { monthOf } = require('../src/controllers/reviewController');
const Review = require('../src/models/Review');

before(start);
after(stop);
beforeEach(async () => { await reset(); await resetLimits(); });

const opinion = {
  rating: 5,
  text: 'Ya no perdemos órdenes en el chat y sabemos a qué hora llegó cada técnico.',
  name: 'Carolina Ruiz',
  role: 'Gerente',
  city: 'Medellín',
  consent: true,
};

const pending = async () => (await call('GET', '/platform/reviews', { platformKey: KEY })).data.items;
const published = async () => call('GET', '/public/reviews');

test('solo el administrador con sesión deja la recomendación; técnicos, clientes y visitantes no', async () => {
  const frio = await company('Frío Andino');
  assert.equal((await call('PUT', '/company/review', { body: opinion })).status, 401);                    // sin sesión
  const tech = await call('POST', '/users', { as: frio.token, body: { name: 'Juan Gómez', email: 'juan@frio.co', role: 'tecnico', password: 'Clave-tecnico-1' } });
  const techToken = await login('juan@frio.co', 'Clave-tecnico-1');
  assert.equal(tech.status, 201);
  assert.equal((await call('PUT', '/company/review', { as: techToken, body: opinion })).status, 403);
  assert.equal((await call('GET', '/company/review', { as: techToken })).status, 403);
  await call('POST', '/users', { as: frio.token, body: { name: 'Hotel Sol', email: 'compras@hotelsol.co', role: 'cliente', password: 'Clave-cliente-1' } });
  assert.equal((await call('PUT', '/company/review', { as: await login('compras@hotelsol.co', 'Clave-cliente-1'), body: opinion })).status, 403);

  const empty = await call('GET', '/company/review', { as: frio.token });
  assert.equal(empty.status, 200);
  assert.equal(empty.data.review, null);
  assert.match(empty.data.consentText, /^Autorizo a NOVA Desarrollos a publicar esta opinión con mi nombre, cargo y empresa en novaworkorder\.com\. Puedo retirarla cuando quiera\.$/);

  const made = await call('PUT', '/company/review', { as: frio.token, body: opinion });
  assert.equal(made.status, 201);
  assert.equal(made.data.review.status, 'pendiente');
  assert.equal(made.data.review.companyName, 'Frío Andino');                                  // la empresa sale de la cuenta
  assert.ok(made.data.review.consentAt);
  // Queda en la bitácora de la empresa
  const log = await call('GET', '/audit', { as: frio.token });
  assert.ok(log.data.items.some((l) => l.action === 'resena.enviar'));
});

test('sin la casilla de autorización no se guarda', async () => {
  const frio = await company('Frío Andino');
  for (const consent of [undefined, false, 'true', 1]) {
    const r = await call('PUT', '/company/review', { as: frio.token, body: { ...opinion, consent } });
    assert.equal(r.status, 400, String(consent));
    assert.match(r.data.errors.map((e) => e.message).join(' '), /autorización/);
  }
  assert.equal(await Review.countDocuments({}), 0);
});

test('validaciones: calificación de 1 a 5 y textos con su largo', async () => {
  const frio = await company('Frío Andino');
  const bad = async (body) => (await call('PUT', '/company/review', { as: frio.token, body: { ...opinion, ...body } })).status;
  for (const rating of [0, 6, 4.5, '5', null]) assert.equal(await bad({ rating }), 400, `rating ${rating}`);
  assert.equal(await bad({ text: 'Muy buena app.' }), 400);                            // menos de 20
  assert.equal(await bad({ text: `   ${'a'.repeat(19)}   ` }), 400);                  // los espacios no cuentan
  assert.equal(await bad({ text: 'a'.repeat(401) }), 400);
  assert.equal(await bad({ text: undefined }), 400);
  assert.equal(await bad({ name: '' }), 400);
  assert.equal(await bad({ name: 'J' }), 400);
  assert.equal(await bad({ name: 'a'.repeat(81) }), 400);
  assert.equal(await bad({ role: 'a'.repeat(81) }), 400);
  assert.equal(await bad({ city: 'a'.repeat(61) }), 400);
  assert.equal(await bad({ name: { $gt: '' } }), 400);
  assert.equal(await Review.countDocuments({}), 0);
  // En el borde sí pasa, y cargo y ciudad son opcionales
  assert.equal(await bad({ text: 'a'.repeat(20), role: undefined, city: undefined, rating: 1 }), 201);
  assert.equal(await bad({ text: 'b'.repeat(400), rating: 5 }), 200);
});

test('una sola reseña viva por empresa: reenviarla la reemplaza y vuelve a «pendiente»', async () => {
  const frio = await company('Frío Andino');
  await call('PUT', '/company/review', { as: frio.token, body: opinion });
  const [first] = await pending();
  assert.equal((await call('POST', `/platform/reviews/${first._id}/approve`, { platformKey: KEY })).data.status, 'aprobada');
  assert.equal((await published()).data.items.length, 1);

  const again = await call('PUT', '/company/review', { as: frio.token, body: { ...opinion, rating: 4, text: 'Cambié de opinión: ahora la usamos también para las cotizaciones.' } });
  assert.equal(again.status, 200);
  assert.equal(again.data.review.status, 'pendiente');
  assert.equal(await Review.countDocuments({}), 1);
  assert.equal((await published()).data.items.length, 0);                       // la nueva espera a Mario
  // Aprobar el id viejo no publica el texto nuevo sin que Mario lo lea
  assert.equal((await call('POST', `/platform/reviews/${first._id}/approve`, { platformKey: KEY })).status, 404);
  const [second] = await pending();
  assert.notEqual(second._id, first._id);
  assert.equal(second.rating, 4);
  // Otra empresa tiene la suya aparte
  const otra = await company('Redes del Valle');
  await call('PUT', '/company/review', { as: otra.token, body: { ...opinion, name: 'Pedro Díaz' } });
  assert.equal((await pending()).length, 2);
  assert.equal((await call('GET', '/company/review', { as: frio.token })).data.review.rating, 4);
});

test('la empresa la retira: desaparece de la página y no se puede aprobar', async () => {
  const frio = await company('Frío Andino');
  assert.equal((await call('DELETE', '/company/review', { as: frio.token })).status, 404);
  await call('PUT', '/company/review', { as: frio.token, body: opinion });
  const [r] = await pending();
  await call('POST', `/platform/reviews/${r._id}/approve`, { platformKey: KEY });
  assert.equal((await published()).data.items.length, 1);

  const gone = await call('DELETE', '/company/review', { as: frio.token });
  assert.equal(gone.status, 200);
  assert.equal(gone.data.review.status, 'retirada');
  assert.ok(gone.data.review.withdrawnAt);
  assert.equal((await published()).data.items.length, 0);
  const again = await call('POST', `/platform/reviews/${r._id}/approve`, { platformKey: KEY });
  assert.equal(again.status, 409);
  assert.equal(again.data.status, 'retirada');
  assert.equal((await call('POST', `/platform/reviews/${r._id}/reject`, { platformKey: KEY })).status, 409);
  const retiradas = (await call('GET', '/platform/reviews?status=retirada', { platformKey: KEY })).data.items;
  assert.equal(retiradas.length, 1);
  // Volver a mandarla crea una nueva, pendiente
  assert.equal((await call('PUT', '/company/review', { as: frio.token, body: opinion })).data.review.status, 'pendiente');
});

test('aprobar y rechazar solo con la llave de plataforma; en la app nadie aprueba su propia reseña', async () => {
  const frio = await company('Frío Andino');
  // Mandar «status» desde la app no cambia nada
  const own = await call('PUT', '/company/review', { as: frio.token, body: { ...opinion, status: 'aprobada', decidedAt: new Date() } });
  assert.equal(own.data.review.status, 'pendiente');
  const [r] = await pending();
  assert.equal((await call('GET', '/platform/reviews')).status, 401);
  assert.equal((await call('GET', '/platform/reviews', { platformKey: 'otra-llave-cualquiera-0123456789abcdef' })).status, 401);
  assert.equal((await call('POST', `/platform/reviews/${r._id}/approve`)).status, 401);
  assert.equal((await call('POST', `/platform/reviews/${r._id}/approve`, { as: frio.token })).status, 401);      // el token de la app no sirve
  assert.equal((await call('POST', `/platform/reviews/${r._id}/reject`, { as: frio.token })).status, 401);
  assert.equal((await call('POST', '/platform/reviews/no-es-un-id/approve', { platformKey: KEY })).status, 400);
  assert.equal((await published()).data.items.length, 0);

  // GABY ve lo que Mario necesita para decidir, con la constancia de la autorización
  assert.equal(r.companyName, 'Frío Andino');
  assert.equal(r.text, opinion.text);
  assert.ok(r.consentAt && /Autorizo a NOVA Desarrollos/.test(r.consentText));

  const ok = await call('POST', `/platform/reviews/${r._id}/approve`, { platformKey: KEY });
  assert.equal(ok.status, 200);
  assert.equal(ok.data.status, 'aprobada');
  assert.equal((await call('POST', `/platform/reviews/${r._id}/approve`, { platformKey: KEY })).status, 409);   // ya está aprobada
  assert.equal((await pending()).length, 0);
  assert.equal((await published()).data.items.length, 1);

  // Mario puede despublicarla; la empresa ve el motivo
  const no = await call('POST', `/platform/reviews/${r._id}/reject`, { platformKey: KEY, body: { reason: 'Menciona a otra empresa' } });
  assert.equal(no.status, 200);
  assert.equal(no.data.status, 'rechazada');
  assert.equal((await published()).data.items.length, 0);
  assert.equal((await call('GET', '/company/review', { as: frio.token })).data.review.reason, 'Menciona a otra empresa');
  assert.equal((await call('POST', `/platform/reviews/${r._id}/approve`, { platformKey: KEY })).status, 409);
  assert.equal((await call('GET', '/platform/reviews?status=rechazada', { platformKey: KEY })).data.items.length, 1);
});

test('la página pública solo muestra las aprobadas, sin datos de contacto y con caché corta', async () => {
  const empty = await published();
  assert.equal(empty.status, 200);
  assert.deepEqual(empty.data, { items: [] });                                     // con 0, la landing no muestra la sección

  const frio = await company('Frío Andino', { adminEmail: 'gerencia@frioandino.co' });
  const redes = await company('Redes del Valle');
  const camaras = await company('Cámaras Norte');
  await call('PUT', '/company/review', { as: frio.token, body: opinion });
  await call('PUT', '/company/review', { as: redes.token, body: { ...opinion, name: 'Pedro Díaz', role: '', city: '', rating: 4 } });
  await call('PUT', '/company/review', { as: camaras.token, body: { ...opinion, name: 'Ana Mora' } });
  const items = await pending();
  const by = (name) => items.find((i) => i.name === name)._id;
  await call('POST', `/platform/reviews/${by('Carolina Ruiz')}/approve`, { platformKey: KEY });
  await call('POST', `/platform/reviews/${by('Pedro Díaz')}/approve`, { platformKey: KEY });
  await call('POST', `/platform/reviews/${by('Ana Mora')}/reject`, { platformKey: KEY });

  const res = await fetch(`${origin()}/api/public/reviews`);
  assert.equal(res.headers.get('cache-control'), 'public, max-age=300');
  const pub = await published();
  assert.equal(pub.data.items.length, 2);
  assert.deepEqual(pub.data.items.map((i) => i.name).sort(), ['Carolina Ruiz', 'Pedro Díaz']);
  for (const item of pub.data.items) {
    assert.deepEqual(Object.keys(item).sort(), ['city', 'company', 'month', 'name', 'rating', 'role', 'text']);
    assert.match(item.month, /^\d{4}-\d{2}$/);
  }
  const carolina = pub.data.items.find((i) => i.name === 'Carolina Ruiz');
  assert.equal(carolina.company, 'Frío Andino');
  assert.equal(carolina.city, 'Medellín');
  const raw = JSON.stringify(pub.data);
  assert.doesNotMatch(raw, /@|frioandino\.co|_id|tenant|consent|submittedBy/);       // ni correo, ni ids, ni constancias
});

test('el mes de la reseña es el de Colombia, no el del servidor en UTC', () => {
  assert.equal(monthOf(new Date('2026-11-01T03:00:00Z')), '2026-10');      // 31-oct a las 10 p. m. en Bogotá
  assert.equal(monthOf(new Date('2026-11-01T06:00:00Z')), '2026-11');
});

test('la landing muestra la sección solo con reseñas aprobadas y sin reseñas de ejemplo en el código', () => {
  const leer = (f) => fs.readFileSync(path.join(__dirname, '..', 'landing', f), 'utf8');
  const js = leer('resenas.js');
  // P-034 A10: en inglés no hay reseñas reales todavía: ni la sección vacía ni el script
  assert.doesNotMatch(leer('en/index.html'), /id="resenas"|resenas\.js|Reviews from our customers/);
  for (const f of ['index.html']) {
    const html = leer(f);
    assert.match(html, /<section id="resenas"[^>]*\bhidden\b/, `${f}: la sección arranca oculta`);
    assert.match(html, /<script src="\/resenas\.js" defer><\/script>/, f);
    assert.ok(html.indexOf('id="resenas"') < html.indexOf('<footer'), `${f}: al final, antes del pie`);
    assert.doesNotMatch(html, /"@type"\s*:\s*"(Review|AggregateRating)"/, f);            // sin JSON-LD de reseñas
  }
  assert.match(js, /\/api\/public\/reviews/);
  assert.match(js, /if \(!items\.length\) return;/);                                  // 0 reseñas: no se muestra
  assert.doesNotMatch(js, /innerHTML/);                                                // el texto lo escribió un cliente
  // Ni nombres ni textos inventados en producción
  for (const src of [js, leer('index.html'), leer('en/index.html')]) assert.doesNotMatch(src, /ejemplo de rese|reseña de ejemplo|sample review/i);
});
