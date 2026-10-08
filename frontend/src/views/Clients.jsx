import { useEffect, useState } from 'react';
import { errorMessage } from '../api';
import { Empty, mapsLink } from '../ui';

const emptyForm = { name: '', email: '', phone: '', company: '', address: '', active: true };

// Clientes de la empresa (las fichas a las que se asignan las órdenes).
export default function Clients({ api, user }) {
  const canManage = user.role === 'admin' || user.role === 'tecnico';
  const [clients, setClients] = useState([]);
  const [query, setQuery] = useState('');
  const [form, setForm] = useState(emptyForm);
  const [editingId, setEditingId] = useState(null);
  const [showForm, setShowForm] = useState(false);

  const load = async () => {
    try {
      const { data } = await api.get('/clients?limit=100');
      setClients(data.items || []);
    } catch (error) {
      console.error(error);
    }
  };
  useEffect(() => { load(); }, []);

  const openEdit = (client) => {
    setEditingId(client._id);
    setForm({ name: client.name, email: client.email, phone: client.phone || '', company: client.company || '', address: client.address || '', active: client.active });
    setShowForm(true);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const save = async (e) => {
    e.preventDefault();
    try {
      if (editingId) await api.put(`/clients/${editingId}`, form);
      else await api.post('/clients', form);
      setShowForm(false);
      setForm(emptyForm);
      setEditingId(null);
      load();
    } catch (error) {
      alert(errorMessage(error, 'No se pudo guardar el cliente'));
    }
  };

  const remove = async (client) => {
    if (!window.confirm(`¿Eliminar a «${client.name}»?`)) return;
    try {
      await api.delete(`/clients/${client._id}`);
      load();
    } catch (error) {
      alert(errorMessage(error, 'No se pudo eliminar el cliente'));
    }
  };

  const q = query.trim().toLowerCase();
  const shown = clients.filter((c) => !q || `${c.name} ${c.email} ${c.company || ''} ${c.phone || ''}`.toLowerCase().includes(q));

  return (
    <section className="view">
      <header className="view-header">
        <div>
          <p className="eyebrow">{user.company?.name}</p>
          <h2>Clientes</h2>
        </div>
        {canManage && !showForm && <button type="button" className="primary-button small" onClick={() => { setEditingId(null); setForm(emptyForm); setShowForm(true); }}>+ Nuevo cliente</button>}
      </header>

      {showForm && (
        <div className="panel-box">
          <div className="panel-header">
            <h3>{editingId ? 'Editar cliente' : 'Nuevo cliente'}</h3>
            <button type="button" className="ghost-button" onClick={() => setShowForm(false)}>Cancelar</button>
          </div>
          <form className="order-form" onSubmit={save}>
            <label>Nombre<input type="text" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required /></label>
            <div className="two-columns">
              <label>Email<input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} required /></label>
              <label>Teléfono<input type="tel" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} /></label>
            </div>
            <label>Empresa (razón social)<input type="text" value={form.company} onChange={(e) => setForm({ ...form, company: e.target.value })} /></label>
            <label>Dirección<textarea rows="2" value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} /></label>
            <label>Estado
              <select value={form.active ? 'active' : 'inactive'} onChange={(e) => setForm({ ...form, active: e.target.value === 'active' })}>
                <option value="active">Activo</option>
                <option value="inactive">Inactivo</option>
              </select>
            </label>
            <button type="submit" className="primary-button">{editingId ? 'Guardar cambios' : 'Crear cliente'}</button>
          </form>
        </div>
      )}

      <div className="toolbar">
        <input type="search" className="search-input" placeholder="Buscar cliente…" value={query} onChange={(e) => setQuery(e.target.value)} />
      </div>

      {shown.length === 0 ? <Empty>No hay clientes registrados.</Empty> : (
        <div className="card-list">
          {shown.map((client) => (
            <article key={client._id} className="order-card compact">
              <div className="order-card-head">
                <span className={`status-tag ${client.active ? 'completada' : 'cancelada'}`}>{client.active ? 'Activo' : 'Inactivo'}</span>
              </div>
              <h3>{client.name}</h3>
              {client.company && <small className="muted">{client.company}</small>}
              <div className="client-box">
                <a className="contact-link" href={`mailto:${client.email}`}>✉ {client.email}</a>
                {client.phone && <a className="contact-link" href={`tel:${client.phone}`}>📞 {client.phone}</a>}
                {client.address && <a className="contact-link" href={mapsLink(client.address)} target="_blank" rel="noreferrer">📍 {client.address}</a>}
              </div>
              {canManage && (
                <div className="order-actions">
                  <button type="button" className="mini-button edit" onClick={() => openEdit(client)}>Editar</button>
                  {user.role === 'admin' && <button type="button" className="mini-button delete" onClick={() => remove(client)}>Eliminar</button>}
                </div>
              )}
            </article>
          ))}
        </div>
      )}
    </section>
  );
}
