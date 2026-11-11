/* Catálogo de DEMOSTRACIÓN del prototipo NOVA Premium Futurista.
   Todo es ilustrativo: las marcas son inventadas, los precios no son precios de venta, no hay inventario y las
   imágenes son dibujos SVG hechos aquí (assets/ilustraciones.js). Nada de esto viene de un proveedor ni de una API. */
(function () {
  'use strict';

  var CATEGORIAS = [
    { id: 'tecnologia', nombre: 'Tecnología', descripcion: 'Audio, relojes y accesorios para el día a día.' },
    { id: 'hogar', nombre: 'Hogar', descripcion: 'Luz, cocina y orden para la casa.' },
    { id: 'moda', nombre: 'Moda', descripcion: 'Tenis, bolsos y accesorios.' },
    { id: 'belleza', nombre: 'Belleza', descripcion: 'Cuidado personal.' },
    { id: 'deportes', nombre: 'Deportes', descripcion: 'Para entrenar y moverse.' },
    { id: 'mascotas', nombre: 'Mascotas', descripcion: 'Para los de cuatro patas.' }
  ];

  // Marcas inventadas para la demostración (no son marcas reales ni proveedores de NOVA).
  var MARCAS = ['Vexo', 'Nubel', 'Quira', 'Ondra', 'Talvo', 'Mirel'];

  // dibujo: el tipo de ilustración SVG; tono: el color principal de la ilustración (grados del círculo de color).
  // precioAntes: solo para mostrar cómo se vería una oferta; ninguna oferta es real.
  var PRODUCTOS = [
    { id: 'p01', nombre: 'Audífonos inalámbricos Pulse', marca: 'Vexo', categoria: 'tecnologia', dibujo: 'audifonos', tono: 215, precio: 189900, precioAntes: 239900, nuevo: true,
      descripcion: 'Audífonos de diadema con estuche. Ficha de ejemplo para ver cómo se presenta un producto.' },
    { id: 'p02', nombre: 'Reloj inteligente Orbit', marca: 'Nubel', categoria: 'tecnologia', dibujo: 'reloj', tono: 265, precio: 329900, precioAntes: null, nuevo: true,
      descripcion: 'Reloj con pantalla redonda y correa de silicona. Ficha de ejemplo.' },
    { id: 'p03', nombre: 'Parlante portátil Eco', marca: 'Quira', categoria: 'tecnologia', dibujo: 'parlante', tono: 190, precio: 149900, precioAntes: 179900, nuevo: false,
      descripcion: 'Parlante pequeño para llevar en el morral. Ficha de ejemplo.' },
    { id: 'p04', nombre: 'Celular Nova Demo X', marca: 'Ondra', categoria: 'tecnologia', dibujo: 'celular', tono: 230, precio: 1249900, precioAntes: null, nuevo: false,
      descripcion: 'Celular de pantalla grande. Ficha de ejemplo: no es un modelo real.' },
    { id: 'p05', nombre: 'Lámpara de escritorio Halo', marca: 'Mirel', categoria: 'hogar', dibujo: 'lampara', tono: 45, precio: 119900, precioAntes: 149900, nuevo: false,
      descripcion: 'Lámpara de brazo con luz cálida. Ficha de ejemplo.' },
    { id: 'p06', nombre: 'Taza térmica Brisa', marca: 'Talvo', categoria: 'hogar', dibujo: 'taza', tono: 175, precio: 59900, precioAntes: null, nuevo: true,
      descripcion: 'Taza con tapa para el café de la mañana. Ficha de ejemplo.' },
    { id: 'p07', nombre: 'Planta decorativa Selva', marca: 'Mirel', categoria: 'hogar', dibujo: 'planta', tono: 150, precio: 79900, precioAntes: 99900, nuevo: false,
      descripcion: 'Planta artificial con matera. Ficha de ejemplo.' },
    { id: 'p08', nombre: 'Tenis urbanos Flux', marca: 'Vexo', categoria: 'moda', dibujo: 'tenis', tono: 280, precio: 259900, precioAntes: 319900, nuevo: true,
      descripcion: 'Tenis livianos para todos los días. Ficha de ejemplo.' },
    { id: 'p09', nombre: 'Morral Nómada', marca: 'Ondra', categoria: 'moda', dibujo: 'morral', tono: 205, precio: 169900, precioAntes: null, nuevo: false,
      descripcion: 'Morral con espacio para el portátil. Ficha de ejemplo.' },
    { id: 'p10', nombre: 'Gafas de sol Prisma', marca: 'Quira', categoria: 'moda', dibujo: 'gafas', tono: 300, precio: 99900, precioAntes: 129900, nuevo: false,
      descripcion: 'Gafas de marco grueso. Ficha de ejemplo.' },
    { id: 'p11', nombre: 'Crema hidratante Rocío', marca: 'Nubel', categoria: 'belleza', dibujo: 'frasco', tono: 320, precio: 64900, precioAntes: null, nuevo: true,
      descripcion: 'Crema para el cuidado diario. Ficha de ejemplo, sin afirmaciones de salud.' },
    { id: 'p12', nombre: 'Perfume Aurora', marca: 'Mirel', categoria: 'belleza', dibujo: 'perfume', tono: 255, precio: 159900, precioAntes: 199900, nuevo: false,
      descripcion: 'Frasco de vidrio con atomizador. Ficha de ejemplo.' },
    { id: 'p13', nombre: 'Botella deportiva Ritmo', marca: 'Talvo', categoria: 'deportes', dibujo: 'botella', tono: 195, precio: 49900, precioAntes: null, nuevo: false,
      descripcion: 'Botella para el gimnasio. Ficha de ejemplo.' },
    { id: 'p14', nombre: 'Mancuernas ajustables Forja', marca: 'Ondra', categoria: 'deportes', dibujo: 'pesas', tono: 220, precio: 289900, precioAntes: 349900, nuevo: false,
      descripcion: 'Par de mancuernas. Ficha de ejemplo.' },
    { id: 'p15', nombre: 'Tapete de yoga Calma', marca: 'Quira', categoria: 'deportes', dibujo: 'tapete', tono: 270, precio: 89900, precioAntes: null, nuevo: true,
      descripcion: 'Tapete enrollable. Ficha de ejemplo.' },
    { id: 'p16', nombre: 'Cama para mascota Nido', marca: 'Talvo', categoria: 'mascotas', dibujo: 'cama', tono: 35, precio: 139900, precioAntes: 169900, nuevo: false,
      descripcion: 'Cama acolchada para perro o gato. Ficha de ejemplo.' },
    { id: 'p17', nombre: 'Juguete mordedor Chispa', marca: 'Vexo', categoria: 'mascotas', dibujo: 'hueso', tono: 185, precio: 29900, precioAntes: null, nuevo: true,
      descripcion: 'Juguete de caucho. Ficha de ejemplo.' },
    { id: 'p18', nombre: 'Comedero doble Duo', marca: 'Nubel', categoria: 'mascotas', dibujo: 'comedero', tono: 240, precio: 54900, precioAntes: 69900, nuevo: false,
      descripcion: 'Dos platos con base. Ficha de ejemplo.' }
  ];

  window.NOVA_DEMO = { CATEGORIAS: CATEGORIAS, MARCAS: MARCAS, PRODUCTOS: PRODUCTOS };
})();
