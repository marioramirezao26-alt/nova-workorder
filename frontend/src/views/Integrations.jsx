import { useEffect, useState } from 'react';
import { errorMessage } from '../api';
import { getLang, t } from '../i18n';
import WompiCard from './WompiCard';
import FactusCard from './FactusCard';

// «Integraciones» (solo el administrador): llaves de API para que otros sistemas lean y creen órdenes, y webhooks
// para avisarle a otro sistema cuando algo cambia. La llave y el secreto se muestran una sola vez.
const EVENT_LABEL = {
  'orden.creada': 'Orden creada',
  'orden.actualizada': 'Orden editada',
  'orden.estado': 'Cambio de estado',
  'orden.borrada': 'Orden borrada',
};

const when = (iso) => {
  if (!iso) return t('nunca');
  try {
    return new Date(iso).toLocaleString(getLang() === 'en' ? 'en-US' : 'es-CO', { dateStyle: 'medium', timeStyle: 'short' });
  } catch {
    return '';
  }
};

const copyText = (text) => navigator.clipboard?.writeText(text).then(() => alert(t('Copiado')), () => {});

export default function Integrations({ api }) {
  const [keys, setKeys] = useState([]);
  const [hooks, setHooks] = useState([]);
  const [events, setEvents] = useState(Object.keys(EVENT_LABEL));
  const [shown, setShown] = useState(null);                    // { label, value }: la llave o el secreto, una vez
  const [keyForm, setKeyForm] = useState({ name: '', scope: 'lectura' });
  const [hookForm, setHookForm] = useState({ url: '', events: ['orden.creada', 'orden.estado'] });
  const [log, setLog] = useState({});                          // envíos recientes por webhook
  const [error, setError] = useState('');

  const load = () => Promise.all([api.get('/integrations/keys'), api.get('/integrations/webhooks')])
    .then(([k, h]) => {
      setKeys(k.data.items);
      setHooks(h.data.items);
      setEvents(h.data.events);
      setError('');
    })
    .catch((err) => setError(errorMessage(err, 'No se pudieron cargar las integraciones')));
  useEffect(() => { load(); }, []);

  const act = async (fn, fallback) => {
    try {
      await fn();
      await load();
    } catch (err) {
      alert(errorMessage(err, fallback));
    }
  };

  const createKey = (e) => {
    e.preventDefault();
    act(async () => {
      const { data } = await api.post('/integrations/keys', keyForm);
      setShown({ label: t('Llave «{name}» · se muestra una sola vez', { name: data.name }), value: data.key });
      setKeyForm({ name: '', scope: 'lectura' });
    }, 'No se pudo crear la llave');
  };

  const createHook = (e) => {
    e.preventDefault();
    act(async () => {
      const { data } = await api.post('/integrations/webhooks', hookForm);
      setShown({ label: t('Secreto de firma de {url} · se muestra una sola vez', { url: data.url }), value: data.secret });
      setHookForm({ url: '', events: ['orden.creada', 'orden.estado'] });
    }, 'No se pudo crear el webhook');
  };

  const toggleEvent = (list, ev) => (list.includes(ev) ? list.filter((x) => x !== ev) : [...list, ev]);

  const test = (h) => act(async () => {
    const { data } = await api.post(`/integrations/webhooks/${h._id}/test`);
    alert(data.ok ? t('¡Llegó! Tu sistema respondió {status}.', { status: data.responseStatus })
      : t('No llegó: {error}', { error: data.error || data.responseStatus }));
  }, 'No se pudo enviar la prueba');

  const showLog = async (h) => {
    try {
      const { data } = await api.get(`/integrations/webhooks/${h._id}/deliveries`);
      setLog((prev) => ({ ...prev, [h._id]: data.items }));
    } catch (err) {
      alert(errorMessage(err, 'No se pudieron cargar los envíos'));
    }
  };

  return (
    <section className="view">
      <header className="view-header">
        <div>
          <h2>{t('Integraciones')}</h2>
          <p className="muted">{t('Conecta NOVA con tu ERP, facturación o Zapier: llaves de API y avisos automáticos (webhooks).')}</p>
        </div>
      </header>

      {error && <p className="error">{error}</p>}

      <WompiCard api={api} />
      <FactusCard api={api} />

      {shown && (
        <div className="panel-box highlight">
          <p className="label">{shown.label}</p>
          <p className="temp-password secret-value">{shown.value}</p>
          <p className="muted">{t('Guárdala en el otro sistema ahora: después no la podemos volver a mostrar.')}</p>
          <div className="order-actions">
            <button type="button" className="mini-button edit" onClick={() => copyText(shown.value)}>{t('Copiar')}</button>
            <button type="button" className="ghost-button" onClick={() => setShown(null)}>{t('Listo')}</button>
          </div>
        </div>
      )}

      <div className="panel-box">
        <h3>{t('Llaves de API')}</h3>
        <p className="muted">{t('Cada llave actúa como tú, solo dentro de tu empresa. Úsala en el encabezado «Authorization: Bearer nwo_…». Ver la guía en docs/API.md.')}</p>
        <form className="order-form" onSubmit={createKey}>
          <div className="two-columns">
            <label>{t('Nombre')}<input type="text" maxLength={60} placeholder={t('Por ejemplo, ERP')} value={keyForm.name} onChange={(e) => setKeyForm({ ...keyForm, name: e.target.value })} required /></label>
            <label>{t('Permiso')}
              <select value={keyForm.scope} onChange={(e) => setKeyForm({ ...keyForm, scope: e.target.value })}>
                <option value="lectura">{t('Solo lectura (consultar órdenes y clientes)')}</option>
                <option value="escritura">{t('Escritura (además crear órdenes y cambiar su estado)')}</option>
              </select>
            </label>
          </div>
          <button type="submit" className="primary-button">{t('Crear llave')}</button>
        </form>
        <div className="card-list">
          {keys.map((k) => (
            <article key={k._id} className="order-card compact">
              <div className="order-card-head">
                <span className="status-tag completada">{t(k.scope === 'escritura' ? 'Escritura' : 'Lectura')}</span>
                <span className="muted">{k.prefix}…</span>
              </div>
              <h3>{k.name}</h3>
              <small className="muted">{t('Último uso: {when}', { when: when(k.lastUsedAt) })}</small>
              <div className="order-actions">
                <button type="button" className="mini-button delete" onClick={() => {
                  if (window.confirm(t('¿Revocar la llave «{name}»? El sistema que la usa dejará de conectarse.', { name: k.name }))) {
                    act(() => api.delete(`/integrations/keys/${k._id}`), 'No se pudo revocar la llave');
                  }
                }}>{t('Revocar')}</button>
              </div>
            </article>
          ))}
        </div>
      </div>

      <div className="panel-box">
        <h3>{t('Webhooks')}</h3>
        <p className="muted">{t('Le avisamos a tu sistema con un POST firmado (encabezado X-Nova-Signature) cada vez que pasa algo. Si falla, reintentamos durante varias horas.')}</p>
        <form className="order-form" onSubmit={createHook}>
          <label>{t('Dirección (https://)')}<input type="url" placeholder="https://mi-sistema.com/avisos" value={hookForm.url} onChange={(e) => setHookForm({ ...hookForm, url: e.target.value })} required /></label>
          <div className="two-columns">
            {events.map((ev) => (
              <label key={ev} className="check-row">
                <input type="checkbox" checked={hookForm.events.includes(ev)} onChange={() => setHookForm({ ...hookForm, events: toggleEvent(hookForm.events, ev) })} />
                {t(EVENT_LABEL[ev] || ev)}
              </label>
            ))}
          </div>
          <button type="submit" className="primary-button" disabled={!hookForm.events.length}>{t('Crear webhook')}</button>
        </form>
        <div className="card-list">
          {hooks.map((h) => (
            <article key={h._id} className="order-card compact">
              <div className="order-card-head">
                <span className={`status-tag ${h.active ? 'completada' : 'cancelada'}`}>{t(h.active ? 'Activo' : 'Apagado')}</span>
                {h.lastStatus && <span className="muted">{t('Último envío: {status}', { status: h.lastStatus })}</span>}
              </div>
              <h3 className="secret-value">{h.url}</h3>
              <small className="muted">{h.events.map((ev) => t(EVENT_LABEL[ev] || ev)).join(' · ')}</small>
              <div className="order-actions">
                <button type="button" className="mini-button edit" onClick={() => test(h)}>{t('Enviar prueba')}</button>
                <button type="button" className="mini-button edit" onClick={() => showLog(h)}>{t('Ver envíos')}</button>
                <button type="button" className="mini-button edit" onClick={() => act(() => api.patch(`/integrations/webhooks/${h._id}`, { active: !h.active }), 'No se pudo cambiar el webhook')}>{t(h.active ? 'Apagar' : 'Prender')}</button>
                <button type="button" className="mini-button edit" onClick={() => {
                  if (window.confirm(t('¿Cambiar el secreto? El anterior deja de valer de inmediato.'))) {
                    act(async () => {
                      const { data } = await api.post(`/integrations/webhooks/${h._id}/secret`);
                      setShown({ label: t('Secreto de firma de {url} · se muestra una sola vez', { url: h.url }), value: data.secret });
                    }, 'No se pudo cambiar el secreto');
                  }
                }}>{t('Nuevo secreto')}</button>
                <button type="button" className="mini-button delete" onClick={() => {
                  if (window.confirm(t('¿Borrar este webhook?'))) act(() => api.delete(`/integrations/webhooks/${h._id}`), 'No se pudo borrar el webhook');
                }}>{t('Eliminar')}</button>
              </div>
              {log[h._id] && (
                <ul className="activity-list">
                  {!log[h._id].length && <li className="muted">{t('Todavía no hay envíos.')}</li>}
                  {log[h._id].map((d) => (
                    <li key={d._id} className="activity-item">
                      <div className="activity-main">
                        <span>{t(EVENT_LABEL[d.event] || d.event)} · {t(d.status)}{d.error ? ` · ${d.error}` : ''}</span>
                        <span className="muted small">{when(d.at)}</span>
                      </div>
                      <small className="muted">{t('Intentos: {n}', { n: d.attempts })}</small>
                    </li>
                  ))}
                </ul>
              )}
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}
