package com.driverlog.app

import android.app.Application
import android.util.Log
import com.google.firebase.FirebaseApp
import com.google.firebase.messaging.FirebaseMessaging

class CotApplication : Application() {
    override fun onCreate() {
        super.onCreate()
        FirebaseApp.initializeApp(this)
        FirebaseMessaging.getInstance().token.addOnSuccessListener { token ->
            Log.d("COT", "FCM Token: $token")
            val prefs = getSharedPreferences("cot_prefs", MODE_PRIVATE)
            prefs.edit().putString("fcm_token", token).apply()
        }
    }
}