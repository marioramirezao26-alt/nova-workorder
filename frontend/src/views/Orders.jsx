import { useEffect, useState } from 'react';
import { errorMessage } from '../api';
import { t } from '../i18n';
import ServiceReport from './ServiceReport';
import { Empty, PRIORITY, STATUS, PriorityTag, StatusTag, formatDateTime, formatDay, isOverdue, phoneRegion, whatsappLink } from '../ui';

const emptyForm = { title: '', description: '', status: 'pendiente', priority: 'media', client: '', assignedTo: '', dueDate: '', notes: '' };

// «Cotizaciones aprobadas sin técnico» (el aviso de Inicio): las órdenes que salieron de una cotización aprobada, siguen
// abiertas y nadie las tiene. Llega como #ordenes?sin-tecnico.
const UNASSIGNED = 'sin-tecnico';
const filterFromHash = () => (window.location.hash.split('?')[1] === UNASSIGNED ? UNASSIGNED : 'all');

// El WhatsApp para avisarle al técnico: qué orden, de quién, dónde, para cuándo y el enlace para entrar a verla.
const assignMessage = (order, tech) => [
  t('Hola {name}, te asigné una orden en NOVAWORKORDER: «{title}».', { name: tech.name.split(' ')[0], title: order.title }),
  order.client?.name || order.customerName ? t('Cliente: {name}', { name: order.client?.name || order.customerName }) : '',
  order.client?.address ? t('Dirección: {address}', { address: order.client.address }) : '',
  order.dueDate ? t('Para el {date}', { date: formatDay(order.dueDate) }) : '',
  t('Entra a verla: {url}', { url: `${window.location.origin}/#mis` }),
].filter(Boolean).join('\n');

