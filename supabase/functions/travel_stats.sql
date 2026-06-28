-- ============================================================================
-- travel_stats.sql
-- Sistema de estimación de llegada por promedios históricos de ruta.
-- Bucket: origen_cod × destino_cod × tipo_servicio × dia_semana × franja
-- Compartido entre todos los choferes (sin legajo). UPSERT acumulando n + suma_dur_ms.
-- Cascada de 4 niveles con umbral c_min=5.
--
-- VERSIONADO: 28/06/2026. Extraído del remoto (frjeivfpldcigklwepqt).
-- Estado: estimación APAGADA a propósito (ActivarViajeWorker pasa 0L).
--         No activar hasta tener muestras suficientes (>= c_min por bucket).
--
-- SEGURIDAD (RLS Escalón 3, 28/06/2026):
--   La app móvil NUNCA toca travel_stats por REST (solo Room local).
--   Todo acceso a la tabla en Supabase pasa por estas RPCs.
--   estimar_llegada y registrar_en_travel_stats son SECURITY DEFINER
--   (corren como postgres, saltean RLS). La tabla queda con RLS encendido
--   y SIN políticas de acceso anon = deny-all para REST directo.
--   Las helper (ts_*) quedan INVOKER: son puras, no tocan la tabla.
--   search_path pineado a 'public, pg_catalog' contra hijack.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- HELPERS (puras, SECURITY INVOKER — no tocan la tabla)
-- ---------------------------------------------------------------------------
-- ts_cod_lugar(text)  -> text   : normaliza un lugar a su código corto
-- ts_a_ms(jsonb)      -> bigint : convierte inicioProgramado/Real/finReal a epoch ms
-- ts_franja(int)      -> int    : mapea hora del día a franja
-- (cuerpos no modificados en esta sesión; ver remoto / extracción previa)

-- ---------------------------------------------------------------------------
-- estimar_llegada(jsonb) -> bigint   [SECURITY DEFINER]
-- Cascada de 4 niveles. Llamada desde agregar_viaje_a_jornada.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.estimar_llegada(p_viaje jsonb)
 RETURNS bigint
 LANGUAGE plpgsql
 STABLE
 SECURITY DEFINER
 SET search_path = public, pg_catalog
AS $function$
DECLARE
  c_min     int    := 5;                          -- muestras mínimas para confiar
  v_inicioP bigint := ts_a_ms(p_viaje->'inicioProgramado');
  v_oc      text   := ts_cod_lugar(p_viaje->>'origen');
  v_dc      text   := ts_cod_lugar(p_viaje->>'destino');
  v_tipo    text   := upper(trim(coalesce(p_viaje->>'tipoServicio', '')));
  v_dia int; v_franja int; v_local timestamp;
  v_n int; v_suma bigint;
BEGIN
  IF v_inicioP IS NULL OR v_oc = '' OR v_dc = '' THEN RETURN NULL; END IF;
  v_local  := to_timestamp(v_inicioP/1000.0) AT TIME ZONE 'America/Montevideo';
  v_dia    := extract(dow  FROM v_local)::int;
  v_franja := ts_franja(extract(hour FROM v_local)::int);

  -- Nivel 1: ruta x tipo x día x franja
  SELECT sum(n), sum(suma_dur_ms) INTO v_n, v_suma FROM travel_stats
   WHERE origen_cod=v_oc AND destino_cod=v_dc AND tipo_servicio=v_tipo
     AND dia_semana=v_dia AND franja=v_franja;
  IF coalesce(v_n,0) >= c_min THEN RETURN v_inicioP + (v_suma / v_n); END IF;

  -- Nivel 2: ruta x tipo x franja (junta todos los días)
  SELECT sum(n), sum(suma_dur_ms) INTO v_n, v_suma FROM travel_stats
   WHERE origen_cod=v_oc AND destino_cod=v_dc AND tipo_servicio=v_tipo
     AND franja=v_franja;
  IF coalesce(v_n,0) >= c_min THEN RETURN v_inicioP + (v_suma / v_n); END IF;

  -- Nivel 3: ruta x tipo
  SELECT sum(n), sum(suma_dur_ms) INTO v_n, v_suma FROM travel_stats
   WHERE origen_cod=v_oc AND destino_cod=v_dc AND tipo_servicio=v_tipo;
  IF coalesce(v_n,0) >= c_min THEN RETURN v_inicioP + (v_suma / v_n); END IF;

  -- Nivel 4: ruta sola
  SELECT sum(n), sum(suma_dur_ms) INTO v_n, v_suma FROM travel_stats
   WHERE origen_cod=v_oc AND destino_cod=v_dc;
  IF coalesce(v_n,0) >= c_min THEN RETURN v_inicioP + (v_suma / v_n); END IF;

  RETURN NULL;
