// ─── reportes.js ─────────────────────────────────────────────────

const AVATAR_COLORS = ['#667eea', '#2DBE6C', '#F59E0B', '#EF4444', '#3B82F6', '#8B5CF6'];

const MOVEMENTS = [
  { product: 'Panel Solar 400W',      sku: 'SL-400-X',  qty: 'x12',   dest: 'Instalación Residencial A', user: 'Carlos R.',  avatar: 'CR', color: 0, date: 'Oct 24, 2023 - 11:45', amount: 3600 },
  { product: 'Inversor 5kW',          sku: 'INV-5K-02', qty: 'x2',    dest: 'Proyecto Industrial B',     user: 'Elena M.',   avatar: 'EM', color: 1, date: 'Oct 24, 2023 - 09:30', amount: 1850 },
  { product: 'Cable de Cobre 2.5mm',  sku: 'COP-25-001',qty: 'x150m', dest: 'Mantenimiento General',     user: 'Admin User', avatar: 'AU', color: 5, date: 'Oct 23, 2023 - 16:15', amount: 450  },
  { product: 'Batería Litio 100Ah',   sku: 'BAT-LI-100',qty: 'x4',    dest: 'Proyecto Solar SFe',        user: 'Carlos R.',  avatar: 'CR', color: 0, date: 'Oct 23, 2023 - 14:00', amount: 2200 },
  { product: 'Interruptores Térmicos',sku: 'INT-TH-092',qty: 'x20',   dest: 'Hub Principal',             user: 'Luis T.',    avatar: 'LT', color: 3, date: 'Oct 22, 2023 - 10:30', amount: 340  },
  { product: 'LED Panels 60x60',      sku: 'LED-PL-060',qty: 'x8',    dest: 'Oficina Central',           user: 'Elena M.',   avatar: 'EM', color: 1, date: 'Oct 22, 2023 - 08:45', amount: 960  },
  { product: 'Circuit Breaker 20A',   sku: 'CIR-BR-20A',qty: 'x15',   dest: 'Site Alpha-4',              user: 'Marco V.',   avatar: 'MV', color: 4, date: 'Oct 21, 2023 - 17:10', amount: 525  },
  { product: 'Paneles Solares 60W',   sku: 'SOL-PA-060',qty: 'x6',    dest: 'Instalación Rural B',       user: 'Admin User', avatar: 'AU', color: 5, date: 'Oct 21, 2023 - 15:00', amount: 720  },
  { product: 'Torque Wrench Set',     sku: 'HER-TOR-01',qty: 'x3',    dest: 'Taller de Mantenimiento',   user: 'Luis T.',    avatar: 'LT', color: 3, date: 'Oct 20, 2023 - 11:20', amount: 210  },
  { product: 'Cable UTP Cat5e x100m', sku: 'CAB-UTP-5E',qty: 'x2',    dest: 'Proyecto Industrial B',     user: 'Marco V.',   avatar: 'MV', color: 4, date: 'Oct 20, 2023 - 09:00', amount: 180  },
];

const KPI_DATA = {
  salidas:   { salidas: { val: '1,284', trend: '+12%', up: true }, items: { val: '8,420', trend: '+5%', up: true }, valor: { val: '$42,150.00', trend: '-2.4%', up: false }, usuarios: { val: '14', note: 'Personal de Almacén' } },
  entradas:  { salidas: { val: '320',   trend: '+8%',  up: true }, items: { val: '4,210', trend: '+11%',up: true }, valor: { val: '$98,700.00', trend: '+18%', up: true  }, usuarios: { val: '8',  note: 'Personal de Almacén' } },
  auditoria: { salidas: { val: '1,604', trend: '+9%',  up: true }, items: { val: '12,630',trend: '+7%', up: true }, valor: { val: '$140,850.00',trend: '+6%', up: true  }, usuarios: { val: '14', note: 'Personal de Almacén' } },
  usuarios:  { salidas: { val: '14',    trend: '+2%',  up: true }, items: { val: '8,420', trend: '+5%', up: true }, valor: { val: '$42,150.00', trend: '-2.4%',up: false }, usuarios: { val: '6',  note: 'Activos este mes'   } },
};

let visibleRows = 3;
let activeFilter = null;

