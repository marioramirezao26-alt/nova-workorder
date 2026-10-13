import { useEffect, useState } from 'react';
import { errorMessage } from '../api';
import { t } from '../i18n';
import { applyBrand, DEFAULT_BRAND, logoUrl, PALETTES, shrinkImage } from '../brand';

// «Mi marca» (solo el administrador): el logo y los colores que ve toda la empresa en su app.
export default function Brand({ api, user, onSaved }) {
  const current = user.company?.branding || {};
  const [colors, setColors] = useState({ primary: current.primary || DEFAULT_BRAND.primary, accent: current.accent || DEFAULT_BRAND.accent });
  const [logo, setLogo] = useState(undefined);                 // undefined: sin cambios · null: quitar · data URL: nuevo
  const [busy, setBusy] = useState(false);

  // Al salir sin guardar, vuelven los colores guardados.
  useEffect(() => () => applyBrand(user.company?.branding), [user.company?.branding]);

  const preview = (next) => {
    setColors(next);
    applyBrand(next);                                          // se ve al instante; si no guarda, vuelve al salir
  };

  const pick = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      setLogo(await shrinkImage(file));
    } catch (error) {
      alert(error.message);
    }
  };

  const save = async () => {
    try {
      setBusy(true);
      const body = { primary: colors.primary, accent: colors.accent, ...(logo !== undefined ? { logo } : {}) };
      const { data } = await api.put('/company/branding', body);
      onSaved(data);
      setLogo(undefined);
      alert(t('¡Listo! Tu equipo verá tu marca la próxima vez que abra la app.'));
    } catch (error) {
      alert(errorMessage(error, t('No se pudo guardar tu marca')));
    } finally {
      setBusy(false);
    }
  };

  const shown = logo === undefined ? logoUrl(user.company) : logo || '/logo.svg';

  return (
    <section className="view">
      <header className="view-header">
        <div>
          <p className="eyebrow">{user.company?.name}</p>
          <h2>{t('Mi marca')}</h2>
          <p className="muted">{t('Tu logo y tus colores en la app de todo tu equipo.')}</p>
        </div>
      </header>

      <div className="panel-box brand-box">
        <h3>{t('Logo')}</h3>
        <div className="brand-logo-row">
          <img className="brand-logo-preview" src={shown} alt={t('Logo de tu empresa')} />
          <div className="brand-logo-actions">
            <label className="mini-button edit brand-upload">
              {t('Subir logo')}
              <input type="file" accept="image/png,image/jpeg,image/webp" onChange={pick} hidden />
            </label>
            {(logo || (logo === undefined && current.hasLogo)) && (
              <button type="button" className="ghost-button" onClick={() => setLogo(null)}>{t('Quitar logo')}</button>
            )}
            <p className="muted small">{t('PNG, JPG o WEBP. Mejor cuadrado y con fondo transparente. Lo ajustamos al tamaño.')}</p>
          </div>
        </div>
      </div>

      <div className="panel-box brand-box">
        <h3>{t('Colores')}</h3>
        <div className="brand-palettes">
          {PALETTES.map((p) => (
            <button key={p.name} type="button" title={t(p.name)}
              className={`brand-swatch ${p.primary === colors.primary && p.accent === colors.accent ? 'active' : ''}`}
              style={{ background: `linear-gradient(135deg, ${p.primary}, ${p.accent})` }}
              onClick={() => preview({ primary: p.primary, accent: p.accent })}>
              <span>{t(p.name)}</span>
            </button>
          ))}
        </div>
        <div className="two-columns">
          <label>{t('Color principal')}
            <input type="color" value={colors.primary} onChange={(e) => preview({ ...colors, primary: e.target.value })} />
          </label>
          <label>{t('Color secundario')}
            <input type="color" value={colors.accent} onChange={(e) => preview({ ...colors, accent: e.target.value })} />
          </label>
        </div>
        <div className="brand-preview">
          <span className="role-badge">{t('Así se ve una etiqueta')}</span>
          <button type="button" className="primary-button small">{t('Así se ve un botón')}</button>
        </div>
      </div>

      <div className="order-actions">
        <button type="button" className="primary-button" disabled={busy} onClick={save}>{busy ? t('Guardando…') : t('Guardar mi marca')}</button>
        <button type="button" className="ghost-button" onClick={() => preview(DEFAULT_BRAND)}>{t('Volver a los colores de NOVA')}</button>
      </div>
    </section>
  );
}
