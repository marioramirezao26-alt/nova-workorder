import { useEffect, useState } from 'react';
import axios from 'axios';
import { API_URL } from '../api';
import { applyBrand } from '../brand';
import { adoptCompanyLang, locale, t } from '../i18n';
import { money } from '../ui';

// Cotización pública (/cotizacion/<llave>): el cliente la revisa sin cuenta y la aprueba (con su nombre) o la rechaza
// (con un motivo opcional). «Descargar PDF» usa la impresión del navegador.
const day = (value) => (value ? new Date(value).toLocaleDateString(locale(), { dateStyle: 'long', timeZone: 'America/Bogota' }) : '');

export default function PublicQuote({ token }) {
  const [data, setData] = useState(null);
  const [error, setError] = useState('');
  const [name, setName] = useState('');
  const [accept, setAccept] = useState(false);
  const [rejecting, setRejecting] = useState(false);
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  const base = `${API_URL}/cotizaciones/${encodeURIComponent(token)}`;

  const show = (d) => {
    adoptCompanyLang(d.company.lang);
    applyBrand(d.company.branding);
    document.title = `${t('Cotización')} #${d.quote.number} · ${d.company.name}`;
    setData(d);
  };
  // Al volver del checkout, Wompi agrega ?id=<transacción>: se muestra lo que dice Wompi de ella (d.tx). El pago lo
  // confirma su evento firmado, que llega aparte: mientras tanto se vuelve a consultar unas veces.
  const txId = new URLSearchParams(window.location.search).get('id');
  const statusUrl = txId ? `${base}/pago/estado?id=${encodeURIComponent(txId)}` : base;
  const [tries, setTries] = useState(0);
  const load = (url) => axios.get(url).then(({ data: d }) => show(d))
    .catch((err) => setError(err.response?.status === 404 ? t('Esta cotización no existe o ya no está disponible.') : t('No se pudo cargar la cotización')));
  useEffect(() => { load(statusUrl); }, [token]);
  useEffect(() => {
    if (!txId || tries >= 6 || data?.quote.payment?.status !== 'pendiente' || !['APPROVED', 'PENDING'].includes(data?.tx?.status)) return undefined;
    const timer = setTimeout(() => { setTries((n) => n + 1); load(statusUrl); }, 5000);
    return () => clearTimeout(timer);
  }, [data]);
  // Si vuelve con «Atrás» desde el checkout, el navegador restaura la página tal cual: el botón no puede quedar ocupado.
  useEffect(() => {
    const restored = (e) => { if (e.persisted) setBusy(false); };
    window.addEventListener('pageshow', restored);
    return () => window.removeEventListener('pageshow', restored);
  }, []);

  const answer = async (approve) => {
    try {
      setBusy(true);
      const { data: d } = await axios.post(`${base}/${approve ? 'aprobar' : 'rechazar'}`, approve ? { name, accept } : { name, note });
      show(d);
    } catch (err) {
      alert(t(err.response?.data?.errors?.[0]?.message || err.response?.data?.message || 'No se pudo registrar tu respuesta'));
      // Ya tenía respuesta, venció, la volvieron a borrador o falló a medias: se muestra cómo quedó de verdad.
      const status = err.response?.status;
      if (status === 404 || status === 409 || status >= 500) load(base);
    } finally {
      setBusy(false);
    }
  };

  const pay = async () => {
    try {
      setBusy(true);
      const { data: d } = await axios.get(`${base}/pago`);
      window.location.href = d.checkoutUrl;
    } catch (err) {
      alert(t(err.response?.data?.message || 'No se pudo preparar el pago'));
      setBusy(false);
    }
  };

  if (error) return <div className="report-page"><p className="muted">{error}</p></div>;
  if (!data) return <div className="report-page"><p className="muted">{t('Cargando…')}</p></div>;
  const { company, quote } = data;
  const cur = quote.currency;
  const logo = company.branding?.hasLogo ? `${API_URL}/public/logo/${company.id}?v=${company.branding.logoVersion}` : null;

  return (
    <div className="report-page">
      <header className="report-head">
        {logo && <img className="report-logo" src={logo} alt="" />}
        <div>
          <p className="eyebrow">{t('Cotización')} #{quote.number}</p>
          <h1>{company.name}</h1>
        </div>
        <button type="button" className="primary-button no-print" onClick={() => window.print()}>{t('Descargar PDF')}</button>
      </header>

      {quote.status === 'aprobada' && <p className="quote-banner ok">{t('✔ Aprobada por {name} el {d}. La empresa ya tiene tu orden de trabajo.', { name: quote.decidedBy, d: day(quote.decidedAt) })}</p>}
      {quote.payment?.status === 'pagado' && <p className="quote-banner ok">{t('✔ Pago recibido. ¡Gracias!')}{quote.payment.test ? ` ${t('(prueba)')}` : ''}</p>}
      {quote.payment?.status === 'anticipo' && <p className="quote-banner ok">{t('✔ Anticipo de {paid} recibido. El saldo de {balance} se acuerda con la empresa.', { paid: money(quote.payment.amountPaid, cur), balance: money(quote.payment.balance, cur) })}{quote.payment.test ? ` ${t('(prueba)')}` : ''}</p>}
      {quote.payment?.status === 'pendiente' && data.tx?.status === 'APPROVED' && <p className="quote-banner ok">{t('Confirmando tu pago con Wompi… Si no se actualiza en un momento, recarga esta página.')}</p>}
      {quote.payment?.status === 'pendiente' && ['DECLINED', 'ERROR', 'VOIDED'].includes(data.tx?.status) && !quote.payment.pending && <p className="quote-banner no">{t('El pago no se aprobó. Puedes intentarlo de nuevo.')}</p>}
      {quote.payment?.status === 'pendiente' && (data.tx?.status === 'PENDING' || quote.payment.pending) && <p className="quote-banner no">{t('Wompi está procesando tu pago. Te avisaremos cuando se confirme; puedes recargar esta página en unos minutos.')}</p>}
      {quote.invoice?.publicUrl && (
        <p className="quote-banner ok">{t('Factura electrónica {n}', { n: quote.invoice.number })}{quote.invoice.validated === false ? ` (${t('pendiente de validación en la DIAN')})` : ''} · <a href={quote.invoice.publicUrl} target="_blank" rel="noreferrer">{t('Descargar factura')}</a></p>
      )}
      {quote.payment?.online && (
        <section className="report-section quote-decision no-print">
          <h3>{quote.payment.due < quote.total ? t('Anticipo para empezar el trabajo') : t('Pago en línea')}</h3>
          <p>{quote.payment.due < quote.total
            ? t('Paga {due} de anticipo ({p} % de {total}); el resto se acuerda con la empresa.', { due: money(quote.payment.due, cur), total: money(quote.total, cur), p: Math.round((quote.payment.due / quote.total) * 100) })
            : t('Paga {due} con tarjeta, PSE, Nequi o Bancolombia.', { due: money(quote.payment.due, cur) })}</p>
          <button type="button" className="primary-button" disabled={busy} onClick={pay}>{t('Pagar {due} con Wompi', { due: money(quote.payment.due, cur) })}</button>
        </section>
      )}
      {quote.status === 'rechazada' && <p className="quote-banner no">{t('Rechazada por {name} el {d}.', { name: quote.decidedBy, d: day(quote.decidedAt) })}</p>}
      {quote.status === 'vencida' && <p className="quote-banner no">{t('Esta cotización venció el {d}. Pide a {company} una nueva.', { d: day(quote.validUntil), company: company.name })}</p>}

      <section className="report-section">
        <h2>{quote.title}</h2>
        <dl className="report-facts">
          <div><dt>{t('Para')}</dt><dd>{quote.client?.name || '—'}{quote.client?.company ? ` · ${quote.client.company}` : ''}</dd></div>
          <div><dt>{t('Fecha')}</dt><dd>{day(quote.sentAt)}</dd></div>
          <div><dt>{t('Válida hasta')}</dt><dd>{day(quote.validUntil)}</dd></div>
        </dl>
      </section>

      <section className="report-section">
        <table className="quote-table print">
          <thead><tr><th>{t('Descripción')}</th><th className="num">{t('Cant.')}</th><th className="num wide">{t('Precio unitario')}</th><th className="num wide">{t(cur === 'USD' ? 'Impuesto' : 'IVA')}</th><th className="num">{t('Valor')}</th></tr></thead>
          <tbody>
            {quote.items.map((i, n) => (
              <tr key={n}><td>{i.description}</td><td className="num">{i.qty}</td><td className="num wide">{money(i.unitPrice, cur)}</td><td className="num wide">{i.excluded ? t('Excluido') : `${i.taxRate} %`}</td><td className="num">{money(i.amount, cur)}</td></tr>
            ))}
          </tbody>
          <tfoot>
            <tr className="sum"><td colSpan="2">{t('Subtotal')}</td><td className="wide" /><td className="wide" /><td className="num">{money(quote.subtotal, cur)}</td></tr>
            <tr className="sum"><td colSpan="2">{t(cur === 'USD' ? 'Impuesto' : 'IVA')}</td><td className="wide" /><td className="wide" /><td className="num">{money(quote.tax, cur)}</td></tr>
            <tr className="grand"><td colSpan="2">{t('Total')}</td><td className="wide" /><td className="wide" /><td className="num">{money(quote.total, cur)}</td></tr>
          </tfoot>
        </table>
      </section>

      {quote.notes && (
        <section className="report-section">
          <h3>{t('Condiciones')}</h3>
          <p className="report-notes">{quote.notes}</p>
        </section>
      )}

      {quote.status === 'enviada' && (
        <section className="report-section quote-decision no-print">
          <h3>{t('¿Apruebas esta cotización?')}</h3>
          <label>{t('Tu nombre completo')}<input value={name} maxLength={100} autoComplete="name" onChange={(e) => setName(e.target.value)} /></label>
          {!rejecting ? (
            <>
              <label className="check-line"><input type="checkbox" checked={accept} onChange={(e) => setAccept(e.target.checked)} /> {t('Acepto la cotización #{n} por {total} y sus condiciones.', { n: quote.number, total: money(quote.total, cur) })}</label>
              <div className="order-actions">
                <button type="button" className="primary-button" disabled={busy || !accept || name.trim().length < 3} onClick={() => answer(true)}>{t('Aprobar cotización')}</button>
                <button type="button" className="ghost-button" onClick={() => setRejecting(true)}>{t('No la apruebo')}</button>
              </div>
            </>
          ) : (
            <>
              <label>{t('¿Por qué? (opcional, le ayuda a la empresa)')}<textarea rows="3" maxLength={500} value={note} onChange={(e) => setNote(e.target.value)} /></label>
              <div className="order-actions">
                <button type="button" className="danger-button" disabled={busy || name.trim().length < 3} onClick={() => answer(false)}>{t('Rechazar cotización')}</button>
                <button type="button" className="ghost-button" onClick={() => setRejecting(false)}>{t('Volver')}</button>
              </div>
            </>
          )}
        </section>
      )}

      <footer className="report-foot muted small">{t('Generado con NOVAWORKORDER Servicios')}</footer>
    </div>
  );
}