// ─── KPI Render ──────────────────────────────────────────────────
function renderKPIs() {
  const type = document.getElementById('reportType').value;
  const d    = KPI_DATA[type] || KPI_DATA.salidas;

  const kpis = [
    { label: 'Total Salidas',    val: d.salidas.val,  trend: d.salidas.trend,  up: d.salidas.up  },
    { label: 'Items Movidos',    val: d.items.val,    trend: d.items.trend,    up: d.items.up    },
    { label: 'Valor de Salidas', val: d.valor.val,    trend: d.valor.trend,    up: d.valor.up    },
    { label: 'Usuarios Activos', val: d.usuarios.val, note: d.usuarios.note                      },
  ];

  document.getElementById('kpiGrid').innerHTML = kpis.map((k, i) => `
    <div class="card rep-kpi-card" style="animation: fadeIn .35s ease ${i * .07}s both">
      <div class="rep-kpi-label">${k.label}</div>
      <div class="rep-kpi-val">${k.val}</div>
      ${k.trend ? `
        <div class="rep-kpi-trend ${k.up ? 'rep-trend-up' : 'rep-trend-down'}">
          <svg viewBox="0 0 24 24">
            ${k.up
              ? '<polyline points="23 6 13.5 15.5 8.5 10.5 1 18"/><polyline points="17 6 23 6 23 12"/>'
              : '<polyline points="23 18 13.5 8.5 8.5 13.5 1 6"/><polyline points="17 18 23 18 23 12"/>'}
          </svg>
          ${k.trend} vs mes anterior
        </div>` : ''}
      ${k.note ? `<div class="rep-kpi-note">${k.note}</div>` : ''}
    </div>
  `).join('');
}

// ─── Table Render ────────────────────────────────────────────────
function renderTable() {
  let data = [...MOVEMENTS];
  if (activeFilter === 'alto') data = data.filter(r => r.amount >= 1000);
  if (activeFilter === 'bajo') data = data.filter(r => r.amount < 500);

  const slice = data.slice(0, visibleRows);

  document.getElementById('movTable').innerHTML = slice.map((r, i) => `
    <tr style="animation-delay:${i * .05}s">
      <td>
        <div class="rep-prod-name">${r.product}</div>
        <div class="rep-prod-sku">SKU: ${r.sku}</div>
      </td>
      <td><span class="rep-qty">${r.qty}</span></td>
      <td><span class="rep-dest">${r.dest}</span></td>
      <td>
        <div class="rep-user-cell">
          <div class="rep-user-avatar" style="background:${AVATAR_COLORS[r.color]}">${r.avatar}</div>
          <span class="rep-user-name">${r.user}</span>
        </div>
      </td>
      <td><span class="rep-date">${r.date}</span></td>
      <td><span class="rep-amount">$${r.amount.toLocaleString('en-US', { minimumFractionDigits: 2 })}</span></td>
    </tr>
  `).join('');

  const btn = document.getElementById('viewMoreBtn');
  btn.style.display = visibleRows >= data.length ? 'none' : 'block';
}

// ─── Controls ────────────────────────────────────────────────────
function applyFilters() { visibleRows = 3; renderKPIs(); renderTable(); }

function loadMore(e) {
  e.preventDefault();
  visibleRows += 3;
  renderTable();
}

const FILTERS = [null, 'alto', 'bajo'];
let filterIdx = 0;

function cycleFilter() {
  filterIdx   = (filterIdx + 1) % FILTERS.length;
  activeFilter = FILTERS[filterIdx];
  visibleRows  = 3;
  renderTable();

  const btn = document.querySelector('.rep-icon-btn');
  btn.style.background = activeFilter ? 'var(--green-light)' : '';
  btn.querySelector('svg').style.stroke = activeFilter ? 'var(--green)' : '';
}

function refresh() {
  const btn = document.querySelectorAll('.rep-icon-btn')[1];
  btn.style.opacity = '.5';
  btn.style.pointerEvents = 'none';
  setTimeout(() => {
    btn.style.opacity = '';
    btn.style.pointerEvents = '';
    renderKPIs();
    renderTable();
  }, 600);
}

// ─── Date range picker (simple toggle) ───────────────────────────
const DATE_RANGES = [
  'Oct 01, 2023 - Oct 31, 2023',
  'Sep 01, 2023 - Sep 30, 2023',
  'Ago 01, 2023 - Ago 31, 2023',
  'Jul 01, 2023 - Jul 31, 2023',
];
let dateIdx = 0;

function toggleDateMenu() {
  dateIdx = (dateIdx + 1) % DATE_RANGES.length;
  document.getElementById('dateLabel').textContent = DATE_RANGES[dateIdx];
  applyFilters();
}

// ─── Export PDF ──────────────────────────────────────────────────
function exportarPDF() {
  const btn = document.querySelector('.rep-export-btn');
  const orig = btn.innerHTML;
  btn.innerHTML = `<svg viewBox="0 0 24 24" style="animation:spin .7s linear infinite"><polyline points="23 4 23 10 17 10"/><path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10" fill="none" stroke="#fff" stroke-width="2" stroke-linecap="round"/></svg> Generando...`;
  btn.disabled = true;

  setTimeout(() => {
    btn.innerHTML = orig;
    btn.disabled  = false;
    window.print();
  }, 1200);
}

// ─── Init ────────────────────────────────────────────────────────
const style = document.createElement('style');
style.textContent = '@keyframes spin { to { transform: rotate(360deg); } }';
document.head.appendChild(style);

renderKPIs();
renderTable();

// Update nav links across all pages when Reportes is active
document.querySelectorAll('.nav-links a').forEach(a => {
  if (a.href.includes('reportes')) a.classList.add('active');
});
