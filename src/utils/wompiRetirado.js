// Wompi se retiró de NOVA (Orden 41 de Mario: Mercado Pago es el proveedor exclusivo de pagos). Toda ruta que antes era
// de Wompi responde 410 (ya no existe, y no va a volver) sin leer ni cambiar nada:
// - las llaves cifradas que una empresa haya guardado se quedan como están (no hay ruta que las borre);
// - el aviso de pagos (la URL de eventos del panel de Wompi) no toca ninguna cotización;
// - la historia sigue en la base y se lee igual: Quote.payment.method = 'wompi', payment.extra y Company.wompi.
const WOMPI_RETIRADO = 'Wompi ya no está disponible en NOVA';

const wompiGone = (req, res) => res.status(410).json({ message: WOMPI_RETIRADO });

module.exports = { WOMPI_RETIRADO, wompiGone };
