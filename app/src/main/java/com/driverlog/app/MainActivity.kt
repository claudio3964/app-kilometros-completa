package com.driverlog.app

import android.Manifest
import android.content.pm.PackageManager
import android.os.Bundle
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.activity.enableEdgeToEdge
import androidx.activity.result.contract.ActivityResultContracts
import androidx.core.content.ContextCompat
import androidx.compose.runtime.*
import com.driverlog.app.data.ViajeRepository
import com.driverlog.app.ui.theme.COTDriverTheme
import com.driverlog.app.ui.theme.HomeScreen
import com.driverlog.app.ui.theme.LoginScreen

class MainActivity : ComponentActivity() {

    private val requestPermissionLauncher = registerForActivityResult(
        ActivityResultContracts.RequestMultiplePermissions()
    ) { /* permisos otorgados o denegados — la app sigue igual */ }

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        enableEdgeToEdge()

        // Pedir permisos GPS al arrancar
        val permisos = arrayOf(
            Manifest.permission.ACCESS_FINE_LOCATION,
            Manifest.permission.ACCESS_COARSE_LOCATION
        )
        val faltanPermisos = permisos.any {
            ContextCompat.checkSelfPermission(this, it) != PackageManager.PERMISSION_GRANTED
        }
        if (faltanPermisos) requestPermissionLauncher.launch(permisos)

        val repository = ViajeRepository(this)


        setContent {
            COTDriverTheme {
                var legajoActual by remember {
                    mutableStateOf(value = repository.getLegajo())
                }

                if (legajoActual.isEmpty()) {
                    LoginScreen(
                        onLoginSuccess = { legajo ->
                            repository.guardarLegajo(legajo)
                            legajoActual = legajo
                        }
                    )
                } else {
                    HomeScreen(
                        legajo = legajoActual,
                        repository = repository,
                        onCerrarSesion = {
                            repository.guardarLegajo("")
                            legajoActual = ""
                        }
                    )
                }
            }
        }
    }
}