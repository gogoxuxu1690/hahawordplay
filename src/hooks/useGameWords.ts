import { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';

export interface GameWord {
  id: string;
  word: string;
  description: string | null;
  image_url: string | null;
  voice_gender: string;
}

export function useGameWords(maxWords = 10) {
  const [searchParams] = useSearchParams();
  const { user } = useAuth();
  const [words, setWords] = useState<GameWord[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const groupIds = searchParams.get('groups')?.split(',') || [];
    if (groupIds.length === 0 || !user) return;

    const fetchWords = async () => {
      // Get word progress for spaced repetition
      const { data: progress } = await supabase
        .from('word_progress')
        .select('word_id, correct_count, last_played_at')
        .eq('user_id', user.id);

      const progressMap = new Map(progress?.map(p => [p.word_id, p]) || []);

      const { data: allWords } = await supabase
        .from('words')
        .select('*')
        .in('group_id', groupIds);

      if (!allWords) { setLoading(false); return; }

      // Sort: prioritize less-mastered words
      const sorted = [...allWords].sort((a, b) => {
        const pa = progressMap.get(a.id);
        const pb = progressMap.get(b.id);
        const scoreA = pa ? pa.correct_count : 0;
        const scoreB = pb ? pb.correct_count : 0;
        return scoreA - scoreB; // least mastered first
      });

      // Shuffle within same mastery level for variety, take max
      const selected = sorted.slice(0, maxWords);
      // Shuffle selected
      for (let i = selected.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [selected[i], selected[j]] = [selected[j], selected[i]];
      }

      setWords(selected);
      setLoading(false);
    };

    fetchWords();
  }, [searchParams, user, maxWords]);

  return { words, loading };
}

export function useRecordResult() {
  const { user } = useAuth();

  const recordResult = async (wordId: string, correct: boolean) => {
    if (!user) return;

    const { data: existing } = await supabase
      .from('word_progress')
      .select('*')
      .eq('user_id', user.id)
      .eq('word_id', wordId)
      .maybeSingle();

    if (existing) {
      await supabase.from('word_progress').update({
        correct_count: correct ? existing.correct_count + 1 : existing.correct_count,
        incorrect_count: correct ? existing.incorrect_count : existing.incorrect_count + 1,
        last_played_at: new Date().toISOString(),
      }).eq('id', existing.id);
    } else {
      await supabase.from('word_progress').insert({
        user_id: user.id,
        word_id: wordId,
        correct_count: correct ? 1 : 0,
        incorrect_count: correct ? 0 : 1,
        last_played_at: new Date().toISOString(),
      });
    }
  };

  const saveSession = async (gameType: string, score: number, total: number, correct: number) => {
    if (!user) return;
    await supabase.from('game_sessions').insert({
      user_id: user.id,
      game_type: gameType,
      score,
      total_words: total,
      correct_words: correct,
    });
  };

  return { recordResult, saveSession };
}
