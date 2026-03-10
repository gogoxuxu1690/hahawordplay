import { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';

export interface GrammarPair {
  id: string;
  question: string;
  answer: string;
  question_image_url: string | null;
  answer_image_url: string | null;
  voice_gender: string;
  group_id: string;
}

export function useGrammarPairs(maxPairs = 10) {
  const [searchParams] = useSearchParams();
  const { user } = useAuth();
  const [pairs, setPairs] = useState<GrammarPair[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const groupIds = searchParams.get('grammar_groups')?.split(',') || [];
    if (groupIds.length === 0 || !user) { setLoading(false); return; }

    const fetchPairs = async () => {
      const { data } = await supabase
        .from('grammar_pairs')
        .select('*')
        .in('group_id', groupIds);

      if (!data) { setLoading(false); return; }

      const shuffled = [...data].sort(() => Math.random() - 0.5).slice(0, maxPairs);
      setPairs(shuffled);
      setLoading(false);
    };

    fetchPairs();
  }, [searchParams, user, maxPairs]);

  return { pairs, loading };
}
