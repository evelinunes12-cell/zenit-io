CREATE OR REPLACE FUNCTION public.log_environment_task_change()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  actor_id uuid;
BEGIN
  IF TG_OP = 'DELETE' THEN
    IF OLD.environment_id IS NULL THEN RETURN OLD; END IF;
    actor_id := COALESCE(auth.uid(), OLD.user_id);
  ELSE
    IF NEW.environment_id IS NULL THEN RETURN NEW; END IF;
    actor_id := COALESCE(auth.uid(), NEW.user_id);
  END IF;

  -- Sem ator identificável (ex.: rotinas automáticas sem dono), não registra log
  IF actor_id IS NULL THEN
    IF TG_OP = 'DELETE' THEN RETURN OLD; ELSE RETURN NEW; END IF;
  END IF;

  IF TG_OP = 'INSERT' THEN
    INSERT INTO public.environment_activity_log (environment_id, user_id, action, entity_type, entity_id, entity_name, details)
    VALUES (NEW.environment_id, actor_id, 'created', 'task', NEW.id, NEW.subject_name, NULL);
  ELSIF TG_OP = 'UPDATE' THEN
    IF OLD.status IS DISTINCT FROM NEW.status THEN
      INSERT INTO public.environment_activity_log (environment_id, user_id, action, entity_type, entity_id, entity_name, details)
      VALUES (NEW.environment_id, actor_id, 'status_changed', 'task', NEW.id, NEW.subject_name,
              'De "' || OLD.status || '" para "' || NEW.status || '"');
    END IF;
    IF OLD.is_archived IS DISTINCT FROM NEW.is_archived AND NEW.is_archived = true THEN
      INSERT INTO public.environment_activity_log (environment_id, user_id, action, entity_type, entity_id, entity_name, details)
      VALUES (NEW.environment_id, actor_id, 'archived', 'task', NEW.id, NEW.subject_name, NULL);
    END IF;
    IF OLD.status IS NOT DISTINCT FROM NEW.status AND OLD.is_archived IS NOT DISTINCT FROM NEW.is_archived THEN
      INSERT INTO public.environment_activity_log (environment_id, user_id, action, entity_type, entity_id, entity_name, details)
      VALUES (NEW.environment_id, actor_id, 'updated', 'task', NEW.id, NEW.subject_name, NULL);
    END IF;
  ELSIF TG_OP = 'DELETE' THEN
    INSERT INTO public.environment_activity_log (environment_id, user_id, action, entity_type, entity_id, entity_name, details)
    VALUES (OLD.environment_id, actor_id, 'deleted', 'task', OLD.id, OLD.subject_name, NULL);
  END IF;

  IF TG_OP = 'DELETE' THEN RETURN OLD; ELSE RETURN NEW; END IF;
END;
$function$;

CREATE OR REPLACE FUNCTION public.auto_archive_tasks()
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  archived_task RECORD;
BEGIN
  -- Tarefas pessoais: arquivar 7 dias após a conclusão
  FOR archived_task IN
    SELECT id, user_id, subject_name
    FROM public.tasks
    WHERE status ILIKE '%conclu%'
      AND is_archived = false
      AND environment_id IS NULL
      AND updated_at < now() - interval '7 days'
  LOOP
    BEGIN
      UPDATE public.tasks
      SET is_archived = true, updated_at = now()
      WHERE id = archived_task.id;

      INSERT INTO public.notifications (user_id, title, message, link)
      VALUES (
        archived_task.user_id,
        'Tarefa Arquivada 📦',
        'Sua tarefa "' || archived_task.subject_name || '" foi arquivada automaticamente após 7 dias concluída.',
        '/archived'
      );
    EXCEPTION WHEN OTHERS THEN
      RAISE WARNING 'Falha ao arquivar tarefa %: %', archived_task.id, SQLERRM;
    END;
  END LOOP;

  -- Tarefas de grupo: arquivar 10 dias após a conclusão
  FOR archived_task IN
    SELECT id, user_id, subject_name, environment_id
    FROM public.tasks
    WHERE status ILIKE '%conclu%'
      AND is_archived = false
      AND environment_id IS NOT NULL
      AND updated_at < now() - interval '10 days'
  LOOP
    BEGIN
      UPDATE public.tasks
      SET is_archived = true, updated_at = now()
      WHERE id = archived_task.id;

      INSERT INTO public.notifications (user_id, title, message, link)
      VALUES (
        archived_task.user_id,
        'Tarefa do Grupo Arquivada 📦',
        'A tarefa "' || archived_task.subject_name || '" foi arquivada automaticamente após 10 dias concluída.',
        '/environment/' || archived_task.environment_id
      );
    EXCEPTION WHEN OTHERS THEN
      RAISE WARNING 'Falha ao arquivar tarefa %: %', archived_task.id, SQLERRM;
    END;
  END LOOP;
END;
$function$;