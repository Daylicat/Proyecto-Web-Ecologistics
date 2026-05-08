
// pos.js — usa ECO_CATALOG de data.js para evitar duplicación

const ICONS = {
  battery: '<svg viewBox="0 0 24 24"><rect x="1" y="6" width="18" height="12" rx="2"/><line x1="23" y1="13" x2="23" y2="11"/></svg>',
  plug:    '<svg viewBox="0 0 24 24"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/><polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/></svg>',
  bolt:    '<svg viewBox="0 0 24 24"><polyline points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/></svg>',
  sun:     '<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="5"/><line x1="12" y1="1" x2="12" y2="3"/><line x1="12" y1="21" x2="12" y2="23"/><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/><line x1="1" y1="12" x2="3" y2="12"/><line x1="21" y1="12" x2="23" y2="12"/><line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/></svg>',
  panel:   '<svg viewBox="0 0 24 24"><rect x="2" y="3" width="20" height="14" rx="2"/><line x1="8" y1="21" x2="16" y2="21"/><line x1="12" y1="17" x2="12" y2="21"/></svg>',
  tool:    '<svg viewBox="0 0 24 24"><path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z"/></svg>',
};

// Catálogo: usa ECO_CATALOG de data.js (fuente única)
// ECO_CATALOG se define en data.js y tiene: name, category, stock, icon, price

let items = {};

// Datos de ejemplo para demostración inicial
(function initDemoItems() {
  var demos = ['BAT-LI-100', 'SOL-PA-060', 'CIR-BR-20A'];
  demos.forEach(function (sku) {
    if (typeof ECO_CATALOG !== 'undefined' && ECO_CATALOG[sku]) {
      items[sku] = Object.assign({}, ECO_CATALOG[sku], { sku: sku, qty: sku === 'BAT-LI-100' ? 2 : sku === 'SOL-PA-060' ? 4 : 10 });
    }
  });
})();

// ── Render ──────────────────────────────────────────────────────────────────
function render() {
  var list = document.getElementById('itemsList');
  var keys = Object.keys(items);

  if (keys.length === 0) {
    list.innerHTML = '<div class="pos-empty">'
      + '<svg viewBox="0 0 24 24"><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/></svg>'
      + '<p>Escanea o ingresa un código para agregar productos</p></div>';
  } else {
    list.innerHTML = keys.map(function (sku, i) {
      var it   = items[sku];
      var sub  = (it.qty * (it.price || 0)).toFixed(2);
      var over = it.qty > it.stock;
      return '<div class="pos-item" style="animation-delay:' + (i * 0.04) + 's">'
        + '<div class="pos-item-icon">' + (ICONS[it.icon] || ICONS.tool) + '</div>'
        + '<div class="pos-item-info">'
        + '<div class="pos-item-name">' + it.name + '</div>'
        + '<div class="pos-item-sku">SKU: ' + sku + ' · $' + (it.price || 0).toFixed(2) + ' c/u</div>'
        + '</div>'
        + '<div class="pos-item-qty-wrap">'
        + '<button class="pos-qty-btn" onclick="changeQty(\'' + sku + '\',-1)">−</button>'
        + '<input class="pos-qty-input' + (over ? ' border-red' : '') + '" type="number" min="1"'
        + ' value="' + it.qty + '" onchange="setQty(\'' + sku + '\',this.value)" onclick="this.select()"'
        + (over ? ' style="border-color:var(--red);color:var(--red)"' : '') + '>'
        + '<button class="pos-qty-btn" onclick="changeQty(\'' + sku + '\',1)">+</button>'
        + '</div>'
        + '<div style="font-size:12px;font-weight:700;color:' + (over ? 'var(--red)' : 'var(--slate)') + ';font-family:\'DM Mono\',monospace;min-width:64px;text-align:right">$' + sub + '</div>'
        + '<button class="pos-delete-btn" onclick="removeItem(\'' + sku + '\')" title="Eliminar">'
        + '<svg viewBox="0 0 24 24"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6"/><path d="M14 11v6"/><path d="M9 6V4h6v2"/></svg>'
        + '</button>'
        + '</div>';
    }).join('');
  }

  updateSummary();
}

function updateSummary() {
  var keys       = Object.keys(items);
  var totalUnits = keys.reduce(function (s, k) { return s + items[k].qty; }, 0);
  var totalCats  = new Set(keys.map(function (k) { return items[k].category; })).size;
  var monto      = keys.reduce(function (s, k) { return s + items[k].qty * (items[k].price || 0); }, 0);

  document.getElementById('totalItems').textContent = String(totalUnits).padStart(2, '0');
  document.getElementById('totalCats').textContent  = String(totalCats).padStart(2, '0');
  document.getElementById('montoTotal').textContent = '$' + monto.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

  var badge      = document.getElementById('stockBadge');
  var confirmBtn = document.getElementById('confirmBtn');
  var status     = 'ok';

  keys.forEach(function (sku) {
    var it = items[sku];
    if (it.qty > it.stock)                                   status = 'critical';
    else if (it.qty / it.stock >= 0.7 && status !== 'critical') status = 'warning';
  });

  badge.className = 'pos-stock-badge';
  if (status === 'ok')       { badge.classList.add('pos-stock-ok');       badge.textContent = 'Suficiente'; }
  if (status === 'warning')  { badge.classList.add('pos-stock-warning');  badge.textContent = 'Bajo Stock'; }
  if (status === 'critical') { badge.classList.add('pos-stock-critical'); badge.textContent = 'Insuficiente'; }

  confirmBtn.disabled = keys.length === 0 || status === 'critical';
}

