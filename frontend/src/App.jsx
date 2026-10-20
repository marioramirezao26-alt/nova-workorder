import { useEffect, useMemo, useState } from 'react';
import axios from 'axios';
import { API_URL, createApi, errorMessage } from './api';
import { ROLE } from './ui';
import Dashboard from './views/Dashboard';
import MyOrders from './views/MyOrders';
import Orders from './views/Orders';
import Clients from './views/Clients';
import Users from './views/Users';
import Brand from './views/Brand';
import LiveMap from './views/LiveMap';
import Activity from './views/Activity';
import Reports from './views/Reports';
import Integrations from './views/Integrations';
import Checklists from './views/Checklists';
import { applyBrand, logoUrl } from './brand';
import { getLang, setLang, t, adoptCompanyLang } from './i18n';

const storageKey = 'nova-token';

// Las secciones de cada rol, en el orden del menú. La primera es la que se abre al entrar.
const SECTIONS = {
  inicio: { label: 'Inicio', icon: '◧', view: Dashboard },
  mis: { label: 'Mis órdenes', icon: '✓', view: MyOrders },
  ordenes: { label: 'Órdenes', icon: '☰', view: Orders },
  mapa: { label: 'Mapa', icon: '⌖', view: LiveMap },
  clientes: { label: 'Clientes', icon: '◉', view: Clients },
  usuarios: { label: 'Usuarios', icon: '⚙', view: Users },
  reportes: { label: 'Reportes', icon: '▦', view: Reports },
  actividad: { label: 'Actividad', icon: '≋', view: Activity },
  checklists: { label: 'Checklists', icon: '☑', view: Checklists },
  integraciones: { label: 'Integraciones', icon: '⇄', view: Integrations },
  marca: { label: 'Mi marca', icon: '★', view: Brand },
};
const MENU = {
  admin: ['inicio', 'ordenes', 'mapa', 'clientes', 'checklists', 'usuarios', 'reportes', 'actividad', 'integraciones', 'marca'],
  tecnico: ['mis', 'ordenes', 'clientes', 'inicio'],
  cliente: ['mis'],
};

// Cambia entre español e inglés; la app se vuelve a pintar con el idioma nuevo.
// `short`: «EN» / «ES», para la barra del celular, donde no cabe la palabra completa.
function LangSwitch({ onChange, className = 'ghost-button', short = false }) {
  const next = getLang() === 'en' ? 'es' : 'en';
  const label = next === 'en' ? 'English' : 'Español';
  return (
    <button type="button" className={className} lang={next} title={label} aria-label={label} onClick={() => { setLang(next); onChange(); }}>
      {short ? next.toUpperCase() : label}
    </button>
  );
}

const sectionFromHash = (menu) => {
  const key = window.location.hash.replace('#', '');
  return menu.includes(key) ? key : menu[0];
};

function Login({ onLogin, onLang }) {
  const [form, setForm] = useState({ email: '', password: '' });
  const [busy, setBusy] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    try {
      setBusy(true);
      const { data } = await axios.post(`${API_URL}/auth/login`, form);
      onLogin(data);
    } catch (error) {
      alert(errorMessage(error, t('No se pudo iniciar sesión')));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="auth-layout">
      <div className="auth-hero">
        <img className="hero-logo" src="/logo.svg" alt="" />
        <div className="hero-badge">NOVAWORKORDER</div>
        <h1>{t('Servicios')}</h1>
        <p>{t('Las órdenes de trabajo de tu empresa, en el celular de cada técnico.')}</p>
        <ul>
          <li>{t('Cada técnico ve sus órdenes del día')}</li>
          <li>{t('Llamar al cliente y abrir el mapa con un toque')}</li>
          <li>{t('Iniciar y completar desde el sitio')}</li>
        </ul>
      </div>
      <form className="auth-card" onSubmit={submit}>
        <h3>{t('Iniciar sesión')}</h3>
        <label>{t('Email')}<input type="email" autoComplete="username" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} required /></label>
        <label>{t('Contraseña')}<input type="password" autoComplete="current-password" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} required /></label>
        <button type="submit" className="primary-button" disabled={busy}>{busy ? t('Entrando…') : t('Entrar')}</button>
        <p className="muted">{t('¿No tienes cuenta? Pídela al administrador de tu empresa.')} {t('¿Tu empresa aún no usa NOVAWORKORDER Servicios?')} <a href={getLang() === 'en' ? 'https://novaworkorder.com/en/#start' : 'https://novaworkorder.com/#demo'}>{t('Solicita una demo')}</a>.</p>
        <LangSwitch onChange={onLang} />
      </form>
    </div>
  );
}

