// ═══════════════════════════════════════════════════════════════
//  nav.js — Campanita de alertas compartida en todas las páginas
//  Requiere: data.js cargado antes
// ═══════════════════════════════════════════════════════════════

(function () {
  function initNav() {
    const bell = document.querySelector('.notif-btn');
    if (!bell) return;

    // ── Badge de conteo ──────────────────────────────────────────
    const count = getTotalAlertCount();
    const dot   = bell.querySelector('.notif-dot');
    if (dot && count > 0) {
      dot.textContent    = count > 9 ? '9+' : count;
      dot.style.cssText  = `
        width: auto; min-width: 16px; height: 16px;
        padding: 0 3px; border-radius: 99px;
        font-size: 9px; font-weight: 800; line-height: 16px;
        text-align: center; display: flex; align-items: center; justify-content: center;
      `;
    }

    // ── Inyectar dropdown ────────────────────────────────────────
    if (!document.getElementById('notifDropdown')) {
      const dropdown = document.createElement('div');
      dropdown.id        = 'notifDropdown';
      dropdown.className = 'notif-dropdown';
      dropdown.innerHTML = buildDropdownHTML();
      bell.appendChild(dropdown);
    }

    // ── Toggle ───────────────────────────────────────────────────
    bell.addEventListener('click', function (e) {
      e.stopPropagation();
      const dd = document.getElementById('notifDropdown');
      dd.classList.toggle('open');
    });

    document.addEventListener('click', function () {
      const dd = document.getElementById('notifDropdown');
      if (dd) dd.classList.remove('open');
    });
  }

  function buildDropdownHTML() {
    const alerts = getAlerts();
    const total  = getTotalAlertCount();

    if (total === 0) {
      return `
        <div class="notif-header">
          <span class="notif-title">Alertas de Stock</span>
        </div>
        <div class="notif-empty">
          <svg viewBox="0 0 24 24"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>
          <p>Sin alertas activas</p>
        </div>`;
    }

    let html = `
      <div class="notif-header">
        <span class="notif-title">Alertas de Stock</span>
        <span class="notif-count-label">${total} alerta${total > 1 ? 's' : ''}</span>
      </div>
      <div class="notif-body">`;

    if (alerts.critico.length) {
      html += `<div class="notif-section-label notif-label-critico">Crítico (${alerts.critico.length})</div>`;
      alerts.critico.forEach(p => {
        html += alertItem(p, 'critico');
      });
    }

    if (alerts.bajoStock.length) {
      html += `<div class="notif-section-label notif-label-bajo">Bajo Stock (${alerts.bajoStock.length})</div>`;
      alerts.bajoStock.forEach(p => {
        html += alertItem(p, 'bajo');
      });
    }

    if (alerts.sinStock.length) {
      html += `<div class="notif-section-label notif-label-sinstock">Sin Stock (${alerts.sinStock.length})</div>`;
      alerts.sinStock.forEach(p => {
        html += alertItem(p, 'sinstock');
      });
    }

    html += `</div>
      <a href="inventory.html" class="notif-footer">Ver inventario completo →</a>`;

    return html;
  }

  function alertItem(p, type) {
    const icon = { critico: '⚠', bajo: 'ℹ', sinstock: '✕' }[type] || '•';
    return `
      <div class="notif-item notif-item-${type}">
        <span class="notif-item-icon">${icon}</span>
        <div class="notif-item-body">
          <div class="notif-item-name">${p.name}</div>
          <div class="notif-item-detail">${p.stock} unidades · Mín. ${p.min}</div>
        </div>
        <a href="inventory.html?filter=${encodeURIComponent(p.status)}" class="notif-item-ver">Ver</a>
      </div>`;
  }

  // Scripts al final del body: DOM ya está listo
  initNav();
})();