// Órdenes de la empresa: buscar, filtrar, crear, editar y (el administrador) eliminar.
export default function Orders({ api, user }) {
  const canManage = user.role === 'admin' || user.role === 'tecnico';
  const [orders, setOrders] = useState([]);
  const [clients, setClients] = useState([]);
  const [techs, setTechs] = useState([]);
  const [filter, setFilter] = useState(filterFromHash);
  const [query, setQuery] = useState('');
  const [form, setForm] = useState(emptyForm);
  const [editingId, setEditingId] = useState(null);
  const [showForm, setShowForm] = useState(false);
  const [selected, setSelected] = useState(null);
  const [assigned, setAssigned] = useState(null);   // la orden recién asignada, para avisarle al técnico

  const load = async () => {
    try {
      const q = new URLSearchParams({ limit: '100' });
      if (filter === UNASSIGNED) {
        q.set('origin', 'quote');
        q.set('assigned', 'none');
        q.set('status', 'open');
      } else if (filter !== 'all') q.set('status', filter);
      if (query.trim()) q.set('q', query.trim());
      const { data } = await api.get(`/workorders?${q}`);
      setOrders(data.items || []);
    } catch (error) {
      console.error(error);
    }
  };

  useEffect(() => { load(); }, [filter]);
  // Volver a «Órdenes» desde la barra (#ordenes) quita el filtro del aviso de Inicio.
  useEffect(() => {
    const onHash = () => setFilter(filterFromHash());
    window.addEventListener('hashchange', onHash);
    return () => window.removeEventListener('hashchange', onHash);
  }, []);
  useEffect(() => {
    const t = setTimeout(load, 300);
    return () => clearTimeout(t);
  }, [query]);
  useEffect(() => {
    if (!canManage) return;
    api.get('/clients?limit=100').then(({ data }) => setClients(data.items || [])).catch(() => {});
    api.get('/users').then(({ data }) => setTechs((data.items || []).filter((u) => u.role !== 'cliente' && u.active !== false))).catch(() => {});
  }, []);

  const openNew = () => { setEditingId(null); setForm(emptyForm); setShowForm(true); };
  const openEdit = (order) => {
    setEditingId(order._id);
    setForm({
      title: order.title, description: order.description, status: order.status, priority: order.priority,
      client: order.client?._id || '', assignedTo: order.assignedTo?._id || '',
      dueDate: order.dueDate ? order.dueDate.slice(0, 10) : '', notes: order.notes || '',
    });
    setShowForm(true);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const save = async (e) => {
    e.preventDefault();
    try {
      const before = orders.find((o) => o._id === editingId);
      const { data } = editingId ? await api.put(`/workorders/${editingId}`, form) : await api.post('/workorders', form);
      // Se creó con técnico o se le cambió el técnico: botón para avisarle por WhatsApp (si tiene celular).
      const techId = data?.assignedTo?._id || '';
      const changed = techId && techId !== String(before?.assignedTo?._id || '');
      setAssigned(changed && techId !== user._id ? data : null);
      setShowForm(false);
      setForm(emptyForm);
      setEditingId(null);
      load();
    } catch (error) {
      alert(errorMessage(error, t('No se pudo guardar la orden')));
    }
  };

  const remove = async (order) => {
    if (!window.confirm(t('¿Eliminar la orden «{title}»?', { title: order.title }))) return;
    try {
      await api.delete(`/workorders/${order._id}`);
      setSelected(null);
      load();
    } catch (error) {
      alert(errorMessage(error, t('No se pudo eliminar la orden')));
    }
  };

  return (
    <section className="view">
      <header className="view-header">
        <div>
          <p className="eyebrow">{user.company?.name}</p>
          <h2>{t('Órdenes')}</h2>
        </div>
        {canManage && !showForm && <button type="button" className="primary-button small" onClick={openNew}>{t('+ Nueva orden')}</button>}
      </header>

      {assigned && (() => {
        const tech = techs.find((u) => u._id === assigned.assignedTo._id);
        const first = (tech?.name || assigned.assignedTo.name || '').split(' ')[0];
        return (
          <div className="panel-box highlight">
            <p>{t('«{title}» quedó asignada a {name}.', { title: assigned.title, name: tech?.name || assigned.assignedTo.name })}</p>
            {tech?.phone ? (
              <div className="order-actions">
                <a className="mini-button edit" href={whatsappLink(tech.phone, assignMessage(assigned, tech), phoneRegion(user.company))} target="_blank" rel="noreferrer">{t('Avisar a {name} por WhatsApp', { name: first })}</a>
                <button type="button" className="ghost-button" onClick={() => setAssigned(null)}>{t('Listo')}</button>
              </div>
            ) : (
              <p className="muted small">
                {user.role === 'admin' ? t('Agrega su celular en «Usuarios» para avisarle por WhatsApp.') : ''}{' '}
                <button type="button" className="link-button" onClick={() => setAssigned(null)}>{t('Listo')}</button>
              </p>
            )}
          </div>
        );
      })()}

      {showForm && (
        <div className="panel-box">
          <div className="panel-header">
            <h3>{editingId ? t('Editar orden') : t('Nueva orden')}</h3>
            <button type="button" className="ghost-button" onClick={() => setShowForm(false)}>{t('Cancelar')}</button>
          </div>
          <form className="order-form" onSubmit={save}>
            <label>{t('Título')}<input type="text" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} required /></label>
            <label>{t('Descripción')}<textarea rows="3" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} required /></label>
            <div className="two-columns">
              <label>{t('Cliente')}
                <select value={form.client} onChange={(e) => setForm({ ...form, client: e.target.value })}>
                  <option value="">{t('Sin cliente')}</option>
                  {clients.map((c) => <option key={c._id} value={c._id}>{c.name}</option>)}
                </select>
              </label>
              <label>{t('Técnico asignado')}
                <select value={form.assignedTo} onChange={(e) => setForm({ ...form, assignedTo: e.target.value })}>
                  <option value="">{t('Sin asignar')}</option>
                  {techs.map((t) => <option key={t._id} value={t._id}>{t.name}</option>)}
                </select>
              </label>
            </div>
            <div className="two-columns">
              <label>{t('Estado')}
                <select value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value })}>
                  {Object.entries(STATUS).map(([k, v]) => <option key={k} value={k}>{t(v)}</option>)}
                </select>
              </label>
              <label>{t('Prioridad')}
                <select value={form.priority} onChange={(e) => setForm({ ...form, priority: e.target.value })}>
                  {Object.entries(PRIORITY).map(([k, v]) => <option key={k} value={k}>{t(v)}</option>)}
                </select>
              </label>
            </div>
            <label>{t('Fecha límite')}<input type="date" value={form.dueDate} onChange={(e) => setForm({ ...form, dueDate: e.target.value })} /></label>
            <label>{t('Notas')}<textarea rows="2" value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} /></label>
            <button type="submit" className="primary-button">{editingId ? t('Guardar cambios') : t('Crear orden')}</button>
          </form>
        </div>
      )}

      <div className="toolbar">
        <input type="search" className="search-input" placeholder={t('Buscar por título, descripción o cliente…')} value={query} onChange={(e) => setQuery(e.target.value)} />
        <select className="filter-select" value={filter} onChange={(e) => setFilter(e.target.value)}>
          <option value="all">{t('Todas')}</option>
          {Object.entries(STATUS).map(([k, v]) => <option key={k} value={k}>{t(v)}</option>)}
          <option value={UNASSIGNED}>{t('Cotizaciones aprobadas sin técnico')}</option>
        </select>
      </div>

      {orders.length === 0 ? <Empty>{t('No hay órdenes con ese filtro.')}</Empty> : (
        <div className="card-list">
          {orders.map((order) => (
            <article key={order._id} className={`order-card compact ${selected === order._id ? 'selected' : ''} ${isOverdue(order) ? 'overdue' : ''}`}>
              <button type="button" className="card-button" onClick={() => setSelected(selected === order._id ? null : order._id)}>
                <div className="order-card-head">
                  <StatusTag status={order.status} />
                  <PriorityTag priority={order.priority} />
                  {order.dueDate && <span className={`due ${isOverdue(order) ? 'late' : ''}`}>{formatDay(order.dueDate)}</span>}
                </div>
                <h3>{order.title}</h3>
                <small className="muted">{order.client?.name || order.customerName || t('Sin cliente')} · {order.assignedTo?.name || t('Sin asignar')}</small>
              </button>
              {selected === order._id && (
                <div className="card-detail">
                  <p className="order-card-text">{order.description}</p>
                  {order.notes && <p className="notes-text">{order.notes}</p>}
                  <p className="muted">{t('Creada por {name}', { name: order.createdBy?.name || '—' })}</p>
                  <Place label={t('Inició')} point={order.startLocation} />
                  <Place label={t('Completó')} point={order.endLocation} />
                  <ServiceReport api={api} user={user} order={order}
                    editable={order.status !== 'cancelada' && (user.role === 'admin' || (user.role === 'tecnico' && order.status !== 'completada' && order.assignedTo?._id === user._id))}
                    onChange={(next) => setOrders((prev) => prev.map((o) => (o._id === next._id ? { ...o, ...next, client: o.client, assignedTo: o.assignedTo, createdBy: o.createdBy } : o)))} />
                  {/* una orden completada solo la corrige el administrador */}
                  {canManage && (user.role === 'admin' || order.status !== 'completada') && (
                    <div className="order-actions">
                      <button type="button" className="mini-button edit" onClick={() => openEdit(order)}>{t('Editar')}</button>
                      {user.role === 'admin' && <button type="button" className="mini-button delete" onClick={() => remove(order)}>{t('Eliminar')}</button>}
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

// Dónde estaba el técnico al iniciar o completar: enlace al mapa, distancia al cliente y aviso si estaba lejos.
function Place({ label, point }) {
  if (!point || !Number.isFinite(point.lat)) return null;
  const km = point.distanceM >= 1000 ? `${(point.distanceM / 1000).toFixed(1)} km` : `${point.distanceM} m`;
  return (
    <p className={point.offSite ? 'muted late' : 'muted'}>
      📍 {label} {formatDateTime(point.at)} ·{' '}
      <a className="inline-link" href={`https://www.google.com/maps/search/?api=1&query=${point.lat},${point.lng}`} target="_blank" rel="noreferrer">{t('ver en el mapa')}</a>
      {point.distanceM != null && <> · {point.offSite ? t('⚠ a {d} del cliente', { d: km }) : t('a {d} del cliente', { d: km })}</>}
    </p>
  );
}
