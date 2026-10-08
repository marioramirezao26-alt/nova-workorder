import { useEffect, useState } from 'react';
import { errorMessage } from '../api';
import { ROLE } from '../ui';

const emptyForm = { name: '', email: '', role: 'tecnico', client: '' };

// Usuarios de la empresa (solo el administrador): crear con contraseña temporal, desactivar, nueva contraseña.
export default function Users({ api, user }) {
  const [users, setUsers] = useState([]);
  const [clients, setClients] = useState([]);
  const [form, setForm] = useState(emptyForm);
  const [issued, setIssued] = useState(null);

  const load = async () => {
    try {
      const { data } = await api.get('/users');
      setUsers(data.items || []);
    } catch (error) {
      console.error(error);
    }
  };
  useEffect(() => {
    load();
    api.get('/clients?limit=100').then(({ data }) => setClients(data.items || [])).catch(() => {});
  }, []);

  const create = async (e) => {
    e.preventDefault();
    try {
      const payload = { ...form, client: form.role === 'cliente' && form.client ? form.client : undefined };
      const { data } = await api.post('/users', payload);
      setIssued({ email: data.user.email, password: data.temporaryPassword });
      setForm(emptyForm);
      load();
    } catch (error) {
      alert(errorMessage(error, 'No se pudo crear el usuario'));
    }
  };

  const update = async (target, changes) => {
    try {
      const { data } = await api.put(`/users/${target._id}`, changes);
      if (data.temporaryPassword) setIssued({ email: target.email, password: data.temporaryPassword });
      load();
    } catch (error) {
      alert(errorMessage(error, 'No se pudo actualizar el usuario'));
    }
  };

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(`Usuario: ${issued.email}\nContraseña temporal: ${issued.password}\nEntra en ${window.location.origin}`);
      alert('Copiado. Envíaselo al usuario por un canal privado.');
    } catch {
      /* el portapapeles puede no estar disponible: el texto queda a la vista */
    }
  };

  return (
    <section className="view">
      <header className="view-header">
        <div>
          <p className="eyebrow">{user.company?.name}</p>
          <h2>Usuarios</h2>
        </div>
      </header>

      {issued && (
        <div className="panel-box highlight">
          <p className="label">Contraseña temporal de {issued.email} · se muestra una sola vez</p>
          <p className="temp-password">{issued.password}</p>
          <p className="muted">Entrégasela al usuario: la cambiará al entrar.</p>
          <div className="order-actions">
            <button type="button" className="mini-button edit" onClick={copy}>Copiar acceso</button>
            <button type="button" className="ghost-button" onClick={() => setIssued(null)}>Listo</button>
          </div>
        </div>
      )}

      <div className="panel-box">
        <h3>Nuevo usuario</h3>
        <form className="order-form" onSubmit={create}>
          <div className="two-columns">
            <label>Nombre<input type="text" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required /></label>
            <label>Email<input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} required /></label>
          </div>
          <div className="two-columns">
            <label>Rol
              <select value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value })}>
                <option value="tecnico">Técnico</option>
                <option value="admin">Administrador</option>
                <option value="cliente">Cliente (consulta sus órdenes)</option>
              </select>
            </label>
            {form.role === 'cliente' && (
              <label>Ficha de cliente
                <select value={form.client} onChange={(e) => setForm({ ...form, client: e.target.value })} required>
                  <option value="">Elige el cliente</option>
                  {clients.map((c) => <option key={c._id} value={c._id}>{c.name}</option>)}
                </select>
              </label>
            )}
          </div>
          <button type="submit" className="primary-button">Crear usuario</button>
        </form>
      </div>

      <div className="card-list">
        {users.map((u) => (
          <article key={u._id} className="order-card compact">
            <div className="order-card-head">
              <span className={`status-tag ${u.active ? 'completada' : 'cancelada'}`}>{u.active ? ROLE[u.role] : 'Inactivo'}</span>
              {u.mustChangePassword && <span className="muted">aún no entra</span>}
            </div>
            <h3>{u.name}</h3>
            <small className="muted">{u.email}</small>
            {u._id !== user._id && (
              <div className="order-actions">
                <button type="button" className="mini-button edit" onClick={() => update(u, { active: !u.active })}>{u.active ? 'Desactivar' : 'Activar'}</button>
                <button type="button" className="mini-button edit" onClick={() => {
                  if (window.confirm(`¿Generar una contraseña temporal nueva para ${u.email}?`)) update(u, { resetPassword: true });
                }}>Nueva contraseña</button>
              </div>
            )}
          </article>
        ))}
      </div>
    </section>
  );
}
