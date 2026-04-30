ALTER TABLE public.words ADD COLUMN is_active boolean NOT NULL DEFAULT true;
ALTER TABLE public.grammar_pairs ADD COLUMN is_active boolean NOT NULL DEFAULT true;