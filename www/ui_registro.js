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
    } else {
      document.getElementById('baseChoferBadge').innerText = "Base: " + (driver.base || "Montevideo");
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
        alert("Ya estás registrado en este dispositivo.");
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
    const insertRes = await fetch("".concat(SUPABASE_URL_REG, "/rest/v1/choferes?on_conflict=empresa_id,legajo"), {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "apikey": SUPABASE_KEY_REG,
        "Authorization": "Bearer ".concat(SUPABASE_KEY_REG),
        "Prefer": "resolution=merge-duplicates,return=minimal"
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
    if (!insertRes.ok) {
      const err = await insertRes.text();
      alert("Error al registrar en servidor: " + err);
      return;
    }

    // ── GUARDAR LOCAL ──
    initDriverProfile({
      legajo,
      nombre,
      base,
      tipo,
      deviceId
    });
    document.getElementById('baseChoferBadge').innerText = "Base: " + base;
    cargarSelectorOrigen(base);
    showScreen('mainScreen');

    // Arrancar bootstrap
    if (typeof iniciarBootstrap === "function") {
      iniciarBootstrap();
    }
  } catch (e) {
    alert("ERROR registrarChofer: " + e.message);
  }
}
window.registrarChofer = registrarChofer;
window.cargarSelectorOrigen = cargarSelectorOrigen;
