package com.driverlog.app.ui.theme

import androidx.compose.foundation.layout.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp

@Composable
fun LoginScreen(onLoginSuccess: (String) -> Unit) {
    var legajo by remember { mutableStateOf("") }

    Column(
        modifier = Modifier.fillMaxSize().padding(32.dp),
        verticalArrangement = Arrangement.Center,
        horizontalAlignment = Alignment.CenterHorizontally
    ) {
        Text("COT Driver", fontSize = 32.sp, fontWeight = FontWeight.Bold)
        Text("Sistema de registro de kilómetros", fontSize = 14.sp)

        Spacer(modifier = Modifier.height(48.dp))

        OutlinedTextField(
            value = legajo,
            onValueChange = { legajo = it },
            label = { Text("Legajo") },
            modifier = Modifier.fillMaxWidth(),
            singleLine = true
        )

        Spacer(modifier = Modifier.height(24.dp))

        Button(
            onClick = {
                if (legajo.isNotBlank()) onLoginSuccess(legajo.trim())
            },
            modifier = Modifier.fillMaxWidth().height(50.dp),
            enabled = legajo.isNotBlank()
        ) {
            Text("Ingresar", fontSize = 16.sp)
        }
    }
}