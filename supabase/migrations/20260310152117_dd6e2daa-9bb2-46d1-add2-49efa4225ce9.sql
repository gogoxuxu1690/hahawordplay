
-- Grammar groups table
CREATE TABLE public.grammar_groups (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  name TEXT NOT NULL,
  emoji TEXT DEFAULT '📝',
  icon_name TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.grammar_groups ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own grammar groups" ON public.grammar_groups FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can create own grammar groups" ON public.grammar_groups FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own grammar groups" ON public.grammar_groups FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own grammar groups" ON public.grammar_groups FOR DELETE USING (auth.uid() = user_id);

-- Grammar pairs table
CREATE TABLE public.grammar_pairs (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  group_id UUID NOT NULL REFERENCES public.grammar_groups(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  question TEXT NOT NULL,
  answer TEXT NOT NULL,
  question_image_url TEXT,
  answer_image_url TEXT,
  voice_gender TEXT NOT NULL DEFAULT 'female',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.grammar_pairs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own grammar pairs" ON public.grammar_pairs FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can create own grammar pairs" ON public.grammar_pairs FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own grammar pairs" ON public.grammar_pairs FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own grammar pairs" ON public.grammar_pairs FOR DELETE USING (auth.uid() = user_id);
