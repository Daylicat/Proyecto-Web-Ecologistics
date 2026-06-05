const AVATAR_COLORS = ['#667eea', '#2DBE6C', '#F59E0B', '#EF4444', '#3B82F6', '#8B5CF6'];

let MOVEMENTS = [];
let visibleRows = 3;
let activeFilter = null;

let KPI_DATA = {
  salidas:   { salidas: { val: '0' }, items: { val: '0' }, valor: { val: '$0.00' }, usuarios: { val: '1', note: 'Personal de Almacén' } },
  entradas:  { salidas: { val: '0' }, items: { val: '0' }, valor: { val: '$0.00' }, usuarios: { val: '1', note: 'Personal de Almacén' } },
  auditoria: { salidas: { val: '0' }, items: { val: '0' }, valor: { val: '$0.00' }, usuarios: { val: '1', note: 'Personal de Almacén' } },
  usuarios:  { salidas: { val: '1' }, items: { val: '0' }, valor: { val: '$0.00' }, usuarios: { val: '1', note: 'Activos este mes' } },
};

function cargarDatosDesdeSupabase() {
  peticionAPI('Producto', 'GET').then(productos => {
    if (!productos || productos.length === 0) {
      MOVEMENTS = [];
      calcularKPIs(0, 0);
      renderKPIs();
      renderTable();
      return;
    }

    peticionAPI('DetalleSalida', 'GET').then(detalles => {
      const historial = detalles || [];
      
      if (historial.length === 0) {
        let totalStockGlobal = 0;
        let valorTotalInventario = 0;

        MOVEMENTS = productos.map((p, idx) => {
          const stock = p.stockActual || 0;
          const valorUnitario = p.valor || 25.00; 
          const montoEstimado = stock * valorUnitario;

          totalStockGlobal += stock;
          valorTotalInventario += montoEstimado;

          return {
            product: p.nombreProducto || 'Producto sin nombre',
            sku: p.sku || 'S/N',
            qty: `x${stock}`,
            dest: 'Inventario Base (Auditoría)',
            user: 'Alejandro T.',
            avatar: 'AT',
            color: idx % AVATAR_COLORS.length,
            date: new Date().toLocaleDateString('es-MX', { month: 'short', day: 'numeric', year: 'numeric' }),
            amount: montoEstimado
          };
        });

        calcularKPIs(totalStockGlobal, valorTotalInventario);
      } else {
        let totalItemsMovidos = 0;
        let valorTotalMovimientos = 0;

        MOVEMENTS = historial.map((d, idx) => {
          const prodRelacionado = productos.find(p => p.idProducto === d.idProducto) || {};
          const cantidad = d.cantidad || 0;
          const precio = prodRelacionado.valor || 0;
          const subtotal = cantidad * precio;

          totalItemsMovidos += cantidad;
          valorTotalMovimientos += subtotal;

          return {
            product: prodRelacionado.nombreProducto || 'Producto Eliminado',
            sku: prodRelacionado.sku || 'S/N',
            qty: `x${cantidad}`,
            dest: 'Despacho POS',
            user: 'Alejandro T.',
            avatar: 'AT',
            color: idx % AVATAR_COLORS.length,
            date: new Date().toLocaleDateString('es-MX', { month: 'short', day: 'numeric', year: 'numeric' }),
            amount: subtotal
          };
        });

        KPI_DATA.salidas.salidas.val = String(historial.length);
        KPI_DATA.salidas.items.val = String(totalItemsMovidos);
        KPI_DATA.salidas.valor.val = `$${valorTotalMovimientos.toLocaleString('en-US', { minimumFractionDigits: 2 })}`;
        
        KPI_DATA.auditoria = { ...KPI_DATA.salidas };
      }

      renderKPIs();
      renderTable();
    });
  });
}

function calcularKPIs(totalStock, valorInventario) {
  const formateado = `$${valorInventario.toLocaleString('en-US', { minimumFractionDigits: 2 })}`;
  
  KPI_DATA.auditoria.salidas.val = String(MOVEMENTS.length);
  KPI_DATA.auditoria.items.val = String(totalStock);
  KPI_DATA.auditoria.valor.val = formateado;

  KPI_DATA.salidas = { ...KPI_DATA.auditoria };
  KPI_DATA.entradas = { ...KPI_DATA.auditoria };
  KPI_DATA.usuarios.items.val = String(totalStock);
  KPI_DATA.usuarios.valor.val = formateado;
}

