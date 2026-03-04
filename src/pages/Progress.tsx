import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Trophy, Target, Zap } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';

interface Session {
  id: string;
  game_type: string;
  score: number;
  total_words: number;
  correct_words: number;
  created_at: string;
}

const gameLabels: Record<string, string> = {
  flashcards: '🃏 Flashcards',
  'multiple-choice': '❓ Multiple Choice',
  matching: '🧩 Matching',
  'fill-blanks': '✏️ Fill in Blanks',
  'word-scramble': '🔀 Word Scramble',
  'memory-match': '🧠 Memory Match',
  'word-shooter': '🎯 Word Shooter',
  'picture-dictation': '🎧 Picture Dictation',
  'woodpecker': '🐦 Woodpecker',
  'voice-master': '🎤 Voice Master',
};

const Progress = () => {
  const { user } = useAuth();
  const [sessions, setSessions] = useState<Session[]>([]);

  useEffect(() => {
    if (!user) return;
    supabase.from('game_sessions').select('*').eq('user_id', user.id).order('created_at', { ascending: false }).limit(50)
      .then(({ data }) => setSessions(data || []));
  }, [user]);

  const totalScore = sessions.reduce((sum, s) => sum + s.score, 0);
  const totalCorrect = sessions.reduce((sum, s) => sum + s.correct_words, 0);
  const totalWords = sessions.reduce((sum, s) => sum + s.total_words, 0);
  const avgMastery = totalWords > 0 ? Math.round((totalCorrect / totalWords) * 100) : 0;

  return (
    <div>
      <h1 className="text-3xl font-display font-bold text-foreground mb-2">Progress 📊</h1>
      <p className="text-muted-foreground mb-8">Track your learning journey</p>

      {/* Stats cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-8">
        {[
          { icon: Trophy, label: 'Total Score', value: totalScore, color: 'bg-sunny' },
          { icon: Zap, label: 'Games Played', value: sessions.length, color: 'bg-coral' },
          { icon: Target, label: 'Avg Mastery', value: `${avgMastery}%`, color: 'bg-mint' },
        ].map((stat, i) => (
          <motion.div
            key={stat.label}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.1 }}
            className={`${stat.color} rounded-2xl p-6 game-card-shadow`}
          >
            <stat.icon className="w-8 h-8 text-foreground mb-2" />
            <p className="text-3xl font-display font-bold text-foreground">{stat.value}</p>
            <p className="text-sm text-foreground/70">{stat.label}</p>
          </motion.div>
        ))}
      </div>

      {/* Recent sessions */}
      <h2 className="text-lg font-display font-bold text-foreground mb-3">Recent Games</h2>
      {sessions.length === 0 ? (
        <p className="text-muted-foreground">No games played yet. Go play some! 🎮</p>
      ) : (
        <div className="space-y-3">
          {sessions.map((session, i) => (
            <motion.div
              key={session.id}
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: i * 0.03 }}
              className="bg-card rounded-xl p-4 game-card-shadow flex items-center justify-between"
            >
              <div>
                <p className="font-bold text-foreground">{gameLabels[session.game_type] || session.game_type}</p>
                <p className="text-sm text-muted-foreground">{new Date(session.created_at).toLocaleDateString()}</p>
              </div>
              <div className="text-right">
                <p className="font-display font-bold text-primary">{session.score} pts</p>
                <p className="text-sm text-muted-foreground">{session.correct_words}/{session.total_words} correct</p>
              </div>
            </motion.div>
          ))}
        </div>
      )}
    </div>
  );
};

export default Progress;
