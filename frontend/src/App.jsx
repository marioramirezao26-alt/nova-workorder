import { useMemo, useState } from 'react';
import axios from 'axios';

const API_URL = '/api';
const storageKey = 'nova-token';

const emptyForm = {
  title: '',
  description: '',
  status: 'pendiente',
  priority: 'media',
  customerName: '',
  notes: '',
};

function App() {
  const [token, setToken] = useState(localStorage.getItem(storageKey) || '');
  const [user, setUser] = useState(null);
  const [authMode, setAuthMode] = useState('login');
  const [loading, setLoading] = useState(false);
  const [workOrders, setWorkOrders] = useState([]);
  const [selectedOrder, setSelectedOrder] = useState(null);
  const [form, setForm] = useState(emptyForm);
  const [authForm, setAuthForm] = useState({
    name: '',
    email: '',
    password: '',
    role: 'cliente',
  });

  const api = useMemo(
    () =>
      axios.create({
        baseURL: API_URL,
        headers: {
          Authorization: token ? `Bearer ${token}` : '',
        },
      }),
    [token]
  );

  const fetchProfile = async () => {
    try {
      const { data } = await api.get('/auth/profile');
      setUser(data);
    } catch (error) {
      logout();
    }
  };

  const fetchWorkOrders = async () => {
    try {
      setLoading(true);
      const { data } = await api.get('/workorders');
      setWorkOrders(data);
      if (!selectedOrder && data.length) {
        setSelectedOrder(data[0]);
      }
    } catch (error) {
      console.error('Error fetching work orders:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleLoginRegister = async (e) => {
    e.preventDefault();

    try {
      const endpoint = authMode === 'login' ? '/auth/login' : '/auth/register';
      const payload =
        authMode === 'login'
          ? {
              email: authForm.email,
              password: authForm.password,
            }
          : authForm;

      const { data } = await axios.post(`${API_URL}${endpoint}`, payload);
      const nextToken = data.token;
      localStorage.setItem(storageKey, nextToken);
      setToken(nextToken);
      setUser({
        name: data.name,
        email: data.email,
        role: data.role,
      });
      setAuthForm({ name: '', email: '', password: '', role: 'cliente' });
    } catch (error) {
      alert(error.response?.data?.message || 'No se pudo completar la operación');
    }
  };

  const handleCreateWorkOrder = async (e) => {
    e.preventDefault();

    try {
      await api.post('/workorders', form);
      setForm(emptyForm);
      fetchWorkOrders();
    } catch (error) {
      alert(error.response?.data?.message || 'No se pudo crear la orden');
    }
  };

  const logout = () => {
    localStorage.removeItem(storageKey);
    setToken('');
    setUser(null);
    setWorkOrders([]);
    setSelectedOrder(null);
  };

  const stats = {
    total: workOrders.length,
    pending: workOrders.filter((item) => item.status === 'pendiente').length,
    inProgress: workOrders.filter((item) => item.status === 'en_proceso').length,
    completed: workOrders.filter((item) => item.status === 'completada').length,
  };

  if (!token || !user) {
    return (
      <div className="auth-layout">
        <div className="auth-hero">
          <div className="hero-badge">NOVA</div>
          <h1>WORKORDER</h1>
          <p>Gestión moderna de órdenes y operaciones.</p>
          <ul>
            <li>Seguimiento en tiempo real</li>
            <li>Control de prioridad</li>
            <li>Panel de trabajo centralizado</li>
          </ul>
        </div>

        <form className="auth-card" onSubmit={handleLoginRegister}>
          <div className="segmented-control">
            <button
              type="button"
              className={authMode === 'login' ? 'active' : ''}
              onClick={() => setAuthMode('login')}
            >
              Iniciar sesión
            </button>
            <button
              type="button"
              className={authMode === 'register' ? 'active' : ''}
              onClick={() => setAuthMode('register')}
            >
              Registrarse
            </button>
          </div>

          {authMode === 'register' && (
            <label>
              Nombre
              <input
                type="text"
                value={authForm.name}
                onChange={(e) =>
                  setAuthForm((prev) => ({ ...prev, name: e.target.value }))
                }
                required
              />
            </label>
          )}

          <label>
            Email
            <input
              type="email"
              value={authForm.email}
              onChange={(e) =>
                setAuthForm((prev) => ({ ...prev, email: e.target.value }))
              }
              required
            />
          </label>

          <label>
            Contraseña
            <input
              type="password"
              value={authForm.password}
              onChange={(e) =>
                setAuthForm((prev) => ({ ...prev, password: e.target.value }))
              }
              required
            />
          </label>

          {authMode === 'register' && (
            <label>
              Rol
              <select
                value={authForm.role}
                onChange={(e) =>
                  setAuthForm((prev) => ({ ...prev, role: e.target.value }))
                }
              >
                <option value="cliente">Cliente</option>
                <option value="tecnico">Técnico</option>
                <option value="admin">Administrador</option>
              </select>
            </label>
          )}

          <button type="submit" className="primary-button">
            {authMode === 'login' ? 'Entrar' : 'Crear cuenta'}
          </button>
        </form>
      </div>
    );
  }

  return (
    <div className="dashboard-layout">
      <aside className="sidebar">
        <div className="sidebar-header">
          <div className="logo">N</div>
          <div>
            <h3>NOVA</h3>
            <small>Workorder</small>
          </div>
        </div>

        <nav className="nav">
          <button className="nav-item active">Dashboard</button>
          <button className="nav-item">Órdenes</button>
          <button className="nav-item">Usuarios</button>
          <button className="nav-item">Informes</button>
        </nav>

        <div className="profile-box">
          <p>{user.name}</p>
          <small>{user.role}</small>
          <button className="logout-button" onClick={logout}>Cerrar sesión</button>
        </div>
      </aside>

      <main className="main-panel">
        <header className="topbar">
          <div>
            <p className="eyebrow">Resumen</p>
            <h2>Panel principal</h2>
          </div>
          <button className="primary-button small">Nueva tarea</button>
        </header>

        <section className="stats-grid">
          <div className="stat-card">
            <span>Total</span>
            <strong>{stats.total}</strong>
          </div>
          <div className="stat-card">
            <span>Pendientes</span>
            <strong>{stats.pending}</strong>
          </div>
          <div className="stat-card">
            <span>En proceso</span>
            <strong>{stats.inProgress}</strong>
          </div>
          <div className="stat-card">
            <span>Completadas</span>
            <strong>{stats.completed}</strong>
          </div>
        </section>

        <section className="content-grid">
          <div className="panel-box">
            <h3>Crear orden</h3>
            <form className="order-form" onSubmit={handleCreateWorkOrder}>
              <label>
                Título
                <input
                  type="text"
                  value={form.title}
                  onChange={(e) => setForm({ ...form, title: e.target.value })}
                  required
                />
              </label>

              <label>
                Descripción
                <textarea
                  rows="3"
                  value={form.description}
                  onChange={(e) =>
                    setForm({ ...form, description: e.target.value })
                  }
                  required
                />
              </label>

              <div className="two-columns">
                <label>
                  Estado
                  <select
                    value={form.status}
                    onChange={(e) => setForm({ ...form, status: e.target.value })}
                  >
                    <option value="pendiente">Pendiente</option>
                    <option value="en_proceso">En proceso</option>
                    <option value="completada">Completada</option>
                    <option value="cancelada">Cancelada</option>
                  </select>
                </label>

                <label>
                  Prioridad
                  <select
                    value={form.priority}
                    onChange={(e) => setForm({ ...form, priority: e.target.value })}
                  >
                    <option value="baja">Baja</option>
                    <option value="media">Media</option>
                    <option value="alta">Alta</option>
                    <option value="urgente">Urgente</option>
                  </select>
                </label>
              </div>

              <label>
                Cliente
                <input
                  type="text"
                  value={form.customerName}
                  onChange={(e) => setForm({ ...form, customerName: e.target.value })}
                />
              </label>

              <label>
                Notas
                <textarea
                  rows="2"
                  value={form.notes}
                  onChange={(e) => setForm({ ...form, notes: e.target.value })}
                />
              </label>

              <button type="submit" className="primary-button">Guardar orden</button>
            </form>
          </div>

          <div className="panel-box">
            <h3>Órdenes recientes</h3>
            {loading ? (
              <p className="muted">Cargando...</p>
            ) : (
              <div className="order-list">
                {workOrders.length === 0 ? (
                  <p className="muted">No hay órdenes registradas.</p>
                ) : (
                  workOrders.map((order) => (
                    <button
                      key={order._id}
                      className={`order-item ${selectedOrder?._id === order._id ? 'selected' : ''}`}
                      onClick={() => setSelectedOrder(order)}
                    >
                      <div className="order-headline">
                        <strong>{order.title}</strong>
                        <span className={`status-tag ${order.status}`}>{order.status}</span>
                      </div>
                      <small>{order.customerName || 'Cliente sin nombre'}</small>
                    </button>
                  ))
                )}
              </div>
            )}
          </div>
        </section>

        {selectedOrder && (
          <section className="detail-panel panel-box">
            <h3>Detalle de orden</h3>
            <div className="detail-grid">
              <div>
                <p className="label">Título</p>
                <strong>{selectedOrder.title}</strong>
              </div>
              <div>
                <p className="label">Prioridad</p>
                <strong>{selectedOrder.priority}</strong>
              </div>
              <div>
                <p className="label">Estado</p>
                <strong>{selectedOrder.status}</strong>
              </div>
              <div>
                <p className="label">Cliente</p>
                <strong>{selectedOrder.customerName || 'Sin cliente'}</strong>
              </div>
            </div>
            <div className="detail-description">
              <p className="label">Descripción</p>
              <p>{selectedOrder.description}</p>
            </div>
          </section>
        )}
      </main>
    </div>
  );
}

export default App;
