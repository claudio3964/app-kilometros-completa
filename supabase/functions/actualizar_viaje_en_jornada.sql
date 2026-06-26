-- =============================================================================
-- actualizar_viaje_en_jornada
-- =============================================================================
-- Fuente de verdad versionada de la RPC. Extraída de producción el 26/06/2026
-- con pg_get_functiondef. Los viajes viven dentro de jornadas.data.travels
-- (JSONB); esta RPC recorre ese array, encuentra el viaje por id y actualiza
-- sus campos. La tabla `viajes` está MUERTA (solo 3 filas de mayo, nadie escribe
-- ahí) — la verdad del laudo está acá, en el JSONB.
--
-- -----------------------------------------------------------------------------
-- HISTORIA DEL BUG (sobrefacturación por viaje fantasma, confirmado 23/06/2026)
-- -----------------------------------------------------------------------------
-- Existían DOS funciones con el mismo nombre (overload por aridad):
--   A) (text, text, bigint, bigint)            -- vieja, sin cierre_automatico
--   B) (text, text, bigint, bigint, boolean)   -- nueva, + cierre_automatico + fold travel_stats
--
-- El cliente cancelaba llamando con 3 args (p_viaje_id, p_status, p_inicio_real=0).
-- Con 3 args, Postgres NO puede elegir entre A y B (ambas matchean el prefijo
-- (text,text,bigint) + DEFAULTs) → ERROR 42725 "function ... is not unique".
-- La cancelación fallaba SIEMPRE, de forma determinística (no era red).
-- La excepción se tragaba en el cliente → Room quedaba 'cancelado', Supabase
-- seguía 'finalizado' → el laudo lo contaba. Confirmado en 4112-20260623.
--
-- FIX: se elimina la función A (huérfana: ningún caller interno de Postgres la
-- menciona — verificado con pg_proc; la finalización ya usa B con 5 args).
-- El cliente pasa a llamar SIEMPRE a B con 5 args. Cancelar = p_status
-- 'cancelado' con los timestamps en NULL (la RPC solo escribe si IS NOT NULL,
-- así se preserva el inicioReal original y solo cambia el status).
-- =============================================================================


-- =============================================================================
-- ESTADO PREVIO AL FIX (RESPALDO — NO EJECUTAR EN PROD, solo referencia/rollback)
-- =============================================================================

-- -----------------------------------------------------------------------------
-- FUNCIÓN A (4 params) — LA QUE SE ELIMINA. Conservada solo para rollback.
-- -----------------------------------------------------------------------------
-- CREATE OR REPLACE FUNCTION public.actualizar_viaje_en_jornada(p_viaje_id text, p_status text, p_inicio_real bigint DEFAULT NULL::bigint, p_fin_real bigint DEFAULT NULL::bigint)
--  RETURNS void
--  LANGUAGE plpgsql
--  SECURITY DEFINER
--  SET search_path TO 'public', 'pg_temp'
-- AS $function$
-- DECLARE
--   v_jornada_id UUID;
--   v_data JSONB;
--   v_travels JSONB;
--   v_nuevo_travels JSONB;
--   v_viaje JSONB;
--   v_idx INT;
-- BEGIN
--   SELECT id, data INTO v_jornada_id, v_data
--   FROM jornadas
--   WHERE data->'travels' @> jsonb_build_array(jsonb_build_object('id', p_viaje_id));
--   IF v_jornada_id IS NULL THEN RETURN; END IF;
--   v_travels := v_data->'travels';
--   v_nuevo_travels := '[]'::jsonb;
--   FOR v_idx IN 0..jsonb_array_length(v_travels)-1 LOOP
--     v_viaje := v_travels->v_idx;
--     IF v_viaje->>'id' = p_viaje_id THEN
--       v_viaje := v_viaje || jsonb_build_object('status', p_status);
--       IF p_inicio_real IS NOT NULL THEN
--         v_viaje := v_viaje || jsonb_build_object('inicioReal', p_inicio_real);
--       END IF;
--       IF p_fin_real IS NOT NULL THEN
--         v_viaje := v_viaje || jsonb_build_object('finReal', p_fin_real);
--       END IF;
--     END IF;
--     v_nuevo_travels := v_nuevo_travels || jsonb_build_array(v_viaje);
--   END LOOP;
--   UPDATE jornadas
--   SET data = jsonb_set(v_data, '{travels}', v_nuevo_travels),
--       updated_at = NOW()
--   WHERE id = v_jornada_id;
-- END;
-- $function$;


-- =============================================================================
-- ESTADO ACTUAL / FUENTE DE VERDAD (FUNCIÓN B — LA QUE SE CONSERVA)
-- =============================================================================
-- Esta es la única función que debe existir después del fix.

CREATE OR REPLACE FUNCTION public.actualizar_viaje_en_jornada(p_viaje_id text, p_status text, p_inicio_real bigint DEFAULT NULL::bigint, p_fin_real bigint DEFAULT NULL::bigint, p_cierre_automatico boolean DEFAULT NULL::boolean)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  v_jornada_id UUID;
  v_data JSONB;
  v_travels JSONB;
  v_nuevo_travels JSONB;
  v_viaje JSONB;
  v_idx INT;
  v_status_anterior TEXT;
BEGIN
  SELECT id, data INTO v_jornada_id, v_data
  FROM jornadas
  WHERE data->'travels' @> jsonb_build_array(jsonb_build_object('id', p_viaje_id));
  IF v_jornada_id IS NULL THEN RETURN; END IF;
  v_travels := v_data->'travels';
  v_nuevo_travels := '[]'::jsonb;
  FOR v_idx IN 0..jsonb_array_length(v_travels)-1 LOOP
    v_viaje := v_travels->v_idx;
    IF v_viaje->>'id' = p_viaje_id THEN
      v_status_anterior := v_viaje->>'status';
      v_viaje := v_viaje || jsonb_build_object('status', p_status);
      IF p_inicio_real IS NOT NULL THEN
        v_viaje := v_viaje || jsonb_build_object('inicioReal', p_inicio_real);
      END IF;
      IF p_fin_real IS NOT NULL THEN
        v_viaje := v_viaje || jsonb_build_object('finReal', p_fin_real);
      END IF;
      IF p_cierre_automatico IS NOT NULL THEN
        v_viaje := v_viaje || jsonb_build_object('cierreAutomatico', p_cierre_automatico);
      END IF;

      -- Foldear la duración en travel_stats SOLO al cierre automático.
      IF p_status = 'finalizado'
         AND p_cierre_automatico IS TRUE
         AND v_status_anterior IS DISTINCT FROM 'finalizado' THEN
        PERFORM registrar_en_travel_stats(v_viaje);
      END IF;
    END IF;
    v_nuevo_travels := v_nuevo_travels || jsonb_build_array(v_viaje);
  END LOOP;
  UPDATE jornadas
  SET data = jsonb_set(v_data, '{travels}', v_nuevo_travels),
      updated_at = NOW()
  WHERE id = v_jornada_id;
END;
$function$;


-- =============================================================================
-- MIGRACIÓN DEL FIX (ejecutar en Supabase para eliminar el overload)
-- =============================================================================
-- Verificado antes de ejecutar:
--   - pg_proc: ninguna función interna llama a esta RPC (0 filas).
--   - La finalización ya resuelve a B (5 args) sin ambigüedad (probado a mano).
--   - La función A (4 args) queda huérfana → segura de eliminar.
--
-- DROP FUNCTION public.actualizar_viaje_en_jornada(text, text, bigint, bigint);