function renderKPIs() {
  const type = document.getElementById('reportType').value;
  const d = KPI_DATA[type] || KPI_DATA.salidas;

  const kpis = [
    { label: 'Total Salidas',    val: d.salidas.val,   trend: d.salidas.trend,  up: d.salidas.up  },
    { label: 'Items Movidos',    val: d.items.val,     trend: d.items.trend,    up: d.items.up    },
    { label: 'Valor de Salidas', val: d.valor.val,     trend: d.valor.trend,    up: d.valor.up    },
    { label: 'Usuarios Activos', val: d.usuarios.val, note: d.usuarios.note },
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

function applyFilters() { visibleRows = 3; renderKPIs(); renderTable(); }
// Corregido error sintáctico previo del botón ver más
function loadMore(e) { e.preventDefault(); visibleRows += 3; renderTable(); }

const FILTERS = [null, 'alto', 'bajo'];
let filterIdx = 0;

function cycleFilter() {
  filterIdx = (filterIdx + 1) % FILTERS.length;
  activeFilter = FILTERS[filterIdx];
  visibleRows = 3;
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
    cargarDatosDesdeSupabase();
  }, 600);
}

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

function escapeHtml(str) {
  if (!str) return '';
  return str.replace(/[&<>]/g, function(m) {
    if (m === '&') return '&amp;';
    if (m === '<') return '&lt;';
    if (m === '>') return '&gt;';
    return m;
  });
}

