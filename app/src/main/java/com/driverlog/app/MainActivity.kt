package com.driverlog.app

import android.os.Bundle
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.activity.enableEdgeToEdge
import androidx.compose.runtime.*
import com.driverlog.app.data.ViajeRepository
import com.driverlog.app.ui.theme.LoginScreen
import com.driverlog.app.ui.theme.COTDriverTheme
import com.driverlog.app.ui.theme.HomeScreen

class MainActivity : ComponentActivity() {

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        enableEdgeToEdge()

        val repository = ViajeRepository(this)

        setContent {
            COTDriverTheme {
                var legajoActual by remember {
                    mutableStateOf(repository.getLegajo())
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