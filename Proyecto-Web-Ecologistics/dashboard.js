
(function () {

  // Alertas dinámicas 
  function renderAlertas() {
    const alerts = getAlerts();

    // Alerta crítica principal 1
    const criticos = alerts.critico;
    const alertaCriticaEl = document.getElementById('alertaCritica');

    if (criticos.length > 0 && alertaCriticaEl) {
      const p = criticos[0];
      const pct = Math.round((p.stock / p.min) * 100);
      alertaCriticaEl.innerHTML = `
        <div class="alert-critical">
          <div class="alert-critical-icon">
            <svg viewBox="0 0 24 24" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/>
              <line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/>
            </svg>
          </div>
          <div class="alert-body">
            <div class="alert-badge">
              Crítico
              <span class="alert-badge-time">Actualizado hace 12 min</span>
            </div>
            <div class="alert-title">Agotamiento de Stock: ${p.name}</div>
            <div class="alert-desc">
              El stock actual ha caído a <strong>${p.stock} unidades</strong>.
              El umbral mínimo es de ${p.min} unidades. Las operaciones podrían verse afectadas en menos de 24 horas.
            </div>
          </div>
          <div class="alert-bg-icon">
            <svg viewBox="0 0 24 24" stroke-width="1" stroke-linecap="round" stroke-linejoin="round">
              <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/>
            </svg>
          </div>
        </div>`;
    }

    // Warnings (
    const warnings = [...alerts.bajoStock, ...alerts.sinStock].slice(0, 2);
    const warningsEl = document.getElementById('alertasWarning');
    if (warningsEl && warnings.length > 0) {
      warningsEl.innerHTML = warnings.map(p => `
        <div class="alert-warning">
          <svg viewBox="0 0 24 24" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/>
          </svg>
          <div>
            <div class="warn-label">${p.status === 'sin stock' ? 'Sin Stock' : 'Advertencia'}</div>
            <div class="warn-text">${p.name}: ${p.stock} unidades</div>
          </div>
          <a href="inventory.html?filter=${encodeURIComponent(p.status)}" class="warn-link">Ver</a>
        </div>`).join('');
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', renderAlertas);
  } else {
    renderAlertas();
  }

})();
