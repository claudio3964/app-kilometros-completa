package com.driverlog.app

import android.app.Application
import android.util.Log
import com.driverlog.app.worker.MensajesPollingWorker
import com.google.firebase.FirebaseApp
import com.google.firebase.messaging.FirebaseMessaging


class CotApplication : Application() {

    override fun onCreate() {
        super.onCreate()
        FirebaseApp.initializeApp(this)
        FirebaseMessaging.getInstance().token.addOnSuccessListener { token ->
            Log.d("COT", "FCM Token: $token")
            getSharedPreferences("cot_prefs", MODE_PRIVATE)
                .edit().putString("fcm_token", token).apply()
        }
        MensajesPollingWorker.iniciar(this)
    }

    companion object {
        // Llámalo desde LoginViewModel después del login
        fun getCachedFcmToken(app: Application): String? =
            app.getSharedPreferences("cot_prefs", MODE_PRIVATE)
                .getString("fcm_token", null)
    }
}