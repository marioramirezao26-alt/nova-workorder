// Ubicación del técnico al iniciar y al cerrar una orden (solo con la empresa de acuerdo y el técnico con su
// autorización, Ley 1581 de 2012): se valida lo que manda el celular y se mide a cuántos metros estaba del cliente.

const OFFSITE_METERS = () => Number(process.env.OFFSITE_METERS) || 300;

// { lat, lng, accuracy } válido o null. El navegador del celular da la precisión en metros.
const parseLocation = (raw) => {
  if (!raw || typeof raw !== 'object') return null;
  const lat = Number(raw.lat);
  const lng = Number(raw.lng);
  if (!Number.isFinite(lat) || !Number.isFinite(lng) || Math.abs(lat) > 90 || Math.abs(lng) > 180) return null;
  const accuracy = Number(raw.accuracy);
  return { lat, lng, accuracy: Number.isFinite(accuracy) && accuracy >= 0 ? Math.round(accuracy) : null };
};

// Distancia en metros entre dos puntos (fórmula del haversine).
const distanceMeters = (a, b) => {
  const R = 6371000;
  const rad = (d) => (d * Math.PI) / 180;
  const dLat = rad(b.lat - a.lat);
  const dLng = rad(b.lng - a.lng);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return Math.round(2 * R * Math.asin(Math.sqrt(h)));
};

// El punto que se guarda en la orden: dónde, cuándo, a cuántos metros del cliente y si estaba lejos.
const stampPoint = (loc, clientLocation) => {
  const known = clientLocation && Number.isFinite(clientLocation.lat) && Number.isFinite(clientLocation.lng);
  const distanceM = known ? distanceMeters(loc, clientLocation) : null;
  return { ...loc, at: new Date(), distanceM, offSite: distanceM !== null && distanceM > OFFSITE_METERS() };
};

module.exports = { parseLocation, distanceMeters, stampPoint, OFFSITE_METERS };
