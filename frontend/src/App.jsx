import { useEffect, useState } from 'react';
import axios from 'axios';

const initialForm = {
  title: '',
  description: '',
  status: 'pendiente',
  priority: 'media',
  customerName: '',
  notes: '',
};

const API_URL = '/api';

function App() {
  const [token, setToken] = useState(localStorage.getItem('nova-token') || '');
  const [user, setUser] = useState(null);
  const [workOrders, setWorkOrders] = useState([]);
  const [loading, setLoading] = useState(false);
  const [authMode, setAuthMode] = useState('login');
  const [form, setForm] = useState(initialForm);
  const [authForm, setAuthForm] = useState({
    name: '',
    email: '',
    password: '',
    role: 'cliente',
  });

  const api = axios.create({
    baseURL: API_URL,
    headers: {
      Authorization: token ? `Bearer ${token}` : '',
    },
  });

  useEffect(() => {
    if (!token) {
      setUser(null);
      return;
    }

    localStorage.setItem('nova-token', token);
    fetchProfile();
    fetchWorkOrders();
  }, [token]);

  const fetchProfile = async () => {
    try {
      const response = await api.get('/auth/profile');
      setUser(response.data);
    } catch (error) {
      console.error('Error obteniendo perfil:', error);
      logout();
    }
  };

  const fetchWorkOrders = async () => {
    try {
      setLoading(true);
      const response = await api.get('/workorders');
      setWorkOrders(response.data);
    } catch (error) {
      console.error('Error cargando órdenes:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleAuthSubmit = async (e) => {
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

      const response = await axios.post(`${API_URL}${endpoint}`, payload);
      const newToken = response.data.token;
      setToken(newToken);
      setUser({
        name: response.data.name,
        email: response.data.email,
        role: response.data.role,
      });
      setAuthForm({ name: '', email: '', password: '', role: 'cliente' });
    } catch (error) {
      alert(error.response?.data?.message || 'Error de autenticación');
    }
  };

  const handleSubmitWorkOrder = async (e) => {
    e.preventDefault();

    try {
      await api.post('/workorders', form);
      setForm(initialForm);
      fetchWorkOrders();
    } catch (error) {
      alert(error.response?.data?.message || 'No se pudo crear la orden');
    }
  };

  const logout = () => {
    localStorage.removeItem('nova-token');
    setToken('');
    setUser(null);
    setWorkOrders([]);
  };

  return (
    <div className="app-shell">
      {!token || !user ? (
        <section className="auth-panel">
          <div className="brand-box">
            <span className="badge">NOVA</span>
            <h1>WORKORDER</h1>
            <p>Gestión inteligente de órdenes y tareas</p>
          </div>

          <form className="auth-form" onSubmit={handleAuthSubmit}>
            <div className="switcher">
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

            <button className="primary-btn" type="submit">
              {authMode === 'login' ? 'Entrar' : 'Crear cuenta'}
            </button>
          </form>
        </section>
      ) : (
        <main className="dashboard">
          <header className="topbar">
            <div>
              <p className="label">Bienvenido</p>
              <h2>{user.name}</h2>
            </div>
            <button className="secondary-btn" onClick={logout}>
              Cerrar sesión
            </button>
          </header>

          <section className="stats-grid">
            <div className="stat-card">
              <span>Total</span>
              <strong>{workOrders.length}</strong>
            </div>
            <div className="stat-card">
              <span>Pendientes</span>
              <strong>
                {workOrders.filter((item) => item.status === 'pendiente').length}
              </strong>
            </div>
            <div className="stat-card">
              <span>En proceso</span>
              <strong>
                {workOrders.filter((item) => item.status === 'en_proceso').length}
              </strong>
            </div>
          </section>

          <section className="content-grid">
            <form className="work-order-form" onSubmit={handleSubmitWorkOrder}>
              <h3>Nueva orden de trabajo</h3>

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
                  rows="4"
                  value={form.description}
                  onChange={(e) => setForm({ ...form, description: e.target.value })}
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
                Observaciones
                <textarea
                  rows="3"
                  value={form.notes}
                  onChange={(e) => setForm({ ...form, notes: e.target.value })}
                />
              </label>

              <button className="primary-btn" type="submit">
                Guardar orden
              </button>
            </form>

            <div className="order-list">
              <h3>Órdenes</h3>

              {loading ? (
                <p>Cargando...</p>
              ) : workOrders.length === 0 ? (
                <p>No hay órdenes registradas.</p>
              ) : (
                workOrders.map((order) => (
                  <article key={order._id} className="order-card">
                    <div className="order-head">
                      <h4>{order.title}</h4>
                      <span className={`tag ${order.status}`}>{order.status}</span>
                    </div>
                    <p>{order.description}</p>
                    <small>
                      {order.customerName || 'Cliente no especificado'} • {order.priority}
                    </small>
                  </article>
                ))
              )}
            </div>
          </section>
        </main>
      )}
    </div>
  );
}

export default App;
