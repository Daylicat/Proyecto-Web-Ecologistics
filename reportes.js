// ─── reportes.js — Módulo de Reportes ────────────────────────────────────────
(function () {
  'use strict';

  // ══════════════════════════════════════════════════════════════════════════
  //  ESTADO
  // ══════════════════════════════════════════════════════════════════════════
  var AVATAR_COLORS = ['#667eea','#2DBE6C','#F59E0B','#EF4444','#3B82F6','#8B5CF6'];
  var REP_PRODUCTOS = [];
  var REP_SALIDAS   = [];
  var REP_DETALLES  = [];
  var REP_ACTIVIDAD = [];
  var REP_CATEGORIAS= [];
  var visibleRows   = 10;
  var _sesion       = null;
  var _sbClient     = null;

  // Filtros activos
  var filtros = { fechaDesde: null, fechaHasta: null, categoria: '', estado: '' };

  function san(str) {
    return String(str||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
  }

  function precio(p) {
    return Number(p.valor) || Number(p.precio_unitario) || Number(p.price) || 0;
  }

  // ══════════════════════════════════════════════════════════════════════════
  //  SUPABASE CLIENT
  // ══════════════════════════════════════════════════════════════════════════
  function getSB() {
    if (_sbClient) return _sbClient;
    if (!window.supabase || !window.SUPABASE_URL || !window.SUPABASE_ANON_KEY) return null;
    _sbClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      auth: { persistSession: true, storageKey: 'eco_session', autoRefreshToken: true }
    });
    return _sbClient;
  }

  // ══════════════════════════════════════════════════════════════════════════
  //  CARGA DE DATOS
  // ══════════════════════════════════════════════════════════════════════════
  async function cargarReportes() {
    _sesion = await EcoAuth.getSession();

    var [rawProductos, salidas, detalles, actividad, categorias] = await Promise.all([
      apiGetProductos(),
      apiGetSalidas(),
      apiGetDetalles(),
      peticionAPI('actividad_log', 'GET', null, '?order=created_at.desc&limit=200') || [],
      peticionAPI('Categoria',    'GET', null, '?order=nombre.asc')                  || [],
      cargarCategoriasCache()
    ]);

    REP_PRODUCTOS  = enriquecerProductos(rawProductos || []);
    REP_SALIDAS    = salidas    || [];
    REP_DETALLES   = detalles   || [];
    REP_ACTIVIDAD  = actividad  || [];
    REP_CATEGORIAS = categorias || [];

    initNav(REP_PRODUCTOS);
    poblarFiltros();
    cambiarTipoReporte();
    suscribirRealtime();
  }

  // ══════════════════════════════════════════════════════════════════════════
  //  FILTROS DINÁMICOS
  // ══════════════════════════════════════════════════════════════════════════
  function poblarFiltros() {
    // Categorías reales
    var selCat = document.getElementById('filterCategoria');
    if (selCat) {
      selCat.innerHTML = '<option value="">Todas las categorías</option>'
        + REP_CATEGORIAS.map(function (c) {
            return '<option value="' + c.idCategoria + '">' + san(c.nombre) + '</option>';
          }).join('');
    }
  }

  function aplicarFiltros() {
    var fDesde = document.getElementById('filterFechaDesde');
    var fHasta = document.getElementById('filterFechaHasta');
    var fCat   = document.getElementById('filterCategoria');
    var fEst   = document.getElementById('filterEstado');

    filtros.fechaDesde = fDesde && fDesde.value ? new Date(fDesde.value) : null;
    filtros.fechaHasta = fHasta && fHasta.value ? new Date(fHasta.value + 'T23:59:59') : null;
    filtros.categoria  = fCat ? fCat.value : '';
    filtros.estado     = fEst ? fEst.value : '';

    visibleRows = 10;
    cambiarTipoReporte();
  }
  window.aplicarFiltros = aplicarFiltros;

  // Accesos rápidos de fecha
  function setFechaRapida(tipo) {
    var hoy    = new Date();
    var desde  = new Date();
    if (tipo === '7d')  desde.setDate(hoy.getDate() - 7);
    if (tipo === '30d') desde.setDate(hoy.getDate() - 30);
    if (tipo === 'hoy') desde = new Date(hoy.getFullYear(), hoy.getMonth(), hoy.getDate());

    var fDesde = document.getElementById('filterFechaDesde');
    var fHasta = document.getElementById('filterFechaHasta');
    if (fDesde) fDesde.value = desde.toISOString().slice(0, 10);
    if (fHasta) fHasta.value = hoy.toISOString().slice(0, 10);
    aplicarFiltros();
  }
  window.setFechaRapida = setFechaRapida;

  function limpiarFiltros() {
    ['filterFechaDesde','filterFechaHasta','filterCategoria','filterEstado'].forEach(function (id) {
      var el = document.getElementById(id);
      if (el) el.value = '';
    });
    filtros = { fechaDesde: null, fechaHasta: null, categoria: '', estado: '' };
    visibleRows = 10;
    cambiarTipoReporte();
  }
  window.limpiarFiltros = limpiarFiltros;

  // Filtrar productos según filtros activos
  function filtrarProductos(lista) {
    return lista.filter(function (p) {
      if (filtros.categoria && String(p.idCategoria) !== String(filtros.categoria)) return false;
      if (filtros.estado    && normStatus(p.status) !== normStatus(filtros.estado))  return false;
      return true;
    });
  }

  // Filtrar salidas por fecha
  function filtrarSalidas(lista) {
    return lista.filter(function (s) {
      var f = s.fecha ? new Date(s.fecha) : null;
      if (filtros.fechaDesde && f && f < filtros.fechaDesde) return false;
      if (filtros.fechaHasta && f && f > filtros.fechaHasta) return false;
      return true;
    });
  }

  // ══════════════════════════════════════════════════════════════════════════
  //  CAMBIAR TIPO DE REPORTE
  // ══════════════════════════════════════════════════════════════════════════
  function cambiarTipoReporte() {
    visibleRows = 10;
    var tipo = document.getElementById('reportType').value;
    var map  = {
      inventario:  renderInventario,
      salidas:     renderSalidas,
      entradas:    renderEntradas,
      criticos:    renderCriticos,
      sin_stock:   renderSinStock,
      movimientos: renderMovimientos
    };
    if (map[tipo]) map[tipo]();
  }
  window.cambiarTipoReporte = cambiarTipoReporte;

  // ══════════════════════════════════════════════════════════════════════════
  //  1. INVENTARIO ACTUAL
  // ══════════════════════════════════════════════════════════════════════════
  function renderInventario() {
    document.getElementById('repTableTitle').textContent = 'Inventario Actual';
    var lista    = filtrarProductos(REP_PRODUCTOS);
    var total    = lista.length;
    var sinStock = lista.filter(function (p) { return normStatus(p.status) === 'sin stock'; }).length;
    var criticos = lista.filter(function (p) { return normStatus(p.status) === 'critico';   }).length;
    var valor    = lista.reduce(function (s, p) {
      return s + (Number(p.stockActual) || 0) * precio(p);
    }, 0);

    renderKPIs([
      { label: 'Total Productos',    val: total },
      { label: 'Sin Stock',          val: sinStock, color: sinStock  > 0 ? '#EF4444' : null },
      { label: 'Stock Crítico',      val: criticos, color: criticos  > 0 ? '#EF4444' : null },
      { label: 'Valor de Inventario',val: '$' + valor.toLocaleString('es-MX', { minimumFractionDigits: 2 }) + ' MXN' }
    ]);

    var slice = lista.slice(0, visibleRows);
    var html  = buildTable(
      ['Producto','Categoría','Stock Actual','Mínimo','Estado','Valor'],
      slice.map(function (p) {
        var st     = p.status || calcularStatus(p.stockActual, p.stockMinimo);
        var stCls  = invStatusClass(st);
        var stLbl  = invStatusLabel(st);
        var val    = ((Number(p.stockActual) || 0) * precio(p)).toLocaleString('es-MX', { minimumFractionDigits: 2 });
        return [
          '<div class="rep-prod-name">' + san(p.nombreProducto) + '</div><div class="rep-prod-sku">SKU: ' + san(p.sku) + '</div>',
          '<span class="rep-dest">' + san(p.category || nombreCategoria(p.idCategoria)) + '</span>',
          '<span class="rep-qty">' + (p.stockActual || 0) + '</span>',
          '<span style="font-size:13px;color:var(--slate)">' + (p.stockMinimo || 0) + '</span>',
          '<span class="status-badge ' + stCls + '">' + stLbl + '</span>',
          { text: '$' + val + ' MXN', align: 'right' }
        ];
      })
    );
    document.getElementById('repTableContainer').innerHTML = html;
    toggleViewMore(lista.length);
  }

  // ══════════════════════════════════════════════════════════════════════════
  //  2. SALIDAS DE ALMACÉN
  // ══════════════════════════════════════════════════════════════════════════
  function renderSalidas() {
    document.getElementById('repTableTitle').textContent = 'Salidas de Almacén';
    var salidasF     = filtrarSalidas(REP_SALIDAS);
    var totalSalidas = salidasF.length;
    var totalUnits   = 0;
    var totalMonto   = 0;

    // Construir filas cruzando detalles + productos con precio real
    var rows = [];
    salidasF.slice().sort(function (a, b) { return new Date(b.fecha) - new Date(a.fecha); })
      .forEach(function (sal, idx) {
        var dets = REP_DETALLES.filter(function (d) { return d.idSalida === sal.idSalida; });
        if (dets.length === 0) {
          rows.push({ sal: sal, prod: {}, cant: 0, subtotal: 0, idx: idx });
        } else {
          dets.forEach(function (d) {
            var prod = REP_PRODUCTOS.find(function (p) {
              return p.idProducto === (d.idProducto || (d.Producto && d.Producto.idProducto));
            }) || (d.Producto ? enriquecerProductos([d.Producto])[0] : {});

            var cant     = d.cantidad || 0;
            var precioU  = precio(prod);
            var subtotal = cant * precioU;
            totalUnits  += cant;
            totalMonto  += subtotal;
            rows.push({ sal: sal, prod: prod, cant: cant, subtotal: subtotal, idx: idx });
          });
        }
      });

    renderKPIs([
      { label: 'Total Salidas',    val: totalSalidas },
      { label: 'Unidades Salidas', val: totalUnits },
      { label: 'Monto Total',      val: '$' + totalMonto.toLocaleString('es-MX', { minimumFractionDigits: 2 }) + ' MXN' }
    ]);

    if (rows.length === 0) {
      document.getElementById('repTableContainer').innerHTML =
        '<div style="text-align:center;padding:40px;color:var(--slate-light)">No hay salidas en el período seleccionado.</div>';
      toggleViewMore(0);
      return;
    }

    var slice = rows.slice(0, visibleRows);
    var html  = buildTable(
      ['Producto','Cantidad','Destino / Proyecto','Registrado por','Fecha y Hora','Subtotal'],
      slice.map(function (r) {
        var fecha  = r.sal.fecha
          ? new Date(r.sal.fecha).toLocaleString('es-MX', { month:'short', day:'numeric', year:'numeric', hour:'2-digit', minute:'2-digit' })
          : '—';
        var color  = AVATAR_COLORS[r.idx % AVATAR_COLORS.length];
        var nombre = r.sal._nombreUsuario || 'Operador';
        var initiales = nombre.split(' ').map(function (n) { return n[0]; }).join('').slice(0, 2).toUpperCase();
        return [
          '<div class="rep-prod-name">' + san(r.prod.nombreProducto || 'Sin producto') + '</div><div class="rep-prod-sku">SKU: ' + san(r.prod.sku || '—') + '</div>',
          '<span class="rep-qty">×' + r.cant + '</span>',
          '<span class="rep-dest">' + san(r.sal.proyecto || '—') + '</span>',
          '<div class="rep-user-cell"><div class="rep-user-avatar" style="background:' + color + '">' + initiales + '</div><span class="rep-user-name">' + san(nombre) + '</span></div>',
          '<span class="rep-date">' + fecha + '</span>',
          { text: '$' + r.subtotal.toLocaleString('es-MX', { minimumFractionDigits: 2 }) + ' MXN', align: 'right' }
        ];
      })
    );
    document.getElementById('repTableContainer').innerHTML = html;
    toggleViewMore(rows.length);
  }

  // ══════════════════════════════════════════════════════════════════════════
  //  3. ENTRADAS A INVENTARIO
  // ══════════════════════════════════════════════════════════════════════════
  function renderEntradas() {
    document.getElementById('repTableTitle').textContent = 'Entradas a Inventario';

    var entradas = REP_ACTIVIDAD.filter(function (a) {
      return a.tipo === 'entrada_registrada' || a.tipo === 'producto_creado';
    });

    // Filtro de fecha (mismo criterio que Salidas/Movimientos)
    if (filtros.fechaDesde || filtros.fechaHasta) {
      entradas = entradas.filter(function (a) {
        var f = a.created_at ? new Date(a.created_at) : null;
        if (filtros.fechaDesde && f && f < filtros.fechaDesde) return false;
        if (filtros.fechaHasta && f && f > filtros.fechaHasta) return false;
        return true;
      });
    }

    // Filtro de categoría — vía el producto referenciado
    if (filtros.categoria) {
      entradas = entradas.filter(function (a) {
        var prod = REP_PRODUCTOS.find(function (p) { return p.idProducto === a.reference_id; });
        return prod && String(prod.idCategoria) === String(filtros.categoria);
      });
    }

    var rows = entradas.map(function (a) {
      var prod = REP_PRODUCTOS.find(function (p) { return p.idProducto === a.reference_id; }) || {};
      var cantidad, tipoBadge;

      if (a.tipo === 'producto_creado') {
        var mAlta = (a.descripcion || '').match(/Stock inicial:\s*(\d+)\s*uds/);
        cantidad  = mAlta ? parseInt(mAlta[1], 10) : 0;
        tipoBadge = '<span class="status-badge status-optimo">Alta de Producto</span>';
      } else {
        var mEnt  = (a.descripcion || '').match(/\+(\d+)\s*uds/);
        cantidad  = mEnt ? parseInt(mEnt[1], 10) : 0;
        tipoBadge = '<span class="status-badge" style="background:#DBEAFE;color:#1D4ED8">Entrada de Stock</span>';
      }

      var subtotal = cantidad * precio(prod);
      return { a: a, prod: prod, cantidad: cantidad, subtotal: subtotal, tipoBadge: tipoBadge };
    });

    var totalEntradas = rows.length;
    var totalUnits    = rows.reduce(function (s, r) { return s + r.cantidad; }, 0);
    var valorTotal    = rows.reduce(function (s, r) { return s + r.subtotal; }, 0);

    renderKPIs([
      { label: 'Entradas Registradas', val: totalEntradas },
      { label: 'Unidades Agregadas',   val: totalUnits },
      { label: 'Valor Agregado',       val: '$' + valorTotal.toLocaleString('es-MX', { minimumFractionDigits: 2 }) + ' MXN' }
    ]);

    if (rows.length === 0) {
      document.getElementById('repTableContainer').innerHTML =
        '<div style="text-align:center;padding:40px;color:var(--slate-light)">No hay entradas de stock en el período seleccionado.</div>';
      toggleViewMore(0);
      return;
    }

    var slice = rows.slice(0, visibleRows);
    var html  = buildTable(
      ['Producto','Tipo','Cantidad Agregada','Categoría','Fecha y Hora','Responsable','Valor Agregado'],
      slice.map(function (r) {
        var fecha = r.a.created_at
          ? new Date(r.a.created_at).toLocaleString('es-MX', { month:'short', day:'numeric', year:'numeric', hour:'2-digit', minute:'2-digit' })
          : '—';
        return [
          '<div class="rep-prod-name">' + san(r.prod.nombreProducto || 'Producto eliminado') + '</div><div class="rep-prod-sku">SKU: ' + san(r.prod.sku || '—') + '</div>',
          r.tipoBadge,
          '<span class="rep-qty" style="color:var(--green)">+' + r.cantidad + '</span>',
          '<span class="rep-dest">' + san(r.prod.category || nombreCategoria(r.prod.idCategoria) || '—') + '</span>',
          '<span class="rep-date">' + fecha + '</span>',
          '<span class="rep-user-name">' + san(r.a.usuario || 'Sistema') + '</span>',
          { text: '$' + r.subtotal.toLocaleString('es-MX', { minimumFractionDigits: 2 }) + ' MXN', align: 'right' }
        ];
      })
    );
    document.getElementById('repTableContainer').innerHTML = html;
    toggleViewMore(rows.length);
  }

  // ══════════════════════════════════════════════════════════════════════════
  //  4. PRODUCTOS CRÍTICOS
  // ══════════════════════════════════════════════════════════════════════════
  function renderCriticos() {
    document.getElementById('repTableTitle').textContent = 'Productos con Stock Crítico';
    var criticos = REP_PRODUCTOS.filter(function (p) {
      return normStatus(p.status) === 'critico' || normStatus(p.status) === 'sin stock';
    });
    if (filtros.categoria) {
      criticos = criticos.filter(function (p) { return String(p.idCategoria) === String(filtros.categoria); });
    }

    renderKPIs([
      { label: 'Total Críticos',  val: criticos.filter(function(p){ return normStatus(p.status)==='critico'; }).length, color: '#EF4444' },
      { label: 'Sin Stock',       val: criticos.filter(function(p){ return normStatus(p.status)==='sin stock'; }).length, color: '#64748B' },
      { label: 'Total Afectados', val: criticos.length }
    ]);

    if (criticos.length === 0) {
      document.getElementById('repTableContainer').innerHTML =
        '<div style="text-align:center;padding:40px;color:var(--green);font-weight:600">✓ Todos los productos tienen stock suficiente.</div>';
      toggleViewMore(0);
      return;
    }

    var slice = criticos.slice(0, visibleRows).sort(function (a, b) {
      return (Number(a.stockActual) || 0) - (Number(b.stockActual) || 0);
    });

    var html = buildTable(
      ['Producto','Categoría','Stock Actual','Stock Mínimo','Faltante','Estado'],
      slice.map(function (p) {
        var st       = p.status || calcularStatus(p.stockActual, p.stockMinimo);
        var stCls    = invStatusClass(st);
        var stLbl    = invStatusLabel(st);
        var faltante = Math.max(0, (Number(p.stockMinimo) || 0) - (Number(p.stockActual) || 0));
        return [
          '<div class="rep-prod-name">' + san(p.nombreProducto) + '</div><div class="rep-prod-sku">SKU: ' + san(p.sku) + '</div>',
          '<span class="rep-dest">' + san(p.category || nombreCategoria(p.idCategoria)) + '</span>',
          '<span class="rep-qty" style="color:var(--red)">' + (p.stockActual || 0) + '</span>',
          '<span style="font-size:13px;color:var(--slate)">' + (p.stockMinimo || 0) + '</span>',
          '<span style="font-size:13px;font-weight:700;color:var(--red)">' + faltante + ' uds.</span>',
          '<span class="status-badge ' + stCls + '">' + stLbl + '</span>'
        ];
      })
    );
    document.getElementById('repTableContainer').innerHTML = html;
    toggleViewMore(criticos.length);
  }

  // ══════════════════════════════════════════════════════════════════════════
  //  5. PRODUCTOS SIN STOCK
  // ══════════════════════════════════════════════════════════════════════════
  function renderSinStock() {
    document.getElementById('repTableTitle').textContent = 'Productos Sin Stock';
    var sinStock = REP_PRODUCTOS.filter(function (p) { return normStatus(p.status) === 'sin stock'; });
    if (filtros.categoria) {
      sinStock = sinStock.filter(function (p) { return String(p.idCategoria) === String(filtros.categoria); });
    }

    renderKPIs([
      { label: 'Productos Sin Stock', val: sinStock.length, color: '#64748B' },
      { label: 'Categorías Afectadas',
        val: new Set(sinStock.map(function (p) { return p.idCategoria; })).size }
    ]);

    if (sinStock.length === 0) {
      document.getElementById('repTableContainer').innerHTML =
        '<div style="text-align:center;padding:40px;color:var(--green);font-weight:600">✓ No hay productos sin stock.</div>';
      toggleViewMore(0);
      return;
    }

    var slice = sinStock.slice(0, visibleRows);
    var html  = buildTable(
      ['Producto','Categoría','Stock Mínimo','Última Salida','Responsable'],
      slice.map(function (p) {
        // Buscar la última salida de este producto en el historial
        var ultimaActividad = REP_ACTIVIDAD.find(function (a) {
          return a.reference_id === p.idProducto && a.tipo === 'salida_registrada';
        });
        var fechaUltima = ultimaActividad && ultimaActividad.created_at
          ? new Date(ultimaActividad.created_at).toLocaleString('es-MX', { month:'short', day:'numeric', hour:'2-digit', minute:'2-digit' })
          : '—';
        var responsable = ultimaActividad ? san(ultimaActividad.usuario || 'Sistema') : '—';
        return [
          '<div class="rep-prod-name">' + san(p.nombreProducto) + '</div><div class="rep-prod-sku">SKU: ' + san(p.sku) + '</div>',
          '<span class="rep-dest">' + san(p.category || nombreCategoria(p.idCategoria)) + '</span>',
          '<span style="font-size:13px;color:var(--slate)">' + (p.stockMinimo || 0) + ' uds.</span>',
          '<span class="rep-date">' + fechaUltima + '</span>',
          '<span class="rep-user-name">' + responsable + '</span>'
        ];
      })
    );
    document.getElementById('repTableContainer').innerHTML = html;
    toggleViewMore(sinStock.length);
  }

  // ══════════════════════════════════════════════════════════════════════════
  //  6. HISTORIAL DE MOVIMIENTOS
  // ══════════════════════════════════════════════════════════════════════════
  function renderMovimientos() {
    document.getElementById('repTableTitle').textContent = 'Historial de Movimientos';

    var actividad = REP_ACTIVIDAD;
    if (filtros.fechaDesde || filtros.fechaHasta) {
      actividad = actividad.filter(function (a) {
        var f = a.created_at ? new Date(a.created_at) : null;
        if (filtros.fechaDesde && f && f < filtros.fechaDesde) return false;
        if (filtros.fechaHasta && f && f > filtros.fechaHasta) return false;
        return true;
      });
    }

    var tiposLabel = {
      'producto_creado':    'Alta Producto',
      'producto_editado':   'Edición',
      'salida_registrada':  'Salida POS',
      'entrada_registrada': 'Entrada',
      'stock_minimo':       'Ajuste Mínimo',
      'precio_actualizado': 'Cambio Precio'
    };

    renderKPIs([
      { label: 'Total Eventos', val: actividad.length },
      { label: 'Salidas POS',   val: actividad.filter(function (a) { return a.tipo === 'salida_registrada'; }).length },
      { label: 'Altas',         val: actividad.filter(function (a) { return a.tipo === 'producto_creado'; }).length }
    ]);

    if (actividad.length === 0) {
      document.getElementById('repTableContainer').innerHTML =
        '<div style="text-align:center;padding:40px;color:var(--slate-light)">No hay eventos en el período seleccionado.</div>';
      toggleViewMore(0);
      return;
    }

    var slice = actividad.slice(0, visibleRows);
    var html  = buildTable(
      ['Fecha y Hora','Tipo','Descripción','Responsable'],
      slice.map(function (a, idx) {
        var fecha = a.created_at
          ? new Date(a.created_at).toLocaleString('es-MX', { month:'short', day:'numeric', year:'numeric', hour:'2-digit', minute:'2-digit' })
          : '—';
        var color    = AVATAR_COLORS[idx % AVATAR_COLORS.length];
        var tipoLbl  = tiposLabel[a.tipo] || a.tipo || '—';
        var initials = (a.usuario || 'S').charAt(0).toUpperCase();
        return [
          '<span class="rep-date">' + fecha + '</span>',
          '<span class="status-badge status-optimo" style="text-transform:none">' + san(tipoLbl) + '</span>',
          '<span style="font-size:13px;color:var(--text)">' + san(a.descripcion || '—') + '</span>',
          '<div class="rep-user-cell"><div class="rep-user-avatar" style="background:' + color + '">' + initials + '</div><span class="rep-user-name">' + san(a.usuario || 'Sistema') + '</span></div>'
        ];
      })
    );
    document.getElementById('repTableContainer').innerHTML = html;
    toggleViewMore(actividad.length);
  }

  // ══════════════════════════════════════════════════════════════════════════
  //  HELPERS DE RENDER
  // ══════════════════════════════════════════════════════════════════════════
  function invStatusClass(s) {
    var n = normStatus(s);
    if (n === 'critico')    return 'status-critico';
    if (n === 'bajo stock') return 'status-bajo';
    if (n === 'optimo')     return 'status-optimo';
    return 'status-sinstock';
  }
  function invStatusLabel(s) {
    var n = normStatus(s);
    if (n === 'critico')    return 'Crítico';
    if (n === 'bajo stock') return 'Bajo Stock';
    if (n === 'optimo')     return 'Óptimo';
    return 'Sin Stock';
  }

  function buildTable(headers, rows) {
    var ths = headers.map(function (h, i) {
      var last = i === headers.length - 1;
      return '<th' + (last ? ' style="text-align:right"' : '') + '>' + h + '</th>';
    }).join('');

    var trs = rows.map(function (cells) {
      var tds = cells.map(function (c) {
        if (typeof c === 'object' && c.align) {
          return '<td class="rep-amount">' + c.text + '</td>';
        }
        return '<td>' + c + '</td>';
      }).join('');
      return '<tr>' + tds + '</tr>';
    }).join('');

    return '<div style="overflow-x:auto"><table class="rep-table"><thead><tr>' + ths + '</tr></thead><tbody>' + trs + '</tbody></table></div>';
  }

  function renderKPIs(kpis) {
    // Sin tarjeta "Fuente" — solo KPIs operativos
    document.getElementById('kpiGrid').innerHTML = kpis.map(function (k, i) {
      return '<div class="card rep-kpi-card" style="animation:fadeIn .35s ease ' + (i * 0.07) + 's both">'
        + '<div class="rep-kpi-label">' + k.label + '</div>'
        + '<div class="rep-kpi-val" style="' + (k.color ? 'color:' + k.color + ';' : '') + '">' + k.val + '</div>'
        + (k.note ? '<div class="rep-kpi-note">' + k.note + '</div>' : '')
        + '</div>';
    }).join('');
  }

  function toggleViewMore(total) {
    var btn = document.getElementById('viewMoreBtn');
    if (btn) btn.style.display = visibleRows >= total ? 'none' : 'block';
  }

  function loadMore(e) {
    e.preventDefault();
    visibleRows += 10;
    cambiarTipoReporte();
  }
  window.loadMore = loadMore;

  function refresh() {
    var btn = document.querySelector('.rep-icon-btn');
    if (btn) { btn.style.opacity = '.5'; btn.style.pointerEvents = 'none'; }
    setTimeout(function () {
      if (btn) { btn.style.opacity = ''; btn.style.pointerEvents = ''; }
      cargarReportes();
    }, 400);
  }
  window.refresh = refresh;

  // ══════════════════════════════════════════════════════════════════════════
  //  EXPORTACIÓN PDF — formato profesional
  // ══════════════════════════════════════════════════════════════════════════

  async function exportarPDF() {
    var btn  = document.querySelector('.rep-export-btn');
    var orig = btn.innerHTML;
    btn.innerHTML = 'Generando PDF...';
    btn.disabled  = true;

    var tipo    = document.getElementById('reportType').value;
    var nombres = {
      inventario:  'Inventario Actual',
      salidas:     'Salidas de Almacén',
      entradas:    'Entradas a Inventario',
      criticos:    'Productos Críticos',
      sin_stock:   'Productos Sin Stock',
      movimientos: 'Historial de Movimientos'
    };

    var usuario  = _sesion ? (_sesion.nombre || _sesion.email || 'Sistema') : 'Sistema';
    var fechaGen = new Date().toLocaleString('es-MX', {
      weekday: 'long', year: 'numeric', month: 'long', day: 'numeric',
      hour: '2-digit', minute: '2-digit'
    });

    // Resumen ejecutivo para el encabezado del PDF
    var kpiEls = document.querySelectorAll('#kpiGrid .rep-kpi-card');
    var resumen = Array.from(kpiEls).map(function (el) {
      var label = el.querySelector('.rep-kpi-label');
      var val   = el.querySelector('.rep-kpi-val');
      return (label ? label.textContent : '') + ': ' + (val ? val.textContent : '');
    }).join(' · ');

    var container = document.getElementById('repTableContainer').innerHTML;

    var html = '<!DOCTYPE html><html><head><meta charset="UTF-8">'
      + '<style>'
      + 'body{font-family:Arial,sans-serif;padding:20px;font-size:11px;color:#0F172A;-webkit-print-color-adjust:exact;print-color-adjust:exact}'
      + '.header{display:flex;align-items:center;justify-content:space-between;border-bottom:3px solid #2DBE6C;padding-bottom:16px;margin-bottom:20px}'
      + '.logo{display:flex;align-items:center;gap:10px}'
      + '.logo-box{width:36px;height:36px;background:#2DBE6C;border-radius:8px;display:flex;align-items:center;justify-content:center}'
      + '.logo-text{font-size:18px;font-weight:700;color:#0F172A}'
      + '.report-meta{text-align:right}'
      + '.report-title{font-size:16px;font-weight:700;color:#0F172A;margin-bottom:3px}'
      + '.report-sub{font-size:11px;color:#64748B}'
      + '.summary-box{background:#F8FAFC;border:1px solid #E2E8F0;border-radius:8px;padding:12px 16px;margin-bottom:20px;font-size:11px;color:#64748B}'
      + 'table{width:100%;border-collapse:collapse;margin-top:8px;page-break-inside:auto}'
      + 'tr{page-break-inside:avoid;page-break-after:auto}'
      + 'th{background:#F8FAFC !important;text-align:left;padding:8px 10px;font-size:9px;letter-spacing:.06em;text-transform:uppercase;border-bottom:2px solid #2DBE6C;color:#64748B}'
      + 'td{padding:9px 10px;border-bottom:1px solid #E2E8F0;font-size:10px;vertical-align:middle}'
      + 'tr:nth-child(even){background:#FAFAFA !important}'
      + '.rep-amount{text-align:right;font-weight:700}'
      + '.status-badge{padding:2px 8px;border-radius:99px;font-size:9px;font-weight:700;display:inline-block}'
      + '.status-critico{background:#FFEBEE !important;color:#E53935 !important}'
      + '.status-bajo{background:#FFFBEB !important;color:#B45309 !important}'
      + '.status-optimo{background:#DCFCE7 !important;color:#15803D !important}'
      + '.status-sinstock{background:#F1F5F9 !important;color:#64748B !important}'
      + '.footer{position:fixed;bottom:0;left:0;right:0;display:flex;justify-content:space-between;font-size:9px;color:#94A3B8;border-top:1px solid #E2E8F0;padding-top:8px}'
      + '@page{size:A4 landscape;margin:0.5in}'
      + '</style></head><body>'
      + '<div class="header">'
      + '<div class="logo">'
      + '<div class="logo-box"><svg viewBox="0 0 24 24" width="20" height="20"><path d="M12 2L3 7l9 5 9-5-9-5zM3 17l9 5 9-5M3 12l9 5 9-5" fill="none" stroke="white" stroke-width="2" stroke-linecap="round"/></svg></div>'
      + '<span class="logo-text">EcoLogistics</span>'
      + '</div>'
      + '<div class="report-meta">'
      + '<div class="report-title">' + san(nombres[tipo] || tipo) + '</div>'
      + '<div class="report-sub">' + fechaGen + '</div>'
      + '<div class="report-sub">Generado por: ' + san(usuario) + '</div>'
      + '</div></div>'
      + (resumen ? '<div class="summary-box"><strong>Resumen:</strong> ' + san(resumen) + '</div>' : '')
      + container
      + '<div class="footer">'
      + '<span>Documento generado automáticamente por EcoLogistics</span>'
      + '<span>Confidencial — Solo para uso interno</span>'
      + '</div>'
      + '</body></html>';

    // Crear iframe temporal
    var iframe = document.createElement('iframe');
    iframe.style.cssText = 'position:absolute;width:0;height:0;border:none;';
    document.body.appendChild(iframe);
    iframe.contentWindow.document.open();
    iframe.contentWindow.document.write(html);
    iframe.contentWindow.document.close();

    // Esperar un instante a que cargue el contenido e invocar la impresión nativa
    setTimeout(function() {
      iframe.contentWindow.focus();
      iframe.contentWindow.print();
      
      // Limpieza del DOM y restauración del botón
      document.body.removeChild(iframe);
      btn.innerHTML = orig;
      btn.disabled  = false;
      registrarExportacion('pdf', tipo);
    }, 250);
  }
  window.exportarPDF = exportarPDF;

  // ══════════════════════════════════════════════════════════════════════════
  //  EXPORTACIÓN EXCEL
  // ══════════════════════════════════════════════════════════════════════════
  function exportarExcel() {
    var tipo    = document.getElementById('reportType').value;
    var nombres = {
      inventario:  'Inventario',
      salidas:     'Salidas',
      entradas:    'Entradas',
      criticos:    'Criticos',
      sin_stock:   'SinStock',
      movimientos: 'Movimientos'
    };

    // Construir CSV (compatible con Excel)
    var lineas = [];
    var table  = document.querySelector('#repTableContainer table');
    if (!table) {
      alert('No hay datos para exportar.');
      return;
    }

    // Headers
    var ths = table.querySelectorAll('thead th');
    lineas.push(Array.from(ths).map(function (th) {
      return '"' + th.textContent.replace(/"/g, '""') + '"';
    }).join(','));

    // Rows
    table.querySelectorAll('tbody tr').forEach(function (tr) {
      lineas.push(Array.from(tr.querySelectorAll('td')).map(function (td) {
        return '"' + td.textContent.trim().replace(/"/g, '""') + '"';
      }).join(','));
    });

    var csv  = '\uFEFF' + lineas.join('\n');  // BOM para Excel
    var blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    var url  = URL.createObjectURL(blob);
    var link = document.createElement('a');
    link.href     = url;
    link.download = 'ecologistics_' + (nombres[tipo] || tipo) + '_' + new Date().toISOString().slice(0, 10) + '.csv';
    link.click();
    URL.revokeObjectURL(url);

    registrarExportacion('excel', tipo);
  }
  window.exportarExcel = exportarExcel;

  // ══════════════════════════════════════════════════════════════════════════
  //  AUDITORÍA DE EXPORTACIONES
  // ══════════════════════════════════════════════════════════════════════════
  async function registrarExportacion(formato, tipoReporte) {
    try {
      var filtrosStr = JSON.stringify(filtros);
      await peticionAPI('actividad_log', 'POST', {
        tipo:        'exportacion_' + formato,
        descripcion: 'Exportación ' + formato.toUpperCase() + ' — ' + tipoReporte + ' | Filtros: ' + filtrosStr,
        usuario:     _sesion ? (_sesion.nombre || _sesion.email) : 'Sistema'
      });
    } catch (e) { /* no bloquear */ }
  }

  // ══════════════════════════════════════════════════════════════════════════
  //  REALTIME
  // ══════════════════════════════════════════════════════════════════════════
  function suscribirRealtime() {
    var sb = getSB();
    if (!sb) return;

    sb.channel('reportes-changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'Producto' },
          async function () {
            var raw  = await apiGetProductos();
            REP_PRODUCTOS = enriquecerProductos(raw || []);
            cambiarTipoReporte();
          })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'Salida' },
          async function () {
            REP_SALIDAS  = await apiGetSalidas()  || [];
            REP_DETALLES = await apiGetDetalles() || [];
            cambiarTipoReporte();
          })
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'actividad_log' },
          async function () {
            REP_ACTIVIDAD = await peticionAPI('actividad_log', 'GET', null, '?order=created_at.desc&limit=200') || [];
            var tipo = document.getElementById('reportType').value;
            if (tipo === 'movimientos' || tipo === 'sin_stock' || tipo === 'entradas') cambiarTipoReporte();
          })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'Categoria' },
          async function () {
            REP_CATEGORIAS = await peticionAPI('Categoria', 'GET', null, '?order=nombre.asc') || [];
            poblarFiltros();
          })
      .subscribe();
  }

  // ══════════════════════════════════════════════════════════════════════════
  //  ARRANQUE
  // ══════════════════════════════════════════════════════════════════════════
  cargarReportes();

})();