function ChangePassword({ api, user, onDone, onLogout }) {
  const [form, setForm] = useState({ currentPassword: '', newPassword: '' });

  const submit = async (e) => {
    e.preventDefault();
    try {
      const { data } = await api.put('/auth/password', form);
      onDone(data);
    } catch (error) {
      alert(errorMessage(error, t('No se pudo cambiar la contraseña')));
    }
  };

  return (
    <div className="auth-layout">
      <div className="auth-hero">
        <img className="hero-logo" src="/logo.svg" alt="" />
        <div className="hero-badge">NOVAWORKORDER</div>
        <h1>{t('Bienvenido, {name}', { name: user.name })}</h1>
        <p>{t('Antes de empezar, cambia la contraseña temporal que te entregaron.')}</p>
      </div>
      <form className="auth-card" onSubmit={submit}>
        <h3>{t('Nueva contraseña')}</h3>
        <label>{t('Contraseña temporal')}<input type="password" autoComplete="current-password" value={form.currentPassword} required onChange={(e) => setForm({ ...form, currentPassword: e.target.value })} /></label>
        <label>{t('Nueva contraseña (mínimo 8 caracteres)')}<input type="password" autoComplete="new-password" minLength={8} value={form.newPassword} required onChange={(e) => setForm({ ...form, newPassword: e.target.value })} /></label>
        <button type="submit" className="primary-button">{t('Guardar y entrar')}</button>
        <button type="button" className="ghost-button" onClick={onLogout}>{t('Salir')}</button>
      </form>
    </div>
  );
}

function App() {
  const [token, setToken] = useState(localStorage.getItem(storageKey) || '');
  const [user, setUser] = useState(null);
  const [section, setSection] = useState('');
  const [, setLangTick] = useState(0);
  const relang = () => setLangTick((n) => n + 1);

  const logout = (reason) => {
    localStorage.removeItem(storageKey);
    setToken('');
    setUser(null);
    if (reason) alert(t(reason));
  };

  // Sesión vencida, usuario desactivado o empresa suspendida: volver al inicio (con el motivo, si lo hay).
  const api = useMemo(() => createApi(token, logout), [token]);

  useEffect(() => {
    if (!token) return;
    api.get('/auth/profile').then(({ data }) => { adoptCompanyLang(data.company?.lang); setUser(data); }).catch(() => logout());
  }, [token]);

  // «Mi marca»: los colores de la empresa en toda la app; al salir, los de NOVAWORKORDER.
  useEffect(() => { applyBrand(user?.company?.branding); }, [user?.company?.branding]);

  const brandSaved = (branding) => setUser({ ...user, company: { ...user.company, branding } });

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
    adoptCompanyLang(profile.company?.lang);
    setToken(nextToken);
    setUser(profile);
  };

  if (!token || !user) {
    return token ? <div className="auth-layout"><p className="muted">{t('Cargando…')}</p></div> : <Login onLogin={login} onLang={relang} />;
  }
  if (user.mustChangePassword) {
    return <ChangePassword api={api} user={user} onDone={(data) => (data?.token ? login(data) : setUser({ ...user, mustChangePassword: false }))} onLogout={() => logout()} />;
  }

  const current = menu.includes(section) ? section : menu[0];
  const View = SECTIONS[current].view;

  return (
    <div className="dashboard-layout">
      <aside className="sidebar">
        <div className="sidebar-header">
          <img className="logo" src={logoUrl(user.company)} alt={user.company?.name || 'NOVAWORKORDER'} />
          <div>
            <h3>{t('Servicios')}</h3>
            <small>{user.company?.name || 'Workorder'}</small>
          </div>
        </div>
        <nav className="nav">
          {menu.map((key) => (
            <button key={key} type="button" className={`nav-item ${current === key ? 'active' : ''}`} onClick={() => go(key)}>
              <span className="nav-icon">{SECTIONS[key].icon}</span> {t(SECTIONS[key].label)}
            </button>
          ))}
        </nav>
        <div className="profile-box">
          <p>{user.name}</p>
          <small>{user.email}</small>
          <span className="role-badge">{t(ROLE[user.role] || user.role)}</span>
          <LangSwitch onChange={relang} className="logout-button" />
          <button type="button" className="logout-button" onClick={() => logout()}>{t('Cerrar sesión')}</button>
        </div>
      </aside>

      <header className="mobile-topbar">
        <img className="logo small" src={logoUrl(user.company)} alt={user.company?.name || 'NOVAWORKORDER'} />
        <div className="mobile-title">
          <strong>{user.company?.name || 'NOVAWORKORDER Servicios'}</strong>
          <small>{user.name} · {t(ROLE[user.role])}</small>
        </div>
        <LangSwitch onChange={relang} className="ghost-button lang-switch" short />
        <button type="button" className="ghost-button" onClick={() => logout()}>{t('Salir')}</button>
      </header>

      <main className="main-panel">
        <View key={current} api={api} user={user} go={go} onSaved={brandSaved} onUser={setUser} />
      </main>

      {menu.length > 1 && (
        <nav className="bottom-nav" style={{ gridTemplateColumns: `repeat(${menu.length}, 1fr)` }}>
          {menu.map((key) => (
            <button key={key} type="button" className={current === key ? 'active' : ''} onClick={() => go(key)}>
              <span className="nav-icon">{SECTIONS[key].icon}</span>
              <span>{t(SECTIONS[key].label)}</span>
            </button>
          ))}
        </nav>
      )}
    </div>
  );
}

export default App;
