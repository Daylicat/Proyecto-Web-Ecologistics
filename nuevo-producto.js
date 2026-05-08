
let qrInstance  = null;
let qrReady     = false;
let debounceTimer = null;

// ── Generación de QR ────────────────────────────────────────────────────────
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
    metaEl.style.display         = 'none';
    metaEmpty.style.marginBottom = '20px';
    if (btnD) btnD.disabled = true;
    if (btnP) btnP.disabled = true;
    return;
  }

  var qrData = sku
    ? 'SKU:' + sku + (name ? '|NAME:' + name : '')
    : name;

  qrInstance = new QRCode(wrap, {
    text:         qrData,
    width:        130, height: 130,
    colorDark:    '#0F172A', colorLight: '#F8FAFC',
    correctLevel: QRCode.CorrectLevel.H,
  });

  document.getElementById('qrSku').textContent  = sku  || '';
  document.getElementById('qrName').textContent = name || '';

  metaEl.style.display         = (sku || name) ? 'block' : 'none';
  metaEmpty.style.marginBottom = '0';

  qrReady = true;
  if (btnD) btnD.disabled = false;
  if (btnP) btnP.disabled = false;
}

function onFieldChange() {
  clearTimeout(debounceTimer);
  debounceTimer = setTimeout(function () {
    var sku  = document.getElementById('prodSku').value.trim();
    var name = document.getElementById('prodName').value.trim();
    generateQR(sku, name);
  }, 350);
}

// ── Descargar / imprimir QR ─────────────────────────────────────────────────
function descargarQR() {
  if (!qrReady) return;
  var canvas = document.querySelector('#qrWrap canvas');
  if (!canvas) return;
  var sku  = document.getElementById('prodSku').value.trim() || 'qr-producto';
  var link = document.createElement('a');
  link.download = 'QR-' + sku + '.png';
  link.href = canvas.toDataURL('image/png');
  link.click();
}

function imprimirQR() {
  if (!qrReady) return;
  var canvas = document.querySelector('#qrWrap canvas');
  if (!canvas) return;
  var sku  = document.getElementById('prodSku').value.trim();
  var name = document.getElementById('prodName').value.trim();
  var img  = canvas.toDataURL('image/png');
  var win  = window.open('', '_blank', 'width=400,height=500');
  win.document.write('<!DOCTYPE html><html><head><title>QR — ' + sku + '</title>'
    + '<style>body{font-family:sans-serif;text-align:center;padding:40px}'
    + 'img{width:200px;height:200px;display:block;margin:0 auto 16px}'
    + '.sku{font-size:16px;font-weight:700;font-family:monospace}'
    + '.nm{font-size:13px;color:#64748B;margin-top:4px}</style></head><body>'
    + '<img src="' + img + '">'
    + '<div class="sku">' + sku + '</div>'
    + '<div class="nm">' + name + '</div>'
    + '<script>window.onload=function(){window.print();window.close()}<\/script>'
    + '</body></html>');
  win.document.close();
}

// ── Registrar producto ──────────────────────────────────────────────────────
function registrar() {
  var name  = document.getElementById('prodName').value.trim();
  var sku   = document.getElementById('prodSku').value.trim();
  var cat   = document.getElementById('prodCategory').value;
  var stock = parseInt(document.getElementById('prodStock').value) || 0;
  var min   = parseInt(document.getElementById('prodMin').value)   || 10;

  // Validación
  var hayError = false;
  ['prodName', 'prodSku', 'prodCategory'].forEach(function (id) {
    var el = document.getElementById(id);
    if (!el.value.trim()) {
      el.style.borderColor = 'var(--red)';
      el.addEventListener('input',  function () { el.style.borderColor = ''; }, { once: true });
      el.addEventListener('change', function () { el.style.borderColor = ''; }, { once: true });
      hayError = true;
    }
  });
  if (hayError) return;

  // Determinar status del nuevo producto
  var newStatus = stock === 0 ? 'sin stock' : (stock < min ? 'crítico' : 'óptimo');

  // Agregar al array global (prototipo — sin backend)
  if (typeof ECO_PRODUCTS !== 'undefined') {
    ECO_PRODUCTS.push({
      id:       sku,
      name:     name,
      category: cat,
      stock:    stock,
      min:      min,
      status:   newStatus,
      icon:     'tool',
      valor:    parseFloat(document.getElementById('prodValor').value) || 0
    });
  }

  // Mostrar overlay de éxito
  document.getElementById('npSuccessName').textContent = name;
  document.getElementById('npSuccessSku').textContent  = sku;
  document.getElementById('npSuccessOverlay').classList.add('show');
}

function irAlInventario() {
  window.location.href = 'inventory.html';
}

function registrarOtro() {
  // Cerrar overlay y limpiar formulario
  document.getElementById('npSuccessOverlay').classList.remove('show');

  ['prodName', 'prodSku', 'prodCategory', 'prodStock', 'prodMin', 'prodValor', 'prodDesc'].forEach(function (id) {
    var el = document.getElementById(id);
    if (el) el.value = '';
  });

  // Limpiar QR
  generateQR('', '');

  // Restaurar botón
  var btn = document.getElementById('npSubmitBtn');
  if (btn) {
    btn.textContent = 'Registrar Producto';
    btn.style.background = '';
    btn.disabled = false;
  }

  document.getElementById('prodName').focus();
}

// ── Teclado ─────────────────────────────────────────────────────────────────
document.addEventListener('keydown', function (e) {
  if (e.key === 'Escape') {
    var overlay = document.getElementById('npSuccessOverlay');
    if (overlay.classList.contains('show')) {
      registrarOtro();
    } else {
      window.location.href = 'inventory.html';
    }
  }
});
