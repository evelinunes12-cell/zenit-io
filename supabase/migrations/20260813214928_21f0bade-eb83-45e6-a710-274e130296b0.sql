ALTER TABLE public.focus_sessions
  ADD COLUMN IF NOT EXISTS topic text,
  ADD COLUMN IF NOT EXISTS rating smallint;

ALTER TABLE public.focus_sessions
  ADD CONSTRAINT focus_sessions_rating_range CHECK (rating IS NULL OR (rating >= 1 AND rating <= 5));