import { useEffect, useState } from 'react';
import { errorMessage } from '../api';
import { t } from '../i18n';
import { Empty, QuoteTag, formatDateTime, formatDay, money, quoteTotals, whatsappLink } from '../ui';

// «Cotizaciones»: se arman en borrador, se envían al cliente con un enlace (WhatsApp o copiado) y el cliente la aprueba
// o la rechaza sin cuenta. Al aprobarse se crea la orden de trabajo. Un usuario cliente ve aquí las suyas.
const FILTERS = ['todas', 'borrador', 'enviada', 'aprobada', 'rechazada', 'vencida'];
const FILTER_LABEL = { todas: 'Todas', borrador: 'Borradores', enviada: 'Enviadas', aprobada: 'Aprobadas', rechazada: 'Rechazadas', vencida: 'Vencidas' };
const colombiaDay = (offsetDays = 0) => new Date(Date.now() - 5 * 3600000 + offsetDays * 86400000).toISOString().slice(0, 10);
const newItem = (currency) => ({ description: '', qty: 1, unitPrice: '', taxRate: currency === 'USD' ? 0 : 19 });

function QuoteForm({ api, currency, initial, onSaved, onCancel }) {
  const [clients, setClients] = useState([]);
  const [form, setForm] = useState(initial || { client: '', title: '', notes: '', validUntil: colombiaDay(15), items: [newItem(currency)] });
  const [busy, setBusy] = useState(false);
  useEffect(() => { api.get('/clients?limit=100').then(({ data }) => setClients(data.items || [])).catch(() => {}); }, []);
  const setItem = (n, patch) => setForm({ ...form, items: form.items.map((i, k) => (k === n ? { ...i, ...patch } : i)) });
  const sums = quoteTotals(form.items, currency);

  const save = async (e) => {
    e.preventDefault();
    const body = { ...form, items: form.items.map((i) => ({ description: i.description, qty: Number(i.qty), unitPrice: Number(i.unitPrice), taxRate: Number(i.taxRate) })) };
    try {
      setBusy(true);
      const { data } = initial?._id ? await api.put(`/quotes/${initial._id}`, body) : await api.post('/quotes', body);
      onSaved(data);
    } catch (error) {
      alert(errorMessage(error, t('No se pudo guardar la cotización')));
    } finally {
      setBusy(false);
    }
  };

  return (
    <form className="panel-box form-grid quote-form" onSubmit={save}>
      <label>{t('Cliente')}
        <select required value={form.client} onChange={(e) => setForm({ ...form, client: e.target.value })}>
          <option value="">{t('Elige el cliente…')}</option>
          {clients.map((c) => <option key={c._id} value={c._id}>{c.name}{c.company ? ` · ${c.company}` : ''}</option>)}
        </select>
      </label>
      <label>{t('Título')}<input required maxLength={150} value={form.title} placeholder={t('Mantenimiento de 4 aires — piso 3')} onChange={(e) => setForm({ ...form, title: e.target.value })} /></label>
      <div className="quote-lines">
        <div className="quote-line head"><span>{t('Descripción')}</span><span>{t('Cant.')}</span><span>{t('Precio unitario')}</span><span>{t(currency === 'USD' ? 'Impuesto %' : 'IVA')}</span><span /></div>
        {form.items.map((item, n) => (
          <div key={n} className="quote-line">
            <input required maxLength={200} aria-label={t('Descripción')} value={item.description} onChange={(e) => setItem(n, { description: e.target.value })} />
            <input required type="number" min="0.01" step="0.01" aria-label={t('Cant.')} value={item.qty} onChange={(e) => setItem(n, { qty: e.target.value })} />
            <input required type="number" min="0" step={currency === 'USD' ? '0.01' : '1'} aria-label={t('Precio unitario')} value={item.unitPrice} onChange={(e) => setItem(n, { unitPrice: e.target.value })} />
            {currency === 'USD' ? (
              <input type="number" min="0" max="30" step="0.01" aria-label={t('Impuesto %')} value={item.taxRate} onChange={(e) => setItem(n, { taxRate: e.target.value })} />
            ) : (
              <select aria-label={t('IVA')} value={item.taxRate} onChange={(e) => setItem(n, { taxRate: e.target.value })}>
                <option value="19">19 %</option>
                <option value="5">5 %</option>
                <option value="0">{t('Sin IVA')}</option>
              </select>
            )}
            <button type="button" className="link-button" aria-label={t('Quitar')} disabled={form.items.length === 1} onClick={() => setForm({ ...form, items: form.items.filter((_, k) => k !== n) })}>×</button>
          </div>
        ))}
        {form.items.length < 50 && <button type="button" className="ghost-button" onClick={() => setForm({ ...form, items: [...form.items, newItem(currency)] })}>{t('+ Agregar renglón')}</button>}
      </div>
      <dl className="quote-sums">
        <div><dt>{t('Subtotal')}</dt><dd>{money(sums.subtotal, currency)}</dd></div>
        <div><dt>{t(currency === 'USD' ? 'Impuesto' : 'IVA')}</dt><dd>{money(sums.tax, currency)}</dd></div>
        <div className="grand"><dt>{t('Total')}</dt><dd>{money(sums.total, currency)}</dd></div>
      </dl>
      <label>{t('Válida hasta')}<input type="date" required min={colombiaDay()} value={form.validUntil} onChange={(e) => setForm({ ...form, validUntil: e.target.value })} /></label>
      <label>{t('Condiciones (garantía, forma de pago, tiempos)')}<textarea rows="3" maxLength={2000} value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} /></label>
      <div className="order-actions">
        <button type="submit" className="primary-button" disabled={busy}>{t('Guardar')}</button>
        <button type="button" className="ghost-button" onClick={onCancel}>{t('Cancelar')}</button>
      </div>
    </form>
  );
}

