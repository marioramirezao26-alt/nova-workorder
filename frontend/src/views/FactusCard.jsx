import { useEffect, useState } from 'react';
import { errorMessage } from '../api';
import { t } from '../i18n';

// «Factura electrónica DIAN» (en Integraciones, solo el administrador): la empresa conecta su cuenta de Factus. El secreto
// y la contraseña se escriben aquí, se prueban con Factus y se guardan cifrados; nunca se vuelven a mostrar.
const EMPTY = { env: 'pruebas', clientId: '', clientSecret: '', username: '', password: '', numberingRangeId: '' };

export default function FactusCard({ api }) {
  const [info, setInfo] = useState(null);
  const [form, setForm] = useState(null);
  const [busy, setBusy] = useState(false);
  useEffect(() => { api.get('/company/factus').then(({ data }) => setInfo(data)).catch(() => {}); }, []);
  if (!info || !info.available) return null;
  const field = (key) => ({ value: form[key], onChange: (e) => setForm({ ...form, [key]: e.target.value }) });

  const save = async (e) => {
    e.preventDefault();
    try {
      setBusy(true);
      setInfo((await api.put('/company/factus', { ...form, numberingRangeId: Number(form.numberingRangeId) })).data);
      setForm(null);
    } catch (error) {
      alert(errorMessage(error, t('No se pudo conectar la factura electrónica')));
    } finally {
      setBusy(false);
    }
  };
  const disconnect = async () => {
    if (!window.confirm(t('¿Desconectar la factura electrónica? Ya no podrás facturar cotizaciones.'))) return;
    try { setInfo((await api.delete('/company/factus')).data); } catch (error) { alert(errorMessage(error, t('No se pudo desconectar la factura electrónica'))); }
  };

  return (
    <div className="panel-box">
      <h3>{t('Factura electrónica DIAN')}</h3>
      <p className="muted">{t('Factura las cotizaciones aprobadas ante la DIAN con tu cuenta de Factus (proveedor tecnológico autorizado). El cliente descarga la factura desde su enlace.')}</p>
      {info.connected && !form && (
        <>
          <p>
            <span className="status-tag q-aprobada">{t('Conectado')}</span>{' '}
            <span className={`status-tag ${info.env === 'produccion' ? 'q-enviada' : 'q-vencida'}`}>{t(info.env === 'produccion' ? 'Producción' : 'Pruebas (habilitación)')}</span>{' '}
            {t('Rango {n}', { n: info.numberingRangeId })} · {info.username}
          </p>
          <div className="order-actions">
            <button type="button" className="ghost-button" onClick={() => setForm({ ...EMPTY, env: info.env, clientId: info.clientId, username: info.username, numberingRangeId: String(info.numberingRangeId || '') })}>{t('Cambiar datos')}</button>
            <button type="button" className="mini-button delete" onClick={disconnect}>{t('Desconectar')}</button>
          </div>
        </>
      )}
      {(!info.connected || form) && (form ? (
        <form className="form-grid" onSubmit={save}>
          <p className="muted small">{t('Los datos están en tu cuenta de Factus → API. Empieza en «Pruebas» (habilitación ante la DIAN) y pasa a «Producción» cuando la DIAN apruebe tu rango.')}</p>
          <label>{t('Ambiente')}
            <select {...field('env')}>
              <option value="pruebas">{t('Pruebas (habilitación)')}</option>
              <option value="produccion">{t('Producción')}</option>
            </select>
          </label>
          <label>client_id<input required autoComplete="off" spellCheck={false} {...field('clientId')} /></label>
          <label>client_secret<input required type="password" autoComplete="off" {...field('clientSecret')} /></label>
          <label>{t('Usuario (correo de Factus)')}<input required type="email" autoComplete="off" {...field('username')} /></label>
          <label>{t('Contraseña de Factus')}<input required type="password" autoComplete="new-password" {...field('password')} /></label>
          <label>{t('Id del rango de numeración')}<input required inputMode="numeric" pattern="\d+" {...field('numberingRangeId')} /></label>
          <div className="order-actions">
            <button type="submit" className="primary-button" disabled={busy}>{busy ? t('Comprobando…') : t('Conectar')}</button>
            <button type="button" className="ghost-button" onClick={() => setForm(null)}>{t('Cancelar')}</button>
          </div>
        </form>
      ) : (
        <button type="button" className="primary-button" onClick={() => setForm({ ...EMPTY })}>{t('Conectar mi cuenta de Factus')}</button>
      ))}
    </div>
  );
}
