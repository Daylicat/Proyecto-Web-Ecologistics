

let qrInstance = null;
let qrReady    = false;
let debounceTimer = null;


function generateQR(sku, name) {
  const wrap        = document.getElementById('qrWrap');
  const placeholder = document.getElementById('qrPlaceholder');
  const metaEl      = document.getElementById('qrMeta');
  const metaEmpty   = document.getElementById('qrMetaEmpty');
  const btnD        = document.getElementById('btnDescargar');
  const btnP        = document.getElementById('btnImprimir');

  if (qrInstance) {
    qrInstance.clear();
    qrInstance = null;
  }

  wrap.innerHTML = '';
  qrReady = false;

  if (!sku && !name) {
    wrap.innerHTML = '<div class="np-qr-placeholder" id="qrPlaceholder">Completa el SKU y nombre<br>para generar el QR</div>';
    metaEl.style.display    = 'none';
    metaEmpty.style.marginBottom = '20px';
    btnD.disabled = btnP.disabled = true;
    return;
  }

  const qrData = sku
    ? `SKU:${sku}${name ? '|NAME:' + name : ''}`
    : name;

  qrInstance = new QRCode(wrap, {
    text:          qrData,
    width:         130,
    height:        130,
    colorDark:     '#0F172A',
    colorLight:    '#F8FAFC',
    correctLevel:  QRCode.CorrectLevel.H,
  });

  
  document.getElementById('qrSku').textContent  = sku  || '';
  document.getElementById('qrName').textContent = name || '';

  metaEl.style.display         = (sku || name) ? 'block' : 'none';
  metaEmpty.style.marginBottom = '0';

  qrReady = true;
  btnD.disabled = btnP.disabled = false;
}


function onFieldChange() {
  clearTimeout(debounceTimer);
  debounceTimer = setTimeout(() => {
    const sku  = document.getElementById('prodSku').value.trim();
    const name = document.getElementById('prodName').value.trim();
    generateQR(sku, name);
  }, 350);
}

function descargarQR() {
  if (!qrReady) return;
  const canvas = document.querySelector('#qrWrap canvas');
  if (!canvas) return;

  const sku  = document.getElementById('prodSku').value.trim() || 'qr-producto';
  const link = document.createElement('a');
  link.download = `QR-${sku}.png`;
  link.href = canvas.toDataURL('image/png');
  link.click();
}


function imprimirQR() {
  if (!qrReady) return;
  const canvas = document.querySelector('#qrWrap canvas');
  if (!canvas) return;

  const sku  = document.getElementById('prodSku').value.trim();
  const name = document.getElementById('prodName').value.trim();
  const img  = canvas.toDataURL('image/png');

  const win = window.open('', '_blank', 'width=400,height=500');
  win.document.write(`
    <!DOCTYPE html><html><head>
      <title>QR — ${sku}</title>
      <style>
        body { font-family: sans-serif; text-align: center; padding: 40px; }
        img  { width: 200px; height: 200px; display: block; margin: 0 auto 16px; }
        .sku { font-size: 16px; font-weight: 700; font-family: monospace; }
        .nm  { font-size: 13px; color: #64748B; margin-top: 4px; }
      </style>
    </head><body>
      <img src="${img}">
      <div class="sku">${sku}</div>
      <div class="nm">${name}</div>
      <script>window.onload = () => { window.print(); window.close(); }<\/script>
    </body></html>
  `);
  win.document.close();
}


function registrar() {
  const name  = document.getElementById('prodName').value.trim();
  const sku   = document.getElementById('prodSku').value.trim();
  const cat   = document.getElementById('prodCategory').value;
  const stock = document.getElementById('prodStock').value;
  const min   = document.getElementById('prodMin').value;

  if (!name || !sku || !cat) {
   
    ['prodName', 'prodSku', 'prodCategory'].forEach(id => {
      const el = document.getElementById(id);
      if (!el.value.trim()) {
        el.style.borderColor = 'var(--red)';
        el.addEventListener('input', () => el.style.borderColor = '', { once: true });
        el.addEventListener('change', () => el.style.borderColor = '', { once: true });
      }
    });
    return;
  }

  
  const btn = document.querySelector('.np-submit');
  btn.textContent = '✓ Producto registrado';
  btn.style.background = '#15803D';
  btn.disabled = true;

  setTimeout(() => {
    window.location.href = 'inventory.html';
  }, 1200);
}


document.addEventListener('keydown', e => {
  if (e.key === 'Escape') window.location.href = 'inventory.html';
});
