import { useEffect, useState } from 'react';
import { errorMessage } from '../api';
import { t } from '../i18n';
import { Empty } from '../ui';

// «Checklists»: el administrador arma las plantillas por tipo de servicio (mantenimiento de aire, instalación de
// cámara…). El técnico elige una en la orden y la va marcando. Los puntos con * son obligatorios para completar.
const blank = () => ({ _id: null, name: '', items: [{ label: '', required: true }] });

export default function Checklists({ api, user, onUser }) {
  const [items, setItems] = useState(null);
  const [form, setForm] = useState(null);
  const [busy, setBusy] = useState(false);

  const load = () => api.get('/checklists?all=1').then(({ data }) => setItems(data.items || [])).catch((e) => alert(errorMessage(e, t('No se pudieron cargar las plantillas'))));
  useEffect(() => { load(); }, []);

  const save = async (e) => {
    e.preventDefault();
    const body = { name: form.name, items: form.items.filter((i) => i.label.trim()) };
    try {
      setBusy(true);
      if (form._id) await api.put(`/checklists/${form._id}`, body); else await api.post('/checklists', body);
      setForm(null);
      load();
    } catch (error) {
      alert(errorMessage(error, t('No se pudo guardar la plantilla')));
    } finally {
      setBusy(false);
    }
  };
  const toggleActive = async (tpl) => {
    try { await api.put(`/checklists/${tpl._id}`, { active: !tpl.active }); load(); } catch (error) { alert(errorMessage(error, t('No se pudo guardar la plantilla'))); }
  };
  const remove = async (tpl) => {
    if (!window.confirm(t('¿Borrar la plantilla «{name}»? Las órdenes que ya la usaron conservan su checklist.', { name: tpl.name }))) return;
    try { await api.delete(`/checklists/${tpl._id}`); load(); } catch (error) { alert(errorMessage(error, t('No se pudo borrar la plantilla'))); }
  };
  const requireSignature = async (enabled) => {
    try { onUser?.((await api.put('/company/require-signature', { enabled })).data); } catch (error) { alert(errorMessage(error, t('No se pudo guardar el ajuste'))); }
  };
  const setItem = (n, patch) => setForm({ ...form, items: form.items.map((i, k) => (k === n ? { ...i, ...patch } : i)) });

  return (
    <section className="view">
      <header className="view-header">
        <div>
          <p className="eyebrow">{t('Informe de servicio')}</p>
          <h2>{t('Checklists')}</h2>
        </div>
        {!form && <button type="button" className="primary-button" onClick={() => setForm(blank())}>{t('Nueva plantilla')}</button>}
      </header>

      <label className="switch-row">
        <input type="checkbox" checked={Boolean(user.company?.requireSignature)} onChange={(e) => requireSignature(e.target.checked)} />
        {t('Pedir la firma del cliente para que el técnico complete la orden')}
      </label>

      {form && (
        <form className="panel-box form-grid" onSubmit={save}>
          <label>{t('Nombre del tipo de servicio')}<input required maxLength={80} value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder={t('Mantenimiento de aire acondicionado')} /></label>
          {form.items.map((item, n) => (
            <div key={n} className="checklist-row">
              <input maxLength={160} value={item.label} placeholder={t('Punto {n}', { n: n + 1 })} onChange={(e) => setItem(n, { label: e.target.value })} />
              <label className="inline"><input type="checkbox" checked={item.required} onChange={(e) => setItem(n, { required: e.target.checked })} /> {t('Obligatorio')}</label>
              <button type="button" className="link-button" aria-label={t('Quitar')} onClick={() => setForm({ ...form, items: form.items.filter((_, k) => k !== n) })}>×</button>
            </div>
          ))}
          {form.items.length < 40 && <button type="button" className="ghost-button" onClick={() => setForm({ ...form, items: [...form.items, { label: '', required: false }] })}>{t('+ Agregar punto')}</button>}
          <div className="order-actions">
            <button type="submit" className="primary-button" disabled={busy}>{t('Guardar')}</button>
            <button type="button" className="ghost-button" onClick={() => setForm(null)}>{t('Cancelar')}</button>
          </div>
        </form>
      )}

      {!items ? <Empty>{t('Cargando…')}</Empty> : items.length === 0 ? (
        <Empty>{t('Todavía no hay plantillas. Crea una por cada tipo de servicio que hacen tus técnicos.')}</Empty>
      ) : (
        <div className="card-list">
          {items.map((tpl) => (
            <article key={tpl._id} className={`order-card compact ${tpl.active ? '' : 'muted'}`}>
              <h3>{tpl.name} {!tpl.active && <small className="muted">· {t('Inactiva')}</small>}</h3>
              <ul className="checklist-preview">
                {tpl.items.map((i, n) => <li key={n}>{i.label}{i.required && <b className="req"> *</b>}</li>)}
              </ul>
              <div className="order-actions">
                <button type="button" className="mini-button edit" onClick={() => setForm({ _id: tpl._id, name: tpl.name, items: tpl.items.map((i) => ({ ...i })) })}>{t('Editar')}</button>
                <button type="button" className="ghost-button" onClick={() => toggleActive(tpl)}>{t(tpl.active ? 'Desactivar' : 'Activar')}</button>
                <button type="button" className="ghost-button" onClick={() => remove(tpl)}>{t('Eliminar')}</button>
              </div>
            </article>
          ))}
        </div>
      )}
    </section>
  );
}
