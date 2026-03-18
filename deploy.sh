#!/bin/bash

echo "🚀 Iniciando deploy APK..."

# 1. Push al repo
echo "⬆️ Subiendo cambios al repo..."
git push origin dev-rebuild-core

# 2. Copiar archivos www al proyecto Android
echo "📋 Copiando archivos www → Android..."
npx cap copy android

# 3. Build APK debug
echo "🔨 Compilando APK..."
cd android && ./gradlew assembleDebug

# 4. Copiar APK a carpeta raíz para fácil acceso
echo "📦 Copiando APK..."
cp app/build/outputs/apk/debug/app-debug.apk ../app-kilometros-latest.apk

echo "✅ Listo!"
echo "📱 app-kilometros-latest.apk — mandalo por WhatsApp e instalalo"
