// ─── inventory.js — Módulo completo de Inventario ────────────────────────────
(function () {
  'use strict';

  // ══════════════════════════════════════════════════════════════════════════
  //  ESTADO DEL MÓDULO
  // ══════════════════════════════════════════════════════════════════════════
  var PRODUCTOS_INV   = [];
  var INV_PAGE_SIZE   = 5;
  var invCurrentPage  = 1;
  var invActiveFilter = 'todos';
  var invSearchQuery  = '';
  var _rolActual      = null;   // 'admin' | 'trabajador'
  var _sbClient       = null;

  // ══════════════════════════════════════════════════════════════════════════
  //  ICONOS SVG
  // ══════════════════════════════════════════════════════════════════════════
  var INV_ICONS = {
    bolt:    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><polyline points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/></svg>',
    sun:     '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><circle cx="12" cy="12" r="5"/><line x1="12" y1="1" x2="12" y2="3"/><line x1="12" y1="21" x2="12" y2="23"/></svg>',
    battery: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><rect x="1" y="6" width="18" height="12" rx="2"/><line x1="23" y1="13" x2="23" y2="11"/></svg>',
    panel:   '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><rect x="2" y="3" width="20" height="14" rx="2"/><line x1="8" y1="21" x2="16" y2="21"/><line x1="12" y1="17" x2="12" y2="21"/></svg>',
    plug:    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/><polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/></svg>',
    tool:    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z"/></svg>'
  };
  var QR_ICON_SVG = '<svg viewBox="0 0 24 24"><rect x="3" y="3" width="7" height="7" rx="1" fill="none" stroke="currentColor" stroke-width="1.5"/><rect x="5" y="5" width="3" height="3" fill="currentColor"/><rect x="14" y="3" width="7" height="7" rx="1" fill="none" stroke="currentColor" stroke-width="1.5"/><rect x="16" y="5" width="3" height="3" fill="currentColor"/><rect x="3" y="14" width="7" height="7" rx="1" fill="none" stroke="currentColor" stroke-width="1.5"/><rect x="5" y="16" width="3" height="3" fill="currentColor"/></svg>';

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

  async function getRol() {
    if (_rolActual) return _rolActual;
    var s = await EcoAuth.getSession();
    _rolActual = s ? s.rol : 'trabajador';
    return _rolActual;
  }

  // ══════════════════════════════════════════════════════════════════════════
  //  HELPERS VISUALES DE ESTADO
  // ══════════════════════════════════════════════════════════════════════════
  function invStatusClass(s) {
    var n = normStatus(s);
    if (n === 'critico')    return 'status-critico';
    if (n === 'bajo stock') return 'status-bajo';
    if (n === 'optimo')     return 'status-optimo';
    if (n === 'sin stock')  return 'status-sinstock';
    return 'status-sinstock';
  }
  function invStatusLabel(s) {
    var n = normStatus(s);
    if (n === 'critico')    return 'Crítico';
    if (n === 'bajo stock') return 'Bajo Stock';
    if (n === 'optimo')     return 'Óptimo';
    if (n === 'sin stock')  return 'Sin Stock';
    return s;
  }
  function invStockClass(s) {
    var n = normStatus(s);
    if (n === 'critico' || n === 'sin stock') return 'stock-critico';
    if (n === 'bajo stock')                   return 'stock-bajo';
    return 'stock-normal';
  }
  function invRowClass(s) {
    var n = normStatus(s);
    if (n === 'critico' || n === 'sin stock') return 'row-critico';
    if (n === 'bajo stock')                   return 'row-bajo';
    return '';
  }
  function san(str) {
    return String(str || '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
  }

  // ══════════════════════════════════════════════════════════════════════════
  //  FILTRADO Y RENDER TABLA
  // ══════════════════════════════════════════════════════════════════════════
  function invGetFiltered() {
    return PRODUCTOS_INV.filter(function (p) {
      var matchFilter = invActiveFilter === 'todos' || normStatus(p.status) === normStatus(invActiveFilter);
      var q           = invSearchQuery.toLowerCase();
      var matchSearch = !q
        || (p.nombreProducto || '').toLowerCase().indexOf(q) > -1
        || (p.sku            || '').toLowerCase().indexOf(q) > -1
        || (p.category       || '').toLowerCase().indexOf(q) > -1;
      return matchFilter && matchSearch;
    });
  }

  async function invRender() {
    var rol     = await getRol();
    var tbody   = document.getElementById('tableBody');
    var infoEl  = document.getElementById('paginationInfo');
    var pnEl    = document.getElementById('pageNumbers');
    var prevBtn = document.getElementById('prevBtn');
    var nextBtn = document.getElementById('nextBtn');

    var filtered = invGetFiltered();
    var total    = filtered.length;
    var pages    = Math.max(1, Math.ceil(total / INV_PAGE_SIZE));
    if (invCurrentPage > pages) invCurrentPage = pages;

    var start = (invCurrentPage - 1) * INV_PAGE_SIZE;
    var slice = filtered.slice(start, start + INV_PAGE_SIZE);
    var html  = '';

    if (slice.length === 0) {
      html = '<tr><td colspan="7"><div class="empty-state"><p>No se encontraron productos</p></div></td></tr>';
    } else {
      slice.forEach(function (p) {
        var st   = p.status || calcularStatus(p.stockActual, p.stockMinimo);
        var icon = INV_ICONS[p.icon || iconoPorCategoria(p.idCategoria)] || INV_ICONS.tool;
        var idP  = p.idProducto;

        // Botones de acción — editar solo para admin
        var editBtn = rol === 'admin'
          ? '<button class="action-btn inv-btn-edit" data-id="' + idP + '" title="Editar">'
            + '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg></button>'
          : '';

        // Botón "+ Stock" — entrada de inventario, solo para admin
        var entradaBtn = rol === 'admin'
          ? '<button class="action-btn inv-btn-entrada" data-id="' + idP + '" title="Agregar Stock">'
            + '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg></button>'
          : '';

        html += '<tr class="' + invRowClass(st) + '">'
          + '<td><div class="prod-cell"><div class="prod-icon">' + icon + '</div>'
          + '<div><div class="prod-name">' + san(p.nombreProducto) + '</div>'
          + '<div class="prod-id">SKU: ' + san(p.sku) + '</div></div></div></td>'
          + '<td style="font-size:13px;color:var(--slate)">' + san(p.category || nombreCategoria(p.idCategoria)) + '</td>'
          + '<td><span class="' + invStockClass(st) + '">' + (p.stockActual !== undefined ? p.stockActual : p.stock) + ' unid.</span></td>'
          + '<td><span class="stock-min">' + (p.stockMinimo !== undefined ? p.stockMinimo : p.min) + ' unid.</span></td>'
          + '<td><span class="status-badge ' + invStatusClass(st) + '">' + invStatusLabel(st) + '</span></td>'
          + '<td><div class="qr-icon inv-btn-qr" data-id="' + idP + '" title="Ver QR">' + QR_ICON_SVG + '</div></td>'
          + '<td><div class="action-btns">'
          + entradaBtn
          + editBtn
          + '<button class="action-btn inv-btn-ver" data-id="' + idP + '" title="Ver detalle">'
          + '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg></button>'
          + '</div></td></tr>';
      });
    }

    tbody.innerHTML = html;

    // Delegar eventos en tbody (evita re-bind en cada render)
    tbody.querySelectorAll('.inv-btn-qr').forEach(function (el) {
      el.addEventListener('click', function () { abrirModalQR(el.dataset.id); });
    });
    tbody.querySelectorAll('.inv-btn-edit').forEach(function (el) {
      el.addEventListener('click', function () { abrirModalEditar(el.dataset.id); });
    });
    tbody.querySelectorAll('.inv-btn-entrada').forEach(function (el) {
      el.addEventListener('click', function () { abrirModalEntrada(el.dataset.id); });
    });
    tbody.querySelectorAll('.inv-btn-ver').forEach(function (el) {
      el.addEventListener('click', function () { abrirModalDetalle(el.dataset.id); });
    });

    var from = total === 0 ? 0 : start + 1;
    var to   = Math.min(start + INV_PAGE_SIZE, total);
    infoEl.textContent = 'Mostrando ' + from + '-' + to + ' de ' + total + ' productos';

    pnEl.innerHTML = '';
    for (var j = 1; j <= pages; j++) {
      (function (page) {
        var btn = document.createElement('button');
        btn.className   = 'page-num' + (page === invCurrentPage ? ' active' : '');
        btn.textContent = page;
        btn.onclick     = function () { invCurrentPage = page; invRender(); };
        pnEl.appendChild(btn);
      })(j);
    }
    if (prevBtn) prevBtn.disabled = invCurrentPage === 1;
    if (nextBtn) nextBtn.disabled = invCurrentPage === pages;
  }

  function invChangePage(dir) {
    var pages  = Math.ceil(invGetFiltered().length / INV_PAGE_SIZE);
    invCurrentPage = Math.max(1, Math.min(pages, invCurrentPage + dir));
    invRender();
  }
  window.invChangePage = invChangePage;

  function invSetFilter(filter, btn) {
    invActiveFilter = filter; invCurrentPage = 1;
    document.querySelectorAll('.filter-tab').forEach(function (t) { t.classList.remove('active'); });
    if (btn) btn.classList.add('active');
    invRender();
  }
  window.invSetFilter = invSetFilter;

  function invFilterTable() {
    var inp = document.getElementById('searchInput');
    invSearchQuery = inp ? inp.value : '';
    invCurrentPage = 1;
    invRender();
  }
  window.invFilterTable = invFilterTable;

  function invApplyUrlFilter() {
    if (!window.location.search) return;
    var params = new URLSearchParams(window.location.search);
    var f = params.get('filter');
    if (!f) return;
    invActiveFilter = decodeURIComponent(f);
    var labelMap = { 'todos': 'Todos', 'bajo stock': 'Bajo Stock', 'critico': 'Crítico', 'sin stock': 'Sin Stock' };
    document.querySelectorAll('.filter-tab').forEach(function (t) {
      t.classList.remove('active');
      if (t.textContent.trim() === (labelMap[normStatus(invActiveFilter)] || invActiveFilter)) t.classList.add('active');
    });
  }

  // ══════════════════════════════════════════════════════════════════════════
  //  HELPER: buscar producto por ID en el array local
  // ══════════════════════════════════════════════════════════════════════════
  function buscarProducto(id) {
    var idNum = parseInt(id, 10);
    return PRODUCTOS_INV.find(function (p) { return p.idProducto === idNum; }) || null;
  }

  // ══════════════════════════════════════════════════════════════════════════
  //  MODAL BASE — crear / cerrar
  // ══════════════════════════════════════════════════════════════════════════
  function crearModal(id, contenido) {
    cerrarModal(id);
    var overlay = document.createElement('div');
    overlay.id        = id;
    overlay.className = 'modal-overlay';
    overlay.innerHTML = '<div class="modal">' + contenido + '</div>';
    document.body.appendChild(overlay);

    // Abrir con animación
    requestAnimationFrame(function () {
      requestAnimationFrame(function () { overlay.classList.add('open'); });
    });

    // Cerrar al click fuera del modal
    overlay.addEventListener('click', function (e) {
      if (e.target === overlay) cerrarModal(id);
    });
    // Cerrar con Escape
    function onKey(e) {
      if (e.key === 'Escape') { cerrarModal(id); document.removeEventListener('keydown', onKey); }
    }
    document.addEventListener('keydown', onKey);
    return overlay;
  }

  function cerrarModal(id) {
    var el = document.getElementById(id);
    if (el) {
      el.classList.remove('open');
      setTimeout(function () { if (el.parentNode) el.parentNode.removeChild(el); }, 220);
    }
  }

  // ══════════════════════════════════════════════════════════════════════════
  //  MODAL QR
  // ══════════════════════════════════════════════════════════════════════════
  function abrirModalQR(id) {
    var p = buscarProducto(id);
    if (!p) return;

    var html = '<div class="modal-header">'
      + '<div class="modal-title">Código QR — ' + san(p.nombreProducto) + '</div>'
      + '<button class="modal-close" onclick="document.getElementById(\'modalQR\').click()">'
      + '<svg viewBox="0 0 24 24"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg></button></div>'
      + '<div class="modal-body" style="align-items:center;text-align:center">'
      + '<div id="qrModalWrap" style="width:200px;height:200px;background:var(--bg);border:1px solid var(--border);border-radius:14px;display:flex;align-items:center;justify-content:center;overflow:hidden;margin:0 auto"></div>'
      + '<div style="font-family:\'DM Mono\',monospace;font-size:15px;font-weight:700;margin-top:12px">' + san(p.sku) + '</div>'
      + '<div style="font-size:13px;color:var(--slate);margin-top:4px">' + san(p.nombreProducto) + '</div>'
      + '</div>'
      + '<div class="modal-footer" style="justify-content:center;gap:10px">'
      + '<button class="btn-secondary" id="qrBtnDescargar">Descargar</button>'
      + '<button class="btn-secondary" id="qrBtnImprimir">Imprimir</button>'
      + '<button class="btn-primary" onclick="cerrarModal(\'modalQR\')">Cerrar</button>'
      + '</div>';

    crearModal('modalQR', html);

    // Generar QR real con la librería QRCode.js (ya incluida en nuevo-producto.html)
    // Si no está cargada, cargarla dinámicamente
    function generarQR() {
      var wrap    = document.getElementById('qrModalWrap');
      var qrData  = 'SKU:' + p.sku + '|NAME:' + p.nombreProducto + '|ID:' + p.idProducto;
      var qr      = new QRCode(wrap, {
        text:         qrData,
        width:        180,
        height:       180,
        colorDark:    '#0F172A',
        colorLight:   '#F8FAFC',
        correctLevel: QRCode.CorrectLevel.H
      });

      // Acciones: descargar
      document.getElementById('qrBtnDescargar').addEventListener('click', function () {
        var canvas = wrap.querySelector('canvas');
        if (!canvas) return;
        var link     = document.createElement('a');
        link.download = 'QR-' + (p.sku || p.idProducto) + '.png';
        link.href     = canvas.toDataURL('image/png');
        link.click();
      });

      // Acciones: imprimir
      document.getElementById('qrBtnImprimir').addEventListener('click', function () {
        var canvas = wrap.querySelector('canvas');
        if (!canvas) return;
        var img  = canvas.toDataURL('image/png');
        var win  = window.open('', '_blank', 'width=420,height=520');
        win.document.write('<!DOCTYPE html><html><head><title>QR — ' + san(p.sku) + '</title>'
          + '<style>body{font-family:sans-serif;text-align:center;padding:40px}'
          + 'img{width:200px;height:200px;display:block;margin:0 auto 16px}'
          + '.sku{font-size:16px;font-weight:700;font-family:monospace}'
          + '.nm{font-size:13px;color:#64748B;margin-top:4px}'
          + '</style></head><body>'
          + '<img src="' + img + '">'
          + '<div class="sku">' + san(p.sku) + '</div>'
          + '<div class="nm">' + san(p.nombreProducto) + '</div>'
          + '<script>window.onload=function(){window.print();window.close()}<\/script>'
          + '</body></html>');
        win.document.close();
      });
    }

    if (typeof QRCode !== 'undefined') {
      generarQR();
    } else {
      var script    = document.createElement('script');
      script.src    = 'https://cdnjs.cloudflare.com/ajax/libs/qrcodejs/1.0.0/qrcode.min.js';
      script.onload = generarQR;
      document.head.appendChild(script);
    }
  }

  // ══════════════════════════════════════════════════════════════════════════
  //  MODAL EDITAR
  // ══════════════════════════════════════════════════════════════════════════
  function abrirModalEditar(id) {
    var p = buscarProducto(id);
    if (!p) return;

    var cats = [
      { id: 1, label: 'Electrical' }, { id: 2, label: 'Solar' },
      { id: 3, label: 'Storage'    }, { id: 4, label: 'Panels' },
      { id: 5, label: 'Cables'     }, { id: 6, label: 'Tools'  }
    ];
    var opcionesCat = cats.map(function (c) {
      return '<option value="' + c.id + '"' + (p.idCategoria == c.id ? ' selected' : '') + '>' + c.label + '</option>';
    }).join('');

    var html = '<div class="modal-header">'
      + '<div class="modal-title">Editar Producto</div>'
      + '<button class="modal-close" onclick="cerrarModal(\'modalEditar\')">'
      + '<svg viewBox="0 0 24 24"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg></button></div>'
      + '<div class="modal-body">'

      + '<div class="form-row">'
      + '<div class="form-group" style="grid-column:1/-1"><label class="form-label">Nombre del Producto</label>'
      + '<input class="form-input" id="editNombre" value="' + san(p.nombreProducto) + '"></div></div>'

      + '<div class="form-row">'
      + '<div class="form-group"><label class="form-label">SKU</label>'
      + '<input class="form-input" id="editSku" value="' + san(p.sku) + '"></div>'
      + '<div class="form-group"><label class="form-label">Categoría</label>'
      + '<select class="form-input" id="editCategoria"><option value="">Seleccionar...</option>' + opcionesCat + '</select></div>'
      + '</div>'

      + '<div class="form-row">'
      + '<div class="form-group"><label class="form-label">Precio Unitario (USD)</label>'
      + '<input class="form-input" id="editValor" type="number" step="0.01" min="0" value="' + (p.valor || 0) + '"></div>'
      + '<div class="form-group"><label class="form-label">Stock Mínimo</label>'
      + '<input class="form-input" id="editStockMin" type="number" min="0" value="' + (p.stockMinimo || 0) + '"></div>'
      + '</div>'

      + '<div class="form-row">'
      + '<div class="form-group"><label class="form-label">Unidad de Medida</label>'
      + '<select class="form-input" id="editUnidad">'
      + '<option value="unidades"' + (p.unidad === 'unidades' ? ' selected' : '') + '>Unidades</option>'
      + '<option value="metros"'  + (p.unidad === 'metros'   ? ' selected' : '') + '>Metros</option>'
      + '<option value="kg"'      + (p.unidad === 'kg'       ? ' selected' : '') + '>Kilogramos</option>'
      + '<option value="piezas"'  + (p.unidad === 'piezas'   ? ' selected' : '') + '>Piezas</option>'
      + '</select></div>'
      + '<div class="form-group"><label class="form-label">Ubicación</label>'
      + '<input class="form-input" id="editUbicacion" placeholder="Ej. Pasillo A-2" value="' + san(p.ubicacion || '') + '"></div>'
      + '</div>'

      + '<div class="form-group" style="grid-column:1/-1"><label class="form-label">Descripción</label>'
      + '<textarea class="form-input" id="editDesc" rows="3" style="resize:vertical">' + san(p.descripcion || '') + '</textarea></div>'

      + '<div id="editError" style="display:none;color:var(--red);font-size:13px;padding:6px 0"></div>'
      + '</div>'

      + '<div class="modal-footer">'
      + '<button class="btn-secondary" onclick="cerrarModal(\'modalEditar\')">Cancelar</button>'
      + '<button class="btn-primary" id="editGuardarBtn">Guardar Cambios</button>'
      + '</div>';

    crearModal('modalEditar', html);

    document.getElementById('editGuardarBtn').addEventListener('click', function () {
      guardarEdicion(p.idProducto);
    });
  }

  async function guardarEdicion(idProducto) {
    var nombre   = (document.getElementById('editNombre').value   || '').trim();
    var sku      = (document.getElementById('editSku').value      || '').trim();
    var catId    = parseInt(document.getElementById('editCategoria').value, 10);
    var valor    = parseFloat(document.getElementById('editValor').value)    || 0;
    var stockMin = parseInt(document.getElementById('editStockMin').value,10)|| 0;
    var unidad   = document.getElementById('editUnidad').value;
    var ubicacion= (document.getElementById('editUbicacion').value || '').trim();
    var desc     = (document.getElementById('editDesc').value     || '').trim();
    var errEl    = document.getElementById('editError');
    var btn      = document.getElementById('editGuardarBtn');

    if (!nombre || !sku || !catId) {
      errEl.textContent = 'Nombre, SKU y categoría son obligatorios.';
      errEl.style.display = 'block';
      return;
    }

    btn.textContent = 'Guardando...'; btn.disabled = true; errEl.style.display = 'none';

    var payload = {
      nombreProducto: nombre,
      sku:            sku,
      idCategoria:    catId,
      valor:          valor,
      stockMinimo:    stockMin,
      unidad:         unidad,
      ubicacion:      ubicacion,
      descripcion:    desc
    };

    var res = await peticionAPI('Producto', 'PATCH', payload, '?idProducto=eq.' + idProducto);
    if (res === null) {
      errEl.textContent = 'Error al guardar. Revisa permisos o conexión.';
      errEl.style.display = 'block';
      btn.textContent = 'Guardar Cambios'; btn.disabled = false;
      return;
    }

    cerrarModal('modalEditar');
    // Realtime lo actualizará, pero forzamos recarga local inmediata
    await recargarProductos();
  }

  // ══════════════════════════════════════════════════════════════════════════
  //  MODAL ENTRADA DE STOCK
  // ══════════════════════════════════════════════════════════════════════════
  function abrirModalEntrada(id) {
    var p = buscarProducto(id);
    if (!p) return;

    var stockActual = Number(p.stockActual) || 0;

    var html = '<div class="modal-header">'
      + '<div class="modal-title">Agregar Stock — ' + san(p.nombreProducto) + '</div>'
      + '<button class="modal-close" onclick="cerrarModal(\'modalEntrada\')">'
      + '<svg viewBox="0 0 24 24"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg></button></div>'
      + '<div class="modal-body">'

      + '<div style="background:var(--bg);border:1px solid var(--border);border-radius:8px;padding:10px 14px;margin-bottom:16px;font-size:13px;color:var(--slate)">'
      + 'Stock actual: <strong style="color:var(--text)">' + stockActual + ' ' + san(p.unidad || 'unidades') + '</strong>'
      + '</div>'

      + '<div class="form-group"><label class="form-label">Cantidad a agregar</label>'
      + '<input class="form-input" id="entradaCantidad" type="number" min="1" step="1" placeholder="Ej. 50"></div>'

      + '<div id="entradaError" style="display:none;color:var(--red);font-size:13px;padding:6px 0"></div>'
      + '</div>'

      + '<div class="modal-footer">'
      + '<button class="btn-secondary" onclick="cerrarModal(\'modalEntrada\')">Cancelar</button>'
      + '<button class="btn-primary" id="entradaGuardarBtn">Agregar Stock</button>'
      + '</div>';

    crearModal('modalEntrada', html);

    document.getElementById('entradaGuardarBtn').addEventListener('click', function () {
      guardarEntrada(p.idProducto);
    });

    var inp = document.getElementById('entradaCantidad');
    setTimeout(function () { inp.focus(); }, 50);
    inp.addEventListener('keydown', function (e) {
      if (e.key === 'Enter') guardarEntrada(p.idProducto);
    });
  }

  async function guardarEntrada(idProducto) {
    var inp      = document.getElementById('entradaCantidad');
    var errEl    = document.getElementById('entradaError');
    var btn      = document.getElementById('entradaGuardarBtn');
    var cantidad = parseInt(inp.value, 10);

    if (!cantidad || cantidad <= 0) {
      errEl.textContent = 'Ingresa una cantidad válida mayor a 0.';
      errEl.style.display = 'block';
      return;
    }

    btn.textContent = 'Guardando...'; btn.disabled = true; errEl.style.display = 'none';

    var sb = getSB();
    var rpcRes = sb
      ? await sb.rpc('registrar_entrada_stock', { p_id_producto: idProducto, p_cantidad: cantidad })
      : null;

    if (!sb || rpcRes.error) {
      errEl.textContent = 'Error al guardar. Revisa permisos o conexión.';
      errEl.style.display = 'block';
      btn.textContent = 'Agregar Stock'; btn.disabled = false;
      return;
    }

    cerrarModal('modalEntrada');
    await recargarProductos();
  }

  // ══════════════════════════════════════════════════════════════════════════
  //  MODAL VER DETALLE + HISTORIAL
  // ══════════════════════════════════════════════════════════════════════════
  async function abrirModalDetalle(id) {
    var p = buscarProducto(id);
    if (!p) return;

    // Esqueleto del modal con spinner
    var html = '<div class="modal-header">'
      + '<div class="modal-title">Detalle de Producto</div>'
      + '<button class="modal-close" onclick="cerrarModal(\'modalDetalle\')">'
      + '<svg viewBox="0 0 24 24"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg></button></div>'
      + '<div class="modal-body" id="detalleBody" style="max-height:70vh;overflow-y:auto">'
      + '<div style="text-align:center;padding:24px;color:var(--slate-light)">Cargando...</div>'
      + '</div>'
      + '<div class="modal-footer">'
      + '<button class="btn-secondary" onclick="cerrarModal(\'modalDetalle\')">Cerrar</button>'
      + '</div>';

    crearModal('modalDetalle', html);

    // Cargar datos frescos desde Supabase y historial
    var [productoDB, historial] = await Promise.all([
      peticionAPI('Producto', 'GET', null, '?idProducto=eq.' + p.idProducto + '&limit=1'),
      apiGetHistorial(p.idProducto)
    ]);

    var prod = (productoDB && productoDB[0]) ? enriquecerProductos([productoDB[0]])[0] : p;
    var st   = prod.status || calcularStatus(prod.stockActual, prod.stockMinimo);
    var valor    = Number(prod.valor) || 0;
    var stock    = Number(prod.stockActual) || 0;
    var valorTotal = (stock * valor).toLocaleString('en-US', { minimumFractionDigits: 2 });

    var historialHtml = '';
    if (!historial || historial.length === 0) {
      historialHtml = '<div style="text-align:center;padding:12px;color:var(--slate-light);font-size:13px">Sin movimientos registrados.</div>';
    } else {
      historialHtml = historial.map(function (h) {
        var fecha = h.created_at
          ? new Date(h.created_at).toLocaleString('es-MX', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })
          : '—';
        return '<div style="display:flex;gap:10px;padding:8px 0;border-bottom:1px solid var(--border)">'
          + '<span style="flex-shrink:0;display:inline-flex;align-items:center;margin-top:2px">' + iconoActividadSVG(h.tipo) + '</span>'
          + '<div><div style="font-size:12px;color:var(--text);font-weight:500">' + san(h.descripcion) + '</div>'
          + '<div style="font-size:11px;color:var(--slate-light);font-family:\'DM Mono\',monospace;margin-top:2px">'
          + fecha + ' · ' + san(h.usuario || 'Sistema') + '</div></div></div>';
      }).join('');
    }

    var body = document.getElementById('detalleBody');
    if (!body) return;

    body.innerHTML =
      // Fila 1 — info principal
      '<div style="display:grid;grid-template-columns:1fr 1fr;gap:14px;margin-bottom:16px">'
      + campo('Nombre', prod.nombreProducto)
      + campo('SKU', prod.sku)
      + campo('Categoría', prod.category || nombreCategoria(prod.idCategoria))
      + campo('Estado', '<span class="status-badge ' + invStatusClass(st) + '">' + invStatusLabel(st) + '</span>')
      + '</div>'
      // Fila 2 — stock y precios
      + '<div style="display:grid;grid-template-columns:repeat(3,1fr);gap:14px;margin-bottom:16px">'
      + campo('Stock Actual', (prod.stockActual || 0) + ' unid.')
      + campo('Stock Mínimo', (prod.stockMinimo || 0) + ' unid.')
      + campo('Precio Unitario', '$' + valor.toLocaleString('en-US', { minimumFractionDigits: 2 }))
      + '</div>'
      // Fila 3 — valor total
      + '<div style="background:var(--green-light);border:1px solid #b7ead0;border-radius:10px;padding:14px 18px;margin-bottom:16px;display:flex;justify-content:space-between;align-items:center">'
      + '<span style="font-size:13px;color:var(--green-dark);font-weight:600">Valor total en inventario</span>'
      + '<span style="font-size:18px;font-weight:700;color:var(--green-dark);font-family:\'DM Mono\',monospace">$' + valorTotal + '</span>'
      + '</div>'
      // Descripción / ubicación
      + (prod.descripcion
          ? '<div style="margin-bottom:16px">' + campo('Descripción', prod.descripcion) + '</div>'
          : '')
      + (prod.ubicacion
          ? '<div style="margin-bottom:16px">' + campo('Ubicación', prod.ubicacion) + '</div>'
          : '')
      // Historial
      + '<div style="font-size:11px;font-weight:700;letter-spacing:.08em;color:var(--slate-light);text-transform:uppercase;margin-bottom:8px">Historial de Movimientos</div>'
      + historialHtml;
  }

  function campo(label, valor) {
    return '<div><div style="font-size:10px;font-weight:700;letter-spacing:.07em;color:var(--slate-light);text-transform:uppercase;margin-bottom:4px">'
      + label + '</div><div style="font-size:13px;color:var(--text);font-weight:500">' + (valor || '—') + '</div></div>';
  }

  // ══════════════════════════════════════════════════════════════════════════
  //  API — historial de actividad filtrado por producto
  // ══════════════════════════════════════════════════════════════════════════
  async function apiGetHistorial(idProducto) {
    // Filtra la tabla actividad_log por referencia al producto
    // La columna reference_id debe existir (ver SQL)
    return await peticionAPI(
      'actividad_log',
      'GET',
      null,
      '?reference_id=eq.' + idProducto + '&order=created_at.desc&limit=20'
    ) || [];
  }

  // ══════════════════════════════════════════════════════════════════════════
  //  REALTIME
  // ══════════════════════════════════════════════════════════════════════════
  function suscribirRealtime() {
    var sb = getSB();
    if (!sb) return;

    sb.channel('inventory-changes')
      .on('postgres_changes',
          { event: '*', schema: 'public', table: 'Producto' },
          async function () {
            await recargarProductos();
          })
      .subscribe();
  }

  async function recargarProductos() {
    var raw = await apiGetProductos();
    PRODUCTOS_INV = enriquecerProductos(raw || []);
    initNav(PRODUCTOS_INV);
    invRender();
  }

  // ══════════════════════════════════════════════════════════════════════════
  //  ARRANQUE
  // ══════════════════════════════════════════════════════════════════════════
  async function cargarInventario() {
    var raw = (await Promise.all([apiGetProductos(), cargarCategoriasCache()]))[0];
    PRODUCTOS_INV = enriquecerProductos(raw || []);
    await getRol();     // cachear rol antes del primer render
    initNav(PRODUCTOS_INV);
    invApplyUrlFilter();
    invRender();
    suscribirRealtime();
  }

  // Exponer cerrarModal globalmente para los onclick inline de los modales
  window.cerrarModal = cerrarModal;

  cargarInventario();

})();
