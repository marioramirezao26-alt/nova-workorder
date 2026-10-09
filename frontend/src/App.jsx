import { useEffect, useMemo, useState } from 'react';
import axios from 'axios';
import { API_URL, createApi, errorMessage } from './api';
import { ROLE } from './ui';
import Dashboard from './views/Dashboard';
import MyOrders from './views/MyOrders';
import Orders from './views/Orders';
import Clients from './views/Clients';
import Users from './views/Users';

const storageKey = 'nova-token';

// Las secciones de cada rol, en el orden del menú. La primera es la que se abre al entrar.
const SECTIONS = {
  inicio: { label: 'Inicio', icon: '◧', view: Dashboard },
  mis: { label: 'Mis órdenes', icon: '✓', view: MyOrders },
  ordenes: { label: 'Órdenes', icon: '☰', view: Orders },
  clientes: { label: 'Clientes', icon: '◉', view: Clients },
  usuarios: { label: 'Usuarios', icon: '⚙', view: Users },
};
const MENU = {
  admin: ['inicio', 'ordenes', 'clientes', 'usuarios'],
  tecnico: ['mis', 'ordenes', 'clientes', 'inicio'],
  cliente: ['mis'],
};

const sectionFromHash = (menu) => {
  const key = window.location.hash.replace('#', '');
  return menu.includes(key) ? key : menu[0];
};

function Login({ onLogin }) {
  const [form, setForm] = useState({ email: '', password: '' });
  const [busy, setBusy] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    try {
      setBusy(true);
      const { data } = await axios.post(`${API_URL}/auth/login`, form);
      onLogin(data);
    } catch (error) {
      alert(errorMessage(error, 'No se pudo iniciar sesión'));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="auth-layout">
      <div className="auth-hero">
        <img className="hero-logo" src="/logo.svg" alt="" />
        <div className="hero-badge">NOVAWORKORDER</div>
        <h1>Servicios</h1>
        <p>Las órdenes de trabajo de tu empresa, en el celular de cada técnico.</p>
        <ul>
          <li>Cada técnico ve sus órdenes del día</li>
          <li>Llamar al cliente y abrir el mapa con un toque</li>
          <li>Iniciar y completar desde el sitio</li>
        </ul>
      </div>
      <form className="auth-card" onSubmit={submit}>
        <h3>Iniciar sesión</h3>
        <label>Email<input type="email" autoComplete="username" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} required /></label>
        <label>Contraseña<input type="password" autoComplete="current-password" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} required /></label>
        <button type="submit" className="primary-button" disabled={busy}>{busy ? 'Entrando…' : 'Entrar'}</button>
        <p className="muted">¿No tienes cuenta? Pídela al administrador de tu empresa. ¿Tu empresa aún no usa NOVAWORKORDER Servicios? <a href="https://novaworkorder.com/#demo">Solicita una demo</a>.</p>
      </form>
    </div>
  );
}

function ChangePassword({ api, user, onDone, onLogout }) {
  const [form, setForm] = useState({ currentPassword: '', newPassword: '' });

  const submit = async (e) => {
    e.preventDefault();
    try {
      await api.put('/auth/password', form);
      onDone();
    } catch (error) {
      alert(errorMessage(error, 'No se pudo cambiar la contraseña'));
    }
  };

  return (
    <div className="auth-layout">
      <div className="auth-hero">
        <img className="hero-logo" src="/logo.svg" alt="" />
        <div className="hero-badge">NOVAWORKORDER</div>
        <h1>Bienvenido, {user.name}</h1>
        <p>Antes de empezar, cambia la contraseña temporal que te entregaron.</p>
      </div>
      <form className="auth-card" onSubmit={submit}>
        <h3>Nueva contraseña</h3>
        <label>Contraseña temporal<input type="password" autoComplete="current-password" value={form.currentPassword} required onChange={(e) => setForm({ ...form, currentPassword: e.target.value })} /></label>
        <label>Nueva contraseña (mínimo 8 caracteres)<input type="password" autoComplete="new-password" minLength={8} value={form.newPassword} required onChange={(e) => setForm({ ...form, newPassword: e.target.value })} /></label>
        <button type="submit" className="primary-button">Guardar y entrar</button>
        <button type="button" className="ghost-button" onClick={onLogout}>Salir</button>
      </form>
    </div>
  );
}

