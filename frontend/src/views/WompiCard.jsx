import { useEffect, useState } from 'react';
import { errorMessage } from '../api';
import { t } from '../i18n';

// «Cobros con Wompi» (en Integraciones, solo el administrador): la empresa conecta SU cuenta de Wompi para que sus
// clientes paguen en línea las cotizaciones aprobadas. Los secretos se escriben aquí, se guardan cifrados y nunca se
// vuelven a mostrar. La URL de eventos se pega en el panel de Wompi para que avise de cada pago.
const EMPTY = { publicKey: '', integritySecret: '', eventsSecret: '', depositPercent: 100 };

export default function WompiCard({ api }) {
  const [info, setInfo] = useState(null);
  const [form, setForm] = useState(null);
  const [busy, setBusy] = useState(false);
  useEffect(() => { api.get('/company/wompi').then(({ data }) => setInfo(data)).catch(() => {}); }, []);
  if (!info || !info.available) return null;
  const field = (key) => ({ value: form[key], onChange: (e) => setForm({ ...form, [key]: e.target.value }) });
  const eventsUrl = `${window.location.origin}${info.eventsPath}`;

  const run = async (fn, fallback) => {
    try {
      setBusy(true);
      setInfo((await fn()).data);
      return true;
    } catch (error) {
      alert(errorMessage(error, t(fallback)));
      return false;
    } finally {
      setBusy(false);
    }
  };
  const save = async (e) => {
    e.preventDefault();
    if (await run(() => api.put('/company/wompi', { ...form, depositPercent: Number(form.depositPercent) }), 'No se pudo conectar Wompi')) setForm(null);
  };

  return (
    <div className="panel-box">
      <h3>{t('Cobros con Wompi')}</h3>
      <p className="muted">{t('Tus clientes pagan en línea las cotizaciones aprobadas (tarjeta, PSE, Nequi, Bancolombia). El dinero llega directo a tu cuenta de Wompi.')}</p>
      {info.connected && !form && (
        <>
          <p>
            <span className="status-tag q-aprobada">{t('Conectado')}</span>{' '}
            {info.test && <span className="status-tag q-vencida">{t('Pruebas')}</span>}{' '}
            <strong>{info.merchantName}</strong>
          </p>
          <label className="switch-row">{t('Se cobra en línea')}
            <select value={info.depositPercent} disabled={busy} onChange={(e) => run(() => api.put('/company/wompi/deposit', { depositPercent: Number(e.target.value) }), 'No se pudo guardar el ajuste')}>
              {[100, 70, 60, 50, 40, 30].map((p) => <option key={p} value={p}>{p === 100 ? t('el total de la cotización') : t('un anticipo del {p} %', { p })}</option>)}
            </select>
          </label>
          <p className="label">{t('URL de eventos (pégala en tu panel de Wompi → Desarrolladores → Eventos)')}</p>
          <div className="secret-row">
            <code>{eventsUrl}</code>
            <button type="button" className="ghost-button" onClick={() => navigator.clipboard?.writeText(eventsUrl).then(() => alert(t('Copiado')))}>{t('Copiar')}</button>
          </div>
          <p className="muted small">{t('Sin esta URL en Wompi, los pagos no quedan registrados aquí.')}</p>
          <p className="muted small">{t('Último aviso de Wompi: {when}', { when: info.lastEventAt ? new Date(info.lastEventAt).toLocaleString() : t('nunca') })}</p>
          <div className="order-actions">
            <button type="button" className="ghost-button" onClick={() => setForm({ ...EMPTY, publicKey: info.publicKey, depositPercent: info.depositPercent })}>{t('Cambiar llaves')}</button>
            <button type="button" className="mini-button delete" disabled={busy} onClick={() => window.confirm(t('¿Desconectar Wompi? Tus clientes ya no podrán pagar en línea.')) && run(() => api.delete('/company/wompi'), 'No se pudo desconectar Wompi')}>{t('Desconectar')}</button>
          </div>
        </>
      )}
      {(!info.connected || form) && (
        form ? (
          <form className="form-grid" onSubmit={save}>
            <p className="muted small">{t('Las encuentras en tu panel de Wompi → Desarrolladores. Usa las de pruebas (pub_test_…) para ensayar y las de producción para cobrar de verdad.')}</p>
            <label>{t('Llave pública')}<input required autoComplete="off" spellCheck={false} placeholder="pub_prod_…" {...field('publicKey')} /></label>
            <label>{t('Secreto de integridad')}<input required type="password" autoComplete="off" placeholder="prod_integrity_…" {...field('integritySecret')} /></label>
            <label>{t('Secreto de eventos')}<input required type="password" autoComplete="off" placeholder="prod_events_…" {...field('eventsSecret')} /></label>
            <label>{t('Se cobra en línea')}
              <select {...field('depositPercent')}>
                {[100, 70, 60, 50, 40, 30].map((p) => <option key={p} value={p}>{p === 100 ? t('el total de la cotización') : t('un anticipo del {p} %', { p })}</option>)}
              </select>
            </label>
            <div className="order-actions">
              <button type="submit" className="primary-button" disabled={busy}>{busy ? t('Comprobando…') : t('Conectar Wompi')}</button>
              <button type="button" className="ghost-button" onClick={() => setForm(null)}>{t('Cancelar')}</button>
            </div>
          </form>
        ) : (
          <button type="button" className="primary-button" onClick={() => setForm({ ...EMPTY })}>{t('Conectar mi cuenta de Wompi')}</button>
        )
      )}
    </div>
  );
}
