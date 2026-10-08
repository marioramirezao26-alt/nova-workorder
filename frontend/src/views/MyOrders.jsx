import { useEffect, useState } from 'react';
import { errorMessage } from '../api';
import { Empty, PriorityTag, StatusTag, formatDay, formatDateTime, isOverdue, mapsLink } from '../ui';

const ACTIVE = ['pendiente', 'en_proceso'];

// «Mis órdenes»: lo que el técnico tiene asignado, en tarjetas grandes para el celular, con llamar, mapa y
// botones para iniciar y completar. Un usuario cliente ve aquí las órdenes de su empresa (solo lectura).
export default function MyOrders({ api, user }) {
  const isTech = user.role !== 'cliente';
  const [orders, setOrders] = useState([]);
  const [tab, setTab] = useState('activas');
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(null);
  const [notes, setNotes] = useState({});

  const load = async () => {
    try {
      setLoading(true);
      const { data } = await api.get(`/workorders?limit=100${isTech ? '&assigned=me' : ''}`);
      setOrders(data.items || []);
    } catch (error) {
      alert(errorMessage(error, 'No se pudieron cargar las órdenes'));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const move = async (order, status) => {
    if (status === 'completada' && !window.confirm(`¿Marcar «${order.title}» como completada?`)) return;
    try {
      setBusy(order._id);
      const { data } = await api.patch(`/workorders/${order._id}/status`, { status, note: notes[order._id] || undefined });
      setOrders((prev) => prev.map((o) => (o._id === data._id ? data : o)));
      setNotes((prev) => ({ ...prev, [order._id]: '' }));
    } catch (error) {
      alert(errorMessage(error, 'No se pudo actualizar la orden'));
    } finally {
      setBusy(null);
    }
  };

  const shown = orders
    .filter((o) => (tab === 'activas' ? ACTIVE.includes(o.status) : !ACTIVE.includes(o.status)))
    .sort((a, b) => (a.dueDate || '9999').localeCompare(b.dueDate || '9999'));

  return (
    <section className="view">
      <header className="view-header">
        <div>
          <p className="eyebrow">{isTech ? `Hola, ${user.name.split(' ')[0]}` : user.company?.name}</p>
          <h2>{isTech ? 'Mis órdenes' : 'Órdenes de mi empresa'}</h2>
        </div>
        <button type="button" className="ghost-button" onClick={load}>Actualizar</button>
      </header>

      <div className="segmented-control">
        <button type="button" className={tab === 'activas' ? 'active' : ''} onClick={() => setTab('activas')}>
          Por hacer ({orders.filter((o) => ACTIVE.includes(o.status)).length})
        </button>
        <button type="button" className={tab === 'cerradas' ? 'active' : ''} onClick={() => setTab('cerradas')}>Cerradas</button>
      </div>

      {loading ? <Empty>Cargando…</Empty> : shown.length === 0 ? (
        <Empty>{tab === 'activas' ? (isTech ? 'No tienes órdenes pendientes. ¡Buen trabajo!' : 'No hay órdenes abiertas.') : 'Todavía no hay órdenes cerradas.'}</Empty>
      ) : (
        <div className="card-list">
          {shown.map((order) => (
            <article key={order._id} className={`order-card ${isOverdue(order) ? 'overdue' : ''}`}>
              <div className="order-card-head">
                <StatusTag status={order.status} />
                <PriorityTag priority={order.priority} />
                {order.dueDate && <span className={`due ${isOverdue(order) ? 'late' : ''}`}>{isOverdue(order) ? 'Vencida · ' : 'Para el '}{formatDay(order.dueDate)}</span>}
              </div>
              <h3>{order.title}</h3>
              <p className="order-card-text">{order.description}</p>
              {(order.client || order.customerName) && (
                <div className="client-box">
                  <strong>{order.client?.name || order.customerName}</strong>
                  {order.client?.phone && <a className="contact-link" href={`tel:${order.client.phone}`}>📞 {order.client.phone}</a>}
                  {order.client?.address && <a className="contact-link" href={mapsLink(order.client.address)} target="_blank" rel="noreferrer">📍 {order.client.address}</a>}
                </div>
              )}
              {order.notes && <details className="notes"><summary>Notas</summary><p>{order.notes}</p></details>}
              {!isTech && order.assignedTo && <p className="muted">Técnico: {order.assignedTo.name}</p>}
              {order.completedAt && <p className="muted">Completada {formatDateTime(order.completedAt)}</p>}
              {isTech && ACTIVE.includes(order.status) && (
                <>
                  <textarea rows="2" placeholder="Nota para la orden (opcional)" value={notes[order._id] || ''}
                    onChange={(e) => setNotes((prev) => ({ ...prev, [order._id]: e.target.value }))} />
                  <div className="big-actions">
                    {order.status === 'pendiente' && (
                      <button type="button" className="big-button start" disabled={busy === order._id} onClick={() => move(order, 'en_proceso')}>▶ Iniciar</button>
                    )}
                    <button type="button" className="big-button done" disabled={busy === order._id} onClick={() => move(order, 'completada')}>✓ Completar</button>
                  </div>
                </>
              )}
            </article>
          ))}
        </div>
      )}
    </section>
  );
}
