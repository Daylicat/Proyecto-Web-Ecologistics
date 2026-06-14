// ─── nuevo-producto.js — Alta de Producto (Corregido) ────────────────────────────────────
(function () {
  'use strict';

  // ══════════════════════════════════════════════════════════════════════════
  //  ESTADO
  // ══════════════════════════════════════════════════════════════════════════
  var qrInstance    = null;
  var qrReady       = false;
  var debounceTimer = null;
  var _categorias   = [];   // cargadas desde Supabase

  // ══════════════════════════════════════════════════════════════════════════
  //  GUARD DE ROL — solo admin puede crear productos
  // ══════════════════════════════════════════════════════════════════════════
  async function verificarRol() {
    var s = await EcoAuth.getSession();
    if (!s || s.rol !== 'admin') {
      // Trabajador: ocultar botón guardar, mostrar aviso
      var btn = document.getElementById('npSubmitBtn');
      if (btn) {
        btn.disabled     = true;
        btn.textContent  = 'Sin permisos para crear productos';
        btn.style.opacity = '0.5';
        btn.style.cursor  = 'not-allowed';
      }
    }
  }

  // ══════════════════════════════════════════════════════════════════════════
  //  CATEGORÍAS DINÁMICAS
  // ══════════════════════════════════════════════════════════════════════════
  async function cargarCategorias() {
    // Obtenemos las categorías reales desde Supabase
    var raw = await peticionAPI('Categoria', 'GET', null, '?order=nombre.asc') || [];
    _categorias = raw;
    poblarSelectCategorias();
  }

  function poblarSelectCategorias() {
    var sel = document.getElementById('prodCategory');
    if (!sel) return;
    var valorActual = sel.value;

    // SOLUCIÓN MAPEO: El value DEBE ser c.idCategoria (el número entero), NO el nombre texto
    sel.innerHTML = '<option value="">Selecciona una categoría...</option>'
      + _categorias.map(function (c) {
          return '<option value="' + c.idCategoria + '"'
            + (c.idCategoria == valorActual ? ' selected' : '')
            + '>' + san(c.nombre) + '</option>';
        }).join('')
      + '<option value="__nueva__">➕ Nueva categoría...</option>';
  }

  // ── Detectar selección de "Nueva categoría" ───────────────────────────────
  document.getElementById('prodCategory').addEventListener('change', function () {
    if (this.value === '__nueva__') {
      this.value = '';   // limpiar selección temporal
      abrirModalNuevaCategoria();
    }
  });

  // ══════════════════════════════════════════════════════════════════════════
  //  MODAL NUEVA CATEGORÍA
  // ══════════════════════════════════════════════════════════════════════════
  function abrirModalNuevaCategoria(categoriaEditar) {
    var esEdicion   = !!categoriaEditar;
    var titulo      = esEdicion ? 'Editar Categoría' : 'Nueva Categoría';
    var valorInicial= esEdicion ? categoriaEditar.nombre : '';
    var idCategoria = esEdicion ? categoriaEditar.idCategoria : null;

    // Crear overlay dinámico compatible con los estilos globales CSS
    var overlay = document.createElement('div');
    overlay.id        = 'modalCategoriaOverlay';
    overlay.className = 'np-success-overlay';
    overlay.style.zIndex = '400';
    overlay.innerHTML =
      '<div class="np-success-card" style="max-width:360px">'
      + '<div style="font-size:18px;font-weight:700;color:var(--text);margin-bottom:20px">' + titulo + '</div>'
      + '<div style="text-align:left;margin-bottom:16px">'
      + '<label class="np-label" style="display:block;margin-bottom:6px">Nombre de la categoría</label>'
      + '<input class="np-input" id="inputNombreCat" type="text" placeholder="Ej. Hogar" value="' + san(valorInicial) + '" style="width:100%">'
      + '<div id="errorNombreCat" style="color:var(--red);font-size:12px;margin-top:4px;display:none"></div>'
      + '</div>'
      + (esEdicion
          ? '<div style="margin-bottom:16px"><button id="btnEliminarCat" style="background:none;border:none;color:var(--red);font-size:13px;cursor:pointer;font-family:\'DM Sans\',sans-serif;font-weight:600;padding:0">Eliminar esta categoría</button></div>'
          : '')
      + '<div class="np-success-actions">'
      + '<button class="np-success-btn-new" id="btnCancelarCat">Cancelar</button>'
      + '<button class="np-success-btn-inv" id="btnGuardarCat">' + (esEdicion ? 'Guardar' : 'Crear') + '</button>'
      + '</div></div>';

    document.body.appendChild(overlay);
    
    requestAnimationFrame(function () {
      requestAnimationFrame(function () { overlay.classList.add('show'); });
    });

    var inputNombre = document.getElementById('inputNombreCat');
    inputNombre.focus();
    
    inputNombre.addEventListener('keydown', function (e) {
      if (e.key === 'Enter') guardarCategoria(idCategoria);
      if (e.key === 'Escape') cerrarModalCategoria();
    });

    document.getElementById('btnCancelarCat').addEventListener('click', cerrarModalCategoria);
    document.getElementById('btnGuardarCat').addEventListener('click', function () {
      guardarCategoria(idCategoria);
    });

    if (esEdicion) {
      document.getElementById('btnEliminarCat').addEventListener('click', function () {
        eliminarCategoria(idCategoria);
      });
    }
  }

  function cerrarModalCategoria() {
    var el = document.getElementById('modalCategoriaOverlay');
    if (el) {
      el.classList.remove('show');
      setTimeout(function () { if (el.parentNode) el.parentNode.removeChild(el); }, 250);
    }
  }

  async function guardarCategoria(idCategoria) {
    var nombre = (document.getElementById('inputNombreCat').value || '').trim();
    var errEl  = document.getElementById('errorNombreCat');
    var btn    = document.getElementById('btnGuardarCat');

    if (!nombre) {
      errEl.textContent = 'El nombre es obligatorio.';
      errEl.style.display = 'block';
      return;
    }

    btn.disabled    = true;
    btn.textContent = 'Guardando...';

    var res;
    if (idCategoria) {
      res = await peticionAPI('Categoria', 'PATCH', { nombre: nombre }, '?idCategoria=eq.' + idCategoria);
    } else {
      res = await peticionAPI('Categoria', 'POST', { nombre: nombre });
    }

    if (!res) {
      errEl.textContent = 'Error al guardar. Verifica permisos.';
      errEl.style.display = 'block';
      btn.disabled = false;
      btn.textContent = idCategoria ? 'Guardar' : 'Crear';
      return;
    }

    // SOLUCIÓN AL DOBLE CLIC: Esperamos 300ms a que Supabase asiente los índices antes de recargar
    setTimeout(async function () {
      await cargarCategorias();
      cerrarModalCategoria();

      // Si fue una creación exitosa, seleccionamos automáticamente el ID en el dropdown
      if (!idCategoria && res && res[0]) {
        var selectEl = document.getElementById('prodCategory');
        if (selectEl) selectEl.value = res[0].idCategoria;
      }
    }, 300);
  }

  async function eliminarCategoria(idCategoria) {
    var prods = await peticionAPI('Producto', 'GET', null, '?idCategoria=eq.' + idCategoria + '&select=idProducto&limit=1');
    if (prods && prods.length > 0) {
      var errEl = document.getElementById('errorNombreCat');
      errEl.textContent = 'No es posible eliminar: hay productos vinculados a esta categoría.';
      errEl.style.display = 'block';
      return;
    }

    await peticionAPI('Categoria', 'DELETE', null, '?idCategoria=eq.' + idCategoria);
    
    setTimeout(async function () {
      await cargarCategorias();
      cerrarModalCategoria();
    }, 300);
  }

  // ══════════════════════════════════════════════════════════════════════════
  //  QR — generación en vista previa
  // ══════════════════════════════════════════════════════════════════════════
  function generateQR(sku, name) {
    var wrap      = document.getElementById('qrWrap');
    var metaEl    = document.getElementById('qrMeta');
    var metaEmpty = document.getElementById('qrMetaEmpty');
    var btnD      = document.getElementById('btnDescargar');
    var btnP      = document.getElementById('btnImprimir');

    if (qrInstance) { qrInstance.clear(); qrInstance = null; }
    wrap.innerHTML = '';
    qrReady = false;

    if (!sku && !name) {
      wrap.innerHTML = '<div class="np-qr-placeholder">Completa el SKU y nombre<br>para generar el QR</div>';
      metaEl.style.display = 'none';
      if (metaEmpty) metaEmpty.style.marginBottom = '20px';
      if (btnD) btnD.disabled = true;
      if (btnP) btnP.disabled = true;
      return;
    }

    var qrData = sku
      ? 'SKU:' + sku + (name ? '|NAME:' + name : '')
      : name;

    if (typeof QRCode !== 'undefined') {
      qrInstance = new QRCode(wrap, {
        text:         qrData,
        width:        130,
        height:       130,
        colorDark:    '#0F172A',
        colorLight:   '#F8FAFC',
        correctLevel: QRCode.CorrectLevel.H
      });

      document.getElementById('qrSku').textContent  = sku  || '';
      document.getElementById('qrName').textContent = name || '';
      metaEl.style.display = 'block';
      if (metaEmpty) metaEmpty.style.marginBottom = '0';
      qrReady = true;
      if (btnD) btnD.disabled = false;
      if (btnP) btnP.disabled = false;
    }
  }

  function onFieldChange() {
    clearTimeout(debounceTimer);
    debounceTimer = setTimeout(function () {
      generateQR(
        document.getElementById('prodSku').value.trim(),
        document.getElementById('prodName').value.trim()
      );
    }, 350);
  }
  window.onFieldChange = onFieldChange;

  function descargarQR() {
    if (!qrReady) return;
    var canvas = document.querySelector('#qrWrap canvas');
    if (!canvas) return;
    var sku  = document.getElementById('prodSku').value.trim() || 'qr-producto';
    var link = document.createElement('a');
    link.download = 'QR-' + sku + '.png';
    link.href     = canvas.toDataURL('image/png');
    link.click();
  }
  window.descargarQR = descargarQR;

  function imprimirQR() {
    if (!qrReady) return;
    var canvas = document.querySelector('#qrWrap canvas');
    if (!canvas) return;
    var sku  = document.getElementById('prodSku').value.trim();
    var name = document.getElementById('prodName').value.trim();
    var img  = canvas.toDataURL('image/png');
    var win  = window.open('', '_blank', 'width=400,height=500');
    win.document.write('<!DOCTYPE html><html><head><title>QR — ' + san(sku) + '</title>'
      + '<style>body{font-family:sans-serif;text-align:center;padding:40px}'
      + 'img{width:200px;height:200px;display:block;margin:0 auto 16px}'
      + '.sku{font-size:16px;font-weight:700;font-family:monospace}'
      + '.nm{font-size:13px;color:#64748B;margin-top:4px}'
      + '</style></head><body>'
      + '<img src="' + img + '">'
      + '<div class="sku">' + san(sku) + '</div>'
      + '<div class="nm">' + san(name) + '</div>'
      + '<script>window.onload=function(){window.print();window.close()}<\/script>'
      + '</body></html>');
    win.document.close();
  }
  window.imprimirQR = imprimirQR;

  // ══════════════════════════════════════════════════════════════════════════
  //  VALIDACIÓN SKU ÚNICO
  // ══════════════════════════════════════════════════════════════════════════
  async function skuEsUnico(sku) {
    var res = await peticionAPI('Producto', 'GET', null, '?sku=eq.' + encodeURIComponent(sku) + '&select=idProducto&limit=1');
    return !res || res.length === 0;
  }

  // ══════════════════════════════════════════════════════════════════════════
  //  REGISTRAR PRODUCTO
  // ══════════════════════════════════════════════════════════════════════════
  async function registrar() {
    var name     = document.getElementById('prodName').value.trim();
    var sku      = document.getElementById('prodSku').value.trim();
    var catId    = document.getElementById('prodCategory').value; // Ahora lee el ID numérico real
    var stock    = parseInt(document.getElementById('prodStock').value, 10) || 0;
    var stockMin = parseInt(document.getElementById('prodMin').value, 10)   || 0;
    var valor    = parseFloat(document.getElementById('prodValor').value)   || 0;
    var unidad   = document.getElementById('prodUnidad').value              || 'unidades';
    var desc     = document.getElementById('prodDesc').value.trim();

    // ── Validar campos obligatorios ───────────────────────────────────────
    var errores = [];
    var campos  = [
      { id: 'prodName',     val: name,     label: 'Nombre' },
      { id: 'prodSku',      val: sku,      label: 'SKU'    },
      { id: 'prodCategory', val: catId,    label: 'Categoría' },
      { id: 'prodMin',      val: stockMin > 0 ? 'ok' : '', label: 'Stock Mínimo' },
      { id: 'prodValor',    val: valor    > 0 ? 'ok' : '', label: 'Precio Unitario' }
    ];

    var hayError = false;
    campos.forEach(function (c) {
      var el = document.getElementById(c.id);
      if (!c.val) {
        if (el) el.style.borderColor = 'var(--red)';
        errores.push(c.label);
        hayError = true;
      }
    });

    if (hayError) {
      mostrarError('Campos obligatorios o inválidos: ' + errores.join(', ') + '.');
      return;
    }

    ocultarError();

    var btn = document.getElementById('npSubmitBtn');
    btn.textContent = 'Verificando SKU...';
    btn.disabled    = true;

    // ── Validar unicidad del SKU ──────────────────────────────────────────
    var unico = await skuEsUnico(sku);
    if (!unico) {
      mostrarError('El SKU "' + san(sku) + '" ya existe. Usa uno diferente.');
      btn.textContent = 'Registrar Producto';
      btn.disabled    = false;
      document.getElementById('prodSku').style.borderColor = 'var(--red)';
      return;
    }

    btn.textContent = 'Guardando...';

    // ── Capturar QR como base64 antes de guardar ──────────────────────────
    var qrDataUrl = '';
    try {
      var canvas = document.querySelector('#qrWrap canvas');
      if (canvas) qrDataUrl = canvas.toDataURL('image/png');
    } catch (e) { /* ignorar */ }

    // ── Construir payload completo apuntando al ID Numérico ────────────────
    var payload = {
      nombreProducto: name,
      sku:            sku,
      idCategoria:    parseInt(catId, 10), // Guardamos el entero limpio
      stockActual:    stock,
      stockMinimo:    stockMin,
      valor:          valor,          
      unidad:         skewUnidad(unidad),
      descripcion:    desc || null,
      qr_data_url:    qrDataUrl || null   
    };

    var res = await apiCleanCrearProducto(payload);

    if (!res) {
      mostrarError('Error al guardar producto. Intenta de nuevo.');
      btn.textContent = 'Registrar Producto';
      btn.disabled    = false;
      return;
    }

    // ── Registro en actividad_log ─────────────────────────────────────────
    try {
      await peticionAPI('actividad_log', 'POST', {
        tipo:         'producto_creado',
        descripcion:  'Producto creado: ' + name + ' (SKU: ' + sku + ')',
        reference_id: res.idProducto || null
      });
    } catch (e) { /* no bloquear */ }

    // ── Éxito ─────────────────────────────────────────────────────────────
    document.getElementById('npSuccessName').textContent = name;
    document.getElementById('npSuccessSku').textContent  = sku;
    document.getElementById('npSuccessOverlay').classList.add('show');
  }
  window.registrar = registrar;

  // ══════════════════════════════════════════════════════════════════════════
  //  HELPERS AUXILIARES
  // ══════════════════════════════════════════════════════════════════════════
  async function apiCleanCrearProducto(obj) {
    var res = await peticionAPI('Producto', 'POST', obj);
    return res && res.length > 0 ? res[0] : null;
  }

  function skewUnidad(u) {
    return ['unidades', 'metros', 'kg', 'piezas'].indexOf(u) > -1 ? u : 'unidades';
  }

  function mostrarError(msg) {
    var el = document.getElementById('npFormError');
    if (!el) return;
    el.textContent    = msg;
    el.style.display  = 'block';
  }
  
  function ocultarError() {
    var el = document.getElementById('npFormError');
    if (el) el.style.display = 'none';
  }

  function san(str) {
    return String(str || '')
      .replace(/&/g, '&amp;').replace(/</g, '&lt;')
      .replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }

  function registrarOtro() {
    document.getElementById('npSuccessOverlay').classList.remove('show');
    ['prodName','prodSku','prodCategory','prodStock','prodMin','prodValor','prodDesc'].forEach(function (id) {
      var el = document.getElementById(id);
      if (el) {
        el.value = '';
        el.style.borderColor = '';
      }
    });
    generateQR('', '');
    var btn = document.getElementById('npSubmitBtn');
    btn.textContent = 'Registrar Producto';
    btn.disabled    = false;
    ocultarError();
    document.getElementById('prodName').focus();
  }
  window.registrarOtro = registrarOtro;

  // ══════════════════════════════════════════════════════════════════════════
  //  ARRANQUE
  // ══════════════════════════════════════════════════════════════════════════
  async function init() {
    if (window.EcoAuth) await EcoAuth.renderNav();
    await verificarRol();
    await cargarCategorias();
  }

  init();

})();