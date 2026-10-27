import { useEffect, useState } from 'react';
import axios from 'axios';
import { API_URL } from '../api';
import { applyBrand } from '../brand';
import { adoptCompanyLang, locale, t } from '../i18n';
import { STATUS, novaLink } from '../ui';

// Informe de servicio público (/informe/<llave>): lo abre el cliente sin cuenta. «Descargar PDF» usa la impresión
// del navegador (Guardar como PDF), con una hoja pensada para imprimir. Las horas van en la zona de la empresa.
const when = (value, timeZone) => (value ? new Date(value).toLocaleString(locale(), { dateStyle: 'medium', timeStyle: 'short', timeZone: timeZone || 'America/Bogota' }) : '—');

export default function PublicReport({ token }) {
  const [report, setReport] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    axios.get(`${API_URL}/informes/${encodeURIComponent(token)}`).then(({ data }) => {
      adoptCompanyLang(data.company.lang);
      applyBrand(data.company.branding);
      document.title = `${t('Informe de servicio')} · ${data.company.name}`;
      setReport(data);
    }).catch((err) => setError(err.response?.status === 404 ? t('Este informe no existe o ya no está disponible.') : t('No se pudo cargar el informe')));
  }, [token]);

  if (error) return <div className="report-page"><p className="muted">{error}</p></div>;
  if (!report) return <div className="report-page"><p className="muted">{t('Cargando…')}</p></div>;

  const { company, order } = report;
  const at = (value) => when(value, company.timeZone);
  const file = (id) => `${API_URL}/informes/${encodeURIComponent(token)}/archivos/${id}`;
  const logo = company.branding?.hasLogo ? `${API_URL}/public/logo/${company.id}?v=${company.branding.logoVersion}` : null;
  const before = order.photos.filter((p) => p.kind === 'antes');
  const after = order.photos.filter((p) => p.kind === 'despues');

  return (
    <div className="report-page">
      <header className="report-head">
        {logo && <img className="report-logo" src={logo} alt="" />}
        <div>
          <p className="eyebrow">{t('Informe de servicio')}</p>
          <h1>{company.name}</h1>
        </div>
        <button type="button" className="primary-button no-print" onClick={() => window.print()}>{t('Descargar PDF')}</button>
      </header>

      <section className="report-section">
        <h2>{order.title}</h2>
        <p>{order.description}</p>
        <dl className="report-facts">
          <div><dt>{t('Cliente')}</dt><dd>{order.client?.name || order.customerName || '—'}{order.client?.company ? ` · ${order.client.company}` : ''}</dd></div>
          {order.client?.address && <div><dt>{t('Dirección')}</dt><dd>{order.client.address}</dd></div>}
          <div><dt>{t('Técnico')}</dt><dd>{order.technician || '—'}</dd></div>
          <div><dt>{t('Estado')}</dt><dd>{t(STATUS[order.status] || order.status)}</dd></div>
          <div><dt>{t('Hora de inicio')}</dt><dd>{at(order.startedAt)}</dd></div>
          {order.status === 'completada' && <div><dt>{t('Cierre')}</dt><dd>{at(order.completedAt)}</dd></div>}
        </dl>
      </section>

      {order.checklist.length > 0 && (
        <section className="report-section">
          <h3>{order.checklistName || t('Checklist')}</h3>
          <ul className="report-checklist">
            {order.checklist.map((item, n) => (
              <li key={n} className={item.done ? 'done' : 'todo'}>
                <span aria-hidden="true">{item.done ? '✔' : '○'}</span> {item.label}
                {item.note && <small> — {item.note}</small>}
              </li>
            ))}
          </ul>
        </section>
      )}

      {[[t('Antes'), before], [t('Después'), after]].filter(([, list]) => list.length).map(([label, list]) => (
        <section key={label} className="report-section">
          <h3>{label}</h3>
          <div className="report-photos">
            {list.map((p) => <img key={p.id} src={file(p.id)} alt={label} loading="lazy" />)}
          </div>
        </section>
      ))}

      {order.notes && (
        <section className="report-section">
          <h3>{t('Notas')}</h3>
          <p className="report-notes">{order.notes}</p>
        </section>
      )}

      <section className="report-section">
        <h3>{t('Recibido a satisfacción')}</h3>
        {order.signature ? (
          <div className="report-signature">
            <img src={file(order.signature.id)} alt={t('Firma')} />
            <p>{order.signature.name} · {at(order.signature.signedAt)}</p>
          </div>
        ) : <p className="muted">{t('Sin firma del cliente.')}</p>}
      </section>

      <footer className="report-foot muted small">
        <a href={novaLink('informe', company.name, company.lang)} target="_blank" rel="noopener">{t('Hecho con NOVAWORKORDER · Prueba gratis')}</a>
      </footer>
    </div>
  );
}
