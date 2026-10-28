import { useEffect, useRef, useState } from 'react';
import { errorMessage } from '../api';
import { t } from '../i18n';
import { phoneRegion, whatsappLink } from '../ui';

// Informe de servicio dentro de una orden: checklist, fotos de antes y después, firma del cliente y el enlace del
// informe para mandárselo. `editable`: el técnico de la orden (o el administrador) mientras se puede llenar. Las fotos,
// la firma y las plantillas se piden solo con el informe abierto (en «Mis órdenes» hay una tarjeta por orden).

// Reduce la foto a 1280 px por lado y la pasa a JPEG (unos 150–300 KB), en el celular, antes de subirla.
const shrinkPhoto = (file) => new Promise((resolve, reject) => {
  if (!/^image\//.test(file.type)) { reject(new Error(t('Usa una imagen PNG, JPG o WEBP'))); return; }
  const url = URL.createObjectURL(file);
  const img = new Image();
  img.onerror = () => { URL.revokeObjectURL(url); reject(new Error(t('La imagen no es válida'))); };
  img.onload = () => {
    URL.revokeObjectURL(url);
    const scale = Math.min(1, 1280 / Math.max(img.width, img.height));
    const canvas = document.createElement('canvas');
    canvas.width = Math.round(img.width * scale);
    canvas.height = Math.round(img.height * scale);
    canvas.getContext('2d').drawImage(img, 0, 0, canvas.width, canvas.height);
    const tryQuality = (q) => canvas.toBlob((blob) => {
      if (!blob) { reject(new Error(t('La imagen no es válida'))); return; }
      if (blob.size > 390 * 1024 && q > 0.4) tryQuality(q - 0.15); else resolve(blob);
    }, 'image/jpeg', q);
    tryQuality(0.75);
  };
  img.src = url;
});

// Las fotos piden sesión: se bajan con el token y se muestran desde la memoria del navegador.
function AuthImage({ api, src, alt, className }) {
  const [url, setUrl] = useState('');
  useEffect(() => {
    let alive = true;
    let made = '';
    api.get(src, { responseType: 'blob' }).then(({ data }) => {
      if (!alive) return;   // llegó después de desmontarse: no se crea una URL que nadie liberaría
      made = URL.createObjectURL(data);
      setUrl(made);
    }).catch(() => {});
    return () => { alive = false; if (made) URL.revokeObjectURL(made); };
  }, [src]);
  return url ? <img className={className} src={url} alt={alt} /> : <span className={`${className} placeholder`} />;
}

// Firma con el dedo: un lienzo blanco donde el cliente dibuja; se guarda como PNG.
function SignaturePad({ onSave, busy }) {
  const canvas = useRef(null);
  const pointer = useRef(null);   // el dedo que firma: otro dedo o la palma no rayan ni cortan el trazo
  const scale = useRef(1);
  const [name, setName] = useState('');
  const [inked, setInked] = useState(false);

  useEffect(() => {
    const c = canvas.current;
    const ratio = window.devicePixelRatio || 1;
    scale.current = ratio;
    c.width = c.offsetWidth * ratio;
    c.height = c.offsetHeight * ratio;
    const ctx = c.getContext('2d');
    ctx.scale(ratio, ratio);
    ctx.lineWidth = 2.2;
    ctx.lineCap = 'round';
    ctx.strokeStyle = '#111';
  }, []);

  // El punto en el lienzo aunque haya cambiado de tamaño después de montarse (al girar el celular): el trazo queda
  // bajo el dedo.
  const point = (e) => {
    const c = canvas.current;
    const r = c.getBoundingClientRect();
    return { x: (e.clientX - r.left) * (c.width / scale.current / r.width), y: (e.clientY - r.top) * (c.height / scale.current / r.height) };
  };
  const down = (e) => {
    if (pointer.current !== null) return;
    e.preventDefault();
    pointer.current = e.pointerId;
    canvas.current.setPointerCapture(e.pointerId);
    const ctx = canvas.current.getContext('2d');
    const p = point(e);
    ctx.beginPath();
    ctx.moveTo(p.x, p.y);
  };
  const move = (e) => {
    if (e.pointerId !== pointer.current) return;
    const ctx = canvas.current.getContext('2d');
    const p = point(e);
    ctx.lineTo(p.x, p.y);
    ctx.stroke();
    setInked(true);
  };
  const up = (e) => { if (e.pointerId === pointer.current) pointer.current = null; };
  const clear = () => {
    const c = canvas.current;
    c.getContext('2d').clearRect(0, 0, c.width, c.height);
    setInked(false);
  };
  // La firma se reduce a 600 px de ancho para que pese poco (el servidor acepta hasta 60 KB); si una firma larga aún
  // pasa del límite, se prueba más pequeña antes de pedir que se firme más simple.
  const save = () => {
    const c = canvas.current;
    for (const width of [600, 450, 300]) {
      const out = document.createElement('canvas');
      out.width = Math.min(width, c.width);
      out.height = Math.round(c.height * (out.width / c.width));
      out.getContext('2d').drawImage(c, 0, 0, out.width, out.height);
      const image = out.toDataURL('image/png');
      if (image.length * 0.75 <= 58 * 1024) { onSave({ name: name.trim(), image }); return; }
    }
    alert(t('La firma quedó muy pesada: bórrala y fírmala más simple'));
  };

  return (
    <div className="signature-pad">
      <canvas ref={canvas} className="signature-canvas" onPointerDown={down} onPointerMove={move} onPointerUp={up} onPointerCancel={up} onPointerLeave={up} />
      <input placeholder={t('Nombre de quien recibe')} value={name} maxLength={100} onChange={(e) => setName(e.target.value)} />
      <div className="order-actions">
        <button type="button" className="ghost-button" onClick={clear}>{t('Borrar')}</button>
        <button type="button" className="mini-button edit" disabled={busy || !inked || !name.trim()} onClick={save}>{t('Guardar firma')}</button>
      </div>
    </div>
  );
}

// «1 foto», «3 fotos».
const count = (n, one, many) => (n === 1 ? t(one) : t(many, { n }));

// `autoShare`: la orden se acaba de completar; el informe se abre con el enlace listo para enviarlo.
export default function ServiceReport({ api, user, order, editable, onChange, autoShare = false }) {
  const [templates, setTemplates] = useState(null);
  const [busy, setBusy] = useState(false);
  const [signing, setSigning] = useState(false);
  const [link, setLink] = useState('');
  const [open, setOpen] = useState(editable && order.status === 'en_proceso');
  const fileKind = useRef('antes');
  const fileInput = useRef(null);
  const shareBox = useRef(null);
  // Compartir: el administrador, el usuario cliente o el técnico de la orden. Cambiar el enlace: el administrador o el
  // técnico de la orden.
  const mine = user.role === 'admin' || (user.role === 'tecnico' && String(order.assignedTo?._id || order.assignedTo || '') === String(user._id));
  const canShare = mine || user.role === 'cliente';

  useEffect(() => { if (editable && order.status === 'en_proceso') setOpen(true); }, [editable, order.status]);
  useEffect(() => {
    if (open && editable && !order.checklist?.length && !templates) api.get('/checklists').then(({ data }) => setTemplates(data.items || [])).catch(() => setTemplates([]));
  }, [open, editable, order.checklist?.length]);

  const run = async (fn, fallback) => {
    try {
      setBusy(true);
      const { data } = await fn();
      if (data && data._id) onChange(data);
      return data;
    } catch (error) {
      alert(errorMessage(error, t(fallback)));
      return null;
    } finally {
      setBusy(false);
    }
  };

  const applyTemplate = (id) => id && run(() => api.put(`/workorders/${order._id}/checklist`, { template: id }), 'No se pudo poner el checklist');
  // Una plantilla elegida por error se quita (con sus marcas) para elegir otra.
  const removeChecklist = () => window.confirm(t('¿Quitar este checklist? Se borran sus marcas y podrás elegir otro.'))
    && run(() => api.put(`/workorders/${order._id}/checklist`, { template: null }), 'No se pudo poner el checklist');
  const toggle = async (index, patch) => {
    const before = order;
    const items = order.checklist.map((i, n) => ({ label: i.label, done: i.done, note: i.note, ...(n === index ? patch : {}) }));
    onChange({ ...order, checklist: order.checklist.map((i, n) => (n === index ? { ...i, ...patch } : i)) });   // al instante
    const saved = await run(() => api.patch(`/workorders/${order._id}/checklist`, { items }), 'No se pudo guardar el checklist');
    if (!saved) onChange(before);   // no se guardó: la pantalla vuelve a lo que tiene el servidor (y la nota se reintenta)
    return saved;
  };
  const pick = (kind) => { fileKind.current = kind; fileInput.current?.click(); };
  const upload = async (e) => {
    const kind = fileKind.current;   // el botón que se tocó, aunque luego se toque el otro mientras se suben
    const files = [...(e.target.files || [])];
    e.target.value = '';
    for (const file of files) {
      try {
        const blob = await shrinkPhoto(file);
        await run(() => api.post(`/workorders/${order._id}/files?kind=${kind}`, blob, { headers: { 'Content-Type': 'image/jpeg' } }), 'No se pudo guardar la foto');
      } catch (error) {
        alert(error.message);
      }
    }
  };
  const removePhoto = (fileId) => window.confirm(t('¿Borrar esta foto?'))
    && run(() => api.delete(`/workorders/${order._id}/files/${fileId}`), 'No se pudo borrar la foto');
  const saveSignature = async (payload) => {
    const done = await run(() => api.post(`/workorders/${order._id}/signature`, payload), 'No se pudo guardar la firma');
    if (done) setSigning(false);
  };
  const share = async () => {
    const data = await run(() => api.post(`/workorders/${order._id}/report-link`), 'No se pudo crear el enlace del informe');
    if (data?.path) setLink(`${window.location.origin}${data.path}`);
  };
  useEffect(() => {
    if (!autoShare || !canShare) return;
    setOpen(true);
    if (!link) share();
  }, [autoShare]);
  useEffect(() => {
    if (autoShare && link) shareBox.current?.scrollIntoView({ block: 'center', behavior: 'smooth' });
  }, [autoShare, link]);

  // Cambiar el enlace: el anterior deja de abrir el informe (se mandó a quien no era, o el cliente lo pide).
  const rotate = async () => {
    if (!window.confirm(t('El enlace anterior dejará de funcionar. ¿Crear uno nuevo?'))) return;
    const data = await run(() => api.post(`/workorders/${order._id}/report-link`, { rotate: true }), 'No se pudo cambiar el enlace del informe');
    if (data?.path) setLink(`${window.location.origin}${data.path}`);
  };

  const photos = order.attachments || [];
  const required = (order.checklist || []).filter((i) => i.required);
  const pending = required.filter((i) => !i.done).length;
  const message = t('Hola {name}, este es el informe del servicio «{title}»: {url}', { name: order.client?.name || order.customerName || '', title: order.title, url: link });

  return (
    <details className="service-report" open={open} onToggle={(e) => setOpen(e.currentTarget.open)}>
      <summary>
        {t('Informe de servicio')}
        <span className="muted small"> · {order.checklist?.length ? (pending ? count(pending, '1 pendiente', '{n} pendientes') : t('checklist listo')) : t('sin checklist')} · {count(photos.length, '1 foto', '{n} fotos')}{order.signature ? ` · ${t('firmado')}` : ''}</span>
      </summary>

      {order.checklist?.length ? (
        <div className="checklist">
          <p className="label">{order.checklistName}</p>
          {order.checklist.map((item, n) => (
            <label key={`${n}-${item.label}`} className={`check-item ${item.done ? 'done' : ''}`}>
              <input type="checkbox" checked={item.done} disabled={!editable || busy} onChange={(e) => toggle(n, { done: e.target.checked })} />
              <span>{item.label}{item.required && <b className="req" title={t('Obligatorio')}> *</b>}</span>
              {editable && (item.done || item.note) ? (
                <input className="check-note" placeholder={t('Nota')} defaultValue={item.note} maxLength={300}
                  onBlur={(e) => e.target.value !== item.note && toggle(n, { note: e.target.value })} />
              ) : item.note && <small className="muted">{item.note}</small>}
            </label>
          ))}
          {editable && <button type="button" className="link-button" disabled={busy} onClick={removeChecklist}>{t('Cambiar checklist')}</button>}
        </div>
      ) : editable && templates?.length ? (
        <label>{t('Checklist')}
          <select value="" disabled={busy} onChange={(e) => applyTemplate(e.target.value)}>
            <option value="">{t('Elige el tipo de servicio…')}</option>
            {templates.map((tpl) => <option key={tpl._id} value={tpl._id}>{tpl.name}</option>)}
          </select>
        </label>
      ) : null}

      <div className="photo-strip">
        {photos.map((p) => (
          <figure key={p.file} className="photo">
            {open && <AuthImage api={api} src={`/workorders/${order._id}/files/${p.file}`} alt={t(p.kind === 'antes' ? 'Antes' : 'Después')} className="photo-img" />}
            <figcaption>{t(p.kind === 'antes' ? 'Antes' : 'Después')}</figcaption>
            {editable && <button type="button" className="photo-remove" aria-label={t('Borrar foto')} onClick={() => removePhoto(p.file)}>×</button>}
          </figure>
        ))}
      </div>
      {editable && photos.length < 12 && (
        <div className="order-actions">
          <button type="button" className="ghost-button" disabled={busy} onClick={() => pick('antes')}>{t('📷 Foto de antes')}</button>
          <button type="button" className="ghost-button" disabled={busy} onClick={() => pick('despues')}>{t('📷 Foto de después')}</button>
          <input ref={fileInput} type="file" accept="image/*" capture="environment" multiple hidden onChange={upload} />
        </div>
      )}

      {order.signature ? (
        <div className="signature-box">
          {open && <AuthImage api={api} src={`/workorders/${order._id}/files/${order.signature.file}`} alt={t('Firma')} className="signature-img" />}
          <small className="muted">{t('Firmó {name}', { name: order.signature.name })}</small>
          {editable && !signing && <button type="button" className="link-button" onClick={() => setSigning(true)}>{t('Firmar de nuevo')}</button>}
        </div>
      ) : editable && !signing && (
        <button type="button" className="ghost-button" onClick={() => setSigning(true)}>{t('✍ Firma del cliente')}</button>
      )}
      {signing && <SignaturePad busy={busy} onSave={saveSignature} />}

      {canShare && autoShare && link && <p className="label">{t('Orden completada: envíale el informe al cliente')}</p>}
      {canShare && (
        <div className="order-actions" ref={shareBox}>
          {!link ? (
            <button type="button" className="ghost-button" disabled={busy} onClick={share}>{t('🔗 Compartir informe')}</button>
          ) : (
            <>
              <a className="ghost-button" href={link} target="_blank" rel="noreferrer">{t('Ver informe')}</a>
              <a className="mini-button edit" href={whatsappLink(order.client?.phone, message, phoneRegion(user.company))} target="_blank" rel="noreferrer">{t('Enviar por WhatsApp')}</a>
              <button type="button" className="ghost-button" onClick={() => navigator.clipboard?.writeText(link).then(() => alert(t('Enlace copiado')))}>{t('Copiar enlace')}</button>
              {mine && <button type="button" className="link-button" disabled={busy} onClick={rotate}>{t('Cambiar enlace')}</button>}
            </>
          )}
        </div>
      )}
    </details>
  );
}
