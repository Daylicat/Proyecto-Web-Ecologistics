// ─── auth.js ─────────────────────────────────────────────────────────────────
// Requiere: Supabase SDK cargado ANTES (CDN)
// Requiere: api-config.js cargado ANTES (expone window.SUPABASE_URL y window.SUPABASE_ANON_KEY)
(function () {
  'use strict';

  var PERMISOS = {
    admin:      ['index.html','inventory.html','pos.html','reportes.html','nuevo-producto.html'],
    trabajador: ['inventory.html','pos.html','nuevo-producto.html']
  };

  var NAV_LINKS = {
    admin: [
      { href:'index.html',          label:'Dashboard'      },
      { href:'inventory.html',      label:'Inventario'     },
      { href:'pos.html',            label:'Salidas POS'    },
      { href:'reportes.html',       label:'Reportes'       }
    ],
    trabajador: [
      { href:'inventory.html',      label:'Inventario'     },
      { href:'pos.html',            label:'Salidas POS'    },
      { href:'nuevo-producto.html', label:'Nuevo Producto' }
    ]
  };

  function pagina() {
    var p = window.location.pathname.split('/');
    return p[p.length - 1] || 'index.html';
  }

  function getSB() {
    if (!window.supabase || !window.SUPABASE_URL || !window.SUPABASE_ANON_KEY) return null;
    return window.supabase.createClient(window.SUPABASE_URL, window.SUPABASE_ANON_KEY, {
      auth: { persistSession: true, storageKey: 'eco_session', autoRefreshToken: true, detectSessionInUrl: false }
    });
  }

  // Devuelve { userId, email, rol, nombre, cargo, avatar } o null
  async function getSession() {
    var sb = getSB();
    if (!sb) return null;
    try {
      var result  = await sb.auth.getSession();
      var session = result.data && result.data.session;
      if (!session) return null;

      var profileRes = await sb.from('profiles')
        .select('rol, nombre, cargo, avatar')
        .eq('id', session.user.id)
        .single();

      if (profileRes.error || !profileRes.data) return null;

      return {
        userId: session.user.id,
        email:  session.user.email,
        rol:    profileRes.data.rol,
        nombre: profileRes.data.nombre,
        cargo:  profileRes.data.cargo,
        avatar: profileRes.data.avatar
          || (profileRes.data.nombre || session.user.email || 'U').charAt(0).toUpperCase()
      };
    } catch (e) {
      console.error('[Auth] getSession error:', e);
      return null;
    }
  }

  async function verificar() {
    var pg = pagina();
    if (pg === 'login.html' || pg === '') return;
    var s = await getSession();
    if (!s) { window.location.replace('login.html'); return; }
    var perms = PERMISOS[s.rol] || [];
    if (perms.indexOf(pg) === -1) window.location.replace(perms[0] || 'login.html');
  }

  async function renderNav() {
    var s = await getSession();
    if (!s) return;

    var links = NAV_LINKS[s.rol] || [];
    var pg    = pagina();
    var ul    = document.querySelector('.nav-links');
    if (ul) {
      ul.innerHTML = links.map(function (l) {
        return '<li><a href="' + l.href + '"' + (pg === l.href ? ' class="active"' : '') + '>' + l.label + '</a></li>';
      }).join('');
    }

    var nameEl   = document.querySelector('.user-name');
    var roleEl   = document.querySelector('.user-role');
    var avatarEl = document.querySelector('.user-avatar');
    if (nameEl)   nameEl.textContent   = s.nombre || 'Usuario';
    if (roleEl)   roleEl.textContent   = s.cargo  || '';
    if (avatarEl) avatarEl.textContent = s.avatar || 'U';
  }

  async function logout() {
    var sb = getSB();
    if (sb) { try { await sb.auth.signOut(); } catch (e) {} }
    window.location.replace('login.html');
  }

  function initLogout() {
    var btn = document.getElementById('logoutBtn');
    if (btn) btn.addEventListener('click', function (e) { e.preventDefault(); logout(); });
  }

  window.EcoAuth = { getSession, verificar, renderNav, logout, initLogout };

  verificar();
})();
