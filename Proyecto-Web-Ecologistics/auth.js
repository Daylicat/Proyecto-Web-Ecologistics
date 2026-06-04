
// ─── auth.js — Módulo central de autenticación y roles ────────────────────────

(function () {

  // Usuarios y sus permisos
  var USERS = {
    'admin@ecologistics.com': {
      pass:   'admin2024',
      rol:    'admin',
      nombre: 'Admin User',
      cargo:  'Gerente de Almacén',
      avatar: 'AU',
      redirect: 'index.html'
    },
    'trabajador@ecologistics.com': {
      pass:   'worker2024',
      rol:    'trabajador',
      nombre: 'Trabajador',
      cargo:  'Operador de Almacén',
      avatar: 'TR',
      redirect: 'inventory.html'
    }
  };

  // Páginas permitidas por rol
  var PERMISOS = {
    admin:      ['index.html', 'inventory.html', 'pos.html', 'reportes.html', 'nuevo-producto.html'],
    trabajador: ['inventory.html', 'pos.html', 'nuevo-producto.html']
  };

  // Navegación visible por rol
  var NAV_LINKS = {
    admin: [
      { href: 'index.html',     label: 'Dashboard'    },
      { href: 'inventory.html', label: 'Inventario'   },
      { href: 'pos.html',       label: 'Salidas POS'  },
      { href: 'reportes.html',  label: 'Reportes'     }
    ],
    trabajador: [
      { href: 'inventory.html',      label: 'Inventario'      },
      { href: 'pos.html',            label: 'Salidas POS'     },
      { href: 'nuevo-producto.html', label: 'Nuevo Producto'  }
    ]
  };

  // ── Helpers de sesión ──────────────────────────────────────────────────────

  function getSession() {
    try {
      var raw = sessionStorage.getItem('eco_session');
      return raw ? JSON.parse(raw) : null;
    } catch (e) { return null; }
  }

  function setSession(email, userData) {
    var session = {
      email:  email,
      rol:    userData.rol,
      nombre: userData.nombre,
      cargo:  userData.cargo,
      avatar: userData.avatar
    };
    sessionStorage.setItem('eco_session', JSON.stringify(session));
  }

  function clearSession() {
    sessionStorage.removeItem('eco_session');
  }

  // ── Página actual ──────────────────────────────────────────────────────────

  function getPaginaActual() {
    var path = window.location.pathname;
    var parts = path.split('/');
    return parts[parts.length - 1] || 'index.html';
  }

  // ── Guardar y verificar acceso ─────────────────────────────────────────────

  function verificarAcceso() {
    var pagina  = getPaginaActual();
    var session = getSession();

    // Si es la página de login, no hacer nada
    if (pagina === 'login.html' || pagina === '') return;

    // Si no hay sesión, redirigir a login
    if (!session) {
      window.location.replace('login.html');
      return;
    }

    // Verificar si el rol tiene permiso para esta página
    var permitidas = PERMISOS[session.rol] || [];
    if (permitidas.indexOf(pagina) === -1) {
      // Redirigir a la primera página permitida del rol
      window.location.replace(permitidas[0] || 'login.html');
    }
  }

  // ── Renderizar nav dinámico según rol ─────────────────────────────────────

  function renderizarNav() {
    var session = getSession();
    if (!session) return;

    var links    = NAV_LINKS[session.rol] || [];
    var pagina   = getPaginaActual();
    var navLinks = document.querySelector('.nav-links');
    if (!navLinks) return;

    navLinks.innerHTML = links.map(function (l) {
      var isActive = pagina === l.href ? ' class="active"' : '';
      return '<li><a href="' + l.href + '"' + isActive + '>' + l.label + '</a></li>';
    }).join('');

    // Actualizar datos del usuario en el nav
    var userNameEl = document.querySelector('.user-name');
    var userRoleEl = document.querySelector('.user-role');
    var avatarEl   = document.querySelector('.user-avatar');

    if (userNameEl)  userNameEl.textContent = session.nombre;
    if (userRoleEl)  userRoleEl.textContent = session.cargo;
    if (avatarEl)    avatarEl.textContent   = session.avatar;
  }

  // ── Login ──────────────────────────────────────────────────────────────────

  function doLogin(email, pass) {
    email = (email || '').trim().toLowerCase();
    var userData = USERS[email];
    if (!userData || userData.pass !== pass) return null;
    setSession(email, userData);
    return userData;
  }

  // ── Logout ─────────────────────────────────────────────────────────────────

  function logout() {
    clearSession();
    window.location.replace('login.html');
  }

  // ── Exponer API global ─────────────────────────────────────────────────────

  window.EcoAuth = {
    verificarAcceso: verificarAcceso,
    renderizarNav:   renderizarNav,
    doLogin:         doLogin,
    logout:          logout,
    getSession:      getSession,
    USERS:           USERS
  };

  // Ejecutar verificación automáticamente al cargar
  verificarAcceso();

})();
