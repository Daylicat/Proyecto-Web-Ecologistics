// ─── dashboard.js — Datos reales + Realtime ──────────────────────────────────
(function () {
  'use strict';

  // ── Estado del módulo ─────────────────────────────────────────────────────
  var _productos = [];
  var _salidas   = [];
  var _detalles  = [];
  var _sbClient  = null;

  // ── Inicializar cliente Supabase ──────────────────────────────────────────
  function getSB() {
    if (_sbClient) return _sbClient;
    if (!window.supabase || !window.SUPABASE_URL || !window.SUPABASE_ANON_KEY) return null;
    _sbClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      auth: { persistSession: true, storageKey: 'eco_session', autoRefreshToken: true }
    });
    return _sbClient;
  }

  // ── Obtener token de sesión activo para peticiones autenticadas ───────────
  async function getAccessToken() {
    var sb = getSB();
    if (!sb) return SUPABASE_ANON_KEY;
    try {
      var res = await sb.auth.getSession();
      return (res.data && res.data.session) ? res.data.session.access_token : SUPABASE_ANON_KEY;
    } catch (e) { return SUPABASE_ANON_KEY; }
  }

  // ── Carga inicial ─────────────────────────────────────────────────────────
  async function cargarDashboard() {
    var token = await getAccessToken();

    // Carga en paralelo para reducir tiempo de espera
    var [rawProductos, salidas, detalles, actividad] = await Promise.all([
      apiGetProductos(),
      apiGetSalidas(),
      apiGetDetalles(),
      apiGetActividad(),
      cargarCategoriasCache()
    ]);

    _productos = enriquecerProductos(rawProductos || []);
    _salidas   = salidas  || [];
    _detalles  = detalles || [];

    initNav(_productos);
    renderAll(actividad || []);
    suscribirRealtime();
  }

  // ── Render central (llama a todos los sub-renders) ────────────────────────
  function renderAll(actividad) {
    renderKpiBar(_productos, _salidas);
    renderAlertas(_productos);
    renderGraficaSemanal(_salidas);
    renderKpiInventario(_productos);
    renderDonut(_productos);
    renderUltimasSalidas(_salidas, _detalles, _productos);
    renderActividad(actividad);
  }

  // ═══════════════════════════════════════════════════════════════════════════
  //  KPI BAR SUPERIOR
  // ═══════════════════════════════════════════════════════════════════════════
  function renderKpiBar(productos, salidas) {
    var total    = productos.length;
    var sinStock = productos.filter(function (p) { return normStatus(p.status) === 'sin stock'; }).length;
    var criticos = productos.filter(function (p) { return normStatus(p.status) === 'critico'; }).length;
    var bajos    = productos.filter(function (p) { return normStatus(p.status) === 'bajo stock'; }).length;
    var totalSalidas = salidas ? salidas.length : 0;

    var kpis = [
      { label: 'Total Productos',    val: total,        color: 'var(--text)' },
      { label: 'Sin Stock',          val: sinStock,     color: sinStock  > 0 ? 'var(--slate)'  : 'var(--text)' },
      { label: 'Stock Crítico',      val: criticos,     color: criticos  > 0 ? 'var(--red)'    : 'var(--text)' },
      { label: 'Stock Bajo',         val: bajos,        color: bajos     > 0 ? 'var(--yellow)' : 'var(--text)' },
      { label: 'Salidas Registradas',val: totalSalidas, color: 'var(--text)' }
    ];

    document.getElementById('dashKpiBar').innerHTML = kpis.map(function (k) {
      return '<div class="card" style="padding:16px 18px">'
        + '<div class="kpi-label">' + k.label + '</div>'
        + '<div style="font-size:28px;font-weight:700;color:' + k.color
        + ';font-family:\'DM Mono\',monospace;letter-spacing:-1px">' + k.val + '</div>'
        + '</div>';
    }).join('');
  }

  // ═══════════════════════════════════════════════════════════════════════════
  //  ALERTAS — misma fuente que KPIs, sin lógica paralela
  // ═══════════════════════════════════════════════════════════════════════════
  function renderAlertas(productos) {
    var alerts   = getAlerts(productos);   // misma función que usan los KPIs
    var criticos = alerts.critico;

    // ── Alerta crítica principal ──────────────────────────────────────────
    var criticoEl = document.getElementById('alertaCritica');
    if (criticos.length > 0 && criticoEl) {
      // Muestra TODOS los críticos si hay más de uno, o el detalle si es solo uno
      var listaHtml = criticos.length === 1
        ? ('<div class="alert-desc">El stock actual ha caído a <strong>'
            + criticos[0].stockActual + ' unidades</strong>. El umbral mínimo es de '
            + criticos[0].stockMinimo + ' unidades.</div>')
        : ('<ul style="margin:6px 0 0 16px;padding:0">'
            + criticos.map(function (p) {
                return '<li style="font-size:13px;color:#B71C1C;margin-bottom:3px">'
                  + '<strong>' + p.nombreProducto + '</strong> — '
                  + p.stockActual + ' / mín. ' + p.stockMinimo + ' uds.</li>';
              }).join('') + '</ul>');

      criticoEl.innerHTML = '<div class="alert-critical">'
        + '<div class="alert-critical-icon"><svg viewBox="0 0 24 24" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg></div>'
        + '<div class="alert-body">'
        + '<div class="alert-badge">Crítico <span class="alert-badge-time">· ' + criticos.length + ' producto' + (criticos.length > 1 ? 's' : '') + '</span></div>'
        + '<div class="alert-title">Stock Crítico: '
        + (criticos.length === 1 ? criticos[0].nombreProducto : criticos.length + ' productos por debajo del mínimo')
        + '</div>'
        + listaHtml
        + '</div>'
        + '<div class="alert-bg-icon"><svg viewBox="0 0 24 24" stroke-width="1" stroke-linecap="round"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/></svg></div>'
        + '</div>';
    } else if (criticoEl) {
      criticoEl.innerHTML = '';
    }

    // ── Warnings (bajo stock + sin stock) ────────────────────────────────
    // Muestra hasta 4 items (2 columnas)
    var warnings   = [].concat(alerts.bajoStock, alerts.sinStock).slice(0, 4);
    var warningsEl = document.getElementById('alertasWarning');
    if (warningsEl) {
      warningsEl.innerHTML = warnings.map(function (p) {
        var esSinStock = normStatus(p.status) === 'sin stock';
        var label  = esSinStock ? 'Sin Stock' : 'Advertencia';
        var filter = esSinStock ? 'sin stock' : 'bajo stock';
        return '<div class="alert-warning">'
          + '<svg viewBox="0 0 24 24" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>'
          + '<div><div class="warn-label">' + label + '</div>'
          + '<div class="warn-text">' + p.nombreProducto + ': ' + p.stockActual + ' uds. / mín. ' + p.stockMinimo + '</div></div>'
          + '<a href="inventory.html?filter=' + encodeURIComponent(filter) + '" class="warn-link">Ver</a>'
          + '</div>';
      }).join('');
    }
  }

  // ═══════════════════════════════════════════════════════════════════════════
  //  GRÁFICA SEMANAL — datos reales de los últimos 7 días
  // ═══════════════════════════════════════════════════════════════════════════
  function renderGraficaSemanal(salidas) {
    var chartArea = document.querySelector('.chart-area');
    if (!chartArea) return;

    // Construir mapa dia → cantidad de unidades salidas
    var hoy   = new Date();
    var dias  = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'];
    var datos = [];  // [{ label, fecha, total }]

    for (var i = 6; i >= 0; i--) {
      var d = new Date(hoy);
      d.setDate(hoy.getDate() - i);
      datos.push({
        label: dias[d.getDay()],
        fecha: d.toISOString().slice(0, 10),
        total: 0
      });
    }

    (salidas || []).forEach(function (s) {
      if (!s.fecha) return;
      var fechaSalida = s.fecha.slice(0, 10);
      var entrada = datos.find(function (d) { return d.fecha === fechaSalida; });
      if (entrada) entrada.total += 1;
    });

    // Sumar también unidades desde detalles si están disponibles
    (_detalles || []).forEach(function (det) {
      var sal = (salidas || []).find(function (s) { return s.idSalida === det.idSalida; });
      if (!sal || !sal.fecha) return;
      var fechaSalida = sal.fecha.slice(0, 10);
      var entrada = datos.find(function (d) { return d.fecha === fechaSalida; });
      if (entrada) entrada.total += (det.cantidad || 0);
    });

    // Normalizar para el SVG (0-180 range, Y invertido)
    var maxVal = Math.max.apply(null, datos.map(function (d) { return d.total; })) || 1;
    var W = 480, H = 180, pad = 20;
    var step = (W - pad * 2) / (datos.length - 1);

    var puntos = datos.map(function (d, i) {
      var x = pad + i * step;
      var y = H - pad - ((d.total / maxVal) * (H - pad * 2));
      return { x: x, y: y, total: d.total };
    });

    // Generar path suavizado (bezier simple)
    function bezier(pts) {
      if (pts.length < 2) return '';
      var d = 'M' + pts[0].x + ',' + pts[0].y;
      for (var j = 1; j < pts.length; j++) {
        var prev = pts[j - 1];
        var curr = pts[j];
        var cx   = (prev.x + curr.x) / 2;
        d += ' C' + cx + ',' + prev.y + ' ' + cx + ',' + curr.y + ' ' + curr.x + ',' + curr.y;
      }
      return d;
    }

    var linePath  = bezier(puntos);
    var areaPath  = linePath + ' L' + puntos[puntos.length - 1].x + ',' + H
      + ' L' + puntos[0].x + ',' + H + ' Z';

    // Puntos interactivos
    var dotsSvg = puntos.map(function (p) {
      return '<circle cx="' + p.x + '" cy="' + p.y + '" r="4" fill="#2DBE6C" stroke="white" stroke-width="2">'
        + '<title>' + p.total + ' unidades</title></circle>';
    }).join('');

    chartArea.innerHTML = '<svg viewBox="0 0 ' + W + ' ' + H + '" preserveAspectRatio="none">'
      + '<defs><linearGradient id="areaGrad" x1="0" y1="0" x2="0" y2="1">'
      + '<stop offset="0%" stop-color="#2DBE6C" stop-opacity="0.22"/>'
      + '<stop offset="100%" stop-color="#2DBE6C" stop-opacity="0.01"/>'
      + '</linearGradient></defs>'
      + '<path d="' + areaPath + '" fill="url(#areaGrad)"/>'
      + '<path d="' + linePath + '" fill="none" stroke="#2DBE6C" stroke-width="2.5" stroke-linecap="round"/>'
      + dotsSvg
      + '</svg>';

    // Etiquetas del eje X
    var xLabels = document.querySelector('.x-labels');
    if (xLabels) {
      xLabels.innerHTML = datos.map(function (d) {
        return '<span title="' + d.fecha + '">' + d.label + '</span>';
      }).join('');
    }
  }

  // ═══════════════════════════════════════════════════════════════════════════
  //  CARD KPI INVENTARIO — valor real + estado del stock segmentado por color
  // ═══════════════════════════════════════════════════════════════════════════
  function renderKpiInventario(productos) {
    // Valor: stockActual × valor (campo 'valor' del producto)
    var valor = productos.reduce(function (s, p) {
      var stock  = Number(p.stockActual !== undefined ? p.stockActual : p.stock) || 0;
      var precio = Number(p.valor) || 0;
      return s + stock * precio;
    }, 0);

    var valEl = document.getElementById('dashValorInv');
    if (valEl) valEl.textContent = '$' + valor.toLocaleString('en-US', { minimumFractionDigits: 2 });

    // Estado del stock: proporción óptimo (verde) / bajo stock (amarillo) / crítico+sin stock (rojo)
    var total   = productos.length;
    var progRow = document.querySelector('.progress-row');
    var barEl   = document.getElementById('dashStockBar');
    var legEl   = document.getElementById('dashStockLegend');

    if (total === 0) {
      // Ocultar sección si no hay datos
      if (progRow) progRow.style.display = 'none';
      if (barEl)   barEl.style.display   = 'none';
      if (legEl)   legEl.style.display   = 'none';
      return;
    }

    var counts = { optimo: 0, bajo: 0, critico: 0 };
    productos.forEach(function (p) {
      var n = normStatus(p.status);
      if (n === 'optimo')          counts.optimo++;
      else if (n === 'bajo stock') counts.bajo++;
      else                          counts.critico++; // crítico + sin stock
    });

    var segmentos = [
      { label: 'Óptimo',              color: 'var(--green)',  val: counts.optimo  },
      { label: 'Bajo Stock',          color: 'var(--yellow)', val: counts.bajo    },
      { label: 'Crítico / Sin Stock', color: 'var(--red)',    val: counts.critico }
    ];

    if (progRow) progRow.style.display = '';

    if (barEl) {
      barEl.style.display = 'flex';
      barEl.innerHTML = segmentos.map(function (s) {
        var pct = total > 0 ? (s.val / total) * 100 : 0;
        return '<div style="height:100%;width:' + pct + '%;background:' + s.color
          + ';transition:width .8s cubic-bezier(.4,0,.2,1)"></div>';
      }).join('');
    }

    if (legEl) {
      legEl.style.display = 'flex';
      legEl.innerHTML = segmentos.map(function (s) {
        var pct = total > 0 ? Math.round((s.val / total) * 100) : 0;
        return '<div style="display:flex;align-items:center;gap:5px">'
          + '<span style="width:8px;height:8px;border-radius:50%;background:' + s.color + ';display:inline-block;flex-shrink:0"></span>'
          + '<span>' + s.label + ' · ' + s.val + ' (' + pct + '%)</span>'
          + '</div>';
      }).join('');
    }
  }

  // ═══════════════════════════════════════════════════════════════════════════
  //  DONUT POR CATEGORÍA — datos reales
  // ═══════════════════════════════════════════════════════════════════════════
  var DONUT_COLORS = ['#2DBE6C', '#3B82F6', '#F59E0B', '#EF4444', '#8B5CF6', '#EC4899'];
  var CIRCUM       = 2 * Math.PI * 50;  // radio = 50

  function renderDonut(productos) {
    var donutWrap   = document.querySelector('.donut-wrap');
    var donutLegend = document.querySelector('.donut-legend');
    if (!donutWrap || !donutLegend) return;

    // Agrupar por categoría
    var grupos = {};
    productos.forEach(function (p) {
      var cat = p.category || nombreCategoria(p.idCategoria);
      grupos[cat] = (grupos[cat] || 0) + 1;
    });

    var catNames = Object.keys(grupos);
    var total    = productos.length || 1;

    if (catNames.length === 0) {
      donutWrap.innerHTML   = '<svg width="130" height="130" viewBox="0 0 130 130"><circle cx="65" cy="65" r="50" fill="none" stroke="#E2E8F0" stroke-width="22"/></svg>';
      donutLegend.innerHTML = '<div style="font-size:12px;color:var(--slate-light);text-align:center">Sin datos</div>';
      return;
    }

    // SVG del donut
    var circles  = '<circle cx="65" cy="65" r="50" fill="none" stroke="#E2E8F0" stroke-width="22"/>';
    var offset   = 0;

    catNames.forEach(function (cat, i) {
      var pct    = grupos[cat] / total;
      var largo  = pct * CIRCUM;
      var hueco  = CIRCUM - largo;
      var color  = DONUT_COLORS[i % DONUT_COLORS.length];
      circles += '<circle cx="65" cy="65" r="50" fill="none" stroke="' + color + '" stroke-width="22"'
        + ' stroke-dasharray="' + largo.toFixed(2) + ' ' + hueco.toFixed(2) + '"'
        + ' stroke-dashoffset="' + (-offset).toFixed(2) + '"'
        + ' transform="rotate(-90 65 65)"/>';
      offset += largo;
    });

    donutWrap.innerHTML = '<svg width="130" height="130" viewBox="0 0 130 130">' + circles + '</svg>';

    // Leyenda
    donutLegend.innerHTML = catNames.map(function (cat, i) {
      var pct   = Math.round((grupos[cat] / total) * 100);
      var color = DONUT_COLORS[i % DONUT_COLORS.length];
      return '<div class="legend-item">'
        + '<div class="legend-left">'
        + '<span class="legend-dot" style="background:' + color + '"></span>'
        + '<span class="legend-name">' + cat + '</span></div>'
        + '<span class="legend-pct">' + pct + '%</span></div>';
    }).join('');
  }

  // ═══════════════════════════════════════════════════════════════════════════
  //  ÚLTIMAS SALIDAS — datos reales de Supabase
  // ═══════════════════════════════════════════════════════════════════════════
  function renderUltimasSalidas(salidas, detalles, productos) {
    var tbody = document.getElementById('dashUltimasSalidas');
    if (!tbody) return;

    if (!salidas || salidas.length === 0) {
      tbody.innerHTML = '<tr><td colspan="5" style="text-align:center;padding:20px;color:var(--slate-light)">Sin salidas registradas</td></tr>';
      return;
    }

    var ultimas = salidas.slice()
      .sort(function (a, b) { return new Date(b.fecha) - new Date(a.fecha); })
      .slice(0, 5);

    tbody.innerHTML = ultimas.map(function (s) {
      var dets  = (detalles || []).filter(function (d) { return d.idSalida === s.idSalida; });
      var prod  = {};

      if (dets.length > 0) {
        // Buscar en la lista de productos enriquecidos
        var idProd = dets[0].idProducto
          || (dets[0].Producto && dets[0].Producto.idProducto);
        prod = productos.find(function (p) { return p.idProducto === idProd; }) || {};
        // También acepta el JOIN anidado que devuelve Supabase
        if (!prod.nombreProducto && dets[0].Producto) {
          prod = enriquecerProductos([dets[0].Producto])[0] || {};
        }
      }

      var nombre = prod.nombreProducto
        || (dets.length > 1 ? dets.length + ' productos' : 'Sin detalle');
      var sku  = prod.sku || '—';
      var cant = dets.reduce(function (sum, d) { return sum + (d.cantidad || 0); }, 0);
      var fecha = s.fecha
        ? new Date(s.fecha).toLocaleDateString('es-MX', {
            month: 'short', day: 'numeric',
            hour: '2-digit', minute: '2-digit'
          })
        : '—';

      return '<tr>'
        + '<td><div class="tx-product">' + nombre + '</div><div class="tx-sku">' + sku + '</div></td>'
        + '<td><span class="tx-recipient">' + (s.proyecto || '—') + '</span></td>'
        + '<td><span class="tx-qty">' + cant + ' unid.</span></td>'
        + '<td><span class="tx-date">' + fecha + '</span></td>'
        + '<td><span class="badge badge-delivered">Registrada</span></td>'
        + '</tr>';
    }).join('');
  }

  // ═══════════════════════════════════════════════════════════════════════════
  //  ACTIVIDAD RECIENTE
  // ═══════════════════════════════════════════════════════════════════════════
  function renderActividad(actividad) {
    var container = document.getElementById('dashActividad');
    if (!container) return;

    if (!actividad || actividad.length === 0) {
      container.innerHTML = '<div style="text-align:center;padding:20px;color:var(--slate-light);font-size:13px">Sin actividad reciente registrada.</div>';
      return;
    }

    container.innerHTML = actividad.slice(0, 10).map(function (a) {
      var hace   = tiempoRelativo(a.created_at);
      var icono  = iconoActividadSVG(a.tipo);
      return '<div style="display:flex;align-items:flex-start;gap:12px;padding:12px 0;border-bottom:1px solid var(--border)">'
        + '<div style="width:32px;height:32px;border-radius:8px;background:var(--bg);border:1px solid var(--border);display:flex;align-items:center;justify-content:center;flex-shrink:0">'
        + icono + '</div>'
        + '<div style="flex:1;min-width:0">'
        + '<div style="font-size:13px;color:var(--text);font-weight:500;line-height:1.4">'
        + sanitize(a.descripcion) + '</div>'
        + '<div style="font-size:11px;color:var(--slate-light);margin-top:3px;font-family:\'DM Mono\',monospace">'
        + hace + ' · ' + sanitize(a.usuario || 'Sistema') + '</div>'
        + '</div></div>';
    }).join('');
  }


  function tiempoRelativo(fechaStr) {
    if (!fechaStr) return '—';
    var diff = Date.now() - new Date(fechaStr).getTime();
    var mins  = Math.floor(diff / 60000);
    if (mins < 1)   return 'ahora mismo';
    if (mins < 60)  return 'hace ' + mins + ' min';
    var hrs = Math.floor(mins / 60);
    if (hrs < 24)   return 'hace ' + hrs + 'h';
    var dias = Math.floor(hrs / 24);
    return 'hace ' + dias + (dias === 1 ? ' día' : ' días');
  }

  function sanitize(str) {
    return String(str || '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  // ═══════════════════════════════════════════════════════════════════════════
  //  API — tabla actividad (nueva)
  // ═══════════════════════════════════════════════════════════════════════════
  async function apiGetActividad() {
    return await peticionAPI(
      'actividad_log',
      'GET',
      null,
      '?order=created_at.desc&limit=10'
    ) || [];
  }

  // ═══════════════════════════════════════════════════════════════════════════
  //  REALTIME — suscripciones
  // ═══════════════════════════════════════════════════════════════════════════
  function suscribirRealtime() {
    var sb = getSB();
    if (!sb) return;

    // Canal único para todo el dashboard
    sb.channel('dashboard-changes')
      .on('postgres_changes',
          { event: '*', schema: 'public', table: 'Producto' },
          async function () {
            var rawProductos = await apiGetProductos();
            _productos = enriquecerProductos(rawProductos || []);
            renderKpiBar(_productos, _salidas);
            renderAlertas(_productos);
            renderKpiInventario(_productos);
            renderDonut(_productos);
            initNav(_productos);
          })
      .on('postgres_changes',
          { event: '*', schema: 'public', table: 'Salida' },
          async function () {
            _salidas  = await apiGetSalidas()  || [];
            _detalles = await apiGetDetalles() || [];
            renderKpiBar(_productos, _salidas);
            renderGraficaSemanal(_salidas);
            renderUltimasSalidas(_salidas, _detalles, _productos);
          })
      .on('postgres_changes',
          { event: '*', schema: 'public', table: 'DetalleSalida' },
          async function () {
            _detalles = await apiGetDetalles() || [];
            renderUltimasSalidas(_salidas, _detalles, _productos);
          })
      .on('postgres_changes',
          { event: 'INSERT', schema: 'public', table: 'actividad_log' },
          async function () {
            var actividad = await apiGetActividad();
            renderActividad(actividad);
          })
      .subscribe();
  }

  // ═══════════════════════════════════════════════════════════════════════════
  //  ARRANQUE
  // ═══════════════════════════════════════════════════════════════════════════
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', cargarDashboard);
  } else {
    cargarDashboard();
  }

})();
