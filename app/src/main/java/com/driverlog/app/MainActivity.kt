package com.driverlog.app

import android.os.Bundle
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.activity.enableEdgeToEdge
import androidx.compose.runtime.*
import com.driverlog.app.data.DialogoBackground
import com.driverlog.app.data.PermisosManager
import com.driverlog.app.data.ViajeRepository
import com.driverlog.app.ui.theme.AppNavigation
import com.driverlog.app.ui.theme.COTDriverTheme
import com.driverlog.app.ui.theme.LoginScreen
import com.driverlog.app.ui.theme.ProfileSetupScreen
import androidx.core.splashscreen.SplashScreen.Companion.installSplashScreen

class MainActivity : ComponentActivity() {

    private lateinit var permisosManager: PermisosManager

    override fun onCreate(savedInstanceState: Bundle?) {
        installSplashScreen()
        super.onCreate(savedInstanceState)
        enableEdgeToEdge()

        // Permisos (no bloqueante): pide ubicación básica + notificaciones, y si
        // queda concedida la básica, encadena el diálogo de "todo el tiempo".
        permisosManager = PermisosManager(this)
        permisosManager.pedirBasicosSiFaltan()

        val repository = ViajeRepository(this)

        // Verificación local de dispositivo antes de entrar a la app.
        // Si el device_id guardado no coincide con el del dispositivo actual
        // (p.ej. restauración de backup en otro teléfono), se borra el legajo
        // y se fuerza re-login para que pase la validación completa en Supabase.
        val savedDeviceId = repository.getSavedDeviceId()
        val currentDeviceId = repository.getCurrentDeviceId()
        if (savedDeviceId.isNotEmpty() && savedDeviceId != currentDeviceId) {
            repository.guardarLegajo("")
            repository.saveDeviceId("")
        }

        setContent {
            COTDriverTheme {
                // Diálogo explicativo de "Permitir todo el tiempo" (paso 2 de permisos).
                if (permisosManager.mostrarDialogoBackground) {
                    DialogoBackground(
                        onConfirmar = { permisosManager.confirmarBackground() },
                        onCancelar  = { permisosManager.cancelarBackground() }
                    )
                }

                var legajoActual by remember { mutableStateOf(repository.getLegajo()) }
                var perfilCompleto by remember { mutableStateOf(repository.perfilCompleto()) }
                var isChecking by remember { mutableStateOf(legajoActual.isEmpty()) }

                if (isChecking) {
                    LaunchedEffect(Unit) {
                        val perfil = repository.buscarLegajoPorDeviceId()
                        if (perfil != null && perfil.legajo.isNotEmpty()) {
                            repository.guardarLegajo(perfil.legajo)
                            repository.guardarPerfil(perfil.nombre, perfil.base, perfil.tipo)
                            repository.saveDeviceId(repository.getCurrentDeviceId())
                            legajoActual = perfil.legajo
                            perfilCompleto = repository.perfilCompleto()
                        }
                        isChecking = false
                    }
                }

                when {
                    isChecking -> { /* esperando respuesta de Supabase, splash cubre la pantalla */ }
                    legajoActual.isEmpty() -> LoginScreen(
                        repository = repository,
                        onLoginSuccess = { legajo ->
                            repository.guardarLegajo(legajo)
                            legajoActual = legajo
                            perfilCompleto = repository.perfilCompleto()
                        }
                    )
                    !perfilCompleto -> ProfileSetupScreen(
                        legajo = legajoActual,
                        repository = repository,
                        onPerfilGuardado = { perfilCompleto = true }
                    )
                    else -> AppNavigation(
                        legajo = legajoActual,
                        nombre = repository.getNombre(),
                        base = repository.getBase(),
                        tipo = repository.getTipo(),
                        repository = repository,
                        onCerrarSesion = {
                            repository.guardarLegajo("")
                            repository.saveDeviceId("")
                            legajoActual = ""
                            perfilCompleto = false
                        }
                    )
                }
            }
        }
    }
}