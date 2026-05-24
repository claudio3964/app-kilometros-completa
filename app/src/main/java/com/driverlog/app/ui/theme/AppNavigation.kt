package com.driverlog.app.ui.theme

import androidx.compose.foundation.layout.padding
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.DateRange
import androidx.compose.material.icons.filled.DirectionsBus
import androidx.compose.material.icons.filled.Home
import androidx.compose.material.icons.filled.Lock
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.navigation.NavType
import androidx.navigation.compose.NavHost
import androidx.navigation.compose.composable
import androidx.navigation.compose.currentBackStackEntryAsState
import androidx.navigation.compose.rememberNavController
import androidx.navigation.navArgument
import com.driverlog.app.data.ViajeRepository
import java.net.URLDecoder
import java.net.URLEncoder

private sealed class AppTab(val route: String, val label: String, val icon: ImageVector) {
    object Home : AppTab("home", "Inicio", Icons.Filled.Home)
    object Viajes : AppTab("viajes", "Viajes", Icons.Filled.DirectionsBus)
    object Guardias : AppTab("guardias", "Guardias", Icons.Filled.Lock)
    object Historial : AppTab("historial", "Historial", Icons.Filled.DateRange)
}

private val allTabs = listOf(AppTab.Home, AppTab.Viajes, AppTab.Guardias, AppTab.Historial)

private const val ROUTE_NUEVO_VIAJE =
    "nuevo_viaje?origen={origen}&destino={destino}&km={km}&tipo={tipo}"
private const val ROUTE_NUEVA_GUARDIA = "nueva_guardia"

@Composable
fun AppNavigation(
    legajo: String,
    nombre: String,
    base: String,
    tipo: String,
    repository: ViajeRepository,
    onCerrarSesion: () -> Unit
) {
    val navController = rememberNavController()
    val backStackEntry by navController.currentBackStackEntryAsState()
    val currentRoute = backStackEntry?.destination?.route

    fun navigateTab(route: String) {
        navController.navigate(route) {
            popUpTo(AppTab.Home.route) { saveState = true }
            launchSingleTop = true
            restoreState = true
        }
    }

    fun navigateNuevaGuardia() {
        navController.navigate(ROUTE_NUEVA_GUARDIA)
    }

    fun navigateNuevoViaje(
        preOrigen: String = "",
        preDestino: String = "",
        preKm: Int = 0,
        preTipo: String = ""
    ) {
        val o = URLEncoder.encode(preOrigen, "UTF-8")
        val d = URLEncoder.encode(preDestino, "UTF-8")
        val t = URLEncoder.encode(preTipo, "UTF-8")
        navController.navigate("nuevo_viaje?origen=$o&destino=$d&km=$preKm&tipo=$t")
    }

    val isOnTab = allTabs.any { it.route == currentRoute }

    Scaffold(
        bottomBar = {
            if (isOnTab) {
                NavigationBar {
                    allTabs.forEach { tab ->
                        NavigationBarItem(
                            selected = currentRoute == tab.route,
                            onClick = { navigateTab(tab.route) },
                            icon = { Icon(tab.icon, contentDescription = tab.label) },
                            label = { Text(tab.label) }
                        )
                    }
                }
            }
        }
    ) { padding ->
        NavHost(
            navController = navController,
            startDestination = AppTab.Home.route,
            modifier = Modifier.padding(paddingValues = padding)
        ) {
            composable(AppTab.Home.route) {
                MainScreen(
                    legajo = legajo,
                    nombre = nombre,
                    base = base,
                    tipo = tipo,
                    repository = repository,
                    onNuevoViaje = { navigateNuevoViaje() },
                    onVerViajes = { navigateTab(AppTab.Viajes.route) },
                    onNuevaGuardia = { navigateNuevaGuardia() },
                    onVerGuardias = { navigateTab(AppTab.Guardias.route) },
                    onHistorial = { navigateTab(AppTab.Historial.route) },
                    onCerrarSesion = onCerrarSesion
                )
            }
            composable(AppTab.Viajes.route) {
                ViajesScreen(legajo = legajo, repository = repository)
            }
            composable(AppTab.Guardias.route) {
                GuardiasScreen(legajo = legajo, repository = repository)
            }
            composable(AppTab.Historial.route) {
                HistorialScreen(legajo = legajo, repository = repository)
            }
            composable(ROUTE_NUEVA_GUARDIA) {
                NuevaGuardiaScreen(
                    legajo = legajo,
                    repository = repository,
                    onGuardada = {
                        navController.navigate(AppTab.Guardias.route) {
                            popUpTo(AppTab.Home.route) { saveState = true }
                        }
                    },
                    onCancel = { navController.popBackStack() }
                )
            }
            composable(
                route = ROUTE_NUEVO_VIAJE,
                arguments = listOf(
                    navArgument("origen") { type = NavType.StringType; defaultValue = "" },
                    navArgument("destino") { type = NavType.StringType; defaultValue = "" },
                    navArgument("km") { type = NavType.IntType; defaultValue = 0 },
                    navArgument("tipo") { type = NavType.StringType; defaultValue = "" }
                )

            ) { backStack ->
                val args = backStack.arguments
                val preOrigen = args?.getString("origen")
                    ?.let { URLDecoder.decode(it, "UTF-8") }?.takeIf { it.isNotEmpty() }
                val preDestino = args?.getString("destino")
                    ?.let { URLDecoder.decode(it, "UTF-8") }?.takeIf { it.isNotEmpty() }
                val preKm = args?.getInt("km").takeIf { it != null && it > 0 }
                val preTipo = args?.getString("tipo")
                    ?.let { URLDecoder.decode(it, "UTF-8") }?.takeIf { it.isNotEmpty() }

                NuevoViajeScreen(
                    legajo = legajo,
                    base = base,
                    repository = repository,
                    initialOrigen = preOrigen,
                    initialDestino = preDestino,
                    initialKm = preKm,
                    initialTipo = preTipo,
                    onSaved = {
                        navController.navigate(AppTab.Home.route) {
                            popUpTo(AppTab.Home.route) { inclusive = true }
                        }
                    },
                    onSavedConVuelta = { o, d, k, t -> navigateNuevoViaje(o, d, k, t) },
                    onCancel = { navController.popBackStack() }
                )
            }
        }
    }
}
