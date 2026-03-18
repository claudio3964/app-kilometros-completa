param(
    [string]$version = ""
)

if($version -eq ""){
    Write-Host "ERROR: Especifica la version. Ejemplo: .\deploy.ps1 -version '1.1'"
    exit 1
}

# Guardar version actual en archivo VERSION
Set-Content -Path "VERSION" -Value $version

Write-Host "Iniciando deploy APK v$version..."

Write-Host "Subiendo cambios al repo..."
git push origin dev-rebuild-core

Write-Host "Copiando archivos www a Android..."
npx cap copy android

Write-Host "Compilando APK..."
Set-Location android
.\gradlew assembleDebug
Set-Location ..

$apkName = "app-kilometros-v$version.apk"
Write-Host "Copiando APK como $apkName..."
Copy-Item "android\app\build\outputs\apk\debug\app-debug.apk" $apkName

Write-Host "Listo! $apkName generado"
Write-Host "Mandalo por WhatsApp e instalalo en el celu"
