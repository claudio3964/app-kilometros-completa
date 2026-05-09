import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const FIREBASE_PROJECT_ID   = Deno.env.get("FIREBASE_PROJECT_ID")  || "driverlog-280da";
const FIREBASE_CLIENT_EMAIL = Deno.env.get("FIREBASE_CLIENT_EMAIL") || "";
const FIREBASE_PRIVATE_KEY  = (Deno.env.get("FIREBASE_PRIVATE_KEY") || "").replace(/\\n/g, "\n");
const SUPABASE_URL          = Deno.env.get("SUPABASE_URL") || "";
const SUPABASE_SERVICE_KEY  = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";

async function getFirebaseAccessToken(): Promise<string> {
  const now = Math.floor(Date.now() / 1000);
  const header  = { alg: "RS256", typ: "JWT" };
  const payload = {
    iss: FIREBASE_CLIENT_EMAIL, sub: FIREBASE_CLIENT_EMAIL,
    aud: "https://oauth2.googleapis.com/token",
    iat: now, exp: now + 3600,
    scope: "https://www.googleapis.com/auth/firebase.messaging",
  };
  const encode = (obj: object) =>
    btoa(JSON.stringify(obj)).replace(/=/g,"").replace(/\+/g,"-").replace(/\//g,"_");
  const headerB64  = encode(header);
  const payloadB64 = encode(payload);
  const sigInput   = `${headerB64}.${payloadB64}`;
  const pemBody = FIREBASE_PRIVATE_KEY
    .replace(/-----BEGIN PRIVATE KEY-----/,"")
    .replace(/-----END PRIVATE KEY-----/,"")
    .replace(/\n/g,"");
  const binaryKey = Uint8Array.from(atob(pemBody), c => c.charCodeAt(0));
  const cryptoKey = await crypto.subtle.importKey(
    "pkcs8", binaryKey,
    { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" }, false, ["sign"]
  );
  const signature = await crypto.subtle.sign(
    "RSASSA-PKCS1-v1_5", cryptoKey, new TextEncoder().encode(sigInput)
  );
  const sigB64 = btoa(String.fromCharCode(...new Uint8Array(signature)))
    .replace(/=/g,"").replace(/\+/g,"-").replace(/\//g,"_");
  const jwt = `${sigInput}.${sigB64}`;
  const tokenRes = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: `grant_type=urn:ietf:params:oauth:grant-type:jwt-bearer&assertion=${jwt}`,
  });
  const tokenData = await tokenRes.json();
  return tokenData.access_token;
}

async function enviarPushFCM(token: string, viaje: any): Promise<boolean> {
  const accessToken = await getFirebaseAccessToken();
  const message = {
    message: {
      token,
      notification: {
        title: viaje._pushTipo === "pre_llegada"
          ? "📍 Llegando a terminal"
          : "🚍 Iniciando viaje",
        body: viaje._pushTipo === "pre_llegada"
          ? `Verificando llegada a ${viaje.destino}`
          : `${viaje.origen} → ${viaje.destino} | Salida: ${viaje.departureTime}`,
      },
      data: {
        tipo: viaje._pushTipo === "pre_llegada" ? "finalizar_viaje" : "activar_viaje",
        viajeId: String(viaje.id || ""),
        origen: viaje.origen || "",
        destino: viaje.destino || "",
        departureTime: viaje.departureTime || "",
      },
      android: {
        priority: "high",
        notification: { sound: "default", channel_id: "viajes_programados" },
      },
    },
  };
  const res = await fetch(
    `https://fcm.googleapis.com/v1/projects/${FIREBASE_PROJECT_ID}/messages:send`,
    {
      method: "POST",
      headers: { "Authorization": `Bearer ${accessToken}`, "Content-Type": "application/json" },
      body: JSON.stringify(message),
    }
  );
  const result = await res.json();
  if (!res.ok) { console.error("FCM error:", JSON.stringify(result)); return false; }
  console.log("FCM enviado OK:", result.name);
  return true;
}

serve(async (_req) => {
  try {
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);
    const ahora = Date.now();

    // Ventana pre-salida: 40 segundos (el cron corre cada minuto, 40s da margen)
    const ventanaPreSalida  = 40 * 1000;
    const ventanaPreLlegada = 10 * 60 * 1000;

    const { data: jornadas, error } = await supabase
      .from("jornadas")
      .select("id, chofer_id, order_number, data")
      .eq("empresa_id", "cot");

    if (error) throw error;

    console.log(`[DEBUG] Jornadas encontradas: ${jornadas?.length || 0}`);

    if (!jornadas || jornadas.length === 0) {
      return new Response(JSON.stringify({ ok: true, enviados: 0 }), { status: 200 });
    }

    let enviados = 0;

    for (const jornada of jornadas) {
      const data = typeof jornada.data === "string" ? JSON.parse(jornada.data) : jornada.data;
      const travels = data?.travels || [];
      const choferId = jornada.chofer_id;

      if (data?.closed) continue;

      const { data: chofer } = await supabase
        .from("choferes")
        .select("fcm_token")
        .eq("legajo", choferId)
        .eq("empresa_id", "cot")
        .single();

      const fcmToken = chofer?.fcm_token;
      if (!fcmToken) {
        console.log(`[DEBUG] Sin FCM token para ${choferId}`);
        continue;
      }

      let jornadaModificada = false;

      for (const viaje of travels) {
        console.log(`[DEBUG] Viaje: ${viaje.id} status:${viaje.status} inicioProgramado:${viaje.inicioProgramado}`);

        // PRE-SALIDA: viaje programado a punto de arrancar
        if (
          viaje.status === "programado" &&
          viaje.inicioProgramado &&
          viaje.inicioProgramado >= ahora &&
          viaje.inicioProgramado <= ahora + ventanaPreSalida
        ) {
          const ok = await enviarPushFCM(fcmToken, { ...viaje, _pushTipo: "pre_salida" });
          if (ok) {
            enviados++;
            viaje.status = "en_curso";
            viaje.inicioReal = new Date().toISOString();
            jornadaModificada = true;
            console.log(`[PRE-SALIDA] Push OK + status → en_curso: ${choferId} | ${viaje.id} | ${viaje.origen} → ${viaje.destino} ${viaje.departureTime}`);
          }
        }

        // PRE-LLEGADA: viaje en curso próximo a llegar
        if (
          viaje.status === "en_curso" &&
          viaje.llegadaEstimada &&
          viaje.llegadaEstimada >= ahora &&
          viaje.llegadaEstimada <= ahora + ventanaPreLlegada
        ) {
          const ok = await enviarPushFCM(fcmToken, { ...viaje, _pushTipo: "pre_llegada" });
          if (ok) {
            enviados++;
            viaje.status = "finalizado";
            viaje.llegadaReal = new Date().toISOString();
            jornadaModificada = true;
            console.log(`[PRE-LLEGADA] Push OK + status → finalizado: ${choferId} | ${viaje.id} | ${viaje.origen} → ${viaje.destino}`);
          }
        }
      }

      // PATCH a Supabase si hubo cambios
      if (jornadaModificada) {
        const dataActualizada = { ...data, travels };
        const { error: patchError } = await supabase
          .from("jornadas")
          .update({ data: dataActualizada })
          .eq("order_number", jornada.order_number);

        if (patchError) {
          console.error(`[PATCH ERROR] jornada ${jornada.order_number}:`, patchError.message);
        } else {
          console.log(`[PATCH OK] Jornada ${jornada.order_number} actualizada`);
        }
      }
    }

    return new Response(
      JSON.stringify({ ok: true, enviados, timestamp: new Date().toISOString() }),
      { status: 200, headers: { "Content-Type": "application/json" } }
    );

  } catch (e: any) {
    console.error("Error edge function:", e.message);
    return new Response(JSON.stringify({ ok: false, error: e.message }), { status: 500 });
  }
});
