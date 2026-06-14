// ─── nav.js — Navegación + notificaciones de stock ───────────────────────────
(function () {
  'use strict';

  // Evitar duplicar el listener del bell en llamadas múltiples a initNav
  var _bellListenerAttached = false;

  async function initNav(productos) {
    // renderNav y initLogout son async — await obligatorio
    if (window.EcoAuth) {
      await EcoAuth.renderNav();
      EcoAuth.initLogout();
    }

    var bell = document.querySelector('.notif-btn');
    if (!bell || !productos) return;

    var alerts = getAlerts(productos);
    var total  = getTotalAlertCount(productos);
    var dot    = bell.querySelector('.notif-dot');

    if (dot) {
      if (total > 0) {
        dot.textContent   = total > 9 ? '9+' : String(total);
        dot.style.cssText = 'width:auto;min-width:16px;height:16px;padding:0 3px;border-radius:99px;'
          + 'font-size:9px;font-weight:800;line-height:16px;text-align:center;'
          + 'display:flex;align-items:center;justify-content:center;';
      } else {
        dot.textContent = '';
        dot.style.cssText = '';
      }
    }

    // Recrear dropdown
    var old = document.getElementById('notifDropdown');
    if (old) old.remove();
    var dd = document.createElement('div');
    dd.id        = 'notifDropdown';
    dd.className = 'notif-dropdown';
    dd.innerHTML = buildHTML(alerts, total);
    bell.appendChild(dd);

    // Adjuntar listener solo una vez
    if (!_bellListenerAttached) {
      bell.addEventListener('click', function (e) {
        e.stopPropagation();
        var el = document.getElementById('notifDropdown');
        if (el) el.classList.toggle('open');
      });
      document.addEventListener('click', function () {
        var el = document.getElementById('notifDropdown');
        if (el) el.classList.remove('open');
      });
      _bellListenerAttached = true;
    }
  }

  function buildHTML(alerts, total) {
    if (total === 0) {
      return '<div class="notif-header"><span class="notif-title">Alertas de Stock</span></div>'
        + '<div class="notif-empty">'
        + '<svg viewBox="0 0 24 24"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>'
        + '<p>Sin alertas activas</p></div>';
    }
    var html = '<div class="notif-header">'
      + '<span class="notif-title">Alertas de Stock</span>'
      + '<span class="notif-count-label">' + total + ' alerta' + (total > 1 ? 's' : '') + '</span>'
      + '</div><div class="notif-body">';

    if (alerts.critico.length) {
      html += '<div class="notif-section-label notif-label-critico">Crítico (' + alerts.critico.length + ')</div>';
      alerts.critico.forEach(function (p) { html += item(p, 'critico'); });
    }
    if (alerts.bajoStock.length) {
      html += '<div class="notif-section-label notif-label-bajo">Bajo Stock (' + alerts.bajoStock.length + ')</div>';
      alerts.bajoStock.forEach(function (p) { html += item(p, 'bajo'); });
    }
    if (alerts.sinStock.length) {
      html += '<div class="notif-section-label notif-label-sinstock">Sin Stock (' + alerts.sinStock.length + ')</div>';
      alerts.sinStock.forEach(function (p) { html += item(p, 'sinstock'); });
    }
    html += '</div><a href="inventory.html" class="notif-footer">Ver inventario completo →</a>';
    return html;
  }

  function item(p, type) {
    var icons  = { critico: '⚠', bajo: 'ℹ', sinstock: '✕' };
    var filter = { critico: 'critico', bajo: 'bajo stock', sinstock: 'sin stock' }[type];
    var stock  = p.stockActual !== undefined ? p.stockActual : p.stock;
    var min    = p.stockMinimo !== undefined ? p.stockMinimo : p.min;
    return '<div class="notif-item notif-item-' + type + '">'
      + '<span class="notif-item-icon">' + (icons[type] || '•') + '</span>'
      + '<div class="notif-item-body">'
      + '<div class="notif-item-name">' + (p.nombreProducto || p.name || '') + '</div>'
      + '<div class="notif-item-detail">' + stock + ' uds · Mín. ' + min + '</div>'
      + '</div>'
      + '<a href="inventory.html?filter=' + encodeURIComponent(filter) + '" class="notif-item-ver">Ver</a>'
      + '</div>';
  }

  window.initNav = initNav;
})();
