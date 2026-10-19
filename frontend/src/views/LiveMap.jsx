import { useEffect, useRef, useState } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { errorMessage } from '../api';
import { t } from '../i18n';
import { Empty, PriorityTag, formatDateTime } from '../ui';

// «Mapa» del administrador: cada técnico con una orden en proceso, dónde va (si autorizó el mapa en vivo), su cliente,
// el recorrido desde que inició y un aviso si se alejó del cliente. Se actualiza solo cada 30 segundos.
const STALE_MS = 10 * 60 * 1000;            // sin un punto en 10 minutos: «sin señal»
const COLORS = { ok: '#3ecf8e', away: '#ff6b6b', stale: '#9aa4b2', client: '#63a3ff' };
const BOGOTA = [4.65, -74.08];

const distance = (m) => (m >= 1000 ? `${(m / 1000).toFixed(1)} km` : `${m} m`);
const where = (o) => o.lastPoint || o.startLocation || null;
const stateOf = (o) => {
  const p = where(o);
  if (!p || !Number.isFinite(p.lat)) return 'none';
  if (Date.now() - new Date(p.at).getTime() > STALE_MS) return 'stale';
  return o.offSiteSince ? 'away' : 'ok';
};
const hasPoint = (p) => p && Number.isFinite(p.lat) && Number.isFinite(p.lng);

export default function LiveMap({ api, user }) {
  const box = useRef(null);
  const map = useRef(null);
  const layer = useRef(null);
  const [data, setData] = useState(null);
  const [error, setError] = useState('');

  const load = async () => {
    try {
      const { data: d } = await api.get('/workorders/live');
      setData(d);
      setError('');
    } catch (err) {
      setError(errorMessage(err, t('No se pudo cargar el mapa')));
    }
  };

  useEffect(() => {
    load();
    const timer = setInterval(load, 30000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    if (!box.current || map.current) return undefined;
    map.current = L.map(box.current, { zoomControl: true }).setView(BOGOTA, 11);
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 19, attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
    }).addTo(map.current);
    layer.current = L.layerGroup().addTo(map.current);
    return () => { map.current.remove(); map.current = null; };
  }, []);

  // Pinta técnicos, clientes y recorridos; ajusta el zoom la primera vez que hay puntos.
  const fitted = useRef(false);
  useEffect(() => {
    if (!data || !layer.current) return;
    layer.current.clearLayers();
    const bounds = [];
    data.items.forEach((o) => {
      const c = o.client?.location;
      if (hasPoint(c)) {
        L.circleMarker([c.lat, c.lng], { radius: 7, color: COLORS.client, weight: 2, fillOpacity: 0.25 })
          .bindTooltip(`${o.client.name}`, { direction: 'top' }).addTo(layer.current);
        bounds.push([c.lat, c.lng]);
      }
      const trail = [o.startLocation, ...(o.trail || [])].filter(hasPoint).map((p) => [p.lat, p.lng]);
      if (trail.length > 1) L.polyline(trail, { color: COLORS.ok, weight: 2, opacity: 0.6, dashArray: '4 6' }).addTo(layer.current);
      const p = where(o);
      if (hasPoint(p)) {
        const s = stateOf(o);
        L.circleMarker([p.lat, p.lng], { radius: 9, color: '#fff', weight: 2, fillColor: COLORS[s] || COLORS.ok, fillOpacity: 0.95 })
          .bindTooltip(`${o.assignedTo?.name || t('Sin técnico')} · ${o.title}`, { direction: 'top' }).addTo(layer.current);
        bounds.push([p.lat, p.lng]);
      }
    });
    if (bounds.length && !fitted.current) {
      map.current.fitBounds(bounds, { padding: [40, 40], maxZoom: 15 });
      fitted.current = true;
    }
  }, [data]);

  const focus = (o) => {
    const p = where(o);
    if (hasPoint(p)) map.current?.setView([p.lat, p.lng], 15);
  };

  const items = data?.items || [];
  return (
    <section className="view">
      <header className="view-header">
        <div>
          <p className="eyebrow">{user.company?.name}</p>
          <h2>{t('Mapa en vivo')}</h2>
        </div>
        <button type="button" className="ghost-button" onClick={load}>{t('Actualizar')}</button>
      </header>

      {data && !data.tracking && (
        <div className="panel-box highlight">
          <p>{t('El mapa en vivo está apagado. Actívalo en «Usuarios»; cada técnico también lo autoriza en su celular. Mientras tanto ves dónde inició cada orden, si se registró.')}</p>
        </div>
      )}
      {error && <p className="muted late">{error}</p>}

      <div className="live-layout">
        <div ref={box} className="live-map" role="region" aria-label={t('Mapa de técnicos')} />
        <div className="live-list">
          {data && items.length === 0 && <Empty>{t('Ningún técnico tiene órdenes en proceso ahora.')}</Empty>}
          {items.map((o) => {
            const s = stateOf(o);
            const p = where(o);
            return (
              <button key={o._id} type="button" className={`live-item ${s}`} onClick={() => focus(o)}>
                <span className={`live-dot ${s}`} aria-hidden="true" />
                <span className="live-text">
                  <strong>{o.assignedTo?.name || t('Sin técnico')}</strong>
                  <span>{o.title} · {o.client?.name || o.customerName || t('Sin cliente')}</span>
                  <PriorityTag priority={o.priority} />
                  {s === 'none' && <span className="muted">{t('Sin ubicación: no autorizó o no tiene GPS.')}</span>}
                  {s === 'stale' && <span className="muted">{t('Sin señal desde {when}', { when: formatDateTime(p.at) })}</span>}
                  {s === 'away' && <span className="late">{t('⚠ Lejos del cliente desde {when} · a {d}', { when: formatDateTime(o.offSiteSince), d: distance(p.distanceM) })}</span>}
                  {s === 'ok' && <span className="muted">{p.distanceM != null ? t('A {d} del cliente · {when}', { d: distance(p.distanceM), when: formatDateTime(p.at) }) : t('Actualizado {when}', { when: formatDateTime(p.at) })}</span>}
                </span>
              </button>
            );
          })}
          <p className="muted live-legend">
            <span className="live-dot ok" /> {t('cerca o en camino')} <span className="live-dot away" /> {t('lejos del cliente')}{' '}
            <span className="live-dot stale" /> {t('sin señal')} <span className="live-dot client" /> {t('cliente')}
          </p>
        </div>
      </div>
    </section>
  );
}
