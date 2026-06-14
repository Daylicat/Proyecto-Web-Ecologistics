// ─── api-config.js ───────────────────────────────────────────────────────────

window.SUPABASE_URL      = 'https://ynnrybjsjuklhrqymfck.supabase.co';
window.SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InlubnJ5YmpzanVrbGhycXltZmNrIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODEzMjUwMTYsImV4cCI6MjA5NjkwMTAxNn0.KfOx1oPky1CUpqK3Svud_VPaye643_8PDaiUrldQNA8';

var SUPABASE_URL      = window.SUPABASE_URL;
var SUPABASE_ANON_KEY = window.SUPABASE_ANON_KEY;

if (window.supabase && !window.sbGlobalClient) {
  window.sbGlobalClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    auth: {
      persistSession:    true,
      storageKey:        'eco_session',
      autoRefreshToken:  true,
      detectSessionInUrl: false
    }
  });
}

// ── Obtener token — con triple fallback ───────────────────────────────────────
async function getAuthToken() {
  // 1. Intentar desde el cliente global (fuente más confiable)
  try {
    if (window.sbGlobalClient) {
      var res = await window.sbGlobalClient.auth.getSession();
      if (res.data && res.data.session && res.data.session.access_token) {
        return res.data.session.access_token;
      }
    }
  } catch (e) {}

  // 2. Leer directamente del storage (cuando el cliente aún no hidrata la sesión)
  try {
    var raw = localStorage.getItem('eco_session') || sessionStorage.getItem('eco_session');
    if (raw) {
      var parsed = JSON.parse(raw);
      // El SDK v2 guarda la sesión en distintas estructuras según la versión
      var token = (parsed.access_token)
               || (parsed.currentSession && parsed.currentSession.access_token)
               || (parsed.session        && parsed.session.access_token);
      if (token) return token;
    }
  } catch (e) {}

  // 3. Fallback: anon key (solo lectura pública)
  return SUPABASE_ANON_KEY;
}

// ── Petición genérica REST ────────────────────────────────────────────────────
async function peticionAPI(tabla, metodo, datos, queryParams) {
  metodo      = metodo      || 'GET';
  datos       = datos       || null;
  queryParams = queryParams || '';

  var authHeader = await getAuthToken();

  var url      = SUPABASE_URL + '/rest/v1/' + tabla + queryParams;
  var opciones = {
    method:  metodo,
    headers: {
      'apikey':        SUPABASE_ANON_KEY,
      'Authorization': 'Bearer ' + authHeader,
      'Content-Type':  'application/json',
      'Prefer':        'return=representation'
    }
  };

  if (datos && (metodo === 'POST' || metodo === 'PUT' || metodo === 'PATCH')) {
    opciones.body = JSON.stringify(datos);
  }

  try {
    var r = await fetch(url, opciones);
    if (!r.ok) {
      var txt = await r.text();
      console.error('[API] ' + metodo + ' ' + tabla + ' → ' + r.status + ':', txt);
      return null;
    }
    var text = await r.text();
    return text ? JSON.parse(text) : [];
  } catch (e) {
    console.error('[API] Error de red en ' + tabla + ':', e);
    return null;
  }
}

// ── Helpers de negocio ────────────────────────────────────────────────────────

async function apiGetProductos() {
  return await peticionAPI('Producto', 'GET') || [];
}

async function apiGetSalidas() {
  return await peticionAPI('Salida', 'GET', null, '?select=*,DetalleSalida(*)') || [];
}

async function apiGetDetalles() {
  return await peticionAPI('DetalleSalida', 'GET', null, '?select=*,Producto(*)') || [];
}

async function apiCrearSalida(salidaObj, detallesArr) {
  var salidas = await peticionAPI('Salida', 'POST', salidaObj);
  if (!salidas || salidas.length === 0) return null;
  var idSalida = salidas[0].idSalida;

  var detallesConId = detallesArr.map(function (d) {
    return Object.assign({}, d, { idSalida: idSalida });
  });
  await peticionAPI('DetalleSalida', 'POST', detallesConId);

  for (var i = 0; i < detallesArr.length; i++) {
    var d     = detallesArr[i];
    var prods = await peticionAPI('Producto', 'GET', null,
      '?idProducto=eq.' + d.idProducto + '&select=stockActual');
    if (prods && prods.length > 0) {
      var nuevoStock = Math.max(0, (prods[0].stockActual || 0) - d.cantidad);
      await peticionAPI('Producto', 'PATCH', { stockActual: nuevoStock },
        '?idProducto=eq.' + d.idProducto);
    }
  }

  return { idSalida: idSalida };
}

async function apiCrearProducto(obj) {
  var res = await peticionAPI('Producto', 'POST', obj);
  return res && res.length > 0 ? res[0] : null;
}