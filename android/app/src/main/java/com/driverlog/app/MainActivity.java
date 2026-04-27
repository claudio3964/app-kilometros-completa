package com.driverlog.app;
 
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.os.Build;
import android.os.Bundle;
import android.webkit.WebSettings;
import com.getcapacitor.BridgeActivity;
 
public class MainActivity extends BridgeActivity {
    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
 
        // ── Canal de notificaciones alta prioridad ──────────────────────
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            NotificationManager nm = getSystemService(NotificationManager.class);
 
            // Canal para mensajes y asignaciones
            NotificationChannel chMensajes = new NotificationChannel(
                "mensajes_driver",
                "Mensajes de Tránsito",
                NotificationManager.IMPORTANCE_HIGH
            );
            chMensajes.setDescription("Asignaciones y mensajes urgentes de tránsito");
            chMensajes.enableVibration(true);
            chMensajes.enableLights(true);
            nm.createNotificationChannel(chMensajes);
 
            // Canal para guardias
            NotificationChannel chGuardias = new NotificationChannel(
                "guardias_driver",
                "Alertas de Guardia",
                NotificationManager.IMPORTANCE_HIGH
            );
            chGuardias.setDescription("Avisos de horas de guardia");
            chGuardias.enableVibration(true);
            chGuardias.enableLights(true);
            nm.createNotificationChannel(chGuardias);
 
            // Canal default
            NotificationChannel chDefault = new NotificationChannel(
                "default",
                "General",
                NotificationManager.IMPORTANCE_HIGH
            );
            chDefault.enableVibration(true);
            nm.createNotificationChannel(chDefault);
        }
        // ────────────────────────────────────────────────────────────────
 
        android.webkit.WebView webView = getBridge().getWebView();
        webView.clearCache(true);
        webView.getSettings().setCacheMode(WebSettings.LOAD_NO_CACHE);
    }
}
 
