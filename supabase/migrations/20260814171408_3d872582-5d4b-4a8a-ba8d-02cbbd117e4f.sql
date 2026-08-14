CREATE OR REPLACE FUNCTION public.check_study_cycle_schedule_notifications()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_tz text := 'America/Sao_Paulo';
  v_today date := (now() AT TIME ZONE 'America/Sao_Paulo')::date;
  v_supabase_url text;
  v_service_role_key text;
  rec record;
  v_title text;
  v_message text;
  v_link text;
BEGIN
  BEGIN
    SELECT decrypted_secret INTO v_supabase_url FROM vault.decrypted_secrets WHERE name = 'SUPABASE_URL' LIMIT 1;
    SELECT decrypted_secret INTO v_service_role_key FROM vault.decrypted_secrets WHERE name = 'SUPABASE_SERVICE_ROLE_KEY' LIMIT 1;
  EXCEPTION WHEN OTHERS THEN
    v_supabase_url := NULL;
    v_service_role_key := NULL;
  END;

  FOR rec IN
    SELECT sc.id, sc.user_id, sc.name, sc.start_date, sc.end_date,
           CASE
             WHEN sc.start_date = v_today + 1 THEN 'starting_1_day'
             WHEN sc.end_date = v_today + 7 THEN 'ending_7_days'
             WHEN sc.end_date = v_today + 1 THEN 'ending_1_day'
           END AS event_key
    FROM public.study_cycles sc
    WHERE sc.is_active = true
      AND (sc.start_date = v_today + 1 OR sc.end_date = v_today + 7 OR sc.end_date = v_today + 1)
  LOOP
    IF rec.event_key IS NULL THEN
      CONTINUE;
    END IF;

    v_link := '/estudos/ciclo#cycle:' || rec.id::text || ':' || rec.event_key;

    -- Idempotência: o mesmo evento lógico nunca é notificado duas vezes.
    IF EXISTS (
      SELECT 1 FROM public.notifications n
      WHERE n.user_id = rec.user_id AND n.link = v_link
    ) THEN
      CONTINUE;
    END IF;

    IF rec.event_key = 'starting_1_day' THEN
      v_title := 'Seu ciclo começa amanhã 🎯';
      v_message := 'O ciclo "' || rec.name || '" começa amanhã. Prepare-se para iniciar seu planejamento.';
    ELSIF rec.event_key = 'ending_7_days' THEN
      v_title := 'Reta final do ciclo 📚';
      v_message := 'O ciclo "' || rec.name || '" termina em 7 dias. Você ainda tem tempo para concluir seu planejamento.';
    ELSE
      v_title := 'Seu ciclo termina amanhã ⚠️';
      v_message := 'O ciclo "' || rec.name || '" termina amanhã. Aproveite os últimos ajustes do seu planejamento.';
    END IF;

    INSERT INTO public.notifications (user_id, title, message, link)
    VALUES (rec.user_id, v_title, v_message, v_link);

    BEGIN
      IF v_supabase_url IS NOT NULL AND v_service_role_key IS NOT NULL THEN
        PERFORM net.http_post(
          url := v_supabase_url || '/functions/v1/send-push',
          body := json_build_object('userId', rec.user_id, 'title', v_title,
            'body', v_message, 'url', '/estudos/ciclo')::jsonb,
          headers := json_build_object('Content-Type', 'application/json',
            'Authorization', 'Bearer ' || v_service_role_key)::jsonb
        );
      END IF;
    EXCEPTION WHEN OTHERS THEN
      NULL;
    END;
  END LOOP;
END;
$$;

SELECT cron.schedule(
  'check-study-cycle-schedule-daily',
  '10 8 * * *',
  $$SELECT public.check_study_cycle_schedule_notifications();$$
);