// Facturar una cotización aprobada (solo el administrador, con Factus conectado): a consumidor final o a nombre del cliente.
function InvoiceBox({ api, quote, onDone }) {
  const [open, setOpen] = useState(false);
  const [buyer, setBuyer] = useState({ docType: 'NIT', identification: '', dv: '', name: quote.client?.company || quote.client?.name || '', email: quote.client?.email || '' });
  const [busy, setBusy] = useState(false);
  const emit = async (withBuyer) => {
    try {
      setBusy(true);
      onDone((await api.post(`/quotes/${quote._id}/invoice`, withBuyer ? { buyer } : {})).data);
      setOpen(false);
    } catch (error) {
      alert(errorMessage(error, t('No se pudo facturar la cotización')));
    } finally {
      setBusy(false);
    }
  };
  if (quote.invoice?.cufe) {
    return <p className="muted">{t('Factura {n}', { n: quote.invoice.number })}{quote.invoice.buyerName ? ` · ${quote.invoice.buyerName}` : ''} · <a className="inline-link" href={quote.invoice.publicUrl} target="_blank" rel="noreferrer">{t('ver PDF')}</a></p>;
  }
  return (
    <div className="invoice-box">
      {quote.invoice?.error && <p className="muted late">{t('Último intento: {e}', { e: quote.invoice.error })}</p>}
      {!open ? (
        <div className="order-actions">
          <button type="button" className="mini-button edit" disabled={busy} onClick={() => setOpen(true)}>{t('Facturar (DIAN)')}</button>
        </div>
      ) : (
        <div className="form-grid">
          <div className="grid2">
            <label>{t('Documento')}
              <select value={buyer.docType} onChange={(e) => setBuyer({ ...buyer, docType: e.target.value })}>
                <option value="NIT">NIT</option><option value="CC">{t('Cédula')}</option><option value="CE">{t('Cédula de extranjería')}</option><option value="PP">{t('Pasaporte')}</option>
              </select>
            </label>
            <label>{t('Número')}<input inputMode="numeric" value={buyer.identification} onChange={(e) => setBuyer({ ...buyer, identification: e.target.value.replace(/\D/g, '') })} /></label>
          </div>
          {buyer.docType === 'NIT' && <label>{t('Dígito de verificación')}<input inputMode="numeric" maxLength={1} value={buyer.dv} onChange={(e) => setBuyer({ ...buyer, dv: e.target.value.replace(/\D/g, '') })} /></label>}
          <label>{t('Nombre o razón social')}<input maxLength={120} value={buyer.name} onChange={(e) => setBuyer({ ...buyer, name: e.target.value })} /></label>
          <label>{t('Correo para la factura')}<input type="email" value={buyer.email} onChange={(e) => setBuyer({ ...buyer, email: e.target.value })} /></label>
          <div className="order-actions">
            <button type="button" className="primary-button" disabled={busy || !buyer.identification || !buyer.name.trim()} onClick={() => emit(true)}>{busy ? t('Facturando…') : t('Facturar a este nombre')}</button>
            <button type="button" className="ghost-button" disabled={busy} onClick={() => emit(false)}>{t('A consumidor final')}</button>
            <button type="button" className="ghost-button" onClick={() => setOpen(false)}>{t('Cancelar')}</button>
          </div>
        </div>
      )}
    </div>
  );
}

