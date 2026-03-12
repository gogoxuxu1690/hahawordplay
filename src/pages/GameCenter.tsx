import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Layers, Shuffle, CheckCircle, PenTool, Puzzle, Brain, Crosshair, Ear, Bird, Mic, Dices, Hammer, BookType, Headphones, HelpCircle, ArrowRightLeft, TreePine, Anchor, Key } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { supabase } from '@/integrations/supabase/client';

interface Group {
  id: string;
  name: string;
  emoji: string;
  icon_name: string | null;
}

const GroupIcon = ({ group }: { group: Group }) => {
  if (group.icon_name && group.icon_name.startsWith('http')) {
    return <img src={group.icon_name} alt="" className="w-[18px] h-[18px] rounded object-cover" />;
  }
  return <span>{group.emoji || '📚'}</span>;
};

const vocabGames = [
  { id: 'flashcards', name: 'Flashcards', icon: Layers, color: 'bg-coral', desc: 'Flip to reveal' },
  { id: 'multiple-choice', name: 'Multiple Choice', icon: CheckCircle, color: 'bg-mint', desc: 'Pick the right answer' },
  { id: 'matching', name: 'Matching', icon: Puzzle, color: 'bg-sky', desc: 'Connect pairs' },
  { id: 'fill-blanks', name: 'Fill in Blanks', icon: PenTool, color: 'bg-sunny', desc: 'Complete the word' },
  { id: 'word-scramble', name: 'Word Scramble', icon: Shuffle, color: 'bg-lavender', desc: 'Unscramble letters' },
  { id: 'memory-match', name: 'Memory Match', icon: Brain, color: 'bg-rose', desc: 'Find matching pairs' },
  { id: 'word-shooter', name: 'Word Shooter', icon: Crosshair, color: 'bg-coral', desc: 'Shoot the right word' },
  { id: 'picture-dictation', name: 'Picture Dictation', icon: Ear, color: 'bg-sky', desc: 'Listen & pick the image' },
  { id: 'woodpecker', name: 'Woodpecker', icon: Bird, color: 'bg-mint', desc: 'Peck the right caterpillar' },
  { id: 'voice-master', name: 'Voice Master', icon: Mic, color: 'bg-lavender', desc: 'Speak & master words' },
  { id: 'lucky-voice', name: 'Lucky Voice', icon: Dices, color: 'bg-sunny', desc: 'Spin & speak to win' },
  { id: 'mole-whacker', name: 'Mole Whacker', icon: Hammer, color: 'bg-rose', desc: 'Listen & whack the mole' },
  { id: 'garden-treasure', name: 'Garden Treasure', icon: TreePine, color: 'bg-mint', desc: 'Find hidden letters!' },
  { id: 'undersea-key-master', name: 'Undersea Key Master', icon: Key, color: 'bg-sky', desc: 'Unlock treasure chests!' },
];

const grammarGames = [
  { id: 'grammar-matching', name: 'Grammar Matching', icon: ArrowRightLeft, color: 'bg-sky', desc: 'Match Q&A pairs' },
  { id: 'grammar-dictation', name: 'Grammar Dictation', icon: Headphones, color: 'bg-mint', desc: 'Listen & type' },
  { id: 'quiz-master', name: 'Quiz Master', icon: HelpCircle, color: 'bg-lavender', desc: 'Answer the question' },
  { id: 'sentence-scramble', name: 'Sentence Scramble', icon: Shuffle, color: 'bg-sunny', desc: 'Reorder the sentence' },
];