// ── Escaneo / búsqueda ──────────────────────────────────────────────────────
function addFromInput() {
  var input = document.getElementById('scanInput');
  var raw   = input.value.trim().toUpperCase().replace(/^#/, '');
  if (!raw) return;

  var catalog = (typeof ECO_CATALOG !== 'undefined') ? ECO_CATALOG : {};
  var sku = raw;

  if (!catalog[sku]) {
    sku = Object.keys(catalog).find(function (k) {
      return k.includes(raw) || (catalog[k].name || '').toUpperCase().includes(raw);
    });
  }

  if (!sku) {
    flashScan('#FFF5F5', '#E53935');
    input.value = '';
    return;
  }

  if (items[sku]) {
    items[sku].qty++;
  } else {
    items[sku] = Object.assign({}, catalog[sku], { sku: sku, qty: 1 });
  }

  input.value = '';
  render();
  flashScan('#DCFCE7', '#2DBE6C');
}

function handleScanKey(e) { if (e.key === 'Enter') addFromInput(); }

function flashScan(bg, border) {
  var wrap = document.querySelector('.pos-scan-wrap');
  if (!wrap) return;
  wrap.style.background  = bg;
  wrap.style.borderColor = border;
  setTimeout(function () { wrap.style.background = ''; wrap.style.borderColor = 'var(--green)'; }, 500);
}

// ── Cantidades ──────────────────────────────────────────────────────────────
function changeQty(sku, delta) {
  if (!items[sku]) return;
  items[sku].qty = Math.max(1, items[sku].qty + delta);
  render();
}

function setQty(sku, val) {
  var n = parseInt(val);
  if (!isNaN(n) && n >= 1) { items[sku].qty = n; render(); }
}

function removeItem(sku) {
  delete items[sku];
  render();
}

function clearAll() {
  if (Object.keys(items).length === 0) return;
  if (confirm('¿Limpiar todos los artículos escaneados?')) { items = {}; render(); }
}

// ── Confirmar salida ────────────────────────────────────────────────────────
function confirmarSalida() {
  var dest = document.getElementById('destInput').value.trim();
  if (!dest) {
    var inp = document.getElementById('destInput');
    inp.style.borderColor = 'var(--red)';
    inp.focus();
    inp.addEventListener('input', function () { inp.style.borderColor = ''; }, { once: true });
    return;
  }

  var keys       = Object.keys(items);
  var totalUnits = keys.reduce(function (s, k) { return s + items[k].qty; }, 0);
  var monto      = keys.reduce(function (s, k) { return s + items[k].qty * (items[k].price || 0); }, 0);

  var productStr;
  if (keys.length === 1) {
    var it = items[keys[0]];
    productStr = '<strong>' + it.qty + ' unidad' + (it.qty !== 1 ? 'es' : '') + '</strong> de <strong>' + it.name + '</strong>';
  } else {
    var lines = keys.map(function (k) { return '• ' + items[k].qty + ' × ' + items[k].name; }).join('<br>');
    productStr = '<strong>' + totalUnits + ' unidades</strong> en total:<br><br>' + lines;
  }

  var msg = 'Se ha registrado la salida de ' + productStr + '.<br><br>'
    + '<strong>Destino:</strong> ' + dest + '<br>'
    + '<strong>Monto total:</strong> $' + monto.toLocaleString('en-US', { minimumFractionDigits: 2 }) + '<br><br>'
    + '¡Operación completada exitosamente! 🎉';

  document.getElementById('successMsg').innerHTML = msg;

  var overlay = document.getElementById('successOverlay');
  var bar     = document.getElementById('successBar');
  overlay.classList.add('show');
  requestAnimationFrame(function () { requestAnimationFrame(function () { bar.classList.add('animate'); }); });

  setTimeout(function () {
    overlay.classList.remove('show');
    bar.classList.remove('animate');
    resetPOS();
  }, 3600);
}

function resetPOS() {
  items = {};
  document.getElementById('destInput').value  = '';
  document.getElementById('notasInput').value = '';
  document.getElementById('scanInput').value  = '';
  render();
  document.getElementById('scanInput').focus();
}

function cancelar() {
  if (Object.keys(items).length === 0 || confirm('¿Cancelar la operación? Se perderán los artículos escaneados.')) {
    resetPOS();
  }
}

// ── Inicio ──────────────────────────────────────────────────────────────────
render();
var scanEl = document.getElementById('scanInput');
if (scanEl) scanEl.focus();
