CREATE TABLE public.notebooks (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  title TEXT NOT NULL,
  description TEXT,
  icon TEXT,
  color TEXT,
  subject_id UUID REFERENCES public.subjects(id) ON DELETE SET NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.notebooks TO authenticated;
GRANT ALL ON public.notebooks TO service_role;

ALTER TABLE public.notebooks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own notebooks"
  ON public.notebooks FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own notebooks"
  ON public.notebooks FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own notebooks"
  ON public.notebooks FOR UPDATE TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete their own notebooks"
  ON public.notebooks FOR DELETE TO authenticated
  USING (auth.uid() = user_id);

CREATE INDEX idx_notebooks_user_updated_at
  ON public.notebooks(user_id, updated_at DESC);

CREATE INDEX idx_notebooks_subject_id
  ON public.notebooks(subject_id)
  WHERE subject_id IS NOT NULL;

CREATE TRIGGER update_notebooks_updated_at
  BEFORE UPDATE ON public.notebooks
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();