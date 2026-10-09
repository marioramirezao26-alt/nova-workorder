import { API_URL } from './api';

// «Mi marca»: los colores de NOVAWORKORDER y las paletas para elegir rápido.
export const DEFAULT_BRAND = { primary: '#2f78f6', accent: '#63a3ff' };
export const PALETTES = [
  { name: 'NOVA', primary: '#2f78f6', accent: '#63a3ff' },
  { name: 'Esmeralda', primary: '#059669', accent: '#34d399' },
  { name: 'Rojo', primary: '#dc2626', accent: '#f87171' },
  { name: 'Naranja', primary: '#ea580c', accent: '#fbbf24' },
  { name: 'Morado', primary: '#7c3aed', accent: '#a78bfa' },
  { name: 'Rosa', primary: '#db2777', accent: '#f472b6' },
  { name: 'Turquesa', primary: '#0891b2', accent: '#22d3ee' },
  { name: 'Grafito', primary: '#475569', accent: '#94a3b8' },
];

// Pone los colores de la empresa en toda la app (variables CSS --brand y --brand-2).
export const applyBrand = (branding) => {
  const root = document.documentElement;
  root.style.setProperty('--brand', branding?.primary || DEFAULT_BRAND.primary);
  root.style.setProperty('--brand-2', branding?.accent || DEFAULT_BRAND.accent);
};

export const logoUrl = (company) => (company?.branding?.hasLogo
  ? `${API_URL}/public/logo/${company._id}?v=${company.branding.logoVersion}` : '/logo.svg');

// Reduce la imagen a máximo 512 px por lado y la pasa a PNG o WEBP liviano, en el navegador (sin subir el original).
export const shrinkImage = (file, max = 512) => new Promise((resolve, reject) => {
  if (!/^image\/(png|jpeg|webp)$/.test(file.type)) {
    reject(new Error('Usa una imagen PNG, JPG o WEBP'));
    return;
  }
  const reader = new FileReader();
  reader.onerror = () => reject(new Error('No se pudo leer la imagen'));
  reader.onload = () => {
    const img = new Image();
    img.onerror = () => reject(new Error('La imagen no es válida'));
    img.onload = () => {
      const scale = Math.min(1, max / Math.max(img.width, img.height));
      const canvas = document.createElement('canvas');
      canvas.width = Math.round(img.width * scale);
      canvas.height = Math.round(img.height * scale);
      canvas.getContext('2d').drawImage(img, 0, 0, canvas.width, canvas.height);
      let out = canvas.toDataURL('image/png');
      if (out.length > 380000) out = canvas.toDataURL('image/webp', 0.85);     // más liviano si el PNG pesa mucho
      resolve(out);
    };
    img.src = reader.result;
  };
  reader.readAsDataURL(file);
});
