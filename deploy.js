#!/usr/bin/env node
// =====================================================
// DEPLOY OTA — RutaUY
// Uso: node deploy.js "descripción del cambio"
// Uso con versión manual: node deploy.js "descripción" 1.8.0
// =====================================================

const fs   = require('fs');
const path = require('path');
const { execSync } = require('child_process');

// ── CONFIG ──────────────────────────────────────────
const SUPABASE_URL     = 'https://frjeivfpldcigklwepqt.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZyamVpdmZwbGRjaWdrbHdlcHF0Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3NTUxNjQ3NywiZXhwIjoyMDkxMDkyNDc3fQ.E98s7p5bvmETfVlrLABaakgyUHrTr57FvtKOgFvIzWA';
const BUCKET           = 'app-updates';
const BOOTSTRAP_PATH   = path.join(__dirname, 'www', 'app_bootstrap.js');
const VERSION_JSON_PATH= path.join(__dirname, 'version.json');

// ── ARGS ─────────────────────────────────────────────
const changelog   = process.argv[2] || 'Actualización de la app';
const versionArg  = process.argv[3] || null;

// ── LEER VERSIÓN ACTUAL ──────────────────────────────
function leerVersionActual() {
  const content = fs.readFileSync(BOOTSTRAP_PATH, 'utf8');
  const match   = content.match(/const APP_VERSION\s*=\s*['"]([^'"]+)['"]/);
  if (!match) throw new Error('No se encontró APP_VERSION en app_bootstrap.js');
  return match[1];
}

// ── INCREMENTAR VERSIÓN ──────────────────────────────
function incrementarVersion(version) {
  const parts = version.split('.').map(Number);
  parts[2] = (parts[2] || 0) + 1;
  return parts.join('.');
}

// ── ACTUALIZAR APP_BOOTSTRAP ─────────────────────────
function actualizarBootstrap(versionNueva) {
  let content = fs.readFileSync(BOOTSTRAP_PATH, 'utf8');
  content = content.replace(
    /const APP_VERSION\s*=\s*['"][^'"]+['"]/,
    `const APP_VERSION = '${versionNueva}'`
  );
  fs.writeFileSync(BOOTSTRAP_PATH, content, 'utf8');
  console.log(`✅ APP_VERSION actualizado a ${versionNueva}`);
}

// ── GENERAR VERSION.JSON ─────────────────────────────
function generarVersionJson(versionNueva) {
  const data = {
    version:   versionNueva,
    changelog,
    mandatory: false,
    fecha:     new Date().toISOString().split('T')[0]
  };
  fs.writeFileSync(VERSION_JSON_PATH, JSON.stringify(data, null, 2), 'utf8');
  console.log(`✅ version.json generado: v${versionNueva}`);
  return data;
}

// ── SUBIR A SUPABASE STORAGE ─────────────────────────
async function subirASupabase(versionNueva) {
  const fileContent = fs.readFileSync(VERSION_JSON_PATH);
  
  // Usar fetch nativo de Node 18+ o fallback
  const fetchFn = typeof fetch !== 'undefined' ? fetch : require('node-fetch');
  
  const res = await fetchFn(
    `${SUPABASE_URL}/storage/v1/object/${BUCKET}/version.json`,
    {
      method:  'POST',
      headers: {
        'Authorization':  `Bearer ${SUPABASE_KEY}`,
        'apikey':         SUPABASE_KEY,
        'Content-Type':   'application/json',
        'x-upsert':       'true',
        'Cache-Control':  'no-cache'
      },
      body: fileContent
    }
  );

  if (res.ok) {
    console.log(`✅ version.json subido a Supabase Storage`);
  } else {
    const err = await res.text();
    throw new Error(`Error subiendo a Supabase: ${err}`);
  }
}

// ── GIT COMMIT Y PUSH ────────────────────────────────
function gitCommitPush(versionNueva) {
  try {
    execSync('git add www/app_bootstrap.js version.json', { stdio: 'inherit' });
    execSync(`git commit -m "release: v${versionNueva} — ${changelog}"`, { stdio: 'inherit' });
    execSync('git push origin dev-rebuild-core', { stdio: 'inherit' });
    console.log(`✅ Git push completado`);
  } catch(e) {
    console.warn('⚠️ Git push falló o no había cambios:', e.message);
  }
}

// ── MAIN ─────────────────────────────────────────────
async function main() {
  console.log('\n🚀 RutaUY — Deploy OTA\n');

  const versionActual = leerVersionActual();
  const versionNueva  = versionArg || incrementarVersion(versionActual);

  console.log(`📦 Versión: ${versionActual} → ${versionNueva}`);
  console.log(`📝 Changelog: ${changelog}\n`);

  actualizarBootstrap(versionNueva);
  generarVersionJson(versionNueva);

  try {
    await subirASupabase(versionNueva);
  } catch(e) {
    console.error('❌ Error en Supabase:', e.message);
    console.log('⚠️ Continuando con git push...');
  }

  gitCommitPush(versionNueva);

  console.log(`\n✅ Deploy completado — v${versionNueva}`);
  console.log(`🔗 La app se actualizará automáticamente al abrirse\n`);
}

main().catch(e => {
  console.error('❌ Error en deploy:', e.message);
  process.exit(1);
});