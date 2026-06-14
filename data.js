// ─── data.js — Helpers compartidos (única fuente de verdad) ──────────────────
// Sin modo Demo. Sin datos mock. Solo Supabase.
// Este archivo debe cargarse ANTES que cualquier módulo de página.

// ── Estado del stock ──────────────────────────────────────────────────────────
function calcularStatus(stockActual, stockMinimo) {
  var s = Number(stockActual) || 0;
  var m = Number(stockMinimo) || 0;
  if (s === 0)     return 'sin stock';
  if (s < m)       return 'crítico';
  if (s < m * 1.5) return 'bajo stock';
  return 'óptimo';
}

// Normalizar para comparaciones (quita tildes, lowercase, trim)
function normStatus(s) {
  return (s || '').toLowerCase()
    .replace(/[áéíóú]/g, function (c) {
      return { á: 'a', é: 'e', í: 'i', ó: 'o', ú: 'u' }[c];
    })
    .trim();
}

// ── Precio unitario — triple fallback para nombres de columna distintos ───────
// Cubre: valor, precio_unitario, price. Nunca devuelve undefined.
function precio(p) {
  return Number(p.valor) || Number(p.precio_unitario) || Number(p.price) || 0;
}

// ── Categorías ────────────────────────────────────────────────────────────────
// Caché de categorías reales (tabla Categoria). Se llena con cargarCategoriasCache(),
// que cada página llama una vez al iniciar. Si aún no se ha llamado (o falla),
// se usa el mapa de respaldo de las 6 categorías originales.
var _categoriasCache = null; // { [idCategoria]: { nombre, icono } }

var ICONOS_CATEGORIA_FALLBACK  = { 1:'bolt', 2:'sun', 3:'battery', 4:'panel', 5:'plug', 6:'tool' };
var NOMBRES_CATEGORIA_FALLBACK = { 1:'Electrical', 2:'Solar', 3:'Storage', 4:'Panels', 5:'Cables', 6:'Tools' };

async function cargarCategoriasCache() {
  try {
    var raw = await peticionAPI('Categoria', 'GET', null, '?select=idCategoria,nombre,icono');
    var mapa = {};
    (raw || []).forEach(function (c) {
      mapa[c.idCategoria] = { nombre: c.nombre, icono: c.icono || 'tool' };
    });
    _categoriasCache = mapa;
  } catch (e) {
    _categoriasCache = _categoriasCache || {};
  }
  return _categoriasCache;
}

function iconoPorCategoria(idCat) {
  if (_categoriasCache && _categoriasCache[idCat]) return _categoriasCache[idCat].icono || 'tool';
  return ICONOS_CATEGORIA_FALLBACK[idCat] || 'tool';
}

function nombreCategoria(idCat) {
  if (_categoriasCache && _categoriasCache[idCat]) return _categoriasCache[idCat].nombre || 'General';
  return NOMBRES_CATEGORIA_FALLBACK[idCat] || 'General';
}

// ── Enriquecer productos ──────────────────────────────────────────────────────
function enriquecerProductos(lista) {
  return (lista || []).map(function (p) {
    return Object.assign({}, p, {
      status:   calcularStatus(p.stockActual, p.stockMinimo),
      icon:     iconoPorCategoria(p.idCategoria),
      name:     p.nombreProducto || '',
      id:       p.sku || '',
      stock:    Number(p.stockActual) || 0,
      min:      Number(p.stockMinimo) || 0,
      valor:    precio(p),          // normaliza el precio sin importar el nombre de columna
      category: nombreCategoria(p.idCategoria)
    });
  });
}

// ── Alertas ───────────────────────────────────────────────────────────────────
function getAlerts(productos) {
  var lista = productos || [];
  return {
    critico:   lista.filter(function (p) { return normStatus(p.status) === 'critico';    }),
    bajoStock: lista.filter(function (p) { return normStatus(p.status) === 'bajo stock'; }),
    sinStock:  lista.filter(function (p) { return normStatus(p.status) === 'sin stock';  })
  };
}

function getTotalAlertCount(productos) {
  var a = getAlerts(productos);
  return a.critico.length + a.bajoStock.length + a.sinStock.length;
}

// ── Stub de compatibilidad ────────────────────────────────────────────────────
// Siempre devuelve true — el modo Demo ya no existe.
function esVersionSupabase() { return true; }

// ── Íconos SVG para actividad_log (mismo estilo que el resto de la app) ───────
function iconoActividadSVG(tipo) {
  var iconos = {
    producto_creado: {
      color: 'var(--green)',
      path:  '<path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/><polyline points="3.27 6.96 12 12.01 20.73 6.96"/><line x1="12" y1="22.08" x2="12" y2="12"/>'
    },
    producto_editado: {
      color: 'var(--blue)',
      path:  '<path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>'
    },
    entrada_registrada: {
      color: 'var(--green)',
      path:  '<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/>'
    },
    salida_registrada: {
      color: 'var(--blue)',
      path:  '<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/>'
    },
    stock_minimo: {
      color: 'var(--red)',
      path:  '<path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/>'
    },
    precio_actualizado: {
      color: 'var(--green-dark)',
      path:  '<line x1="12" y1="1" x2="12" y2="23"/><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/>'
    }
  };

  var conf = iconos[tipo] || {
    color: 'var(--slate)',
    path:  '<line x1="8" y1="6" x2="21" y2="6"/><line x1="8" y1="12" x2="21" y2="12"/><line x1="8" y1="18" x2="21" y2="18"/><line x1="3" y1="6" x2="3.01" y2="6"/><line x1="3" y1="12" x2="3.01" y2="12"/><line x1="3" y1="18" x2="3.01" y2="18"/>'
  };

  return '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="' + conf.color + '" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">' + conf.path + '</svg>';
}
