CREATE TABLE public.notebook_pages (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  notebook_id UUID NOT NULL REFERENCES public.notebooks(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  position INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  CONSTRAINT notebook_pages_title_not_blank CHECK (length(btrim(title)) > 0),
  CONSTRAINT notebook_pages_position_nonnegative CHECK (position >= 0)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.notebook_pages TO authenticated;
GRANT ALL ON public.notebook_pages TO service_role;

ALTER TABLE public.notebook_pages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view pages from their own notebooks"
  ON public.notebook_pages FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.notebooks
    WHERE notebooks.id = notebook_pages.notebook_id
      AND notebooks.user_id = auth.uid()
  ));

CREATE POLICY "Users can create pages in their own notebooks"
  ON public.notebook_pages FOR INSERT TO authenticated
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.notebooks
    WHERE notebooks.id = notebook_pages.notebook_id
      AND notebooks.user_id = auth.uid()
  ));

CREATE POLICY "Users can update pages from their own notebooks"
  ON public.notebook_pages FOR UPDATE TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.notebooks
    WHERE notebooks.id = notebook_pages.notebook_id
      AND notebooks.user_id = auth.uid()
  ))
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.notebooks
    WHERE notebooks.id = notebook_pages.notebook_id
      AND notebooks.user_id = auth.uid()
  ));

CREATE POLICY "Users can delete pages from their own notebooks"
  ON public.notebook_pages FOR DELETE TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.notebooks
    WHERE notebooks.id = notebook_pages.notebook_id
      AND notebooks.user_id = auth.uid()
  ));

CREATE UNIQUE INDEX idx_notebook_pages_notebook_position
  ON public.notebook_pages(notebook_id, position);

CREATE INDEX idx_notebook_pages_notebook_updated
  ON public.notebook_pages(notebook_id, updated_at DESC);

CREATE OR REPLACE FUNCTION public.assign_notebook_page_position()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  PERFORM 1 FROM public.notebooks WHERE id = NEW.notebook_id FOR UPDATE;
  SELECT COALESCE(MAX(position) + 1, 0)
    INTO NEW.position
    FROM public.notebook_pages
    WHERE notebook_id = NEW.notebook_id;
  RETURN NEW;
END;
$$;

CREATE TRIGGER assign_notebook_page_position_before_insert
  BEFORE INSERT ON public.notebook_pages
  FOR EACH ROW
  EXECUTE FUNCTION public.assign_notebook_page_position();

CREATE TRIGGER update_notebook_pages_updated_at
  BEFORE UPDATE ON public.notebook_pages
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

CREATE OR REPLACE FUNCTION public.touch_notebook_from_page()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  UPDATE public.notebooks
  SET updated_at = now()
  WHERE id = COALESCE(NEW.notebook_id, OLD.notebook_id);
  RETURN COALESCE(NEW, OLD);
END;
$$;

CREATE TRIGGER touch_notebook_after_page_change
  AFTER INSERT OR UPDATE OR DELETE ON public.notebook_pages
  FOR EACH ROW
  EXECUTE FUNCTION public.touch_notebook_from_page();