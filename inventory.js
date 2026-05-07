// inventory.js — requiere data.js cargado antes

var INV_ICONS = {
  bolt:    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><polyline points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/></svg>',
  sun:     '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><circle cx="12" cy="12" r="5"/><line x1="12" y1="1" x2="12" y2="3"/><line x1="12" y1="21" x2="12" y2="23"/></svg>',
  battery: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><rect x="1" y="6" width="18" height="12" rx="2"/><line x1="23" y1="13" x2="23" y2="11"/></svg>',
  panel:   '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><rect x="2" y="3" width="20" height="14" rx="2"/><line x1="8" y1="21" x2="16" y2="21"/><line x1="12" y1="17" x2="12" y2="21"/></svg>',
  plug:    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/><polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/></svg>',
  tool:    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z"/></svg>'
};

var INV_QR = '<svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">'
  + '<rect x="3" y="3" width="7" height="7" rx="1" fill="none" stroke="currentColor" stroke-width="1.5"/>'
  + '<rect x="5" y="5" width="3" height="3" fill="currentColor"/>'
  + '<rect x="14" y="3" width="7" height="7" rx="1" fill="none" stroke="currentColor" stroke-width="1.5"/>'
  + '<rect x="16" y="5" width="3" height="3" fill="currentColor"/>'
  + '<rect x="3" y="14" width="7" height="7" rx="1" fill="none" stroke="currentColor" stroke-width="1.5"/>'
  + '<rect x="5" y="16" width="3" height="3" fill="currentColor"/>'
  + '</svg>';

// Estado
var INV_PAGE_SIZE   = 5;
var invCurrentPage  = 1;
var invActiveFilter = 'todos';
var invSearchQuery  = '';

// ── Helpers ──────────────────────────────────────────────────────

function invStatusClass(s) {
  if (s === 'critico')    return 'status-critico';
  if (s === 'bajo stock') return 'status-bajo';
  if (s === 'optimo')     return 'status-optimo';
  if (s === 'sin stock')  return 'status-sinstock';
  return 'status-sinstock';
}

function invStatusLabel(s) {
  if (s === 'critico')    return 'Crítico';
  if (s === 'bajo stock') return 'Bajo Stock';
  if (s === 'optimo')     return 'Óptimo';
  if (s === 'sin stock')  return 'Sin Stock';
  return s;
}

function invStockClass(s) {
  if (s === 'critico' || s === 'sin stock') return 'stock-critico';
  if (s === 'bajo stock') return 'stock-bajo';
  return 'stock-normal';
}

function invRowClass(s) {
  if (s === 'critico' || s === 'sin stock') return 'row-critico';
  if (s === 'bajo stock') return 'row-bajo';
  return '';
}

// ── Filtrado ─────────────────────────────────────────────────────

function invGetFiltered() {
  var list = (typeof ECO_PRODUCTS !== 'undefined') ? ECO_PRODUCTS : [];
  return list.filter(function(p) {
    var matchFilter = invActiveFilter === 'todos' || p.status === invActiveFilter;
    var q = invSearchQuery.toLowerCase();
    var matchSearch = !q
      || p.name.toLowerCase().indexOf(q) > -1
      || p.id.toLowerCase().indexOf(q) > -1
      || p.category.toLowerCase().indexOf(q) > -1;
    return matchFilter && matchSearch;
  });
}

// ── Render ───────────────────────────────────────────────────────

function invRender() {
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
    for (var i = 0; i < slice.length; i++) {
      var p    = slice[i];
      var icon = INV_ICONS[p.icon] || INV_ICONS.tool;
      html += '<tr class="' + invRowClass(p.status) + '">';
      html +=   '<td>';
      html +=     '<div class="prod-cell">';
      html +=       '<div class="prod-icon">' + icon + '</div>';
      html +=       '<div>';
      html +=         '<div class="prod-name">' + p.name + '</div>';
      html +=         '<div class="prod-id">ID: #' + p.id + '</div>';
      html +=       '</div>';
      html +=     '</div>';
      html +=   '</td>';
      html +=   '<td style="font-size:13px;color:var(--slate)">' + p.category + '</td>';
      html +=   '<td><span class="' + invStockClass(p.status) + '">' + p.stock + ' unid.</span></td>';
      html +=   '<td><span class="stock-min">' + p.min + ' unid.</span></td>';
      html +=   '<td><span class="status-badge ' + invStatusClass(p.status) + '">' + invStatusLabel(p.status) + '</span></td>';
      html +=   '<td><div class="qr-icon" title="Ver QR">' + INV_QR + '</div></td>';
      html +=   '<td>';
      html +=     '<div class="action-btns">';
      html +=       '<button class="action-btn" title="Editar">'
                  +   '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round">'
                  +     '<path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>'
                  +     '<path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>'
                  +   '</svg>'
                  + '</button>';
      html +=       '<button class="action-btn" title="Ver detalle">'
                  +   '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round">'
                  +     '<path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/>'
                  +     '<circle cx="12" cy="12" r="3"/>'
                  +   '</svg>'
                  + '</button>';
      html +=     '</div>';
      html +=   '</td>';
      html += '</tr>';
    }
  }

  tbody.innerHTML = html;

  var from = total === 0 ? 0 : start + 1;
  var to   = Math.min(start + INV_PAGE_SIZE, total);
  infoEl.textContent = 'Mostrando ' + from + '-' + to + ' de ' + total + ' productos';

  pnEl.innerHTML = '';
  for (var j = 1; j <= pages; j++) {
    (function(page) {
      var btn       = document.createElement('button');
      btn.className = 'page-num' + (page === invCurrentPage ? ' active' : '');
      btn.textContent = page;
      btn.onclick   = function() { invCurrentPage = page; invRender(); };
      pnEl.appendChild(btn);
    })(j);
  }

  prevBtn.disabled = (invCurrentPage === 1);
  nextBtn.disabled = (invCurrentPage === pages);
}

