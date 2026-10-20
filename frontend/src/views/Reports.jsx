import { useEffect, useState } from 'react';
import { errorMessage } from '../api';
import { t } from '../i18n';

const iso = (d) => d.toISOString().slice(0, 10);
const STATUS = { pendiente: 'Pendiente', en_proceso: 'En proceso', completada: 'Completada', cancelada: 'Cancelada' };

// Reportes de la empresa (solo admin): órdenes por estado, por técnico y por día, totales y descarga CSV.
export default function Reports({ api }) {
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
      setError(errorMessage(err, 'No se pudieron cargar los reportes'));
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

  return (
    <section className="panel">
      <header className="panel-header">
        <h2>{t('Reportes')}</h2>
      </header>

      <div className="card filters">
        <label>{t('Desde')}<input type="date" value={from} max={to} onChange={(e) => setFrom(e.target.value)} /></label>
        <label>{t('Hasta')}<input type="date" value={to} min={from} onChange={(e) => setTo(e.target.value)} /></label>
        <button type="button" className="primary-button" onClick={load} disabled={busy}>{t('Ver')}</button>
        <button type="button" className="ghost-button" onClick={downloadCsv} disabled={busy || !data}>{t('Descargar CSV')}</button>
      </div>

      {error && <p className="error">{error}</p>}
      {!data && !error && <p className="muted">{t('Cargando…')}</p>}

      {data && (
        <>
          <div className="stat-grid">
            <div className="stat-card"><small>{t('Órdenes creadas')}</small><strong>{data.totals.created}</strong></div>
            <div className="stat-card"><small>{t('Completadas')}</small><strong>{data.totals.completed}</strong></div>
          </div>

          <h3>{t('Por técnico')}</h3>
          {data.byTechnician.length ? (
            <table className="report-table"><tbody>
              {data.byTechnician.map((r) => <tr key={r.name}><td>{r.name}</td><td>{r.count}</td></tr>)}
            </tbody></table>
          ) : <p className="muted">{t('Sin datos en este rango.')}</p>}

          <h3>{t('Por estado')}</h3>
          {data.byStatus.length ? (
            <table className="report-table"><tbody>
              {data.byStatus.map((r) => <tr key={r.status}><td>{t(STATUS[r.status] || r.status)}</td><td>{r.count}</td></tr>)}
            </tbody></table>
          ) : <p className="muted">{t('Sin datos en este rango.')}</p>}

          <h3>{t('Por día')}</h3>
          {data.byDay.length ? (
            <table className="report-table"><tbody>
              {data.byDay.map((r) => <tr key={r.day}><td>{r.day}</td><td>{r.count}</td></tr>)}
            </tbody></table>
          ) : <p className="muted">{t('Sin datos en este rango.')}</p>}
        </>
      )}
    </section>
  );
}
