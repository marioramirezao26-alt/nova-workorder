import { useEffect, useState } from 'react';
import { errorMessage } from '../api';
import { t } from '../i18n';

const iso = (d) => d.toISOString().slice(0, 10);
const STATUS = { pendiente: 'Pendiente', en_proceso: 'En proceso', completada: 'Completada', cancelada: 'Cancelada' };

// Reportes de la empresa (solo admin): órdenes por estado, por técnico y por día, totales y descarga CSV.
export default function Reports({ api, user }) {
  const [to, setTo] = useState(iso(new Date()));
  const [from, setFrom] = useState(iso(new Date(Date.now() - 29 * 86400000)));
  const [data, setData] = useState(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const load = async () => {
    try {
      setBusy(true);
      const { data: d } = await api.get('/reports', { params: { from, to } });
      setData(d);
      setError('');
    } catch (err) {
      setError(errorMessage(err, t('No se pudieron cargar los reportes')));
    } finally {
      setBusy(false);
    }
  };
  useEffect(() => { load(); }, []);

  const downloadCsv = async () => {
    try {
      const res = await api.get('/reports/orders.csv', { params: { from, to }, responseType: 'blob' });
      const url = URL.createObjectURL(res.data);
      const a = document.createElement('a');
      a.href = url;
      a.download = `ordenes-${from}_a_${to}.csv`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } catch (err) {
      alert(errorMessage(err, 'No se pudo descargar el CSV'));
    }
  };

  // Una tabla de nombre y cantidad, con el estilo de las tablas de la app.
  const table = (rows, label, head) => (rows.length ? (
    <table className="quote-table">
      <thead><tr><th scope="col">{head}</th><th scope="col" className="num">{t('Órdenes')}</th></tr></thead>
      <tbody>{rows.map((r) => <tr key={r.key}><td>{label(r)}</td><td className="num">{r.count}</td></tr>)}</tbody>
    </table>
  ) : <p className="muted">{t('Sin datos en este rango.')}</p>);

  return (
    <section className="view">
      <header className="view-header">
        <div>
          <p className="eyebrow">{user.company?.name}</p>
          <h2>{t('Reportes')}</h2>
        </div>
      </header>

      <div className="panel-box report-filters">
        <div className="two-columns">
          <label>{t('Desde')}<input type="date" value={from} max={to} onChange={(e) => setFrom(e.target.value)} /></label>
          <label>{t('Hasta')}<input type="date" value={to} min={from} onChange={(e) => setTo(e.target.value)} /></label>
        </div>
        <div className="order-actions">
          <button type="button" className="primary-button small" onClick={load} disabled={busy}>{t('Ver')}</button>
          <button type="button" className="ghost-button" onClick={downloadCsv} disabled={busy || !data}>{t('Descargar CSV')}</button>
        </div>
      </div>

      {error && <p className="form-error" role="alert">{error}</p>}
      {!data && !error && <p className="muted empty">{t('Cargando…')}</p>}

      {data && (
        <>
          <div className="stats-grid two">
            <div className="stat-card"><span>{t('Órdenes creadas')}</span><strong>{data.totals.created}</strong></div>
            <div className="stat-card"><span>{t('Completadas')}</span><strong>{data.totals.completed}</strong></div>
          </div>

          <div className="report-grid">
            <div className="panel-box">
              <h3>{t('Por técnico')}</h3>
              {table(data.byTechnician.map((r) => ({ ...r, key: r.name })), (r) => r.name, t('Técnico'))}
            </div>
            <div className="panel-box">
              <h3>{t('Por estado')}</h3>
              {table(data.byStatus.map((r) => ({ ...r, key: r.status })), (r) => t(STATUS[r.status] || r.status), t('Estado'))}
            </div>
            <div className="panel-box">
              <h3>{t('Por día')}</h3>
              {table(data.byDay.map((r) => ({ ...r, key: r.day })), (r) => r.day, t('Día'))}
            </div>
          </div>
        </>
      )}
    </section>
  );
}