function App() {
  const [token, setToken] = useState(localStorage.getItem(storageKey) || '');
  const [user, setUser] = useState(null);
  const [section, setSection] = useState('');

  const logout = (reason) => {
    localStorage.removeItem(storageKey);
    setToken('');
    setUser(null);
    if (reason) alert(reason);
  };

  // Sesión vencida, usuario desactivado o empresa suspendida: volver al inicio (con el motivo, si lo hay).
  const api = useMemo(() => createApi(token, logout), [token]);

  useEffect(() => {
    if (!token) return;
    api.get('/auth/profile').then(({ data }) => setUser(data)).catch(() => logout());
  }, [token]);

  const menu = MENU[user?.role] || [];

  // La sección vive en la dirección (#ordenes…): el botón «atrás» del celular funciona.
  useEffect(() => {
    if (!user) return;
    setSection(sectionFromHash(menu));
    const onHash = () => setSection(sectionFromHash(menu));
    window.addEventListener('hashchange', onHash);
    return () => window.removeEventListener('hashchange', onHash);
  }, [user?._id]);

  const go = (key) => {
    if (window.location.hash !== `#${key}`) window.location.hash = key;
    setSection(key);
    window.scrollTo(0, 0);
  };

  const login = ({ token: nextToken, ...profile }) => {
    localStorage.setItem(storageKey, nextToken);
    setToken(nextToken);
    setUser(profile);
  };

  if (!token || !user) {
    return token ? <div className="auth-layout"><p className="muted">Cargando…</p></div> : <Login onLogin={login} />;
  }
  if (user.mustChangePassword) {
    return <ChangePassword api={api} user={user} onDone={() => setUser({ ...user, mustChangePassword: false })} onLogout={() => logout()} />;
  }

  const current = menu.includes(section) ? section : menu[0];
  const View = SECTIONS[current].view;

  return (
    <div className="dashboard-layout">
      <aside className="sidebar">
        <div className="sidebar-header">
          <img className="logo" src="/logo.svg" alt="NOVAWORKORDER" />
          <div>
            <h3>Servicios</h3>
            <small>{user.company?.name || 'Workorder'}</small>
          </div>
        </div>
        <nav className="nav">
          {menu.map((key) => (
            <button key={key} type="button" className={`nav-item ${current === key ? 'active' : ''}`} onClick={() => go(key)}>
              <span className="nav-icon">{SECTIONS[key].icon}</span> {SECTIONS[key].label}
            </button>
          ))}
        </nav>
        <div className="profile-box">
          <p>{user.name}</p>
          <small>{user.email}</small>
          <span className="role-badge">{ROLE[user.role] || user.role}</span>
          <button type="button" className="logout-button" onClick={() => logout()}>Cerrar sesión</button>
        </div>
      </aside>

      <header className="mobile-topbar">
        <img className="logo small" src="/logo.svg" alt="NOVAWORKORDER" />
        <div className="mobile-title">
          <strong>{user.company?.name || 'NOVAWORKORDER Servicios'}</strong>
          <small>{user.name} · {ROLE[user.role]}</small>
        </div>
        <button type="button" className="ghost-button" onClick={() => logout()}>Salir</button>
      </header>

      <main className="main-panel">
        <View key={current} api={api} user={user} go={go} />
      </main>

      {menu.length > 1 && (
        <nav className="bottom-nav" style={{ gridTemplateColumns: `repeat(${menu.length}, 1fr)` }}>
          {menu.map((key) => (
            <button key={key} type="button" className={current === key ? 'active' : ''} onClick={() => go(key)}>
              <span className="nav-icon">{SECTIONS[key].icon}</span>
              <span>{SECTIONS[key].label}</span>
            </button>
          ))}
        </nav>
      )}
    </div>
  );
}

export default App;
