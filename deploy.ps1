Write-Host "Iniciando deploy APK..."

Write-Host "Subiendo cambios al repo..."
git push origin dev-rebuild-core

Write-Host "Copiando archivos www a Android..."
npx cap copy android

Write-Host "Compilando APK..."
Set-Location android
.\gradlew assembleDebug
Set-Location ..

Write-Host "Copiando APK a raiz..."
Copy-Item "android\app\build\outputs\apk\debug\app-debug.apk" "app-kilometros-latest.apk"

Write-Host "Listo! app-kilometros-latest.apk generado"
Write-Host "Mandalo por WhatsApp e instalalo en el celu"
