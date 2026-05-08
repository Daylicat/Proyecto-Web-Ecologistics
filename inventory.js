
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

// ── Estado ──────────────────────────────────────────────────────────────────
var INV_PAGE_SIZE   = 5;
var invCurrentPage  = 1;
var invActiveFilter = 'todos';
var invSearchQuery  = '';

// ── Normalizar status para comparaciones (elimina tildes) ───────────────────
function normStatus(s) {
  return (s || '').toLowerCase()
    .replace(/[áéíóú]/g, function (c) {
      return { 'á':'a','é':'e','í':'i','ó':'o','ú':'u' }[c];
    })
    .trim();
}

// ── Helpers de clasificación ────────────────────────────────────────────────
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
  if (n === 'bajo stock') return 'stock-bajo';
  return 'stock-normal';
}

function invRowClass(s) {
  var n = normStatus(s);
  if (n === 'critico' || n === 'sin stock') return 'row-critico';
  if (n === 'bajo stock') return 'row-bajo';
  return '';
}

// ── Filtrado ────────────────────────────────────────────────────────────────
function invGetFiltered() {
  var list = (typeof ECO_PRODUCTS !== 'undefined') ? ECO_PRODUCTS : [];
  return list.filter(function (p) {
    var matchFilter;
    if (invActiveFilter === 'todos') {
      matchFilter = true;
    } else {
      matchFilter = normStatus(p.status) === normStatus(invActiveFilter);
    }
    var q = invSearchQuery.toLowerCase();
    var matchSearch = !q
      || p.name.toLowerCase().indexOf(q) > -1
      || p.id.toLowerCase().indexOf(q) > -1
      || (p.category || '').toLowerCase().indexOf(q) > -1;
    return matchFilter && matchSearch;
  });
}

// ── Render ──────────────────────────────────────────────────────────────────
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
      html +=   '<td><div class="prod-cell"><div class="prod-icon">' + icon + '</div>';
      html +=   '<div><div class="prod-name">' + p.name + '</div>';
      html +=   '<div class="prod-id">ID: #' + p.id + '</div></div></div></td>';
      html +=   '<td style="font-size:13px;color:var(--slate)">' + (p.category || '') + '</td>';
      html +=   '<td><span class="' + invStockClass(p.status) + '">' + p.stock + ' unid.</span></td>';
      html +=   '<td><span class="stock-min">' + p.min + ' unid.</span></td>';
      html +=   '<td><span class="status-badge ' + invStatusClass(p.status) + '">' + invStatusLabel(p.status) + '</span></td>';
      html +=   '<td><div class="qr-icon" title="Ver QR">' + INV_QR + '</div></td>';
      html +=   '<td><div class="action-btns">';
      html +=     '<button class="action-btn" title="Editar">'
               +    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round">'
               +      '<path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>'
               +      '<path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>'
               +    '</svg></button>';
      html +=     '<button class="action-btn" title="Ver detalle">'
               +    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round">'
               +      '<path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/>'
               +      '<circle cx="12" cy="12" r="3"/>'
               +    '</svg></button>';
      html +=   '</div></td>';
      html += '</tr>';
    }
  }

  tbody.innerHTML = html;

  var from = total === 0 ? 0 : start + 1;
  var to   = Math.min(start + INV_PAGE_SIZE, total);
  infoEl.textContent = 'Mostrando ' + from + '-' + to + ' de ' + total + ' productos';

  pnEl.innerHTML = '';
  for (var j = 1; j <= pages; j++) {
    (function (page) {
      var btn       = document.createElement('button');
      btn.className = 'page-num' + (page === invCurrentPage ? ' active' : '');
      btn.textContent = page;
      btn.onclick   = function () { invCurrentPage = page; invRender(); };
      pnEl.appendChild(btn);
    })(j);
  }

  if (prevBtn) prevBtn.disabled = (invCurrentPage === 1);
  if (nextBtn) nextBtn.disabled = (invCurrentPage === pages);
}

// ── Paginación y filtros ────────────────────────────────────────────────────
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
  if (btn) btn.classList.add('active');
  invRender();
}

function invFilterTable() {
  var inp = document.getElementById('searchInput');
  invSearchQuery = inp ? inp.value : '';
  invCurrentPage = 1;
  invRender();
}

// ── Aplicar filtros desde URL ────────────────────────────────────────────────
function invApplyUrlFilter() {
  if (!window.location.search) return;
  var params = new URLSearchParams(window.location.search);
  var f = params.get('filter');
  if (!f) return;
  invActiveFilter = decodeURIComponent(f);

  var labelMap = {
    'todos': 'Todos',
    'bajo stock': 'Bajo Stock',
    'critico': 'Crítico',
    'sin stock': 'Sin Stock'
  };

  var tabs = document.querySelectorAll('.filter-tab');
  for (var i = 0; i < tabs.length; i++) {
    tabs[i].classList.remove('active');
    var tabText = tabs[i].textContent.trim();
    var mapped  = labelMap[normStatus(invActiveFilter)] || invActiveFilter;
    if (tabText === mapped) {
      tabs[i].classList.add('active');
    }
  }
}

// ── Init ────────────────────────────────────────────────────────────────────
invApplyUrlFilter();
invRender();