function exportarPDF() {
  const btn = document.querySelector('.rep-export-btn');
  const originalText = btn.innerHTML;
  btn.innerHTML = `<svg viewBox="0 0 24 24" style="animation:spin .7s linear infinite"><polyline points="23 4 23 10 17 10"/><path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10" fill="none" stroke="#fff" stroke-width="2" stroke-linecap="round"/></svg> Generando PDF...`;
  btn.disabled = true;

  let allData = [...MOVEMENTS];
  if (activeFilter === 'alto') allData = allData.filter(r => r.amount >= 1000);
  if (activeFilter === 'bajo') allData = allData.filter(r => r.amount < 500);

  const reportType = document.getElementById('reportType').value;
  const typeName = {
    'salidas': 'Salidas de Almacén',
    'entradas': 'Entradas de Stock',
    'auditoria': 'Auditoría Completa',
    'usuarios': 'Por Usuario'
  }[reportType] || 'Reporte';
  
  const dateLabel = document.getElementById('dateLabel').textContent;
  const kpiData = KPI_DATA[reportType] || KPI_DATA.salidas;
  const totalAmount = allData.reduce((sum, r) => sum + r.amount, 0);

  const pdfContent = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="UTF-8">
      <title>Reporte EcoLogistics - ${typeName}</title>
      <style>
        * { margin:0; padding:0; box-sizing:border-box; }
        body {
          font-family: 'DM Sans', 'Helvetica Neue', Arial, sans-serif;
          padding: 20px 25px;
          color: #0F172A;
          background: white;
          font-size: 12px;
        }
        .report-header {
          margin-bottom: 25px;
          border-bottom: 2px solid #2DBE6C;
          padding-bottom: 12px;
        }
        .report-title { font-size: 22px; font-weight: 700; color: #0F172A; margin-bottom: 4px; }
        .report-sub { font-size: 12px; color: #64748B; margin-top: 3px; }
        .report-date { font-size: 11px; color: #94A3B8; margin-top: 3px; }
        
        .kpi-grid {
          display: grid;
          grid-template-columns: repeat(4, 1fr);
          gap: 12px;
          margin-bottom: 25px;
        }
        .kpi-card {
          border: 1px solid #E2E8F0;
          border-radius: 10px;
          padding: 14px 16px;
          background: #FFFFFF;
        }
        .kpi-label { font-size: 9px; font-weight: 700; text-transform: uppercase; color: #64748B; margin-bottom: 6px; }
        .kpi-value { font-size: 24px; font-weight: 700; font-family: monospace; color: #0F172A; }
        .kpi-note { font-size: 10px; color: #64748B; margin-top: 4px; }
        
        .section-title { font-size: 13px; font-weight: 700; margin: 18px 0 12px 0; }
        
        table {
          width: 100%;
          border-collapse: collapse;
          table-layout: fixed;
        }
        th {
          text-align: left;
          font-size: 9px;
          font-weight: 700;
          text-transform: uppercase;
          color: #64748B;
          padding: 8px 10px;
          border-bottom: 1px solid #E2E8F0;
          background: #F8FAFC;
        }
        td {
          padding: 10px 10px;
          border-bottom: 1px solid #E2E8F0;
          font-size: 11px;
          vertical-align: middle;
          word-wrap: break-word;
        }
        th:nth-child(1), td:nth-child(1) { width: 22%; }
        th:nth-child(2), td:nth-child(2) { width: 10%; }
        th:nth-child(3), td:nth-child(3) { width: 20%; }
        th:nth-child(4), td:nth-child(4) { width: 12%; }
        th:nth-child(5), td:nth-child(5) { width: 20%; }
        th:nth-child(6), td:nth-child(6) { width: 16%; text-align: right; }
        
        .prod-name { font-size: 12px; font-weight: 700; color: #0F172A; }
        .prod-sku { font-size: 9px; color: #64748B; font-family: monospace; margin-top: 2px; }
        .rep-qty { font-size: 12px; font-weight: 700; font-family: monospace; }
        .rep-dest { font-size: 11px; color: #64748B; }
        .rep-user-name { font-size: 11px; color: #64748B; }
        .rep-date { font-size: 10px; color: #64748B; font-family: monospace; }
        .rep-amount { font-size: 12px; font-weight: 700; font-family: monospace; text-align: right; }
        
        .total-row { background: #F8FAFC; }
        .total-row td { border-top: 2px solid #E2E8F0; padding: 10px 10px; }
        .total-label { text-align: right; font-size: 12px; font-weight: 700; }
        .total-amount { font-size: 13px; font-weight: 700; color: #2DBE6C; font-family: monospace; text-align: right; }
        
        .footer { margin-top: 25px; font-size: 9px; color: #94A3B8; text-align: center; border-top: 1px solid #E2E8F0; padding-top: 12px; }
      </style>
    </head>
    <body>
      <div class="report-header">
        <div class="report-title">EcoLogistics — ${typeName}</div>
        <div class="report-sub">Historial detallado de movimientos y auditoría de stock</div>
        <div class="report-date">Período: ${dateLabel} | Generado: ${new Date().toLocaleString()}</div>
      </div>

      <div class="kpi-grid">
        <div class="kpi-card"><div class="kpi-label">Total Salidas</div><div class="kpi-value">${kpiData.salidas.val}</div></div>
        <div class="kpi-card"><div class="kpi-label">Ítems Movidos</div><div class="kpi-value">${kpiData.items.val}</div></div>
        <div class="kpi-card"><div class="kpi-label">Valor de Salidas</div><div class="kpi-value">${kpiData.valor.val}</div></div>
        <div class="kpi-card"><div class="kpi-label">Usuarios Activos</div><div class="kpi-value">${kpiData.usuarios.val}</div><div class="kpi-note">${kpiData.usuarios.note || ''}</div></div>
      </div>

      <div class="section-title"> Detalle de Movimientos (${allData.length} registros)</div>
      <table>
        <thead>
          <tr><th>Producto</th><th>Cantidad</th><th>Destino / Proyecto</th><th>Usuario</th><th>Fecha y Hora</th><th style="text-align:right">Monto Estimado</th></tr>
        </thead>
        <tbody>
          ${allData.map(r => `
            <tr>
              <td><div class="prod-name">${escapeHtml(r.product)}</div><div class="prod-sku">SKU: ${escapeHtml(r.sku)}</div></td>
              <td><span class="rep-qty">${escapeHtml(r.qty)}</span></td>
              <td><span class="rep-dest">${escapeHtml(r.dest)}</span></td>
              <td><span class="rep-user-name">${escapeHtml(r.user)}</span></td>
              <td><span class="rep-date">${escapeHtml(r.date)}</span></td>
              <td class="rep-amount">$${r.amount.toLocaleString('en-US', { minimumFractionDigits: 2 })}</td>
            </tr>
          `).join('')}
        </tbody>
        <tfoot>
          <tr class="total-row"><td colspan="5" class="total-label">TOTAL GENERAL:</td><td class="total-amount">$${totalAmount.toLocaleString('en-US', { minimumFractionDigits: 2 })}</td></tr>
        </tfoot>
      </table>
      <div class="footer">Reporte generado automáticamente por EcoLogistics — Sistema de Gestión de Inventario<br>Documento válido como constancia de movimientos de almacén</div>
    </body>
    </html>
  `;

  const iframe = document.createElement('iframe');
  iframe.style.position = 'absolute';
  iframe.style.width = '0';
  iframe.style.height = '0';
  iframe.style.border = 'none';
  document.body.appendChild(iframe);

  iframe.contentWindow.document.open();
  iframe.contentWindow.document.write(pdfContent);
  iframe.contentWindow.document.close();

  const opt = {
    margin: [0.4, 0.4, 0.4, 0.4],
    filename: `reporte_${reportType}_${new Date().toISOString().slice(0, 19).replace(/:/g, '-')}.pdf`,
    image: { type: 'jpeg', quality: 0.98 },
    html2canvas: { scale: 2, useCORS: false, letterRendering: true, logging: false },
    jsPDF: { unit: 'in', format: 'a4', orientation: 'landscape' }
  };

  html2pdf().set(opt).from(iframe.contentWindow.document.body).save()
    .then(() => {
      document.body.removeChild(iframe);
      btn.innerHTML = originalText;
      btn.disabled = false;
    })
    .catch(err => {
      console.error('Error al generar PDF:', err);
      document.body.removeChild(iframe);
      btn.innerHTML = originalText;
      btn.disabled = false;
      alert('Hubo un error al generar el PDF. Intenta nuevamente.');
    });
}

const style = document.createElement('style');
style.textContent = '@keyframes spin { to { transform: rotate(360deg); } }';
document.head.appendChild(style);

document.querySelectorAll('.nav-links a').forEach(a => {
  if (a.href.includes('reportes')) a.classList.add('active');
});

// Inicialización del flujo asíncrono hacia Supabase al cargar la pantalla
cargarDatosDesdeSupabase();