"use strict";

const SUPABASE_URL_PUSH = "https://frjeivfpldcigklwepqt.supabase.co";
const SUPABASE_KEY_PUSH = "sb_publishable_6A7tufjD-rTAUAPfxyziyw_3kXMumzJ";

async function registrarTokenFCM() {
  try {
    if (!window.Capacitor || !window.Capacitor.isNativePlatform()) return;

    const { PushNotifications } = window.Capacitor.Plugins;
    if (!PushNotifications) return;

    // Pedir permisos
    const { Geolocation } = window.Capacitor.Plugins;
    await Geolocation.requestPermissions();
    const perm = await PushNotifications.requestPermissions();
    if (perm.receive !== 'granted') {
      console.warn('Push notifications no autorizadas');
      return;
    }

    // Registrar
    await PushNotifications.register();

// 🟢 Crear canal de notificación (Android)
await PushNotifications.createChannel({
  id: "driverlog_high",
  name: "Asignaciones de viaje",
  description: "Alertas importantes",
  importance: 5, // HIGH
  visibility: 1, // visible en lockscreen
  sound: "default",
  vibration: true
});

    // Escuchar token
    PushNotifications.addListener('registration', async (token) => {
      console.log('📱 FCM Token:', token.value);
      const driver = getDriver ? getDriver() : null;
      if (!driver || !driver.legajo) return;

      // Guardar token en Supabase
      await fetch(`${SUPABASE_URL_PUSH}/rest/v1/choferes?empresa_id=eq.cot&legajo=eq.${driver.legajo}`, {
        method: 'PATCH',
        headers: {
          'apikey': SUPABASE_KEY_PUSH,
          'Authorization': `Bearer ${SUPABASE_KEY_PUSH}`,
          'Content-Type': 'application/json',
          'Prefer': 'return=minimal'
        },
        body: JSON.stringify({ fcm_token: token.value })
      });
      console.log('✅ FCM token guardado en Supabase');
    });

    // Escuchar notificaciones recibidas
    PushNotifications.addListener('pushNotificationReceived', (notification) => {
      console.log('🔔 Push recibida:', notification);
      if (typeof consultarMensajes === 'function') consultarMensajes();
    });

    // Escuchar tap en notificación
    PushNotifications.addListener('pushNotificationActionPerformed', (action) => {
      console.log('👆 Push tapeada:', action);
      if (typeof consultarMensajes === 'function') consultarMensajes();
    });

  } catch(e) {
    console.warn('Error registrando FCM:', e.message);
  }
}

window.registrarTokenFCM = registrarTokenFCM;