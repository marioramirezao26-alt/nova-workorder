import { useEffect, useState } from 'react';
import { errorMessage } from '../api';
import { formatDateTime } from '../ui';
import { t } from '../i18n';

// «Recomiéndanos» (solo el administrador, en Inicio): la opinión de su empresa para novaworkorder.com. Queda «en
// revisión» hasta que NOVA la apruebe; desde la app nadie la aprueba. Una por empresa: enviarla de nuevo la reemplaza.
const STATE = {
  pendiente: { label: 'En revisión', tone: 'pending', help: 'NOVA la revisa antes de publicarla. Si la cambias, vuelve a revisión.' },
  aprobada: { label: 'Publicada', tone: 'ok', help: 'Sale en novaworkorder.com con tu nombre, tu cargo y tu empresa.' },
  rechazada: { label: 'No publicada', tone: 'bad', help: 'NOVA no la publicó. Puedes escribirla de nuevo.' },
  retirada: { label: 'Retirada', tone: 'muted', help: 'Ya no sale en novaworkorder.com. Puedes escribirla de nuevo cuando quieras.' },
};
const EMPTY = { rating: 0, text: '', name: '', role: '', city: '', consent: false };

export default function Recommend({ api, user }) {
  const [data, setData] = useState(null);           // { review, consentText, limits }
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState(EMPTY);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    api.get('/company/review').then(({ data: d }) => setData(d)).catch(() => setData(null));
  }, []);
  if (!data) return null;

  const { review, consentText, limits } = data;
  const textLength = form.text.trim().length;

  const start = () => {
    setForm(review && review.status !== 'retirada'
      ? { rating: review.rating, text: review.text, name: review.name, role: review.role, city: review.city, consent: false }
      : { ...EMPTY, name: user.name || '' });
    setError('');
    setOpen(true);
  };

  // Lo mismo que valida el servidor, para avisar junto al formulario antes de enviar.
  const problem = () => {
    if (!form.rating) return t('Elige una calificación de 1 a 5 estrellas');
    if (textLength < limits.textMin || textLength > limits.textMax) return t('La opinión va de {min} a {max} caracteres', { min: limits.textMin, max: limits.textMax });
    if (form.name.trim().length < limits.nameMin) return t('Escribe tu nombre');
    if (!form.consent) return t('Para publicarla necesitamos tu autorización: marca la casilla');
    return '';
  };

  const submit = async (e) => {
    e.preventDefault();
    const p = problem();
    if (p) { setError(p); return; }
    try {
      setBusy(true);
      setError('');
      const { data: d } = await api.put('/company/review', { ...form, text: form.text.trim() });
      setData(d);
      setOpen(false);
    } catch (err) {
      setError(errorMessage(err, t('No se pudo guardar tu recomendación')));
    } finally {
      setBusy(false);
    }
  };

  const withdraw = async () => {
    if (!window.confirm(t('¿Retirar tu recomendación? Dejará de salir en novaworkorder.com.'))) return;
    try {
      const { data: d } = await api.delete('/company/review');
      setData(d);
    } catch (err) {
      alert(errorMessage(err, t('No se pudo retirar tu recomendación')));
    }
  };

  const state = review && STATE[review.status];
  return (
    <div className="panel-box recommend-box">
      <div className="recommend-head">
        <div>
          <h3>{t('Recomiéndanos')}</h3>
          <p className="muted">{t('¿NOVAWORKORDER le sirve a tu empresa? Cuéntalo en novaworkorder.com y ayuda a otros negocios a decidir.')}</p>
        </div>
        {state && <span className={`review-state ${state.tone}`}>{t(state.label)}</span>}
      </div>

      {review && !open && (
        <div className="recommend-current">
          <p className="review-stars" aria-label={t('{n} de 5 estrellas', { n: review.rating })}>{'★'.repeat(review.rating)}<span>{'★'.repeat(5 - review.rating)}</span></p>
          <blockquote>«{review.text}»</blockquote>
          <p className="muted small">{[review.name, review.role, review.companyName, review.city].filter(Boolean).join(' · ')}</p>
          <p className="muted small">{t(state.help)} {t('Enviada: {d}', { d: formatDateTime(review.submittedAt) })}</p>
          {review.status === 'rechazada' && review.reason && <p className="muted small">{t('Motivo: {r}', { r: review.reason })}</p>}
        </div>
      )}

      {!open && (
        <div className="order-actions">
          <button type="button" className="mini-button edit" onClick={start}>
            {!review || review.status === 'retirada' ? t('Escribir mi recomendación') : t('Cambiar mi recomendación')}
          </button>
          {review && review.status !== 'retirada' && <button type="button" className="ghost-button" onClick={withdraw}>{t('Retirarla')}</button>}
        </div>
      )}

      {open && (
        <form className="recommend-form" onSubmit={submit} noValidate>
          <fieldset className="star-input">
            <legend>{t('Tu calificación')}</legend>
            {[1, 2, 3, 4, 5].map((n) => (
              <label key={n} className={n <= form.rating ? 'on' : ''} title={t('{n} de 5 estrellas', { n })}>
                <input type="radio" name="rating" value={n} checked={form.rating === n} onChange={() => setForm({ ...form, rating: n })} />
                <span aria-hidden="true">★</span><span className="sr-only">{t('{n} de 5 estrellas', { n })}</span>
              </label>
            ))}
          </fieldset>
          <label>{t('Tu opinión')}
            <textarea rows={4} maxLength={limits.textMax} value={form.text} onChange={(e) => setForm({ ...form, text: e.target.value })}
              placeholder={t('¿Qué cambió en tu empresa desde que usan la app?')} aria-describedby="review-count" />
            <small id="review-count" className={`muted small ${textLength && textLength < limits.textMin ? 'warn' : ''}`}>
              {t('{n} de {max} caracteres (mínimo {min})', { n: textLength, max: limits.textMax, min: limits.textMin })}
            </small>
          </label>
          <div className="two-columns">
            <label>{t('Tu nombre')}<input value={form.name} maxLength={limits.nameMax} autoComplete="name" onChange={(e) => setForm({ ...form, name: e.target.value })} /></label>
            <label>{t('Tu cargo (opcional)')}<input value={form.role} maxLength={limits.roleMax} autoComplete="organization-title" onChange={(e) => setForm({ ...form, role: e.target.value })} /></label>
            <label>{t('Ciudad (opcional)')}<input value={form.city} maxLength={limits.cityMax} onChange={(e) => setForm({ ...form, city: e.target.value })} /></label>
            <label>{t('Empresa')}<input value={user.company?.name || ''} readOnly aria-readonly="true" /></label>
          </div>
          <label className="switch-row consent-row">
            <input type="checkbox" checked={form.consent} onChange={(e) => setForm({ ...form, consent: e.target.checked })} />
            <span>{t(consentText)}</span>
          </label>
          <p className="muted small">{t('No publicamos tu correo ni tu teléfono. NOVA la revisa antes de publicarla.')}</p>
          {error && <p className="form-error" role="alert">{error}</p>}
          <div className="order-actions">
            <button type="submit" className="primary-button" disabled={busy}>{busy ? t('Enviando…') : t('Enviar mi recomendación')}</button>
            <button type="button" className="ghost-button" onClick={() => setOpen(false)}>{t('Cancelar')}</button>
          </div>
        </form>
      )}
    </div>
  );
}
