import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Layers, Shuffle, CheckCircle, PenTool, Puzzle, Brain, Crosshair, Ear, Bird, icons } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { supabase } from '@/integrations/supabase/client';

interface Group {
  id: string;
  name: string;
  emoji: string;
  icon_name: string | null;
}

const GroupIcon = ({ group }: { group: Group }) => {
  if (group.icon_name) {
    const Icon = icons[group.icon_name as keyof typeof icons];
    if (Icon && typeof Icon === 'function') return <Icon size={18} />;
  }
  return <span>{group.emoji || '📚'}</span>;
};

const games = [
  { id: 'flashcards', name: 'Flashcards', icon: Layers, color: 'bg-coral', desc: 'Flip to reveal' },
  { id: 'multiple-choice', name: 'Multiple Choice', icon: CheckCircle, color: 'bg-mint', desc: 'Pick the right answer' },
  { id: 'matching', name: 'Matching', icon: Puzzle, color: 'bg-sky', desc: 'Connect pairs' },
  { id: 'fill-blanks', name: 'Fill in Blanks', icon: PenTool, color: 'bg-sunny', desc: 'Complete the word' },
  { id: 'word-scramble', name: 'Word Scramble', icon: Shuffle, color: 'bg-lavender', desc: 'Unscramble letters' },
  { id: 'memory-match', name: 'Memory Match', icon: Brain, color: 'bg-rose', desc: 'Find matching pairs' },
  { id: 'word-shooter', name: 'Word Shooter', icon: Crosshair, color: 'bg-coral', desc: 'Shoot the right word' },
  { id: 'picture-dictation', name: 'Picture Dictation', icon: Ear, color: 'bg-sky', desc: 'Listen & pick the image' },
  { id: 'woodpecker', name: 'Woodpecker', icon: Bird, color: 'bg-mint', desc: 'Peck the right caterpillar' },
];

const GameCenter = () => {
  const navigate = useNavigate();
  const [groups, setGroups] = useState<Group[]>([]);
  const [selectedGroups, setSelectedGroups] = useState<string[]>([]);
  const [wordCount, setWordCount] = useState(0);

  useEffect(() => {
    supabase.from('groups').select('*').order('created_at').then(({ data }) => setGroups(data || []));
  }, []);

  useEffect(() => {
    if (selectedGroups.length === 0) { setWordCount(0); return; }
    supabase.from('words').select('id', { count: 'exact' }).in('group_id', selectedGroups)
      .then(({ count }) => setWordCount(count || 0));
  }, [selectedGroups]);

  const toggleGroup = (id: string) => {
    setSelectedGroups(prev => prev.includes(id) ? prev.filter(g => g !== id) : [...prev, id]);
  };

  const startGame = (gameId: string) => {
    if (selectedGroups.length === 0 || wordCount < 2) return;
    navigate(`/play/${gameId}?groups=${selectedGroups.join(',')}`);
  };

  return (
    <div>
      <h1 className="text-3xl font-display font-bold text-foreground mb-2">Game Center 🎮</h1>
      <p className="text-muted-foreground mb-8">Select groups, then pick a game!</p>

      {/* Group Selection */}
      <div className="mb-8">
        <h2 className="text-lg font-display font-bold text-foreground mb-3">Select Groups</h2>
        {groups.length === 0 ? (
          <p className="text-muted-foreground">No groups yet. Add words first!</p>
        ) : (
          <div className="flex flex-wrap gap-3">
            {groups.map(group => (
              <motion.button
                key={group.id}
                whileTap={{ scale: 0.95 }}
                onClick={() => toggleGroup(group.id)}
                className={`flex items-center gap-2 px-4 py-2.5 rounded-xl font-semibold transition-all ${
                  selectedGroups.includes(group.id)
                    ? 'bg-primary text-primary-foreground game-card-shadow'
                    : 'bg-card text-foreground border border-border hover:border-primary/50'
                }`}
              >
                <GroupIcon group={group} />
                <span>{group.name}</span>
              </motion.button>
            ))}
          </div>
        )}
        {selectedGroups.length > 0 && (
          <p className="text-sm text-muted-foreground mt-2">{wordCount} words selected</p>
        )}
      </div>

      {/* Games Grid */}
      <h2 className="text-lg font-display font-bold text-foreground mb-3">Choose a Game</h2>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {games.map((game, i) => (
          <motion.button
            key={game.id}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.08 }}
            whileHover={{ scale: 1.03, y: -4 }}
            whileTap={{ scale: 0.97 }}
            onClick={() => startGame(game.id)}
            disabled={selectedGroups.length === 0 || wordCount < 2}
            className={`p-6 rounded-2xl text-left game-card-shadow transition-all disabled:opacity-40 disabled:cursor-not-allowed ${game.color}`}
          >
            <game.icon className="w-8 h-8 mb-3 text-foreground" />
            <h3 className="font-display font-bold text-lg text-foreground">{game.name}</h3>
            <p className="text-sm text-foreground/70 mt-1">{game.desc}</p>
          </motion.button>
        ))}
      </div>
    </div>
  );
};

export default GameCenter;
