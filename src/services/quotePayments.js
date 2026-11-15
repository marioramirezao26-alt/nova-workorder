// El cobro de una cotización aprobada. Wompi se retiró (Orden 41): ya no hay aviso que cambie un pago; lo registra la
// oficina a mano (quoteController.setPayment) y lo que Wompi confirmó antes se sigue leyendo igual en cada cotización.

// «Por cobrar» en la base: también las cotizaciones de antes del cobro en línea, que no tienen el campo payment
// (Mongoose pone el valor por defecto al leerlas, pero un filtro por 'pendiente' no las encuentra).
const UNPAID = { 'payment.status': { $nin: ['anticipo', 'pagado'] } };
const statusFor = (paid, total) => (paid <= 0 ? 'pendiente' : paid >= total ? 'pagado' : 'anticipo');

module.exports = { statusFor, UNPAID };