END;
$function$;

-- ---------------------------------------------------------------------------
-- registrar_en_travel_stats(jsonb) -> void   [SECURITY DEFINER]
-- UPSERT acumulativo. Llamada desde actualizar_viaje_en_jornada (auto-close).
-- Descarta -PRU, datos incompletos y duraciones absurdas (<1min / >12h).
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.registrar_en_travel_stats(p_viaje jsonb)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path = public, pg_catalog
AS $function$
DECLARE
  v_id      text   := p_viaje->>'id';
  v_inicioP bigint := ts_a_ms(p_viaje->'inicioProgramado');
  v_inicioR bigint := ts_a_ms(p_viaje->'inicioReal');
  v_finR    bigint := ts_a_ms(p_viaje->'finReal');
  v_dur     bigint;
  v_oc text; v_dc text; v_tipo text; v_dia int; v_franja int;
  v_local timestamp;
BEGIN
  -- Descartar pruebas y datos incompletos
  IF v_id IS NULL OR v_id LIKE '%-PRU' THEN RETURN; END IF;
  IF v_inicioR IS NULL OR v_finR IS NULL OR v_inicioP IS NULL THEN RETURN; END IF;

  v_dur := v_finR - v_inicioR;
  -- Filtrar duraciones absurdas (ruido / cierres falsos): < 1 min o > 12 h
  IF v_dur < 60000 OR v_dur > 12*3600*1000 THEN RETURN; END IF;

  v_oc   := ts_cod_lugar(p_viaje->>'origen');
  v_dc   := ts_cod_lugar(p_viaje->>'destino');
  v_tipo := upper(trim(coalesce(p_viaje->>'tipoServicio', '')));
  IF v_oc = '' OR v_dc = '' OR v_tipo = '' THEN RETURN; END IF;

  -- día y franja desde la hora citada, en horario de Montevideo
  v_local  := to_timestamp(v_inicioP/1000.0) AT TIME ZONE 'America/Montevideo';
  v_dia    := extract(dow  FROM v_local)::int;
  v_franja := ts_franja(extract(hour FROM v_local)::int);

  INSERT INTO travel_stats AS t
    (origen_cod, destino_cod, tipo_servicio, dia_semana, franja, n, suma_dur_ms, updated_at)
  VALUES (v_oc, v_dc, v_tipo, v_dia, v_franja, 1, v_dur, now())
  ON CONFLICT (origen_cod, destino_cod, tipo_servicio, dia_semana, franja)
  DO UPDATE SET n           = t.n + 1,
                suma_dur_ms = t.suma_dur_ms + EXCLUDED.suma_dur_ms,
                updated_at  = now();
END;
$function$;

-- ---------------------------------------------------------------------------
-- RLS: encender deny-all sobre la tabla. Solo las RPC DEFINER de arriba acceden.
-- ---------------------------------------------------------------------------
ALTER TABLE public.travel_stats ENABLE ROW LEVEL SECURITY;
-- Sin políticas = deny-all para acceso REST directo (anon/authenticated).
-- Las RPCs SECURITY DEFINER saltean RLS y siguen funcionando.
