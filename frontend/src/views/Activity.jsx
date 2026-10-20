import { useEffect, useState } from 'react';
import { errorMessage } from '../api';
import { getLang, t } from '../i18n';

// La bitácora de la empresa: quién hizo qué y cuándo en el panel. Solo el administrador llega aquí.
const when = (iso) => {
  try {
    return new Date(iso).toLocaleString(getLang() === 'en' ? 'en-US' : 'es-CO', { dateStyle: 'medium', timeStyle: 'short' });
  } catch {
    return '';
  }
};

export default function Activity({ api }) {
  const [items, setItems] = useState(null);
  const [pageInfo, setPageInfo] = useState(null);
  const [error, setError] = useState('');

  const load = (page = 1) => api.get('/audit', { params: { page } })
    .then(({ data }) => {
      setItems((prev) => (page === 1 ? data.items : [...(prev || []), ...data.items]));
      setPageInfo(data.pagination || null);
      setError('');
    })
    .catch((err) => setError(errorMessage(err, 'No se pudo cargar la actividad')));
  useEffect(() => { load(1); }, []);

  return (
    <section className="panel">
      <header className="panel-header">
        <div>
          <h2>{t('Actividad')}</h2>
          <p className="muted">{t('Quién hizo qué en el panel: órdenes, clientes y usuarios.')}</p>
        </div>
        <button type="button" className="ghost-button" onClick={() => load(1)}>{t('Actualizar')}</button>
      </header>

      {error && <p className="error">{error}</p>}
      {!items && !error && <p className="muted">{t('Cargando…')}</p>}
      {items && !items.length && <p className="muted">{t('Todavía no hay actividad registrada.')}</p>}

      <ul className="activity-list">
        {items?.map((e) => (
          <li key={e._id} className="activity-item">
            <div className="activity-main">
              <span>{e.summary}</span>
              <span className="muted small">{when(e.at)}</span>
            </div>
            <small className="muted">{e.user}</small>
          </li>
        ))}
      </ul>

      {pageInfo?.hasMore && (
        <div className="center">
          <button type="button" className="ghost-button" onClick={() => load(pageInfo.page + 1)}>{t('Cargar más')}</button>
        </div>
      )}
    </section>
  );
}
