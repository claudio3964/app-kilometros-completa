package com.driverlog.app

import android.Manifest
import android.content.pm.PackageManager
import android.os.Build
import android.os.Bundle
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.activity.enableEdgeToEdge
import androidx.activity.result.contract.ActivityResultContracts
import androidx.core.content.ContextCompat
import androidx.compose.runtime.*
import com.driverlog.app.data.ViajeRepository
import com.driverlog.app.ui.theme.AppNavigation
import com.driverlog.app.ui.theme.COTDriverTheme
import com.driverlog.app.ui.theme.LoginScreen
import com.driverlog.app.ui.theme.ProfileSetupScreen

class MainActivity : ComponentActivity() {

    private val requestPermissionLauncher = registerForActivityResult(
        ActivityResultContracts.RequestMultiplePermissions()
    ) { }

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        enableEdgeToEdge()

        val permisos = arrayOf(
            Manifest.permission.ACCESS_FINE_LOCATION,
            Manifest.permission.ACCESS_COARSE_LOCATION
        )
        val faltanPermisos = permisos.any {
            ContextCompat.checkSelfPermission(this, it) != PackageManager.PERMISSION_GRANTED
        }
        if (faltanPermisos) requestPermissionLauncher.launch(permisos)

        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
            requestPermissionLauncher.launch(arrayOf(Manifest.permission.POST_NOTIFICATIONS))
        }

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
                var legajoActual by remember { mutableStateOf(repository.getLegajo()) }
                var perfilCompleto by remember { mutableStateOf(repository.perfilCompleto()) }

                when {
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
