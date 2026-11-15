import { useEffect, useState } from 'react';
import { errorMessage } from '../api';
import { t } from '../i18n';

// «Cobros con Mercado Pago» (en Integraciones, solo el administrador; empresas de Colombia y México): la empresa conecta
// SU cuenta para que sus clientes paguen en línea las cotizaciones aprobadas. El Access Token y la clave secreta del
// webhook se escriben aquí, se guardan cifrados y nunca se vuelven a mostrar. La URL de avisos se pega en la cuenta de
// Mercado Pago (Tus integraciones → Webhooks, evento Pagos) para que avise de cada pago.
// Si el servidor no tiene Mercado Pago encendido, la API responde 404 y la tarjeta no se muestra. Por ahora solo acepta
// credenciales de prueba (TEST-): ningún pago mueve plata real.
const EMPTY = { accessToken: '', webhookSecret: '', publicKey: '', depositPercent: 100 };
const PERCENTS = [100, 70, 60, 50, 40, 30];

export default function MercadoPagoCard({ api }) {
  const [info, setInfo] = useState(null);
  const [form, setForm] = useState(null);
  const [busy, setBusy] = useState(false);
  useEffect(() => { api.get('/company/mercadopago').then(({ data }) => setInfo(data)).catch(() => {}); }, []);
  if (!info || !info.available) return null;
  const field = (key) => ({ value: form[key], onChange: (e) => setForm({ ...form, [key]: e.target.value }) });
  const avisosUrl = `${window.location.origin}${info.avisosPath}`;

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
    const body = { ...form, depositPercent: Number(form.depositPercent) };
    if (!body.publicKey) delete body.publicKey;
    if (await run(() => api.put('/company/mercadopago', body), 'No se pudo conectar Mercado Pago')) setForm(null);
  };
  const percentOptions = PERCENTS.map((p) => <option key={p} value={p}>{p === 100 ? t('el total de la cotización') : t('un anticipo del {p} %', { p })}</option>);

  return (
    <div className="panel-box">
      <h3>{t('Cobros con Mercado Pago')}</h3>
      <p className="muted">{t('Tus clientes pagan en línea las cotizaciones aprobadas con tu cuenta de Mercado Pago. El dinero llega directo a tu cuenta; NOVA no lo toca ni guarda datos de tarjetas.')}</p>
      {!info.production && <p className="quote-banner no">{t('Modo de pruebas: por ahora solo se conectan credenciales de prueba (TEST-…). Ningún pago mueve dinero real.')}</p>}
      {info.connected && !form && (
        <>
          <p>
            <span className="status-tag q-aprobada">{t('Conectado')}</span>{' '}
            {info.test && <span className="status-tag q-vencida">{t('Pruebas')}</span>}{' '}
            <strong>{info.nickname}</strong>
          </p>
          {!info.usable && <p className="error">{t('Esta cuenta no es de prueba: no se usa hasta que NOVA active los cobros reales.')}</p>}
          <label className="switch-row">{t('Se cobra en línea')}
            <select value={info.depositPercent} disabled={busy} onChange={(e) => run(() => api.put('/company/mercadopago/deposit', { depositPercent: Number(e.target.value) }), 'No se pudo guardar el ajuste')}>
              {percentOptions}
            </select>
          </label>
          <p className="label">{t('URL de avisos (pégala en tu cuenta de Mercado Pago → Tus integraciones → Webhooks, evento «Pagos»)')}</p>
          <div className="secret-row">
            <code>{avisosUrl}</code>
            <button type="button" className="ghost-button" onClick={() => navigator.clipboard?.writeText(avisosUrl).then(() => alert(t('Copiado')))}>{t('Copiar')}</button>
          </div>
          <p className="muted small">{t('Sin esta URL en Mercado Pago, los pagos no quedan registrados aquí.')}</p>
          <p className="muted small">{t('Último aviso de Mercado Pago: {when}', { when: info.lastEventAt ? new Date(info.lastEventAt).toLocaleString() : t('nunca') })}</p>
          <div className="order-actions">
            <button type="button" className="ghost-button" onClick={() => setForm({ ...EMPTY, publicKey: info.publicKey, depositPercent: info.depositPercent })}>{t('Cambiar llaves')}</button>
            <button type="button" className="mini-button delete" disabled={busy} onClick={() => window.confirm(t('¿Desconectar Mercado Pago? Tus clientes ya no podrán pagar en línea.')) && run(() => api.delete('/company/mercadopago'), 'No se pudo desconectar Mercado Pago')}>{t('Desconectar')}</button>
          </div>
        </>
      )}
      {(!info.connected || form) && (
        form ? (
          <form className="form-grid" onSubmit={save}>
            <p className="muted small">{t('Las encuentras en tu cuenta de Mercado Pago → Tus integraciones → tu aplicación → Credenciales de prueba. La clave secreta está en Webhooks.')}</p>
            <label>{t('Access Token')}<input required type="password" autoComplete="off" spellCheck={false} placeholder="TEST-…" {...field('accessToken')} /></label>
            <label>{t('Clave secreta del webhook')}<input required type="password" autoComplete="off" spellCheck={false} {...field('webhookSecret')} /></label>
            <label>{t('Public Key (opcional)')}<input autoComplete="off" spellCheck={false} placeholder="TEST-…" {...field('publicKey')} /></label>
            <label>{t('Se cobra en línea')}
              <select {...field('depositPercent')}>{percentOptions}</select>
            </label>
            <div className="order-actions">
              <button type="submit" className="primary-button" disabled={busy}>{busy ? t('Comprobando…') : t('Conectar Mercado Pago')}</button>
              <button type="button" className="ghost-button" onClick={() => setForm(null)}>{t('Cancelar')}</button>
            </div>
          </form>
        ) : (
          <button type="button" className="primary-button" onClick={() => setForm({ ...EMPTY })}>{t('Conectar mi cuenta de Mercado Pago')}</button>
        )
      )}
    </div>
  );
}
