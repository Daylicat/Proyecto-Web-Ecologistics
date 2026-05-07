// ─── pos.js ──────────────────────────────────────────────────────

const CATALOG = {
  'BAT-LI-100': { name: 'Batería Litio 100Ah',        category: 'Storage',    stock: 124, price: 480.00,  icon: 'battery' },
  'MC4-CON-01': { name: 'Conector MC4 (Par)',          category: 'Cables',     stock: 80,  price: 12.50,   icon: 'plug'    },
  'COP-25-001': { name: 'Cables de Cobre 2.5mm',      category: 'Electrical', stock: 12,  price: 38.00,   icon: 'bolt'    },
  'INT-TH-092': { name: 'Interruptores Térmicos',     category: 'Electrical', stock: 45,  price: 27.00,   icon: 'sun'     },
  'SOL-PA-060': { name: 'Paneles Solares 60W',        category: 'Panels',     stock: 18,  price: 210.00,  icon: 'panel'   },
  'LED-PL-060': { name: 'LED Panels 60x60',           category: 'Panels',     stock: 76,  price: 55.00,   icon: 'panel'   },
  'CIR-BR-20A': { name: 'Circuit Breaker 20A',        category: 'Electrical', stock: 33,  price: 44.00,   icon: 'bolt'    },
  'HER-TOR-01': { name: 'Torque Wrench Set',          category: 'Tools',      stock: 12,  price: 95.00,   icon: 'tool'    },
  'CAB-UTP-5E': { name: 'Cable UTP Cat5e x100m',      category: 'Cables',     stock: 8,   price: 62.00,   icon: 'plug'    },
  'INV-HB-5KW': { name: 'Inversor Híbrido 5kW',       category: 'Solar',      stock: 6,   price: 1250.00, icon: 'bolt'    },
  'CAB-SOL-6M': { name: 'Cable Solar 6mm²',           category: 'Cables',     stock: 200, price: 4.80,    icon: 'plug'    },
  'FUS-63A-DC': { name: 'Fusible DC 63A',             category: 'Electrical', stock: 50,  price: 8.50,    icon: 'bolt'    },
};

const ICONS = {
  battery: `<svg viewBox="0 0 24 24"><rect x="1" y="6" width="18" height="12" rx="2"/><line x1="23" y1="13" x2="23" y2="11"/></svg>`,
  plug:    `<svg viewBox="0 0 24 24"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/><polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/></svg>`,
  bolt:    `<svg viewBox="0 0 24 24"><polyline points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/></svg>`,
  sun:     `<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="5"/><line x1="12" y1="1" x2="12" y2="3"/><line x1="12" y1="21" x2="12" y2="23"/><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/><line x1="1" y1="12" x2="3" y2="12"/><line x1="21" y1="12" x2="23" y2="12"/><line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/></svg>`,
  panel:   `<svg viewBox="0 0 24 24"><rect x="2" y="3" width="20" height="14" rx="2"/><line x1="8" y1="21" x2="16" y2="21"/><line x1="12" y1="17" x2="12" y2="21"/></svg>`,
  tool:    `<svg viewBox="0 0 24 24"><path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z"/></svg>`,
};

// ─── State ───────────────────────────────────────────────────────
let items = {
  'BAT-LI-100': { ...CATALOG['BAT-LI-100'], sku: 'BAT-LI-100', qty: 2 },
  'MC4-CON-01': { ...CATALOG['MC4-CON-01'], sku: 'MC4-CON-01', qty: 15 },
  'SOL-PA-060': { ...CATALOG['SOL-PA-060'], sku: 'SOL-PA-060', qty: 4  },
  'CIR-BR-20A': { ...CATALOG['CIR-BR-20A'], sku: 'CIR-BR-20A', qty: 10 },
  'CAB-SOL-6M': { ...CATALOG['CAB-SOL-6M'], sku: 'CAB-SOL-6M', qty: 30 },
};

// ─── Render ──────────────────────────────────────────────────────
function render() {
  const list = document.getElementById('itemsList');
  const keys = Object.keys(items);

  if (keys.length === 0) {
    list.innerHTML = `
      <div class="pos-empty">
        <svg viewBox="0 0 24 24"><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/></svg>
        <p>Escanea o ingresa un código para agregar productos</p>
      </div>`;
  } else {
    list.innerHTML = keys.map((sku, i) => {
      const it    = items[sku];
      const sub   = (it.qty * it.price).toFixed(2);
      const over  = it.qty > it.stock;
      return `
        <div class="pos-item" style="animation-delay:${i * .04}s">
          <div class="pos-item-icon">${ICONS[it.icon] || ICONS.tool}</div>
          <div class="pos-item-info">
            <div class="pos-item-name">${it.name}</div>
            <div class="pos-item-sku">SKU: ${sku} · $${it.price.toFixed(2)} c/u</div>
          </div>
          <div class="pos-item-qty-wrap">
            <button class="pos-qty-btn" onclick="changeQty('${sku}', -1)">−</button>
            <input
              class="pos-qty-input ${over ? 'border-red' : ''}"
              type="number" min="1"
              value="${it.qty}"
              onchange="setQty('${sku}', this.value)"
              onclick="this.select()"
              style="${over ? 'border-color:var(--red);color:var(--red)' : ''}">
            <button class="pos-qty-btn" onclick="changeQty('${sku}', 1)">+</button>
          </div>
          <div style="font-size:12px;font-weight:700;color:${over ? 'var(--red)' : 'var(--slate)'};font-family:'DM Mono',monospace;min-width:64px;text-align:right">
            $${sub}
          </div>
          <button class="pos-delete-btn" onclick="removeItem('${sku}')" title="Eliminar">
            <svg viewBox="0 0 24 24"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6"/><path d="M14 11v6"/><path d="M9 6V4h6v2"/></svg>
          </button>
        </div>`;
    }).join('');
  }

  updateSummary();
}

