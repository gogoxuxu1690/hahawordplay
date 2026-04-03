
ALTER TABLE public.groups ADD COLUMN sort_order integer NOT NULL DEFAULT 0;

-- Initialize sort_order for existing rows based on creation order
WITH numbered AS (
  SELECT id, ROW_NUMBER() OVER (PARTITION BY user_id ORDER BY created_at) - 1 AS rn
  FROM public.groups
)
UPDATE public.groups SET sort_order = numbered.rn FROM numbered WHERE public.groups.id = numbered.id;