export default function Quotes({ api, user, go }) {
  const currency = user.company?.lang === 'en' ? 'USD' : 'COP';
  const canWrite = user.role === 'admin' || user.role === 'tecnico';
  const [items, setItems] = useState(null);
  const [filter, setFilter] = useState('todas');
  const [selected, setSelected] = useState(null);
  const [form, setForm] = useState(null);
  const [links, setLinks] = useState({});
  const [busy, setBusy] = useState(false);
  const [invoicing, setInvoicing] = useState(false);
  useEffect(() => {
    if (user.role === 'admin') api.get('/company/factus').then(({ data }) => setInvoicing(Boolean(data.connected))).catch(() => {});
  }, []);

  const load = async () => {
    try {
      const { data } = await api.get(`/quotes?limit=200${filter !== 'todas' ? `&status=${filter}` : ''}`);
      setItems(data.items || []);
    } catch (error) {
      alert(errorMessage(error, t('No se pudieron cargar las cotizaciones')));
    }
  };
  useEffect(() => { load(); }, [filter]);

  const replace = (q) => setItems((prev) => (prev || []).map((x) => (x._id === q._id ? q : x)));
  const act = async (fn, fallback) => {
    try {
      setBusy(true);
      return await fn();
    } catch (error) {
      alert(errorMessage(error, t(fallback)));
      return null;
    } finally {
      setBusy(false);
    }
  };
  const send = (q) => act(async () => {
    const { data } = await api.post(`/quotes/${q._id}/send`);
    replace(data.quote);
    setLinks((prev) => ({ ...prev, [q._id]: `${window.location.origin}${data.path}` }));
  }, 'No se pudo enviar la cotización');
  const reopen = (q) => act(async () => replace((await api.post(`/quotes/${q._id}/reopen`)).data), 'No se pudo volver a borrador');
  const approve = (q) => window.confirm(t('¿El cliente aprobó la cotización #{n} por fuera del enlace (teléfono, en persona)? Se creará la orden de trabajo.', { n: q.number }))
    && act(async () => replace((await api.post(`/quotes/${q._id}/approve`, { note: t('Aprobada por la oficina') })).data), 'No se pudo aprobar la cotización');
  const convert = (q) => act(async () => replace((await api.post(`/quotes/${q._id}/convert`)).data), 'No se pudo crear la orden');
  const setPaid = (q, paid) => (!paid || window.confirm(t('¿Marcar la cotización #{n} como pagada (efectivo, transferencia)?', { n: q.number })))
    && act(async () => replace((await api.post(`/quotes/${q._id}/payment`, { status: paid ? 'pagado' : 'pendiente' })).data), 'No se pudo guardar el pago');
  const remove = (q) => window.confirm(t('¿Borrar la cotización #{n}?', { n: q.number }))
    && act(async () => { await api.delete(`/quotes/${q._id}`); setItems((prev) => prev.filter((x) => x._id !== q._id)); }, 'No se pudo borrar la cotización');
  const editable = (q) => user.role === 'admin' || (user.role === 'tecnico' && q.createdBy?._id === user._id);

  const saved = (q) => {
    setForm(null);
    setSelected(q._id);
    setItems((prev) => [q, ...(prev || []).filter((x) => x._id !== q._id)]);
  };

  return (
    <section className="view">
      <header className="view-header">
        <div>
          <p className="eyebrow">{user.company?.name}</p>
          <h2>{t('Cotizaciones')}</h2>
        </div>
        {canWrite && !form && <button type="button" className="primary-button" onClick={() => setForm({})}>{t('Nueva cotización')}</button>}
      </header>

      {form && (
        <QuoteForm api={api} currency={currency} onCancel={() => setForm(null)} onSaved={saved}
          initial={form._id ? { _id: form._id, client: form.client?._id || form.client, title: form.title, notes: form.notes, validUntil: new Date(new Date(form.validUntil).getTime() - 5 * 3600000).toISOString().slice(0, 10),
            items: form.items.map((i) => ({ description: i.description, qty: i.qty, unitPrice: i.unitPrice, taxRate: i.taxRate })) } : null} />
      )}

      <div className="segmented-control wrap">
        {FILTERS.filter((f) => user.role !== 'cliente' || f !== 'borrador').map((f) => (
          <button key={f} type="button" className={filter === f ? 'active' : ''} onClick={() => setFilter(f)}>{t(FILTER_LABEL[f])}</button>
        ))}
      </div>

      {!items ? <Empty>{t('Cargando…')}</Empty> : items.length === 0 ? (
        <Empty>{t(canWrite ? 'No hay cotizaciones con ese filtro. Arma una con «Nueva cotización».' : 'No hay cotizaciones con ese filtro.')}</Empty>
      ) : (
        <div className="card-list">
          {items.map((q) => (
            <article key={q._id} className={`order-card compact ${selected === q._id ? 'selected' : ''}`}>
              <button type="button" className="card-button" onClick={() => setSelected(selected === q._id ? null : q._id)}>
                <div className="order-card-head">
                  <QuoteTag status={q.status} />
                  {q.status === 'aprobada' && <span className={`status-tag ${q.payment?.status === 'pagado' ? 'q-aprobada' : 'q-vencida'}`}>{t(q.payment?.status === 'pagado' ? 'Pagada' : 'Por cobrar')}</span>}
                  <span className="due">#{q.number} · {t('válida hasta {d}', { d: formatDay(new Date(new Date(q.validUntil).getTime() - 5 * 3600000)) })}</span>
                </div>
                <h3>{q.title}</h3>
                <small className="muted">{q.client?.name || '—'} · <strong>{money(q.total, q.currency)}</strong></small>
              </button>
              {selected === q._id && (
                <div className="card-detail">
                  <table className="quote-table">
                    <tbody>
                      {q.items.map((i, n) => (
                        <tr key={n}><td>{i.qty} × {i.description}</td><td className="num">{money(i.amount, q.currency)}</td></tr>
                      ))}
                      <tr className="sum"><td>{t('Subtotal')}</td><td className="num">{money(q.subtotal, q.currency)}</td></tr>
                      <tr className="sum"><td>{t(q.currency === 'USD' ? 'Impuesto' : 'IVA')}</td><td className="num">{money(q.tax, q.currency)}</td></tr>
                      <tr className="grand"><td>{t('Total')}</td><td className="num">{money(q.total, q.currency)}</td></tr>
                    </tbody>
                  </table>
                  {q.notes && <p className="notes-text">{q.notes}</p>}
                  <p className="muted">{t('Armada por {name}', { name: q.createdBy?.name || '—' })}</p>
                  {q.decidedAt && (
                    <p className="muted">{t(q.status === 'aprobada' ? 'Aprobada por {name} ({via})' : 'Rechazada por {name} ({via})', { name: q.decidedBy, via: t(q.decidedVia === 'oficina' ? 'oficina' : 'enlace') })}{q.decisionNote ? ` — ${q.decisionNote}` : ''}</p>
                  )}
                  {q.status === 'aprobada' && (
                    <p className="muted">{q.payment?.status === 'pagado'
                      ? t(q.payment.method === 'wompi' ? 'Pagada con Wompi el {d}' : 'Marcada como pagada el {d}', { d: formatDateTime(q.payment.paidAt) })
                      : q.payment?.txStatus ? t('Por cobrar · último intento en Wompi: {s}', { s: q.payment.txStatus }) : t('Por cobrar')}</p>
                  )}
                  {q.status === 'aprobada' && (invoicing || q.invoice?.cufe) && user.role === 'admin' && <InvoiceBox api={api} quote={q} onDone={replace} />}
                  {q.workOrder && <p><button type="button" className="link-button" onClick={() => go?.('ordenes')}>{t('Orden creada: {title}', { title: q.workOrder.title })}</button></p>}

                  {links[q._id] && (
                    <div className="order-actions">
                      <a className="mini-button edit" href={whatsappLink(q.client?.phone, t('Hola {name}, te comparto la cotización #{n} «{title}» por {total}. Puedes revisarla y aprobarla aquí: {url}', { name: q.client?.name || '', n: q.number, title: q.title, total: money(q.total, q.currency), url: links[q._id] }), user.company?.lang)} target="_blank" rel="noreferrer">{t('Enviar por WhatsApp')}</a>
                      <a className="ghost-button" href={links[q._id]} target="_blank" rel="noreferrer">{t('Ver como el cliente')}</a>
                      <button type="button" className="ghost-button" onClick={() => navigator.clipboard?.writeText(links[q._id]).then(() => alert(t('Enlace copiado')))}>{t('Copiar enlace')}</button>
                    </div>
                  )}

                  {user.role === 'cliente' && q.publicToken && ['enviada'].includes(q.status) && (
                    <a className="primary-button" href={`/cotizacion/${q.publicToken}`}>{t('Revisar y aprobar')}</a>
                  )}

                  {editable(q) && (
                    <div className="order-actions">
                      {q.status === 'borrador' && <button type="button" className="ghost-button" disabled={busy} onClick={() => setForm(q)}>{t('Editar')}</button>}
                      {['borrador', 'enviada'].includes(q.status) && <button type="button" className="mini-button edit" disabled={busy} onClick={() => send(q)}>{t(q.status === 'borrador' ? 'Enviar al cliente' : 'Compartir enlace')}</button>}
                      {['enviada', 'vencida', 'rechazada'].includes(q.status) && <button type="button" className="ghost-button" disabled={busy} onClick={() => reopen(q)}>{t('Volver a borrador')}</button>}
                      {user.role === 'admin' && q.status === 'enviada' && <button type="button" className="ghost-button" disabled={busy} onClick={() => approve(q)}>{t('Aprobada por teléfono')}</button>}
                      {user.role === 'admin' && q.status === 'aprobada' && q.payment?.status !== 'pagado' && <button type="button" className="ghost-button" disabled={busy} onClick={() => setPaid(q, true)}>{t('Marcar pagada')}</button>}
                      {user.role === 'admin' && q.status === 'aprobada' && q.payment?.status === 'pagado' && q.payment.method !== 'wompi' && <button type="button" className="ghost-button" disabled={busy} onClick={() => setPaid(q, false)}>{t('Marcar por cobrar')}</button>}
                      {user.role === 'admin' && q.status === 'aprobada' && !q.workOrder && <button type="button" className="mini-button edit" disabled={busy} onClick={() => convert(q)}>{t('Crear la orden')}</button>}
                      {user.role === 'admin' && q.status !== 'aprobada' && <button type="button" className="mini-button delete" disabled={busy} onClick={() => remove(q)}>{t('Eliminar')}</button>}
                    </div>
                  )}
                </div>
              )}
            </article>
          ))}
        </div>
      )}
    </section>
  );
}
