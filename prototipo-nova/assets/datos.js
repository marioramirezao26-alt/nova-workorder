/* Catálogo de DEMOSTRACIÓN del prototipo NOVA Premium Futurista.
   Todo es ilustrativo: las marcas son inventadas, los precios no son precios de venta, no hay inventario y las
   imágenes son dibujos SVG hechos aquí (assets/ilustraciones.js). Nada de esto viene de un proveedor ni de una API. */
(function () {
  'use strict';

  // Las 7 categorías del mockup aprobado (más «Todas», que en la interfaz lleva a la tienda sin filtro).
  // muestra: el producto que ilustra la categoría en la página Categorías.
  var CATEGORIAS = [
    { id: 'hogar', nombre: 'Hogar', descripcion: 'Luz, plantas y detalles para la casa.', muestra: 'p07' },
    { id: 'tecnologia', nombre: 'Tecnología', descripcion: 'Audio, relojes y equipos para el día a día.', muestra: 'p01' },
    { id: 'bienestar', nombre: 'Bienestar', descripcion: 'Cuidado personal y descanso.', muestra: 'p12' },
    { id: 'deportes', nombre: 'Deportes', descripcion: 'Para entrenar y moverse.', muestra: 'p14' },
    { id: 'cafe', nombre: 'Café y Bebidas', descripcion: 'Café, tazas y cafeteras.', muestra: 'p16' },
    { id: 'oficina', nombre: 'Oficina', descripcion: 'Escritorio, teclado y cuadernos.', muestra: 'p19' },
    { id: 'accesorios', nombre: 'Accesorios', descripcion: 'Morrales, gafas y lo que va contigo.', muestra: 'p09' }
  ];

  // Marcas inventadas para la demostración (no son marcas reales ni proveedores de NOVA).
  var MARCAS = ['Vexo', 'Nubel', 'Quira', 'Ondra', 'Talvo', 'Mirel'];

  // dibujo: el tipo de ilustración SVG; tono: el color principal de la ilustración (grados del círculo de color).
  // corta: una línea descriptiva para la tarjeta, sin promesas que no se puedan respaldar.
  // destacado: orden en el carrusel «Productos destacados» del Inicio (los que no lo tienen no salen ahí).
  // precioAntes: solo para mostrar cómo se vería una oferta; ninguna oferta es real.
  var PRODUCTOS = [
    { id: 'p01', nombre: 'Audífonos inalámbricos Pulse', marca: 'Vexo', categoria: 'tecnologia', dibujo: 'audifonos', tono: 215, precio: 129900, precioAntes: 159900, nuevo: true, destacado: 2,
      corta: 'Audífonos de diadema', descripcion: 'Audífonos de diadema con estuche. Ficha de ejemplo para ver cómo se presenta un producto.' },
    { id: 'p02', nombre: 'Reloj inteligente Orbit', marca: 'Nubel', categoria: 'tecnologia', dibujo: 'reloj', tono: 225, precio: 189900, precioAntes: null, nuevo: true, destacado: 3,
      corta: 'Reloj para deporte y día a día', descripcion: 'Reloj con pantalla redonda y correa de silicona. Ficha de ejemplo.' },
    { id: 'p03', nombre: 'Parlante portátil Eco', marca: 'Quira', categoria: 'tecnologia', dibujo: 'parlante', tono: 190, precio: 149900, precioAntes: 179900, nuevo: false, destacado: 7,
      corta: 'Parlante pequeño para llevar', descripcion: 'Parlante pequeño para llevar en el morral. Ficha de ejemplo.' },
    { id: 'p04', nombre: 'Celular Demo X', marca: 'Ondra', categoria: 'tecnologia', dibujo: 'celular', tono: 235, precio: 1249900, precioAntes: null, nuevo: false,
      corta: 'Celular de pantalla grande', descripcion: 'Celular de pantalla grande. Ficha de ejemplo: no es un modelo real.' },
    { id: 'p05', nombre: 'Lámpara de escritorio Halo', marca: 'Mirel', categoria: 'oficina', dibujo: 'lampara', tono: 45, precio: 119900, precioAntes: 149900, nuevo: false, destacado: 6,
      corta: 'Lámpara de brazo, luz cálida', descripcion: 'Lámpara de brazo con luz cálida. Ficha de ejemplo.' },
    { id: 'p06', nombre: 'Taza térmica Brisa', marca: 'Talvo', categoria: 'cafe', dibujo: 'taza', tono: 175, precio: 59900, precioAntes: null, nuevo: true,
      corta: 'Taza con tapa', descripcion: 'Taza con tapa para el café de la mañana. Ficha de ejemplo.' },
    { id: 'p07', nombre: 'Planta decorativa Selva', marca: 'Mirel', categoria: 'hogar', dibujo: 'planta', tono: 150, precio: 79900, precioAntes: 99900, nuevo: false,
      corta: 'Planta artificial con matera', descripcion: 'Planta artificial con matera. Ficha de ejemplo.' },
    { id: 'p08', nombre: 'Tenis livianos Flux', marca: 'Vexo', categoria: 'deportes', dibujo: 'tenis', tono: 280, precio: 259900, precioAntes: 319900, nuevo: true, destacado: 5,
      corta: 'Tenis para caminar o trotar', descripcion: 'Tenis livianos para todos los días. Ficha de ejemplo.' },
    { id: 'p09', nombre: 'Morral Nómada', marca: 'Ondra', categoria: 'accesorios', dibujo: 'morral', tono: 205, precio: 169900, precioAntes: null, nuevo: false,
      corta: 'Morral con espacio para el portátil', descripcion: 'Morral con espacio para el portátil. Ficha de ejemplo.' },
    { id: 'p10', nombre: 'Gafas de sol Prisma', marca: 'Quira', categoria: 'accesorios', dibujo: 'gafas', tono: 300, precio: 99900, precioAntes: 129900, nuevo: false,
      corta: 'Gafas de marco grueso', descripcion: 'Gafas de marco grueso. Ficha de ejemplo.' },
    { id: 'p11', nombre: 'Crema hidratante Rocío', marca: 'Nubel', categoria: 'bienestar', dibujo: 'frasco', tono: 320, precio: 64900, precioAntes: null, nuevo: true, destacado: 8,
      corta: 'Crema para el cuidado diario', descripcion: 'Crema para el cuidado diario. Ficha de ejemplo, sin afirmaciones de salud.' },
    { id: 'p12', nombre: 'Humidificador Bruma', marca: 'Mirel', categoria: 'bienestar', dibujo: 'humidificador', tono: 195, precio: 89900, precioAntes: null, nuevo: true, destacado: 4,
      corta: 'Humidificador con luz LED', descripcion: 'Humidificador pequeño con luz LED. Ficha de ejemplo, sin afirmaciones de salud.' },
    { id: 'p13', nombre: 'Botella deportiva Ritmo', marca: 'Talvo', categoria: 'deportes', dibujo: 'botella', tono: 195, precio: 49900, precioAntes: null, nuevo: false,
      corta: 'Botella para el gimnasio', descripcion: 'Botella para el gimnasio. Ficha de ejemplo.' },
    { id: 'p14', nombre: 'Mancuernas ajustables Forja', marca: 'Ondra', categoria: 'deportes', dibujo: 'pesas', tono: 220, precio: 289900, precioAntes: 349900, nuevo: false,
      corta: 'Par de mancuernas', descripcion: 'Par de mancuernas. Ficha de ejemplo.' },
    { id: 'p15', nombre: 'Tapete de yoga Calma', marca: 'Quira', categoria: 'bienestar', dibujo: 'tapete', tono: 270, precio: 89900, precioAntes: null, nuevo: true,
      corta: 'Tapete enrollable', descripcion: 'Tapete enrollable. Ficha de ejemplo.' },
    { id: 'p16', nombre: 'Café molido Montaña', marca: 'Talvo', categoria: 'cafe', dibujo: 'cafe', tono: 345, precio: 32900, precioAntes: null, nuevo: true, destacado: 1,
      corta: 'Café colombiano (ejemplo)', descripcion: 'Bolsa de café molido de 250 g. Ficha de ejemplo: Talvo es una marca inventada.' },
    { id: 'p17', nombre: 'Prensa francesa Vapor', marca: 'Nubel', categoria: 'cafe', dibujo: 'prensa', tono: 30, precio: 79900, precioAntes: 94900, nuevo: false,
      corta: 'Cafetera de émbolo', descripcion: 'Cafetera de émbolo de vidrio. Ficha de ejemplo.' },
    { id: 'p18', nombre: 'Cuaderno de tapa dura Trazo', marca: 'Mirel', categoria: 'oficina', dibujo: 'cuaderno', tono: 250, precio: 24900, precioAntes: null, nuevo: false,
      corta: 'Cuaderno con banda elástica', descripcion: 'Cuaderno de hojas cuadriculadas. Ficha de ejemplo.' },
    { id: 'p19', nombre: 'Teclado inalámbrico Tecla', marca: 'Quira', categoria: 'oficina', dibujo: 'teclado', tono: 210, precio: 139900, precioAntes: 169900, nuevo: true,
      corta: 'Teclado delgado', descripcion: 'Teclado delgado para el escritorio. Ficha de ejemplo.' }
  ];

  window.NOVA_DEMO = { CATEGORIAS: CATEGORIAS, MARCAS: MARCAS, PRODUCTOS: PRODUCTOS };
})();
