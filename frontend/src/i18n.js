// Idiomas de la app: español (Colombia) e inglés (Estados Unidos). El texto se escribe en español en el código y
// `t('Texto')` lo devuelve en inglés cuando la app está en inglés. Si una frase no está en EN, se queda en español.
// El idioma: el que eligió la persona en este equipo; si no eligió, el de su empresa; antes de entrar, el del navegador.
const KEY = 'nova-lang';

const EN = {
  // general
  'Cargando…': 'Loading…',
  Cancelar: 'Cancel',
  Editar: 'Edit',
  Eliminar: 'Delete',
  Guardar: 'Save',
  'Guardar cambios': 'Save changes',
  Actualizar: 'Refresh',
  Salir: 'Log out',
  'Cerrar sesión': 'Log out',
  Email: 'Email',
  Nombre: 'Name',
  Notas: 'Notes',
  Estado: 'Status',
  Activo: 'Active',
  Inactivo: 'Inactive',
  English: 'English',
  Español: 'Español',

  // menú y roles
  Inicio: 'Home',
  'Mis órdenes': 'My jobs',
  Órdenes: 'Work orders',
  Clientes: 'Customers',
  Usuarios: 'Users',
  Actividad: 'Activity',
  Reportes: 'Reports',
  Desde: 'From',
  Hasta: 'To',
  Ver: 'View',
  'Descargar CSV': 'Download CSV',
  'Órdenes creadas': 'Work orders created',
  Completadas: 'Completed',
  'Por técnico': 'By technician',
  'Por estado': 'By status',
  'Por día': 'By day',
  'Sin datos en este rango.': 'No data in this range.',
  'No se pudieron cargar los reportes': "Couldn't load reports",
  'No se pudo descargar el CSV': "Couldn't download the CSV",
  'Quién hizo qué en el panel: órdenes, clientes y usuarios.': 'Who did what in the panel: work orders, customers and users.',
  'Todavía no hay actividad registrada.': 'No activity recorded yet.',
  'Cargar más': 'Load more',
  'No se pudo cargar la actividad': "Couldn't load activity",
  'Mi marca': 'My brand',
  Servicios: 'Services',
  Administrador: 'Admin',
  Técnico: 'Technician',
  Cliente: 'Customer',

  // estados y prioridades
  Pendiente: 'Pending',
  'En proceso': 'In progress',
  Completada: 'Completed',
  Cancelada: 'Canceled',
  Baja: 'Low',
  Media: 'Medium',
  Alta: 'High',
  Urgente: 'Urgent',

  // entrar
  'Las órdenes de trabajo de tu empresa, en el celular de cada técnico.': "Your company's work orders, on every technician's phone.",
  'Cada técnico ve sus órdenes del día': 'Each technician sees their jobs for the day',
  'Llamar al cliente y abrir el mapa con un toque': 'Call the customer and open the map with one tap',
  'Iniciar y completar desde el sitio': 'Start and complete jobs on site',
  'Iniciar sesión': 'Log in',
  Contraseña: 'Password',
  'Entrando…': 'Logging in…',
  Entrar: 'Log in',
  '¿No tienes cuenta? Pídela al administrador de tu empresa.': "Don't have an account? Ask your company's admin.",
  '¿Tu empresa aún no usa NOVAWORKORDER Servicios?': "Your company doesn't use NOVAWORKORDER yet?",
  'Solicita una demo': 'Book a demo',
  'No se pudo iniciar sesión': 'Could not log in',
  'Bienvenido, {name}': 'Welcome, {name}',
  'Antes de empezar, cambia la contraseña temporal que te entregaron.': 'Before you start, change the temporary password you were given.',
  'Nueva contraseña': 'New password',
  'Contraseña temporal': 'Temporary password',
  'Nueva contraseña (mínimo 8 caracteres)': 'New password (at least 8 characters)',
  'Guardar y entrar': 'Save and log in',
  'No se pudo cambiar la contraseña': 'Could not change the password',

  // inicio
  Total: 'Total',
  Pendientes: 'Pending',
  Completadas: 'Completed',
  'Por estado': 'By status',
  'Últimos meses': 'Last few months',
  'Aún no hay datos.': 'No data yet.',
  Recientes: 'Recent',
  'Aún no hay órdenes.': 'No work orders yet.',

  // mis órdenes
  'Hola, {name}': 'Hi, {name}',
  'Órdenes de mi empresa': "My company's work orders",
  'Por hacer ({n})': 'To do ({n})',
  Cerradas: 'Closed',
  'No tienes órdenes pendientes. ¡Buen trabajo!': 'No pending jobs. Nice work!',
  'No hay órdenes abiertas.': 'No open work orders.',
  'Todavía no hay órdenes cerradas.': 'No closed work orders yet.',
  'Vencida · ': 'Overdue · ',
  'Para el ': 'Due ',
  'Técnico: {name}': 'Technician: {name}',
  'Completada {when}': 'Completed {when}',
  'Nota para la orden (opcional)': 'Note for this job (optional)',
  // ubicación al iniciar y completar
  'Ubicación al iniciar y completar órdenes': 'Location when starting and completing jobs',
  '{company} registra dónde estás solo en el momento en que pulsas «Iniciar» y «Completar», para confirmar la visita al cliente. No se te sigue durante el día. Puedes retirar la autorización cuando quieras.':
    '{company} records where you are only when you tap «Start» and «Complete», to confirm the visit to the customer. You are not tracked during the day. You can withdraw this permission at any time.',
  Autorizo: 'I agree',
  'Ahora no': 'Not now',
  'No se pudo guardar tu respuesta': 'Your answer could not be saved',
  '📍 Se registra tu ubicación al iniciar y completar.': '📍 Your location is recorded when you start and complete.',
  'Retirar autorización': 'Withdraw permission',
  Inició: 'Started',
  Completó: 'Completed',
  'ver en el mapa': 'see on the map',
  'a {d} del cliente': '{d} from the customer',
  '⚠ a {d} del cliente': '⚠ {d} from the customer',
  'No se pudo guardar el ajuste': 'The setting could not be saved',
  'Registrar la ubicación de los técnicos al iniciar y completar cada orden': 'Record technicians\' location when they start and complete each job',
  'Cada técnico lo autoriza en su celular (Ley 1581). Solo se guarda el punto en esos dos momentos, no un seguimiento continuo; en cada orden ves a cuántos metros del cliente estaba.':
    'Each technician agrees on their phone. Only the point at those two moments is saved, not continuous tracking; each job shows how far from the customer they were.',
  // mapa en vivo
  Mapa: 'Map',
  'Mapa en vivo': 'Live map',
  'Mapa en vivo mientras trabajas en una orden': 'Live map while you work on a job',
  '{company} quiere ver en su mapa dónde vas solo mientras tienes una orden «En proceso» (un punto por minuto), para coordinar las visitas. Al completar la orden deja de compartirse. Puedes retirar la autorización cuando quieras.':
    '{company} wants to see on its map where you are only while you have a job «In progress» (one point per minute), to coordinate visits. When you complete the job it stops being shared. You can withdraw this permission at any time.',
  '🛰 Compartiendo dónde vas mientras la orden está en proceso.': '🛰 Sharing where you are while the job is in progress.',
  '🛰 Se compartirá dónde vas mientras la orden esté en proceso (activa el GPS).': '🛰 Your location will be shared while the job is in progress (turn on GPS).',
  '🛰 Mapa en vivo autorizado: solo con una orden en proceso.': '🛰 Live map allowed: only while a job is in progress.',
  'Mapa en vivo: ver dónde va cada técnico mientras tiene una orden en proceso': 'Live map: see where each technician is while they have a job in progress',
  'Es otra autorización de cada técnico. Solo mientras la orden está «En proceso», un punto por minuto; al completarla deja de compartirse. Lo ves en «Mapa».':
    'Each technician agrees to this separately. Only while the job is «In progress», one point per minute; it stops when the job is completed. You see it in «Map».',
  'No se pudo cargar el mapa': 'The map could not be loaded',
  'El mapa en vivo está apagado. Actívalo en «Usuarios»; cada técnico también lo autoriza en su celular. Mientras tanto ves dónde inició cada orden, si se registró.':
    'The live map is off. Turn it on in «Users»; each technician also agrees on their phone. Meanwhile you see where each job started, if it was recorded.',
  'Mapa de técnicos': 'Technicians map',
  'Ningún técnico tiene órdenes en proceso ahora.': 'No technician has a job in progress right now.',
  'Sin técnico': 'No technician',
  'Sin cliente': 'No customer',
  'Sin ubicación: no autorizó o no tiene GPS.': 'No location: not allowed or no GPS.',
  'Sin señal desde {when}': 'No signal since {when}',
  '⚠ Lejos del cliente desde {when} · a {d}': '⚠ Away from the customer since {when} · {d} away',
  'A {d} del cliente · {when}': '{d} from the customer · {when}',
  'Actualizado {when}': 'Updated {when}',
  'cerca o en camino': 'near or on the way',
  'lejos del cliente': 'away from the customer',
  'sin señal': 'no signal',
  cliente: 'customer',
  '▶ Iniciar': '▶ Start',
  '✓ Completar': '✓ Complete',
  '¿Marcar «{title}» como completada?': 'Mark "{title}" as completed?',
  'No se pudieron cargar las órdenes': 'Could not load the work orders',
  'No se pudo actualizar la orden': 'Could not update the work order',

  // órdenes
  '+ Nueva orden': '+ New work order',
  'Editar orden': 'Edit work order',
  'Nueva orden': 'New work order',
  Título: 'Title',
  Descripción: 'Description',
  'Sin cliente': 'No customer',
  'Técnico asignado': 'Assigned technician',
  'Sin asignar': 'Unassigned',
  Prioridad: 'Priority',
  'Fecha límite': 'Due date',
  'Crear orden': 'Create work order',
  'Buscar por título, descripción o cliente…': 'Search by title, description or customer…',
  Todas: 'All',
  'No hay órdenes con ese filtro.': 'No work orders match this filter.',
  'Creada por {name}': 'Created by {name}',
  '¿Eliminar la orden «{title}»?': 'Delete the work order "{title}"?',
  'No se pudo guardar la orden': 'Could not save the work order',
  'No se pudo eliminar la orden': 'Could not delete the work order',

  // clientes
  '+ Nuevo cliente': '+ New customer',
  'Editar cliente': 'Edit customer',
  'Nuevo cliente': 'New customer',
  Teléfono: 'Phone',
  'Empresa (razón social)': 'Company',
  Dirección: 'Address',
  'Crear cliente': 'Create customer',
  'Buscar cliente…': 'Search customers…',
  'No hay clientes registrados.': 'No customers yet.',
  '¿Eliminar a «{name}»?': 'Delete "{name}"?',
  'No se pudo guardar el cliente': 'Could not save the customer',
  'No se pudo eliminar el cliente': 'Could not delete the customer',

  // usuarios
  'Contraseña temporal de {email} · se muestra una sola vez': 'Temporary password for {email} · shown only once',
  'Entrégasela al usuario: la cambiará al entrar.': 'Give it to the user: they will change it when they log in.',
  'Copiar acceso': 'Copy login',
  Listo: 'Done',
  'Nuevo usuario': 'New user',
  Rol: 'Role',
  'Cliente (consulta sus órdenes)': 'Customer (sees their own jobs)',
  'Ficha de cliente': 'Customer record',
  'Elige el cliente': 'Choose the customer',
  'Crear usuario': 'Create user',
  'aún no entra': "hasn't logged in yet",
  Desactivar: 'Deactivate',
  Activar: 'Activate',
  '¿Generar una contraseña temporal nueva para {email}?': 'Generate a new temporary password for {email}?',
  'Usuario: {email}\nContraseña temporal: {password}\nEntra en {url}': 'User: {email}\nTemporary password: {password}\nLog in at {url}',
  'Copiado. Envíaselo al usuario por un canal privado.': 'Copied. Send it to the user privately.',
  'No se pudo crear el usuario': 'Could not create the user',
  'No se pudo actualizar el usuario': 'Could not update the user',

  // mi marca
  'Tu logo y tus colores en la app de todo tu equipo.': 'Your logo and colors in the app for your whole team.',
  Logo: 'Logo',
  'Logo de tu empresa': 'Your company logo',
  'Subir logo': 'Upload logo',
  'Quitar logo': 'Remove logo',
  'PNG, JPG o WEBP. Mejor cuadrado y con fondo transparente. Lo ajustamos al tamaño.': 'PNG, JPG or WEBP. Square with a transparent background works best. We resize it for you.',
  Colores: 'Colors',
  'Color principal': 'Main color',
  'Color secundario': 'Secondary color',
  'Así se ve una etiqueta': 'This is a label',
  'Así se ve un botón': 'This is a button',
  'Guardando…': 'Saving…',
  'Guardar mi marca': 'Save my brand',
  'Volver a los colores de NOVA': 'Back to NOVA colors',
  '¡Listo! Tu equipo verá tu marca la próxima vez que abra la app.': 'Done! Your team will see your brand the next time they open the app.',
  'No se pudo guardar tu marca': 'Could not save your brand',
  'Usa una imagen PNG, JPG o WEBP': 'Use a PNG, JPG or WEBP image',
  'No se pudo leer la imagen': 'Could not read the image',
  'La imagen no es válida': 'The image is not valid',
  Esmeralda: 'Emerald',
  Rojo: 'Red',
  Naranja: 'Orange',
  Morado: 'Purple',
  Rosa: 'Pink',
  Turquesa: 'Teal',
  Grafito: 'Graphite',

  // mensajes del servidor que puede ver un usuario
  'Credenciales inválidas': 'Wrong email or password',
  'Email y contraseña son obligatorios': 'Email and password are required',
  'Demasiados intentos fallidos. Espera 15 minutos e inténtalo de nuevo.': 'Too many failed attempts. Wait 15 minutes and try again.',
  'La cuenta de tu empresa está suspendida. Escríbenos para reactivarla.': "Your company's account is paused. Email us at contacto@novaworkorder.com to reactivate it.",
  'La contraseña actual no es correcta': 'The current password is not correct',
  'La nueva contraseña debe ser distinta de la actual': 'The new password must be different from the current one',
  'Contraseña actualizada': 'Password updated',
  'No tienes permisos para realizar esta acción': "You don't have permission to do this",
  'Solo puedes actualizar las órdenes que tienes asignadas': 'You can only update jobs assigned to you',
  'Ya existe un cliente con ese email': 'A customer with that email already exists',
  'Ya existe un usuario con ese email': 'A user with that email already exists',
  'No puedes quitarte el rol de administrador ni desactivarte a ti mismo': "You can't remove your own admin role or deactivate yourself",
  'Orden de trabajo no encontrada': 'Work order not found',
  'Cliente no encontrado': 'Customer not found',
  'Usuario no encontrado': 'User not found',
  'Datos inválidos': 'Invalid data',

  // integraciones
  "Integraciones": "Integrations",
  "Conecta NOVA con tu ERP, facturación o Zapier: llaves de API y avisos automáticos (webhooks).": "Connect NOVA to your ERP, billing or Zapier: API keys and automatic notifications (webhooks).",
  "No se pudieron cargar las integraciones": "Could not load integrations",
  "Llave «{name}» · se muestra una sola vez": "Key “{name}” · shown only once",
  "Secreto de firma de {url} · se muestra una sola vez": "Signing secret for {url} · shown only once",
  "Guárdala en el otro sistema ahora: después no la podemos volver a mostrar.": "Save it in the other system now: we can't show it again later.",
  "Copiar": "Copy",
  "Copiado": "Copied",
  "Llaves de API": "API keys",
  "Cada llave actúa como tú, solo dentro de tu empresa. Úsala en el encabezado «Authorization: Bearer nwo_…». Ver la guía en docs/API.md.": "Each key acts as you, only within your company. Send it in the “Authorization: Bearer nwo_…” header. See the guide in docs/API.md.",
  "Por ejemplo, ERP": "For example, ERP",
  "Permiso": "Permission",
  "Solo lectura (consultar órdenes y clientes)": "Read only (view work orders and customers)",
  "Escritura (además crear órdenes y cambiar su estado)": "Write (also create work orders and change their status)",
  "Crear llave": "Create key",
  "Escritura": "Write",
  "Lectura": "Read",
  "Último uso: {when}": "Last used: {when}",
  "nunca": "never",
  "Revocar": "Revoke",
  "¿Revocar la llave «{name}»? El sistema que la usa dejará de conectarse.": "Revoke the key “{name}”? The system using it will stop connecting.",
  "Webhooks": "Webhooks",
  "Le avisamos a tu sistema con un POST firmado (encabezado X-Nova-Signature) cada vez que pasa algo. Si falla, reintentamos durante varias horas.": "We notify your system with a signed POST (X-Nova-Signature header) every time something happens. If it fails, we retry for several hours.",
  "Dirección (https://)": "URL (https://)",
  "Crear webhook": "Create webhook",
  "Orden creada": "Work order created",
  "Orden editada": "Work order edited",
  "Cambio de estado": "Status change",
  "Orden borrada": "Work order deleted",
  "Apagado": "Off",
  "Último envío: {status}": "Last delivery: {status}",
  "Enviar prueba": "Send test",
  "Ver envíos": "View deliveries",
  "Apagar": "Turn off",
  "Prender": "Turn on",
  "Nuevo secreto": "New secret",
  "¿Cambiar el secreto? El anterior deja de valer de inmediato.": "Change the secret? The old one stops working immediately.",
  "¿Borrar este webhook?": "Delete this webhook?",
  "Todavía no hay envíos.": "No deliveries yet.",
  "Intentos: {n}": "Attempts: {n}",
  "¡Llegó! Tu sistema respondió {status}.": "Delivered! Your system answered {status}.",
  "No llegó: {error}": "Not delivered: {error}",
  "No se pudo crear la llave": "Could not create the key",
  "No se pudo crear el webhook": "Could not create the webhook",
  "No se pudo enviar la prueba": "Could not send the test",
  "No se pudieron cargar los envíos": "Could not load deliveries",
  "No se pudo revocar la llave": "Could not revoke the key",
  "No se pudo cambiar el webhook": "Could not change the webhook",
  "No se pudo cambiar el secreto": "Could not change the secret",
  "No se pudo borrar el webhook": "Could not delete the webhook",
  "pendiente": "pending",
  "entregado": "delivered",
  "fallido": "failed",
};

