CREATE OR REPLACE FUNCTION public.protect_notebook_page_structure()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF NEW.notebook_id IS DISTINCT FROM OLD.notebook_id THEN
    RAISE EXCEPTION 'A página não pode ser movida para outro caderno';
  END IF;
  IF NEW.position IS DISTINCT FROM OLD.position THEN
    RAISE EXCEPTION 'A posição da página não pode ser alterada diretamente';
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER protect_notebook_page_structure_before_update
  BEFORE UPDATE ON public.notebook_pages
  FOR EACH ROW
  EXECUTE FUNCTION public.protect_notebook_page_structure();