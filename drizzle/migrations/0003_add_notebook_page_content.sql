ALTER TABLE public.notebook_pages
  ADD COLUMN content TEXT NOT NULL DEFAULT '';

COMMENT ON COLUMN public.notebook_pages.content IS 'HTML simples produzido pelo editor da página; sem estrutura de blocos nesta etapa.';