const GameCenter = () => {
  const navigate = useNavigate();
  const [groups, setGroups] = useState<Group[]>([]);
  const [grammarGroups, setGrammarGroups] = useState<Group[]>([]);
  const [selectedGroups, setSelectedGroups] = useState<string[]>([]);
  const [selectedGrammarGroups, setSelectedGrammarGroups] = useState<string[]>([]);
  const [wordCount, setWordCount] = useState(0);
  const [pairCount, setPairCount] = useState(0);

  useEffect(() => {
    supabase.from('groups').select('*').order('created_at').then(({ data }) => setGroups(data || []));
    supabase.from('grammar_groups').select('*').order('created_at').then(({ data }) => setGrammarGroups(data || []));
  }, []);

  useEffect(() => {
    if (selectedGroups.length === 0) { setWordCount(0); return; }
    supabase.from('words').select('id', { count: 'exact' }).in('group_id', selectedGroups)
      .then(({ count }) => setWordCount(count || 0));
  }, [selectedGroups]);

  useEffect(() => {
    if (selectedGrammarGroups.length === 0) { setPairCount(0); return; }
    supabase.from('grammar_pairs').select('id', { count: 'exact' }).in('group_id', selectedGrammarGroups)
      .then(({ count }) => setPairCount(count || 0));
  }, [selectedGrammarGroups]);

  const toggleGroup = (id: string) => setSelectedGroups(prev => prev.includes(id) ? prev.filter(g => g !== id) : [...prev, id]);
  const toggleGrammarGroup = (id: string) => setSelectedGrammarGroups(prev => prev.includes(id) ? prev.filter(g => g !== id) : [...prev, id]);

  const startVocabGame = (gameId: string) => {
    if (selectedGroups.length === 0 || wordCount < 2) return;
    navigate(`/play/${gameId}?groups=${selectedGroups.join(',')}`);
  };

  const startGrammarGame = (gameId: string) => {
    if (selectedGrammarGroups.length === 0 || pairCount < 2) return;
    navigate(`/play/${gameId}?grammar_groups=${selectedGrammarGroups.join(',')}`);
  };

  return (
    <div>
      <h1 className="text-3xl font-display font-bold text-foreground mb-2">Game Center 🎮</h1>
      <p className="text-muted-foreground mb-8">Select groups, then pick a game!</p>

      {/* Vocabulary Section */}
      <div className="mb-10">
        <h2 className="text-lg font-display font-bold text-foreground mb-3">📚 Vocabulary Groups</h2>
        {groups.length === 0 ? (
          <p className="text-muted-foreground text-sm">No word groups yet. Add words first!</p>
        ) : (
          <div className="flex flex-wrap gap-3">
            {groups.map(group => (
              <motion.button key={group.id} whileTap={{ scale: 0.95 }} onClick={() => toggleGroup(group.id)}
                className={`flex items-center gap-2 px-4 py-2.5 rounded-xl font-semibold transition-all ${
                  selectedGroups.includes(group.id) ? 'bg-primary text-primary-foreground game-card-shadow' : 'bg-card text-foreground border border-border hover:border-primary/50'
                }`}>
                <GroupIcon group={group} />
                <span>{group.name}</span>
              </motion.button>
            ))}
          </div>
        )}
        {selectedGroups.length > 0 && <p className="text-sm text-muted-foreground mt-2">{wordCount} words selected</p>}

        <h3 className="text-base font-display font-bold text-foreground mt-4 mb-3">Vocabulary Games</h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {vocabGames.map((game, i) => (
            <motion.button key={game.id} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }}
              whileHover={{ scale: 1.03, y: -4 }} whileTap={{ scale: 0.97 }} onClick={() => startVocabGame(game.id)}
              disabled={selectedGroups.length === 0 || wordCount < 2}
              className={`p-6 rounded-2xl text-left game-card-shadow transition-all disabled:opacity-40 disabled:cursor-not-allowed ${game.color}`}>
              <game.icon className="w-8 h-8 mb-3 text-foreground" />
              <h3 className="font-display font-bold text-lg text-foreground">{game.name}</h3>
              <p className="text-sm text-foreground/70 mt-1">{game.desc}</p>
            </motion.button>
          ))}
        </div>
      </div>

      {/* Grammar Section */}
      <div className="mb-8">
        <h2 className="text-lg font-display font-bold text-foreground mb-3">📝 Grammar Groups</h2>
        {grammarGroups.length === 0 ? (
          <p className="text-muted-foreground text-sm">No grammar groups yet. Add grammar pairs first!</p>
        ) : (
          <div className="flex flex-wrap gap-3">
            {grammarGroups.map(group => (
              <motion.button key={group.id} whileTap={{ scale: 0.95 }} onClick={() => toggleGrammarGroup(group.id)}
                className={`flex items-center gap-2 px-4 py-2.5 rounded-xl font-semibold transition-all ${
                  selectedGrammarGroups.includes(group.id) ? 'bg-primary text-primary-foreground game-card-shadow' : 'bg-card text-foreground border border-border hover:border-primary/50'
                }`}>
                <GroupIcon group={group} />
                <span>{group.name}</span>
              </motion.button>
            ))}
          </div>
        )}
        {selectedGrammarGroups.length > 0 && <p className="text-sm text-muted-foreground mt-2">{pairCount} pairs selected</p>}

        <h3 className="text-base font-display font-bold text-foreground mt-4 mb-3">Grammar Games</h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {grammarGames.map((game, i) => (
            <motion.button key={game.id} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }}
              whileHover={{ scale: 1.03, y: -4 }} whileTap={{ scale: 0.97 }} onClick={() => startGrammarGame(game.id)}
              disabled={selectedGrammarGroups.length === 0 || pairCount < 2}
              className={`p-6 rounded-2xl text-left game-card-shadow transition-all disabled:opacity-40 disabled:cursor-not-allowed ${game.color}`}>
              <game.icon className="w-8 h-8 mb-3 text-foreground" />
              <h3 className="font-display font-bold text-lg text-foreground">{game.name}</h3>
              <p className="text-sm text-foreground/70 mt-1">{game.desc}</p>
            </motion.button>
          ))}
        </div>
      </div>
    </div>
  );
};

export default GameCenter;
