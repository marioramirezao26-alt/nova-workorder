import { useEffect, useMemo, useState } from 'react';
import axios from 'axios';

// En desarrollo, el proxy de Vite envía /api al backend; VITE_API_URL permite apuntar a otro servidor.
const API_URL = `${import.meta.env.VITE_API_URL || ''}/api`;
const storageKey = 'nova-token';

const emptyForm = {
  title: '',
  description: '',
  status: 'pendiente',
  priority: 'media',
  customerName: '',
  notes: '',
};

const emptyClientForm = {
  name: '',
  email: '',
  phone: '',
  company: '',
  address: '',
  active: true,
};

const statusLabels = {
  pendiente: 'Pendientes',
  en_proceso: 'En proceso',
  completada: 'Completadas',
  cancelada: 'Canceladas',
};

function App() {
  const [token, setToken] = useState(localStorage.getItem(storageKey) || '');
  const [user, setUser] = useState(null);
  const [authMode, setAuthMode] = useState('login');
  const [loading, setLoading] = useState(false);
  const [workOrders, setWorkOrders] = useState([]);
  const [clients, setClients] = useState([]);
  const [dashboard, setDashboard] = useState({
    total: 0,
    pending: 0,
    inProgress: 0,
    completed: 0,
    cancelled: 0,
    statusBreakdown: {
      pendiente: 0,
      en_proceso: 0,
      completada: 0,
      cancelada: 0,
    },
    priorities: [],
    recentOrders: [],
    monthlyTrend: [],
    topClients: [],
  });
  const [selectedOrder, setSelectedOrder] = useState(null);
  const [selectedClient, setSelectedClient] = useState(null);
  const [editingId, setEditingId] = useState(null);
  const [editingClientId, setEditingClientId] = useState(null);
  const [filter, setFilter] = useState('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [form, setForm] = useState(emptyForm);
  const [clientForm, setClientForm] = useState(emptyClientForm);
  const [authForm, setAuthForm] = useState({
    name: '',
    email: '',
    password: '',
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

  const canManageOrders = user?.role === 'admin' || user?.role === 'tecnico';
  const canManageClients = user?.role === 'admin' || user?.role === 'tecnico';

  useEffect(() => {
    if (!token) {
      setUser(null);
      return;
    }

    fetchProfile();
    fetchWorkOrders();
    fetchClients();
    fetchDashboard();
  }, [token]);

  useEffect(() => {
    if (token) {
      fetchWorkOrders();
      fetchDashboard();
    }
  }, [filter]);

  const fetchProfile = async () => {
    try {
      const { data } = await api.get('/auth/profile');
      setUser(data);
    } catch (error) {
      logout();
    }
  };

  const fetchDashboard = async () => {
    try {
      const { data } = await api.get('/dashboard/summary');
      setDashboard(data);
    } catch (error) {
      console.error('Error fetching dashboard:', error);
    }
  };

  const fetchWorkOrders = async () => {
    try {
      setLoading(true);
      const query = filter !== 'all' ? `?status=${filter}` : '';
      const { data } = await api.get(`/workorders${query}`);
      const items = data.items || data;
      setWorkOrders(items);
      if (!selectedOrder && items.length) {
        setSelectedOrder(items[0]);
      }
      if (selectedOrder && !items.find((order) => order._id === selectedOrder._id)) {
        setSelectedOrder(items[0] || null);
      }
    } catch (error) {
      console.error('Error fetching work orders:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchClients = async () => {
    try {
      const { data } = await api.get('/clients');
      const items = data.items || data;
      setClients(items);
      if (!selectedClient && items.length) {
        setSelectedClient(items[0]);
      }
    } catch (error) {
      console.error('Error fetching clients:', error);
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
      setAuthForm({ name: '', email: '', password: '' });
    } catch (error) {
      alert(error.response?.data?.message || 'No se pudo completar la operación');
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!canManageOrders) {
      alert('No tienes permisos para gestionar órdenes');
      return;
    }

    try {
      if (editingId) {
        await api.put(`/workorders/${editingId}`, form);
      } else {
        await api.post('/workorders', form);
      }

      setForm(emptyForm);
      setEditingId(null);
      fetchWorkOrders();
      fetchDashboard();
    } catch (error) {
      alert(error.response?.data?.message || 'No se pudo guardar la orden');
    }
  };

  const handleClientSubmit = async (e) => {
    e.preventDefault();

    if (!canManageClients) {
      alert('No tienes permisos para gestionar clientes');
      return;
    }

    try {
      if (editingClientId) {
        await api.put(`/clients/${editingClientId}`, clientForm);
      } else {
        await api.post('/clients', clientForm);
      }

      setClientForm(emptyClientForm);
      setEditingClientId(null);
      fetchClients();
    } catch (error) {
      alert(error.response?.data?.message || 'No se pudo guardar el cliente');
    }
  };

  const handleEditOrder = (order) => {
    if (!canManageOrders) return;
    setEditingId(order._id);
    setSelectedOrder(order);
    setForm({
      title: order.title,
      description: order.description,
      status: order.status,
      priority: order.priority,
      customerName: order.customerName || '',
      notes: order.notes || '',
    });
  };

  const handleEditClient = (client) => {
    if (!canManageClients) return;
    setEditingClientId(client._id);
    setSelectedClient(client);
    setClientForm({
      name: client.name,
      email: client.email,
      phone: client.phone || '',
      company: client.company || '',
      address: client.address || '',
      active: client.active,
    });
  };

  const handleDeleteOrder = async (id) => {
    if (!canManageOrders) {
      alert('No tienes permisos para eliminar órdenes');
      return;
    }

    if (!window.confirm('¿Quieres eliminar esta orden?')) return;

    try {
      await api.delete(`/workorders/${id}`);
      if (selectedOrder?._id === id) {
        setSelectedOrder(null);
      }
      if (editingId === id) {
        setEditingId(null);
        setForm(emptyForm);
      }
      fetchWorkOrders();
      fetchDashboard();
    } catch (error) {
      alert(error.response?.data?.message || 'No se pudo eliminar la orden');
    }
  };

  const handleDeleteClient = async (id) => {
    if (!canManageClients) {
      alert('No tienes permisos para eliminar clientes');
      return;
    }

    if (!window.confirm('¿Quieres eliminar este cliente?')) return;

    try {
      await api.delete(`/clients/${id}`);
      if (selectedClient?._id === id) {
        setSelectedClient(null);
      }
      if (editingClientId === id) {
        setEditingClientId(null);
        setClientForm(emptyClientForm);
      }
      fetchClients();
    } catch (error) {
      alert(error.response?.data?.message || 'No se pudo eliminar el cliente');
    }
  };

  const logout = () => {
    localStorage.removeItem(storageKey);
    setToken('');
    setUser(null);
    setWorkOrders([]);
    setClients([]);
    setSelectedOrder(null);
    setSelectedClient(null);
    setEditingId(null);
    setEditingClientId(null);
    setForm(emptyForm);
    setClientForm(emptyClientForm);
    setSearchTerm('');
  };

  const visibleOrders = filter === 'all' ? workOrders : workOrders.filter((order) => order.status === filter);
  const filteredOrders = visibleOrders.filter((order) => {
    const query = searchTerm.trim().toLowerCase();
    if (!query) return true;
    const haystack = `${order.title} ${order.description} ${order.customerName || ''}`.toLowerCase();
    return haystack.includes(query);
  });

  const filteredClients = clients.filter((client) => {
    const query = searchTerm.trim().toLowerCase();
    if (!query) return true;
    const haystack = `${client.name} ${client.email} ${client.company || ''} ${client.phone || ''}`.toLowerCase();
    return haystack.includes(query);
  });

  const maxMonthlyValue = dashboard.monthlyTrend.length
    ? Math.max(...dashboard.monthlyTrend.map((item) => item.count))
    : 1;

  if (!token || !user) {
    return (
      <div className="auth-layout">
        <div className="auth-hero">
          <div className="hero-badge">NOVA</div>
          <h1>WORKORDER</h1>
          <p>Gestión moderna de órdenes, clientes y métricas.</p>
          <ul>
            <li>Seguimiento en tiempo real</li>
            <li>Control de clientes y prioridad</li>
            <li>Dashboard con indicadores clave</li>
          </ul>
        </div>

        <form className="auth-card" onSubmit={handleLoginRegister}>
          <div className="segmented-control">
            <button type="button" className={authMode === 'login' ? 'active' : ''} onClick={() => setAuthMode('login')}>
              Iniciar sesión
            </button>
            <button type="button" className={authMode === 'register' ? 'active' : ''} onClick={() => setAuthMode('register')}>
              Registrarse
            </button>
          </div>

          {authMode === 'register' && (
            <label>
              Nombre
              <input
                type="text"
                value={authForm.name}
                onChange={(e) => setAuthForm((prev) => ({ ...prev, name: e.target.value }))}
                required
              />
            </label>
          )}

          <label>
            Email
            <input
              type="email"
              value={authForm.email}
              onChange={(e) => setAuthForm((prev) => ({ ...prev, email: e.target.value }))}
              required
            />
          </label>

          <label>
            Contraseña
            <input
              type="password"
              value={authForm.password}
              onChange={(e) => setAuthForm((prev) => ({ ...prev, password: e.target.value }))}
              required
            />
          </label>

          {authMode === 'register' && (
            <p className="muted">Las cuentas nuevas se crean como cliente. Un administrador asigna los demás roles.</p>
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
          <button className="nav-item">Clientes</button>
          <button className="nav-item">Informes</button>
        </nav>

        <div className="profile-box">
          <p>{user.name}</p>
          <small>{user.role}</small>
          <span className="role-badge">{user.role}</span>
          <button className="logout-button" onClick={logout}>Cerrar sesión</button>
        </div>
      </aside>

      <main className="main-panel">
        <header className="topbar">
          <div>
            <p className="eyebrow">Resumen</p>
            <h2>Panel principal</h2>
          </div>
          {canManageOrders && (
            <button className="primary-button small" onClick={() => { setEditingId(null); setSelectedOrder(null); setForm(emptyForm); }}>
              Nueva tarea
            </button>
          )}
        </header>

        <div className="role-header">
          <div>
            <p className="eyebrow">Permisos actuales</p>
            <h3>{user.role.toUpperCase()}</h3>
          </div>
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Buscar órdenes o clientes..."
            className="search-input"
          />
        </div>

        <section className="stats-grid">
          <div className="stat-card">
            <span>Total</span>
            <strong>{dashboard.total || workOrders.length}</strong>
          </div>
          <div className="stat-card">
            <span>Pendientes</span>
            <strong>{dashboard.pending || dashboard.statusBreakdown.pendiente || 0}</strong>
          </div>
          <div className="stat-card">
            <span>En proceso</span>
            <strong>{dashboard.inProgress || dashboard.statusBreakdown.en_proceso || 0}</strong>
          </div>
          <div className="stat-card">
            <span>Completadas</span>
            <strong>{dashboard.completed || dashboard.statusBreakdown.completada || 0}</strong>
          </div>
        </section>

        <section className="report-grid">
          <div className="panel-box">
            <h3>Reporte por estado</h3>
            <div className="report-list">
              {Object.entries(statusLabels).map(([key, label]) => (
                <div className="report-item" key={key}>
                  <div className="report-meta">
                    <span>{label}</span>
                    <strong>{dashboard.statusBreakdown?.[key] || 0}</strong>
                  </div>
                  <div className="report-bar">
                    <span style={{ width: `${((dashboard.statusBreakdown?.[key] || 0) / Math.max(dashboard.total || 1, 1)) * 100}%` }} />
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="panel-box">
            <h3>Reporte por prioridad</h3>
            <div className="report-list">
              {dashboard.priorities?.length ? (
                dashboard.priorities.map((entry) => (
                  <div className="report-item" key={entry._id || 'priority'}>
                    <div className="report-meta">
                      <span>{entry._id || 'Sin prioridad'}</span>
                      <strong>{entry.count}</strong>
                    </div>
                    <div className="report-bar">
                      <span style={{ width: `${(entry.count / Math.max(dashboard.total || 1, 1)) * 100}%` }} />
                    </div>
                  </div>
                ))
              ) : (
                <p className="muted">No hay prioridad disponible.</p>
              )}
            </div>
          </div>

          <div className="panel-box">
            <h3>Últimos 6 meses</h3>
            <div className="trend-list">
              {dashboard.monthlyTrend?.length ? (
                dashboard.monthlyTrend.map((item) => (
                  <div className="trend-item" key={item._id}>
                    <span>{item._id}</span>
                    <div className="trend-bar">
                      <span style={{ width: `${(item.count / maxMonthlyValue) * 100}%` }} />
                    </div>
                    <strong>{item.count}</strong>
                  </div>
                ))
              ) : (
                <p className="muted">No hay datos de tendencia.</p>
              )}
            </div>
          </div>
        </section>

        <section className="content-grid two-column-layout">
          {canManageOrders && (
            <div className="panel-box">
              <div className="panel-header">
                <h3>{editingId ? 'Editar orden' : 'Crear orden'}</h3>
                {editingId && (
                  <button className="ghost-button" onClick={() => { setEditingId(null); setForm(emptyForm); }}>
                    Cancelar
                  </button>
                )}
              </div>

              <form className="order-form" onSubmit={handleSubmit}>
                <label>
                  Título
                  <input type="text" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} required />
                </label>

                <label>
                  Descripción
                  <textarea rows="3" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} required />
                </label>

                <div className="two-columns">
                  <label>
                    Estado
                    <select value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value })}>
                      <option value="pendiente">Pendiente</option>
                      <option value="en_proceso">En proceso</option>
                      <option value="completada">Completada</option>
                      <option value="cancelada">Cancelada</option>
                    </select>
                  </label>

                  <label>
                    Prioridad
                    <select value={form.priority} onChange={(e) => setForm({ ...form, priority: e.target.value })}>
                      <option value="baja">Baja</option>
                      <option value="media">Media</option>
                      <option value="alta">Alta</option>
                      <option value="urgente">Urgente</option>
                    </select>
                  </label>
                </div>

                <label>
                  Cliente
                  <input type="text" value={form.customerName} onChange={(e) => setForm({ ...form, customerName: e.target.value })} />
                </label>

                <label>
                  Notas
                  <textarea rows="2" value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} />
                </label>

                <button type="submit" className="primary-button">
                  {editingId ? 'Actualizar orden' : 'Guardar orden'}
                </button>
              </form>
            </div>
          )}

          <div className="panel-box">
            <div className="panel-header">
              <h3>Órdenes recientes</h3>
              <select className="filter-select" value={filter} onChange={(e) => setFilter(e.target.value)}>
                <option value="all">Todas</option>
                <option value="pendiente">Pendientes</option>
                <option value="en_proceso">En proceso</option>
                <option value="completada">Completadas</option>
                <option value="cancelada">Canceladas</option>
              </select>
            </div>

            {loading ? (
              <p className="muted">Cargando...</p>
            ) : (
              <div className="order-list">
                {filteredOrders.length === 0 ? (
                  <p className="muted">No hay órdenes registradas.</p>
                ) : (
                  filteredOrders.map((order) => (
                    <div key={order._id} className={`order-item ${selectedOrder?._id === order._id ? 'selected' : ''}`}>
                      <button type="button" className="order-select" onClick={() => setSelectedOrder(order)}>
                        <div className="order-headline">
                          <strong>{order.title}</strong>
                          <span className={`status-tag ${order.status}`}>{order.status}</span>
                        </div>
                        <small>{order.customerName || 'Cliente sin nombre'}</small>
                      </button>
                      {canManageOrders && (
                        <div className="order-actions">
                          <button type="button" className="mini-button edit" onClick={() => handleEditOrder(order)}>Editar</button>
                          <button type="button" className="mini-button delete" onClick={() => handleDeleteOrder(order._id)}>Eliminar</button>
                        </div>
                      )}
                    </div>
                  ))
                )}
              </div>
            )}
          </div>
        </section>

        <section className="content-grid client-grid">
          {canManageClients && (
            <div className="panel-box">
              <div className="panel-header">
                <h3>{editingClientId ? 'Editar cliente' : 'Crear cliente'}</h3>
                {editingClientId && (
                  <button className="ghost-button" onClick={() => { setEditingClientId(null); setClientForm(emptyClientForm); }}>
                    Cancelar
                  </button>
                )}
              </div>

              <form className="order-form" onSubmit={handleClientSubmit}>
                <label>
                  Nombre
                  <input type="text" value={clientForm.name} onChange={(e) => setClientForm({ ...clientForm, name: e.target.value })} required />
                </label>

                <label>
                  Email
                  <input type="email" value={clientForm.email} onChange={(e) => setClientForm({ ...clientForm, email: e.target.value })} required />
                </label>

                <label>
                  Teléfono
                  <input type="text" value={clientForm.phone} onChange={(e) => setClientForm({ ...clientForm, phone: e.target.value })} />
                </label>

                <label>
                  Empresa
                  <input type="text" value={clientForm.company} onChange={(e) => setClientForm({ ...clientForm, company: e.target.value })} />
                </label>

                <label>
                  Dirección
                  <textarea rows="2" value={clientForm.address} onChange={(e) => setClientForm({ ...clientForm, address: e.target.value })} />
                </label>

                <label>
                  Estado
                  <select value={clientForm.active ? 'active' : 'inactive'} onChange={(e) => setClientForm({ ...clientForm, active: e.target.value === 'active' })}>
                    <option value="active">Activo</option>
                    <option value="inactive">Inactivo</option>
                  </select>
                </label>

                <button type="submit" className="primary-button">
                  {editingClientId ? 'Actualizar cliente' : 'Guardar cliente'}
                </button>
              </form>
            </div>
          )}

          <div className="panel-box">
            <h3>Clientes</h3>
            <div className="order-list">
              {filteredClients.length === 0 ? (
                <p className="muted">No hay clientes registrados.</p>
              ) : (
                filteredClients.map((client) => (
                  <div key={client._id} className={`order-item ${selectedClient?._id === client._id ? 'selected' : ''}`}>
                    <button type="button" className="order-select" onClick={() => setSelectedClient(client)}>
                      <div className="order-headline">
                        <strong>{client.name}</strong>
                        <span className={`status-tag ${client.active ? 'completada' : 'cancelada'}`}>{client.active ? 'Activo' : 'Inactivo'}</span>
                      </div>
                      <small>{client.email}</small>
                    </button>
                    {canManageClients && (
                      <div className="order-actions">
                        <button type="button" className="mini-button edit" onClick={() => handleEditClient(client)}>Editar</button>
                        <button type="button" className="mini-button delete" onClick={() => handleDeleteClient(client._id)}>Eliminar</button>
                      </div>
                    )}
                  </div>
                ))
              )}
            </div>
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

        {selectedClient && (
          <section className="detail-panel panel-box">
            <h3>Detalle de cliente</h3>
            <div className="detail-grid">
              <div>
                <p className="label">Nombre</p>
                <strong>{selectedClient.name}</strong>
              </div>
              <div>
                <p className="label">Email</p>
                <strong>{selectedClient.email}</strong>
              </div>
              <div>
                <p className="label">Teléfono</p>
                <strong>{selectedClient.phone || 'Sin teléfono'}</strong>
              </div>
              <div>
                <p className="label">Empresa</p>
                <strong>{selectedClient.company || 'Sin empresa'}</strong>
              </div>
            </div>
            <div className="detail-description">
              <p className="label">Dirección</p>
              <p>{selectedClient.address || 'Sin dirección registrada'}</p>
            </div>
          </section>
        )}
      </main>
    </div>
  );
}

export default App;
