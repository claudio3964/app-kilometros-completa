package com.driverlog.app.data

import android.Manifest
import android.content.Intent
import android.content.pm.PackageManager
import android.net.Uri
import android.os.Build
import android.provider.Settings
import androidx.activity.ComponentActivity
import androidx.activity.result.contract.ActivityResultContracts
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.setValue
import androidx.core.content.ContextCompat

// ════════════════════════════════════════════════════════════════════════
// (1) CAPA PURA — sin imports de Android. ESTO es lo que se espeja en iOS.
//     La decisión de QUÉ pedir, en qué orden, y QUÉ texto mostrar vive acá.
//     En Swift se traduce línea por línea; no hay lógica de plataforma adentro.
// ════════════════════════════════════════════════════════════════════════

/** Estados del flujo de permisos. Idénticos conceptualmente en Android e iOS. */
enum class PermisoEstado {
    INICIAL,          // todavía no se pidió nada
    SOLO_BASICOS,     // ubicación "mientras se usa" concedida; falta "todo el tiempo"
    COMPLETO,         // ubicación "todo el tiempo" concedida
    DENEGADO          // sin ubicación; el GPS del viaje no va a poder arrancar
}

/**
 * Decisiones puras del flujo. No tocan APIs de Android: reciben booleanos
 * (¿está concedido X?) y devuelven qué corresponde hacer. Espejo directo en iOS.
 */
object PermisoPolitica {

    /** ¿Hay que abrir el pedido del sistema de los permisos básicos? */
    fun necesitaBasicos(fineConcedido: Boolean, coarseConcedido: Boolean): Boolean =
        !fineConcedido && !coarseConcedido

    /** Tras tener la ubicación básica, ¿corresponde ofrecer "todo el tiempo"? */
    fun debeOfrecerBackground(fineConcedido: Boolean, backgroundConcedido: Boolean): Boolean =
        fineConcedido && !backgroundConcedido

    /** Estado consolidado a partir de lo concedido. */
    fun estadoFinal(fineConcedido: Boolean, backgroundConcedido: Boolean): PermisoEstado =
        when {
            fineConcedido && backgroundConcedido -> PermisoEstado.COMPLETO
            fineConcedido                        -> PermisoEstado.SOLO_BASICOS
            else                                 -> PermisoEstado.DENEGADO
        }
}

/**
 * Textos del diálogo explicativo. Mismo copy en las dos plataformas (la UI cambia,
 * el texto no). Escrito desde el lado del chofer: dice qué pasa, no cómo está hecho.
 */
object PermisoTextos {
    const val BG_TITULO    = "Permitir ubicación todo el tiempo"
    const val BG_MENSAJE   =
        "Para registrar la llegada cuando la pantalla está apagada o la app quedó en " +
                "segundo plano, la ubicación tiene que estar en \"Permitir todo el tiempo\". " +
                "Sin esto, el viaje puede no cerrarse solo."
    const val BG_CONFIRMAR = "Abrir ajustes"
    const val BG_CANCELAR  = "Ahora no"
}

// ════════════════════════════════════════════════════════════════════════
// (2) ACTUADOR ANDROID — lo único que se reescribe en iOS (con CLLocationManager).
//     Lanza los diálogos reales del sistema y abre Ajustes para "todo el tiempo".
//     No bloquea: el usuario entra a la app conceda o no.
// ════════════════════════════════════════════════════════════════════════

class PermisosManager(private val activity: ComponentActivity) {

    /** Lo observa Compose para mostrar el diálogo explicativo de background. */
    var mostrarDialogoBackground by mutableStateOf(false)
        private set

