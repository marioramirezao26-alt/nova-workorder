import { useEffect, useState } from 'react';
import { STATUS, StatusTag, formatDateTime } from '../ui';

// Inicio: los números de la empresa (o, para un cliente, de sus órdenes).
export default function Dashboard({ api, user, go }) {
  const [d, setD] = useState(null);

  useEffect(() => {
    api.get('/dashboard/summary').then(({ data }) => setD(data)).catch(() => setD({ total: 0, statusBreakdown: {}, priorities: [], monthlyTrend: [], recentOrders: [] }));
  }, []);

  if (!d) return <section className="view"><p className="muted empty">Cargando…</p></section>;
  const max = Math.max(1, ...((d.monthlyTrend || []).map((m) => m.count)));
  const total = Math.max(d.total || 0, 1);

  return (
    <section className="view">
      <header className="view-header">
        <div>
          <p className="eyebrow">{user.company?.name}</p>
          <h2>Inicio</h2>
        </div>
      </header>

      <div className="stats-grid">
        <button type="button" className="stat-card" onClick={() => go('ordenes')}><span>Total</span><strong>{d.total || 0}</strong></button>
        <button type="button" className="stat-card" onClick={() => go('ordenes')}><span>Pendientes</span><strong>{d.statusBreakdown?.pendiente || 0}</strong></button>
        <button type="button" className="stat-card" onClick={() => go('ordenes')}><span>En proceso</span><strong>{d.statusBreakdown?.en_proceso || 0}</strong></button>
        <button type="button" className="stat-card" onClick={() => go('ordenes')}><span>Completadas</span><strong>{d.statusBreakdown?.completada || 0}</strong></button>
      </div>

      <div className="report-grid">
        <div className="panel-box">
          <h3>Por estado</h3>
          <div className="report-list">
            {Object.entries(STATUS).map(([key, label]) => (
              <div className="report-item" key={key}>
                <div className="report-meta"><span>{label}</span><strong>{d.statusBreakdown?.[key] || 0}</strong></div>
                <div className="report-bar"><span style={{ width: `${((d.statusBreakdown?.[key] || 0) / total) * 100}%` }} /></div>
              </div>
            ))}
          </div>
        </div>
        <div className="panel-box">
          <h3>Últimos meses</h3>
          <div className="trend-list">
            {(d.monthlyTrend || []).length ? d.monthlyTrend.map((m) => (
              <div className="trend-item" key={m._id}>
                <span>{m._id}</span>
                <div className="trend-bar"><span style={{ width: `${(m.count / max) * 100}%` }} /></div>
                <strong>{m.count}</strong>
              </div>
            )) : <p className="muted">Aún no hay datos.</p>}
          </div>
        </div>
        <div className="panel-box">
          <h3>Recientes</h3>
          <div className="report-list">
            {(d.recentOrders || []).length ? d.recentOrders.map((o) => (
              <div className="recent-item" key={o._id}>
                <div><strong>{o.title}</strong><small className="muted">{formatDateTime(o.createdAt)}</small></div>
                <StatusTag status={o.status} />
              </div>
            )) : <p className="muted">Aún no hay órdenes.</p>}
          </div>
        </div>
      </div>
    </section>
  );
}
