// ─── pos.js — Salida de Materiales POS ───────────────────────────────────────
(function () {
  'use strict';

  // ══════════════════════════════════════════════════════════════════════════
  //  ESTADO
  // ══════════════════════════════════════════════════════════════════════════
  var POS_CATALOG  = {};   // sku → {idProducto, name, category, stock, price, icon, sku}
  var items        = {};   // sku → {…catalog, qty}
  var _sesion      = null; // sesión real de Supabase Auth
  var _debounce    = null;
  var _sbClient    = null;

  var ICONS = {
    battery: '<svg viewBox="0 0 24 24"><rect x="1" y="6" width="18" height="12" rx="2"/><line x1="23" y1="13" x2="23" y2="11"/></svg>',
    plug:    '<svg viewBox="0 0 24 24"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/><polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/></svg>',
    bolt:    '<svg viewBox="0 0 24 24"><polyline points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/></svg>',
    sun:     '<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="5"/><line x1="12" y1="1" x2="12" y2="3"/><line x1="12" y1="21" x2="12" y2="23"/></svg>',
    panel:   '<svg viewBox="0 0 24 24"><rect x="2" y="3" width="20" height="14" rx="2"/><line x1="8" y1="21" x2="16" y2="21"/><line x1="12" y1="17" x2="12" y2="21"/></svg>',
    tool:    '<svg viewBox="0 0 24 24"><path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z"/></svg>'
  };

  function san(str) {
    return String(str || '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
  }

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

  // ══════════════════════════════════════════════════════════════════════════
  //  INICIALIZACIÓN
  // ══════════════════════════════════════════════════════════════════════════
  async function initPOS() {
    // Sesión real — await correcto
    _sesion = await EcoAuth.getSession();
    var nameEl = document.getElementById('posUserName');
    if (nameEl && _sesion) nameEl.textContent = _sesion.nombre || 'Usuario';

    var raw      = (await Promise.all([apiGetProductos(), cargarCategoriasCache()]))[0];
    var productos = enriquecerProductos(raw || []);
    initNav(productos);

    POS_CATALOG = {};
    productos.forEach(function (p) {
      // precio: intentar 'valor', luego 'precio_unitario', luego 'price' como fallback
      var precio = Number(p.valor) || Number(p.precio_unitario) || Number(p.price) || 0;
      POS_CATALOG[p.sku] = {
        idProducto: p.idProducto,
        name:       p.nombreProducto,
        category:   p.category,
        stock:      Number(p.stockActual) || 0,
        price:      precio,
        icon:       p.icon,
        sku:        p.sku
      };
    });

    render();

    var scanEl = document.getElementById('scanInput');
    if (scanEl) {
      scanEl.focus();
      scanEl.addEventListener('input',   onScanInput);
      scanEl.addEventListener('keydown', handleScanKey);
    }

    // Cerrar dropdown al click fuera
    document.addEventListener('click', function (e) {
      if (!e.target.closest('.pos-scan-wrap')) cerrarDropdown();
    });

    suscribirRealtime();
  }

  // ══════════════════════════════════════════════════════════════════════════
  //  BUSCADOR CON AUTOCOMPLETADO EN TIEMPO REAL
  // ══════════════════════════════════════════════════════════════════════════
  function onScanInput() {
    clearTimeout(_debounce);
    _debounce = setTimeout(mostrarSugerencias, 180);
  }

  function mostrarSugerencias() {
    var input = document.getElementById('scanInput');
    var raw   = (input.value || '').trim().toUpperCase();

    cerrarDropdown();
    if (!raw || raw.length < 1) return;

    var resultados = Object.keys(POS_CATALOG).filter(function (sku) {
      var p = POS_CATALOG[sku];
      return sku.includes(raw)
        || (p.name || '').toUpperCase().includes(raw)
        || (p.category || '').toUpperCase().includes(raw);
    }).slice(0, 8);

    if (resultados.length === 0) return;

    var dd = document.createElement('div');
    dd.id        = 'posDropdown';
    dd.className = 'pos-dropdown';
    dd.style.cssText = 'position:absolute;top:100%;left:0;right:0;background:var(--white);'
      + 'border:1px solid var(--border);border-top:none;border-radius:0 0 10px 10px;'
      + 'box-shadow:0 8px 24px rgba(0,0,0,.08);z-index:50;overflow:hidden;';

    dd.innerHTML = resultados.map(function (sku) {
      var p          = POS_CATALOG[sku];
      var stockColor = p.stock === 0 ? 'var(--red)' : p.stock < 5 ? 'var(--yellow)' : 'var(--green)';
      return '<div class="pos-dd-item" data-sku="' + san(sku) + '"'
        + ' style="display:flex;align-items:center;gap:12px;padding:10px 16px;cursor:pointer;transition:background .1s;"'
        + ' onmouseenter="this.style.background=\'var(--bg)\'" onmouseleave="this.style.background=\'\'">'
        + '<div style="flex:1;min-width:0">'
        + '<div style="font-size:13px;font-weight:600;color:var(--text)">' + san(p.name) + '</div>'
        + '<div style="font-size:11px;color:var(--slate-light);font-family:\'DM Mono\',monospace">SKU: ' + san(sku)
        + ' · ' + san(p.category) + '</div>'
        + '</div>'
        + '<div style="text-align:right;flex-shrink:0">'
        + '<div style="font-size:12px;font-weight:700;color:' + stockColor + '">' + p.stock + ' disp.</div>'
        + '<div style="font-size:11px;color:var(--slate);font-family:\'DM Mono\',monospace">$' + (p.price || 0).toFixed(2) + '</div>'
        + '</div></div>';
    }).join('');

    dd.querySelectorAll('.pos-dd-item').forEach(function (el) {
      el.addEventListener('click', function () {
        agregarProducto(el.dataset.sku);
        cerrarDropdown();
        var scanEl = document.getElementById('scanInput');
        scanEl.value = '';
        scanEl.focus();
      });
    });

    var wrap = document.querySelector('.pos-scan-wrap');
    if (wrap) {
      wrap.style.position = 'relative';
      wrap.appendChild(dd);
    }
  }

  function cerrarDropdown() {
    var dd = document.getElementById('posDropdown');
    if (dd && dd.parentNode) dd.parentNode.removeChild(dd);
  }

  // ══════════════════════════════════════════════════════════════════════════
  //  AGREGAR PRODUCTO AL CARRITO
  // ══════════════════════════════════════════════════════════════════════════
  function agregarProducto(sku) {
    if (!sku || !POS_CATALOG[sku]) {
      flashScan('#FFF5F5', '#E53935');
      return;
    }
    if (items[sku]) {
      items[sku].qty++;
    } else {
      items[sku] = Object.assign({}, POS_CATALOG[sku], { qty: 1 });
    }
    render();
    flashScan('#DCFCE7', '#2DBE6C');
  }

  // ── Agregar desde input (Enter / botón ENTER) ─────────────────────────────
  function addFromInput() {
    cerrarDropdown();
    var input = document.getElementById('scanInput');
    var raw   = (input.value || '').trim().toUpperCase().replace(/^#/, '');
    if (!raw) return;

    // Buscar por SKU exacto primero, luego por coincidencia parcial
    var sku = POS_CATALOG[raw]
      ? raw
      : Object.keys(POS_CATALOG).find(function (k) {
          var p = POS_CATALOG[k];
          return k.includes(raw) || (p.name || '').toUpperCase().includes(raw);
        });

    input.value = '';
    agregarProducto(sku || null);
  }
  window.addFromInput = addFromInput;

  // ── Decodificar QR (formato SKU:xxx|NAME:xxx) ─────────────────────────────
  function parsearQR(texto) {
    if (!texto) return null;
    // Formato: SKU:ECO-001|NAME:Cable HDMI
    var matchSku = texto.match(/SKU:([^|]+)/i);
    if (matchSku) return matchSku[1].trim().toUpperCase();
    // Fallback: el texto completo podría ser el SKU directo
    return texto.trim().toUpperCase();
  }

  function handleScanKey(e) {
    if (e.key === 'Enter') {
      cerrarDropdown();
      // Intentar parsear como QR antes de búsqueda directa
      var raw = (document.getElementById('scanInput').value || '').trim();
      var sku = parsearQR(raw);
      if (sku && POS_CATALOG[sku]) {
        agregarProducto(sku);
        document.getElementById('scanInput').value = '';
      } else {
        addFromInput();
      }
    }
    if (e.key === 'Escape') cerrarDropdown();
    if (e.key === 'ArrowDown') {
      var primero = document.querySelector('.pos-dd-item');
      if (primero) { primero.focus(); e.preventDefault(); }
    }
  }

  function flashScan(bg, border) {
    var wrap = document.querySelector('.pos-scan-wrap');
    if (!wrap) return;
    wrap.style.background  = bg;
    wrap.style.borderColor = border;
    setTimeout(function () {
      wrap.style.background  = '';
      wrap.style.borderColor = 'var(--green)';
    }, 500);
  }

  // ══════════════════════════════════════════════════════════════════════════
  //  RENDER CARRITO
  // ══════════════════════════════════════════════════════════════════════════
  function render() {
    var list = document.getElementById('itemsList');
    var keys = Object.keys(items);

    if (keys.length === 0) {
      list.innerHTML = '<div class="pos-empty">'
        + '<svg viewBox="0 0 24 24"><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/></svg>'
        + '<p>El carrito está vacío. Escanea o ingresa un código para agregar productos.</p></div>';
    } else {
      list.innerHTML = keys.map(function (sku, i) {
        var it  = items[sku];
        var sub = ((it.qty || 0) * (it.price || 0)).toFixed(2);
        var over = it.qty > it.stock;
        return '<div class="pos-item" style="animation-delay:' + (i * 0.04) + 's">'
          + '<div class="pos-item-icon">' + (ICONS[it.icon] || ICONS.tool) + '</div>'
          + '<div class="pos-item-info">'
          + '<div class="pos-item-name">' + san(it.name) + '</div>'
          + '<div class="pos-item-sku">SKU: ' + san(sku) + ' · $' + (it.price || 0).toFixed(2) + ' MXN c/u</div>'
          + '</div>'
          + '<div class="pos-item-qty-wrap">'
          + '<button class="pos-qty-btn" data-sku="' + san(sku) + '" data-delta="-1">−</button>'
          + '<input class="pos-qty-input" type="number" min="1" value="' + it.qty + '" data-sku="' + san(sku) + '"'
          + (over ? ' style="border-color:var(--red);color:var(--red)"' : '') + '>'
          + '<button class="pos-qty-btn" data-sku="' + san(sku) + '" data-delta="1">+</button>'
          + '</div>'
          + '<div style="font-size:12px;font-weight:700;color:' + (over ? 'var(--red)' : 'var(--slate)')
          + ';font-family:\'DM Mono\',monospace;min-width:80px;text-align:right">$' + sub + ' MXN</div>'
          + '<button class="pos-delete-btn" data-sku="' + san(sku) + '" title="Eliminar">'
          + '<svg viewBox="0 0 24 24"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/>'
          + '<path d="M10 11v6"/><path d="M14 11v6"/><path d="M9 6V4h6v2"/></svg>'
          + '</button></div>';
      }).join('');

      // Event delegation en la lista
      list.querySelectorAll('.pos-qty-btn').forEach(function (btn) {
        btn.addEventListener('click', function () {
          var sku   = btn.dataset.sku;
          var delta = parseInt(btn.dataset.delta, 10);
          if (items[sku]) { items[sku].qty = Math.max(1, items[sku].qty + delta); render(); }
        });
      });
      list.querySelectorAll('.pos-qty-input').forEach(function (inp) {
        inp.addEventListener('change', function () {
          var n = parseInt(inp.value, 10);
          if (!isNaN(n) && n >= 1) { items[inp.dataset.sku].qty = n; render(); }
        });
        inp.addEventListener('click', function () { inp.select(); });
      });
      list.querySelectorAll('.pos-delete-btn').forEach(function (btn) {
        btn.addEventListener('click', function () { delete items[btn.dataset.sku]; render(); });
      });
    }

    updateSummary();
  }

  function updateSummary() {
    var keys       = Object.keys(items);
    var totalUnits = keys.reduce(function (s, k) { return s + (items[k].qty || 0); }, 0);
    var totalCats  = new Set(keys.map(function (k) { return items[k].category; })).size;
    var monto      = keys.reduce(function (s, k) { return s + (items[k].qty || 0) * (items[k].price || 0); }, 0);

    document.getElementById('totalItems').textContent = String(totalUnits).padStart(2, '0');
    document.getElementById('totalCats').textContent  = String(totalCats).padStart(2, '0');
    document.getElementById('montoTotal').textContent = '$' + monto.toLocaleString('es-MX', { minimumFractionDigits: 2 }) + ' MXN';

    var badge      = document.getElementById('stockBadge');
    var confirmBtn = document.getElementById('confirmBtn');
    var status     = 'ok';

    keys.forEach(function (sku) {
      var it = items[sku];
      if (it.qty > it.stock)                                       status = 'critical';
      else if (it.qty / it.stock >= 0.7 && status !== 'critical') status = 'warning';
    });

    badge.className = 'pos-stock-badge';
    if (status === 'ok')       { badge.classList.add('pos-stock-ok');       badge.textContent = 'Suficiente'; }
    if (status === 'warning')  { badge.classList.add('pos-stock-warning');  badge.textContent = 'Bajo Stock'; }
    if (status === 'critical') { badge.classList.add('pos-stock-critical'); badge.textContent = 'Insuficiente'; }

    confirmBtn.disabled = keys.length === 0 || status === 'critical';
  }

  // ══════════════════════════════════════════════════════════════════════════
  //  CONFIRMAR SALIDA — validación de stock en tiempo real + RPC atómica
  // ══════════════════════════════════════════════════════════════════════════
  async function confirmarSalida() {
    var dest = (document.getElementById('destInput').value || '').trim();
    if (!dest) {
      var inp = document.getElementById('destInput');
      inp.style.borderColor = 'var(--red)';
      inp.focus();
      inp.addEventListener('input', function () { inp.style.borderColor = ''; }, { once: true });
      return;
    }

    var keys       = Object.keys(items);
    var confirmBtn = document.getElementById('confirmBtn');
    confirmBtn.disabled    = true;
    confirmBtn.textContent = 'Verificando stock...';

    // ── Validar stock real desde Supabase (no del catálogo cacheado) ──────
    for (var i = 0; i < keys.length; i++) {
      var sku  = keys[i];
      var it   = items[sku];
      var res  = await peticionAPI('Producto', 'GET', null,
                   '?idProducto=eq.' + it.idProducto + '&select=stockActual&limit=1');
      var stockReal = (res && res[0]) ? Number(res[0].stockActual) : 0;

      // Actualizar stock en catálogo y carrito
      POS_CATALOG[sku].stock = stockReal;
      it.stock               = stockReal;

      if (it.qty > stockReal) {
        mostrarErrorPos('Stock insuficiente para "' + it.name + '". '
          + 'Disponible: ' + stockReal + ' uds., solicitado: ' + it.qty + ' uds.');
        confirmBtn.disabled    = false;
        confirmBtn.innerHTML   = '<svg viewBox="0 0 24 24"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>Confirmar Salida';
        render();  // re-renderizar con stock rojo actualizado
        return;
      }
    }

    confirmBtn.textContent = 'Registrando...';

    var notas = (document.getElementById('notasInput').value || '').trim();
    var monto = keys.reduce(function (s, k) {
      return s + (items[k].qty || 0) * (items[k].price || 0);
    }, 0);
    var totalUnits = keys.reduce(function (s, k) { return s + (items[k].qty || 0); }, 0);

    // ── Llamar RPC atómica (registrar_salida del SQL) ─────────────────────
    var sb = getSB();
    var resultado;

    if (sb) {
      var rpcRes = await sb.rpc('registrar_salida', {
        p_proyecto:   dest,
        p_notas:      notas || null,
        p_monto:      monto,
        p_id_persona: _sesion ? (_sesion.userId || 1) : 1,
        p_detalles:   JSON.stringify(keys.map(function (sku) {
          return { idProducto: items[sku].idProducto, cantidad: items[sku].qty };
        }))
      });

      if (rpcRes.error) {
        var msgError = rpcRes.error.message || 'Error al registrar la salida.';
        if (msgError.includes('Stock insuficiente')) {
          mostrarErrorPos('Stock insuficiente para uno o más productos. Operación cancelada.');
        } else {
          mostrarErrorPos('Error: ' + msgError);
        }
        confirmBtn.disabled  = false;
        confirmBtn.innerHTML = '<svg viewBox="0 0 24 24"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>Confirmar Salida';
        return;
      }
      resultado = rpcRes.data;
    } else {
      // Fallback si el SDK no está disponible (no debería ocurrir en producción)
      var salidaObj  = { proyecto: dest, notas: notas, montoTotalEstimado: monto, idPersona: 1 };
      var detallesArr = keys.map(function (sku) {
        return { idProducto: items[sku].idProducto, cantidad: items[sku].qty };
      });
      resultado = await apiCrearSalida(salidaObj, detallesArr);
      if (!resultado) {
        mostrarErrorPos('Error al guardar la salida. Verifica la conexión.');
        confirmBtn.disabled  = false;
        confirmBtn.innerHTML = '<svg viewBox="0 0 24 24"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>Confirmar Salida';
        return;
      }
    }

    ocultarErrorPos();

    // ── Mensaje de éxito ──────────────────────────────────────────────────
    var productStr;
    if (keys.length === 1) {
      var it = items[keys[0]];
      productStr = '<strong>' + it.qty + ' unidad' + (it.qty !== 1 ? 'es' : '')
        + '</strong> de <strong>' + san(it.name) + '</strong>';
    } else {
      var lines = keys.map(function (k) {
        return '• ' + items[k].qty + ' × ' + san(items[k].name);
      }).join('<br>');
      productStr = '<strong>' + totalUnits + ' unidades</strong> en total:<br><br>' + lines;
    }

    document.getElementById('successMsg').innerHTML =
      'Se ha registrado la salida de ' + productStr + '.<br><br>'
      + '<strong>Destino:</strong> ' + san(dest) + '<br>'
      + '<strong>Monto total:</strong> $'
      + monto.toLocaleString('es-MX', { minimumFractionDigits: 2 }) + ' MXN';

    var overlay = document.getElementById('successOverlay');
    var bar     = document.getElementById('successBar');
    overlay.classList.add('show');
    requestAnimationFrame(function () {
      requestAnimationFrame(function () { bar.classList.add('animate'); });
    });

    setTimeout(function () {
      overlay.classList.remove('show');
      bar.classList.remove('animate');
      resetPOS();
    }, 3600);
  }
  window.confirmarSalida = confirmarSalida;

  function resetPOS() {
    items = {};
    document.getElementById('destInput').value  = '';
    document.getElementById('notasInput').value = '';
    document.getElementById('scanInput').value  = '';
    ocultarErrorPos();
    render();
    document.getElementById('scanInput').focus();

    // Actualizar catálogo con stocks frescos en background
    apiGetProductos().then(function (raw) {
      var productos = enriquecerProductos(raw || []);
      productos.forEach(function (p) {
        if (POS_CATALOG[p.sku]) {
          POS_CATALOG[p.sku].stock = Number(p.stockActual) || 0;
          POS_CATALOG[p.sku].price = Number(p.valor) || Number(p.precio_unitario) || 0;
        }
      });
    });
  }

  function clearAll() {
    if (Object.keys(items).length === 0) return;
    if (confirm('¿Limpiar todos los artículos del carrito?')) { items = {}; render(); }
  }
  window.clearAll = clearAll;

  function cancelar() {
    if (Object.keys(items).length === 0 || confirm('¿Cancelar la operación? Se perderán los artículos del carrito.')) {
      resetPOS();
    }
  }
  window.cancelar = cancelar;

  // ══════════════════════════════════════════════════════════════════════════
  //  MENSAJES DE ERROR EN POS
  // ══════════════════════════════════════════════════════════════════════════
  function mostrarErrorPos(msg) {
    var el = document.getElementById('posError');
    if (!el) return;
    el.textContent   = msg;
    el.style.display = 'block';
  }
  function ocultarErrorPos() {
    var el = document.getElementById('posError');
    if (el) el.style.display = 'none';
  }

  // ══════════════════════════════════════════════════════════════════════════
  //  REALTIME — actualizar catálogo cuando cambia el stock en Supabase
  // ══════════════════════════════════════════════════════════════════════════
  function suscribirRealtime() {
    var sb = getSB();
    if (!sb) return;

    sb.channel('pos-stock-changes')
      .on('postgres_changes',
          { event: 'UPDATE', schema: 'public', table: 'Producto' },
          function (payload) {
            var p   = payload.new;
            var sku = p.sku;
            if (!sku || !POS_CATALOG[sku]) return;
            POS_CATALOG[sku].stock = Number(p.stockActual) || 0;
            POS_CATALOG[sku].price = Number(p.valor) || Number(p.precio_unitario) || 0;
            // Si hay items en carrito con ese sku, actualizar stock
            if (items[sku]) { items[sku].stock = POS_CATALOG[sku].stock; }
            render();
          })
      .on('postgres_changes',
          { event: 'INSERT', schema: 'public', table: 'Producto' },
          function (payload) {
            var p      = payload.new;
            var enrich = enriquecerProductos([p])[0];
            if (!enrich) return;
            POS_CATALOG[enrich.sku] = {
              idProducto: enrich.idProducto,
              name:       enrich.nombreProducto,
              category:   enrich.category,
              stock:      Number(enrich.stockActual) || 0,
              price:      Number(enrich.valor) || 0,
              icon:       enrich.icon,
              sku:        enrich.sku
            };
          })
      .subscribe();
  }

  // ══════════════════════════════════════════════════════════════════════════
  //  ARRANQUE
  // ══════════════════════════════════════════════════════════════════════════
  initPOS();

})();