// ── Controles públicos (llamados desde HTML) ──────────────────────

function invChangePage(dir) {
  var pages = Math.ceil(invGetFiltered().length / INV_PAGE_SIZE);
  invCurrentPage = Math.max(1, Math.min(pages, invCurrentPage + dir));
  invRender();
}

function invSetFilter(filter, btn) {
  invActiveFilter = filter;
  invCurrentPage  = 1;
  var tabs = document.querySelectorAll('.filter-tab');
  for (var i = 0; i < tabs.length; i++) tabs[i].classList.remove('active');
  btn.classList.add('active');
  invRender();
}

function invFilterTable() {
  invSearchQuery = document.getElementById('searchInput').value;
  invCurrentPage = 1;
  invRender();
}

// ── Campanita ────────────────────────────────────────────────────

function invInitNotif() {
  var notifBtn = document.getElementById('notifBtn');
  var dot      = document.getElementById('notifDot');
  if (!notifBtn || typeof ECO_PRODUCTS === 'undefined') return;

  var critico   = ECO_PRODUCTS.filter(function(p) { return p.status === 'critico'; });
  var bajoStock = ECO_PRODUCTS.filter(function(p) { return p.status === 'bajo stock'; });
  var sinStock  = ECO_PRODUCTS.filter(function(p) { return p.status === 'sin stock'; });
  var total     = critico.length + bajoStock.length + sinStock.length;

  if (dot && total > 0) {
    dot.textContent = total > 9 ? '9+' : String(total);
    dot.style.cssText = 'width:auto;min-width:16px;height:16px;padding:0 3px;'
      + 'border-radius:99px;font-size:9px;font-weight:800;line-height:16px;'
      + 'text-align:center;display:flex;align-items:center;justify-content:center;';
  }

  function makeItem(p, type) {
    var iconMap  = { critico: '⚠', 'bajo stock': 'ℹ', 'sin stock': '✕' };
    var classMap = { critico: 'critico', 'bajo stock': 'bajo', 'sin stock': 'sinstock' };
    return '<div class="notif-item notif-item-' + classMap[type] + '">'
      + '<span class="notif-item-icon">' + iconMap[type] + '</span>'
      + '<div class="notif-item-body">'
      + '<div class="notif-item-name">' + p.name + '</div>'
      + '<div class="notif-item-detail">' + p.stock + ' unidades &middot; M&iacute;n. ' + p.min + '</div>'
      + '</div>'
      + '<a href="inventory.html?filter=' + encodeURIComponent(type) + '" class="notif-item-ver">Ver</a>'
      + '</div>';
  }

  var html = '<div class="notif-header">'
    + '<span class="notif-title">Alertas de Stock</span>'
    + '<span class="notif-count-label">' + total + ' alerta' + (total !== 1 ? 's' : '') + '</span>'
    + '</div><div class="notif-body">';

  if (critico.length) {
    html += '<div class="notif-section-label notif-label-critico">Cr&iacute;tico (' + critico.length + ')</div>';
    for (var a = 0; a < critico.length; a++) html += makeItem(critico[a], 'critico');
  }
  if (bajoStock.length) {
    html += '<div class="notif-section-label notif-label-bajo">Bajo Stock (' + bajoStock.length + ')</div>';
    for (var b = 0; b < bajoStock.length; b++) html += makeItem(bajoStock[b], 'bajo stock');
  }
  if (sinStock.length) {
    html += '<div class="notif-section-label notif-label-sinstock">Sin Stock (' + sinStock.length + ')</div>';
    for (var c = 0; c < sinStock.length; c++) html += makeItem(sinStock[c], 'sin stock');
  }

  html += '</div><a href="inventory.html" class="notif-footer">Ver inventario completo &rarr;</a>';

  var dd = document.createElement('div');
  dd.id        = 'notifDropdown';
  dd.className = 'notif-dropdown';
  dd.innerHTML = html;
  notifBtn.appendChild(dd);

  notifBtn.addEventListener('click', function(e) {
    e.stopPropagation();
    dd.classList.toggle('open');
  });
  document.addEventListener('click', function() { dd.classList.remove('open'); });
}

// ── Filtro desde URL: inventory.html?filter=critico ───────────────

function invApplyUrlFilter() {
  if (!window.location.search) return;
  var params = new URLSearchParams(window.location.search);
  var f = params.get('filter');
  if (!f) return;
  invActiveFilter = decodeURIComponent(f);
  var map  = { 'todos': 'Todos', 'bajo stock': 'Bajo Stock', 'critico': 'Crítico', 'sin stock': 'Sin Stock' };
  var tabs = document.querySelectorAll('.filter-tab');
  for (var i = 0; i < tabs.length; i++) {
    tabs[i].classList.remove('active');
    if (tabs[i].textContent.trim() === (map[invActiveFilter] || invActiveFilter)) {
      tabs[i].classList.add('active');
    }
  }
}

// ── Arranque ─────────────────────────────────────────────────────
invApplyUrlFilter();
invInitNotif();
invRender();