    // Launcher de los permisos básicos (FINE/COARSE + notificaciones).
    // Se crea en el constructor → antes de que la activity llegue a STARTED,
    // que es el requisito de registerForActivityResult.
    private val launcherBasicos = activity.registerForActivityResult(
        ActivityResultContracts.RequestMultiplePermissions()
    ) {
        // Cuando se resuelve el diálogo de location: si quedó FINE y falta
        // background, encadenamos el segundo paso (el diálogo explicativo).
        if (PermisoPolitica.debeOfrecerBackground(fineConcedido(), backgroundConcedido())) {
            mostrarDialogoBackground = true
        }
    }

    /**
     * Paso 1. Pide ubicación básica + notificaciones si faltan. No bloquea.
     * Si la ubicación básica ya estaba (instalación vieja, tu Honor), saltea el
     * diálogo de location y ofrece directamente "todo el tiempo".
     */
    fun pedirBasicosSiFaltan() {
        when {
            PermisoPolitica.necesitaBasicos(fineConcedido(), coarseConcedido()) -> {
                val permisos = mutableListOf(
                    Manifest.permission.ACCESS_FINE_LOCATION,
                    Manifest.permission.ACCESS_COARSE_LOCATION
                )
                if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
                    permisos.add(Manifest.permission.POST_NOTIFICATIONS)
                }
                launcherBasicos.launch(permisos.toTypedArray())
            }
            PermisoPolitica.debeOfrecerBackground(fineConcedido(), backgroundConcedido()) -> {
                mostrarDialogoBackground = true
            }
            Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU && !notifConcedido() -> {
                launcherBasicos.launch(arrayOf(Manifest.permission.POST_NOTIFICATIONS))
            }
        }
    }

    /**
     * Paso 2. El usuario aceptó el diálogo → lo llevamos a Ajustes de la app.
     * En Android 11+ "todo el tiempo" NO tiene popup: se elige a mano en Ajustes.
     */
    fun confirmarBackground() {
        mostrarDialogoBackground = false
        val intent = Intent(
            Settings.ACTION_APPLICATION_DETAILS_SETTINGS,
            Uri.fromParts("package", activity.packageName, null)
        )
        activity.startActivity(intent)
    }

    /** El usuario eligió "Ahora no". No insistimos en esta sesión. */
    fun cancelarBackground() {
        mostrarDialogoBackground = false
    }

    /** Estado actual, por si la UI quiere mostrarlo en algún lado. */
    fun estado(): PermisoEstado =
        PermisoPolitica.estadoFinal(fineConcedido(), backgroundConcedido())

    // ── Chequeos (Android-específicos) ──────────────────────────────────
    private fun concedido(permiso: String) =
        ContextCompat.checkSelfPermission(activity, permiso) == PackageManager.PERMISSION_GRANTED

    fun fineConcedido()   = concedido(Manifest.permission.ACCESS_FINE_LOCATION)
    fun coarseConcedido() = concedido(Manifest.permission.ACCESS_COARSE_LOCATION)

    fun backgroundConcedido(): Boolean =
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q)
            concedido(Manifest.permission.ACCESS_BACKGROUND_LOCATION)
        else true   // antes de Android 10 no existe el permiso → se da por concedido

    fun notifConcedido(): Boolean =
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU)
            concedido(Manifest.permission.POST_NOTIFICATIONS)
        else true
}

// ════════════════════════════════════════════════════════════════════════
// (3) UI — diálogo de Compose. Solo Android. En iOS esto es un .alert de SwiftUI
//     usando los MISMOS textos de PermisoTextos.
// ════════════════════════════════════════════════════════════════════════

@Composable
fun DialogoBackground(onConfirmar: () -> Unit, onCancelar: () -> Unit) {
    AlertDialog(
        onDismissRequest = onCancelar,
        title = { Text(PermisoTextos.BG_TITULO) },
        text  = { Text(PermisoTextos.BG_MENSAJE) },
        confirmButton = { TextButton(onClick = onConfirmar) { Text(PermisoTextos.BG_CONFIRMAR) } },
        dismissButton = { TextButton(onClick = onCancelar)  { Text(PermisoTextos.BG_CANCELAR) } }
    )
}