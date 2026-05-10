"use strict";

// =====================================================
// UI REGISTRO — COT Driver App
// Maneja el registro inicial del chofer
// =====================================================

console.log("ui_registro cargado");
const SUPABASE_URL_REG = "https://frjeivfpldcigklwepqt.supabase.co";
const SUPABASE_KEY_REG = "sb_publishable_6A7tufjD-rTAUAPfxyziyw_3kXMumzJ";

// =====================================================
// BASES DISPONIBLES (fuente única de verdad)
// =====================================================
const BASES_DISPONIBLES = ['Montevideo', 'Punta del Este', 'Piriápolis', 'Punta Colorada', 'Punta Negra', 'Rocha', 'Colonia', 'Chuy', 'La Pedrera', 'La Paloma', 'Aguas Dulces', 'Otro'];

// =====================================================
// CARGAR SELECTOR DE ORIGEN AL INICIAR
// =====================================================
function cargarSelectorOrigen(baseSeleccionada) {
  const sel = document.getElementById('originTravels');
  if (!sel) return;
  sel.innerHTML = BASES_DISPONIBLES.map(b => "<option value=\"".concat(b, "\" ").concat(b === baseSeleccionada ? 'selected' : '', ">").concat(b, "</option>")).join('');
}

// =====================================================
// FLUJO DE ARRANQUE
// =====================================================
document.addEventListener('DOMContentLoaded', () => {
  showScreen('splashScreen');
  setTimeout(() => {
    const driver = getDriver();
    if (!driver) {
      showScreen('registroScreen');
      setTimeout(() => {
        if (typeof iniciarAnimacionRegistro === 'function') iniciarAnimacionRegistro();
      }, 100);
    } else {
      const badge = document.getElementById('baseCHoferBadge');
      if (badge) badge.innerText = "Base: " + (driver.base || "Montevideo");
      cargarSelectorOrigen(driver.base || "Montevideo");
      showScreen('mainScreen');
      // Arrancar bootstrap (verifica cambio de dia, motores, sync)
      if (typeof iniciarBootstrap === "function") {
        iniciarBootstrap();
      }
    }
  }, 900);
});

// =====================================================
// REGISTRAR CHOFER (con verificación Supabase)
// =====================================================
async function registrarChofer() {
  try {
    const legajo = document.getElementById('regLegajo').value.trim();
    const nombre = document.getElementById('regNombre').value.trim();
    const base = document.getElementById('regBase').value;
    const tipo = document.getElementById('regTipo').value;
    if (!legajo || !nombre) {
      alert("Completá legajo y nombre");
      return;
    }
    if (!tipo) {
      alert("Elegí tipo de chofer");
      return;
    }

    // ── DEVICE ID único por dispositivo ──
    let deviceId = localStorage.getItem("device_id");
    if (!deviceId) {
      deviceId = "dev-" + Date.now() + "-" + Math.random().toString(36).substring(2, 9);
      localStorage.setItem("device_id", deviceId);
    }

    // ── CONSULTAR SUPABASE: ¿ya existe este legajo? ──
    const checkRes = await fetch("".concat(SUPABASE_URL_REG, "/rest/v1/choferes?empresa_id=eq.cot&legajo=eq.").concat(legajo, "&select=id,legajo,device_id"), {
      headers: {
        "apikey": SUPABASE_KEY_REG,
        "Authorization": "Bearer ".concat(SUPABASE_KEY_REG)
      }
    });
    const choferes = await checkRes.json();
    if (choferes.length > 0) {
      const choferExistente = choferes[0];

      // ── Mismo dispositivo — ya registrado ──
      if (choferExistente.device_id === deviceId) {
  initDriverProfile({ legajo, nombre, base, tipo, deviceId });
  document.getElementById('baseChoferBadge').innerText = "Base: " + base;
  cargarSelectorOrigen(base);
  showScreen('mainScreen');
  return;
}

      // ── Otro dispositivo — alerta al admin ──
      if (choferExistente.device_id && choferExistente.device_id !== deviceId) {
        await fetch("".concat(SUPABASE_URL_REG, "/rest/v1/registro_alertas"), {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "apikey": SUPABASE_KEY_REG,
            "Authorization": "Bearer ".concat(SUPABASE_KEY_REG)
          },
          body: JSON.stringify({
            empresa_id: "cot",
            legajo,
            nombre,
            device_id_nuevo: deviceId,
            device_id_actual: choferExistente.device_id
          })
        });
        alert("Este legajo ya está registrado en otro dispositivo.\nEl administrador fue notificado.");
        return;
      }
    }

  // ── REGISTRAR EN SUPABASE ──
const insertRes = await fetch(`${SUPABASE_URL_REG}/rest/v1/choferes?on_conflict=empresa_id,legajo`, {
  method: "POST",
  headers: {
    "Content-Type": "application/json",
    "apikey": SUPABASE_KEY_REG,
    "Authorization": `Bearer ${SUPABASE_KEY_REG}`,
    "Prefer": "resolution=merge-duplicates,return=representation"
  },
  body: JSON.stringify({
    empresa_id: "cot",
    legajo,
    nombre,
    base,
    tipo,
    device_id: deviceId,
    registrado_at: new Date().toISOString()
  })
});

const insertData = await insertRes.json();

if (!insertRes.ok) {
  alert("Error al registrar en servidor: " + JSON.stringify(insertData));
  return;
}

const supabaseId = insertData[0]?.id;

// ── GUARDAR LOCAL ──
initDriverProfile({
  legajo,
  nombre,
  base,
  tipo,
  deviceId,
  supabaseId
});

document.getElementById('baseChoferBadge').innerText = "Base: " + base;
cargarSelectorOrigen(base);

// Animación: frenar luces → revelar bus → ir a main
const btn = document.getElementById('regBtn');
if (btn) { btn.disabled = true; btn.textContent = 'Registrando...'; }

if (typeof window._frenarAnimacionRegistro === 'function') {
  window._frenarAnimacionRegistro(function() {
    // Revelar interior del bus
    const busInt  = document.getElementById('regBusInterior');
    const busOvl  = document.getElementById('regBusOverlay');
    const formLay = document.getElementById('regFormLayer');
    const success = document.getElementById('regSuccess');
    const speedBg = document.getElementById('regSpeedBg');

    if (speedBg) speedBg.classList.add('fading');
    if (formLay) formLay.classList.add('hiding');

    if (busInt) {
      busInt.style.transition = 'opacity 0s';
      busInt.style.opacity = '1';
      busInt.animate([
        { filter: 'blur(20px) brightness(2.5)', transform: 'scale(1.08)', opacity: 0.2 },
        { filter: 'blur(8px)  brightness(1.6)', transform: 'scale(1.04)', opacity: 0.7, offset: 0.4 },
        { filter: 'blur(2px)  brightness(1.2)', transform: 'scale(1.01)', opacity: 0.95, offset: 0.75 },
        { filter: 'blur(0px)  brightness(1)',   transform: 'scale(1)',    opacity: 1 }
      ], { duration: 1600, easing: 'cubic-bezier(0.25,0.1,0.25,1)', fill: 'forwards' });
    }
    if (busOvl) busOvl.style.opacity = '1';
    if (success) success.classList.add('show');

    // Ir a main después de que el chofer vea el bus
    setTimeout(() => {
      showScreen('mainScreen');
      if (typeof iniciarBootstrap === 'function') iniciarBootstrap();
    }, 3200);
  });
} else {
  // Fallback sin animación
  showScreen('mainScreen');
  if (typeof iniciarBootstrap === 'function') iniciarBootstrap();
}

} catch (e) {
  alert("ERROR registrarChofer: " + e.message);
}
}
window.registrarChofer = registrarChofer;
window.cargarSelectorOrigen = cargarSelectorOrigen;