const DICTS = { en: EN };

const browserLang = () => (typeof navigator !== 'undefined' && /^en\b/i.test(navigator.language || '') ? 'en' : 'es');
const saved = () => {
  try { return localStorage.getItem(KEY); } catch { return null; }
};

let lang = saved() === 'en' || saved() === 'es' ? saved() : browserLang();

export const getLang = () => lang;
export const hasChoice = () => saved() === 'en' || saved() === 'es';
export const locale = () => (lang === 'en' ? 'en-US' : 'es-CO');

const apply = (next) => {
  lang = next === 'en' ? 'en' : 'es';
  if (typeof document !== 'undefined') document.documentElement.lang = lang;
};
apply(lang);

// La persona eligió un idioma: se recuerda en este equipo.
export const setLang = (next) => {
  apply(next);
  try { localStorage.setItem(KEY, lang); } catch { /* modo privado */ }
};

// Al entrar, si nunca eligió, la app toma el idioma de su empresa.
export const adoptCompanyLang = (companyLang) => {
  if (!hasChoice() && (companyLang === 'en' || companyLang === 'es')) apply(companyLang);
};

export const t = (text, vars) => {
  const out = (lang !== 'es' && DICTS[lang]?.[text]) || text;
  return vars ? out.replace(/\{(\w+)\}/g, (m, k) => (k in vars ? String(vars[k]) : m)) : out;
};