// ─── Summary ─────────────────────────────────────────────────────
function updateSummary() {
  const keys       = Object.keys(items);
  const totalUnits = keys.reduce((s, k) => s + items[k].qty, 0);
  const totalCats  = new Set(keys.map(k => items[k].category)).size;
  const monto      = keys.reduce((s, k) => s + items[k].qty * items[k].price, 0);

  document.getElementById('totalItems').textContent = String(totalUnits).padStart(2, '0');
  document.getElementById('totalCats').textContent  = String(totalCats).padStart(2, '0');
  document.getElementById('montoTotal').textContent = '$' + monto.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

  const badge      = document.getElementById('stockBadge');
  const confirmBtn = document.getElementById('confirmBtn');
  let status = 'ok';

  keys.forEach(sku => {
    const it = items[sku];
    if (it.qty > it.stock) status = 'critical';
    else if (it.qty / it.stock >= 0.7 && status !== 'critical') status = 'warning';
  });

  badge.className = 'pos-stock-badge';
  if (status === 'ok')       { badge.classList.add('pos-stock-ok');       badge.textContent = 'Suficiente'; }
  if (status === 'warning')  { badge.classList.add('pos-stock-warning');  badge.textContent = 'Bajo Stock'; }
  if (status === 'critical') { badge.classList.add('pos-stock-critical'); badge.textContent = 'Insuficiente'; }

  confirmBtn.disabled = keys.length === 0 || status === 'critical';
}

// ─── Add item ────────────────────────────────────────────────────
function addFromInput() {
  const input = document.getElementById('scanInput');
  const raw   = input.value.trim().toUpperCase().replace(/^#/, '');
  if (!raw) return;

  let sku = raw;
  if (!CATALOG[sku]) {
    sku = Object.keys(CATALOG).find(k =>
      k.includes(raw) || CATALOG[k].name.toUpperCase().includes(raw)
    );
  }

  if (!sku) {
    flashScan('#FFF5F5', '#E53935');
    input.value = '';
    return;
  }

  if (items[sku]) {
    items[sku].qty++;
  } else {
    items[sku] = { ...CATALOG[sku], sku, qty: 1 };
  }

  input.value = '';
  render();
  flashScan('#DCFCE7', '#2DBE6C');
}

function handleScanKey(e) { if (e.key === 'Enter') addFromInput(); }

function flashScan(bg, border) {
  const wrap = document.querySelector('.pos-scan-wrap');
  wrap.style.background  = bg;
  wrap.style.borderColor = border;
  setTimeout(() => { wrap.style.background = ''; wrap.style.borderColor = 'var(--green)'; }, 500);
}

// ─── Qty controls ────────────────────────────────────────────────
function changeQty(sku, delta) {
  if (!items[sku]) return;
  items[sku].qty = Math.max(1, items[sku].qty + delta);
  render();
}

function setQty(sku, val) {
  const n = parseInt(val);
  if (!isNaN(n) && n >= 1) {
    items[sku].qty = n;
    render();
  }
}

// ─── Remove / Clear ──────────────────────────────────────────────
function removeItem(sku) {
  delete items[sku];
  render();
}

function clearAll() {
  if (Object.keys(items).length === 0) return;
  if (confirm('¿Limpiar todos los artículos escaneados?')) {
    items = {};
    render();
  }
}

// ─── Confirm & Success ───────────────────────────────────────────
function confirmarSalida() {
  const dest = document.getElementById('destInput').value.trim();
  if (!dest) {
    const inp = document.getElementById('destInput');
    inp.style.borderColor = 'var(--red)';
    inp.focus();
    inp.addEventListener('input', () => inp.style.borderColor = '', { once: true });
    return;
  }

  const keys       = Object.keys(items);
  const totalUnits = keys.reduce((s, k) => s + items[k].qty, 0);
  const monto      = keys.reduce((s, k) => s + items[k].qty * items[k].price, 0);

  // Build product list string
  let productStr;
  if (keys.length === 1) {
    const it = items[keys[0]];
    productStr = `<strong>${it.qty} unidad${it.qty !== 1 ? 'es' : ''}</strong> de <strong>${it.name}</strong>`;
  } else {
    const lines = keys.map(k => `• ${items[k].qty} × ${items[k].name}`).join('<br>');
    productStr = `<strong>${totalUnits} unidades</strong> en total:<br><br>${lines}`;
  }

  const msg = `Se ha registrado la salida de ${productStr}.<br><br>
    <strong>Destino:</strong> ${dest}<br>
    <strong>Monto total:</strong> $${monto.toLocaleString('en-US', { minimumFractionDigits: 2 })}<br><br>
    ¡Felicitaciones por su venta! 🎉`;

  document.getElementById('successMsg').innerHTML = msg;

  const overlay = document.getElementById('successOverlay');
  const bar     = document.getElementById('successBar');

  overlay.classList.add('show');
  // trigger bar animation after paint
  requestAnimationFrame(() => requestAnimationFrame(() => bar.classList.add('animate')));

  setTimeout(() => {
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

// ─── Cancel ──────────────────────────────────────────────────────
function cancelar() {
  if (Object.keys(items).length === 0 || confirm('¿Cancelar la operación? Se perderán los artículos escaneados.')) {
    resetPOS();
  }
}

// ─── Init ────────────────────────────────────────────────────────
render();
document.getElementById('scanInput').focus();