// =====================================================
// MOTOR ANIMACIÓN REGISTRO — luces velocidad → bus
// =====================================================

function iniciarAnimacionRegistro() {
  const bg = document.getElementById('regSpeedBg');
  if (!bg || bg._iniciado) return;
  bg._iniciado = true;

  const W = bg.offsetWidth || window.innerWidth || 390;
  const H = bg.offsetHeight || window.innerHeight || 844;
  const cx = W / 2;
  const cy = H / 2;
  const N = 32;
  const streaks = [];

  // Crear rayos desde el centro hacia afuera
  for (let i = 0; i < N; i++) {
    const el = document.createElement('div');
    el.className = 'reg-streak';

    const angle = (i / N) * 2 * Math.PI;
    // Posición: desde el centro, a lo largo del ángulo
    const distMin = 30 + Math.random() * 80;
    const distMax = distMin + 80 + Math.random() * 180;
    const sx = cx + Math.cos(angle) * distMin;
    const sy = cy + Math.sin(angle) * distMin;
    const len = distMax - distMin;

    // Rotar el streak según el ángulo de su dirección
    const deg = (angle * 180 / Math.PI) + 90;

    const baseDur = 0.35 + Math.random() * 0.4;
    const delay   = Math.random() * baseDur;

    el.style.cssText = `
      left: ${sx}px;
      top: ${sy}px;
      height: ${len}px;
      transform: rotate(${deg}deg);
      transform-origin: top center;
    `;

    // Animación con keyframes via Web Animations API
    const anim = el.animate([
      { opacity: 0, transform: `rotate(${deg}deg) scaleY(0.3)` },
      { opacity: 0.9, transform: `rotate(${deg}deg) scaleY(1)`, offset: 0.15 },
      { opacity: 0.9, transform: `rotate(${deg}deg) scaleY(1)`, offset: 0.85 },
      { opacity: 0, transform: `rotate(${deg}deg) scaleY(1.4)` }
    ], {
      duration: baseDur * 1000,
      delay: delay * 1000,
      iterations: Infinity,
      easing: 'ease-in-out'
    });

    bg.appendChild(el);
    streaks.push({ el, anim, baseDur });
  }

  // Exponer función de freno para registrarChofer()
  window._frenarAnimacionRegistro = function(onComplete) {
    const SLOW_MS = 2000;
    const start = performance.now();

    function tick(now) {
      const progress = Math.min((now - start) / SLOW_MS, 1);
      const eased = 1 - Math.pow(1 - progress, 3); // ease-out cubic

      streaks.forEach(s => {
        // Estirar duración = frenar
        const newDur = s.baseDur * 1000 * (1 + eased * 7);
        s.anim.updatePlaybackRate(s.baseDur * 1000 / newDur);
      });

      if (progress < 1) {
        requestAnimationFrame(tick);
      } else {
        // Parar todo y revelar bus
        streaks.forEach(s => s.anim.pause());
        if (typeof onComplete === 'function') onComplete();
      }
    }
    requestAnimationFrame(tick);
  };
}
window.iniciarAnimacionRegistro = iniciarAnimacionRegistro;