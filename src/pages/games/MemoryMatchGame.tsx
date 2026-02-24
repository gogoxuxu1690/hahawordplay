import { useState, useMemo, useEffect } from 'react';
import { motion } from 'framer-motion';
import { useGameWords, useRecordResult } from '@/hooks/useGameWords';
import { GameResults } from '@/components/GameResults';

interface Card {
  id: string;
  wordId: string;
  type: 'word' | 'image';
  content: string;
}

const MemoryMatchGame = () => {
  const { words, loading } = useGameWords(6);
  const { recordResult, saveSession } = useRecordResult();
  const [cards, setCards] = useState<Card[]>([]);
  const [flipped, setFlipped] = useState<Set<string>>(new Set());
  const [matched, setMatched] = useState<Set<string>>(new Set());
  const [selected, setSelected] = useState<string[]>([]);
  const [score, setScore] = useState(0);
  const [moves, setMoves] = useState(0);
  const [finished, setFinished] = useState(false);

  useEffect(() => {
    if (words.length === 0) return;
    const newCards: Card[] = [];
    words.forEach(w => {
      newCards.push({ id: `word-${w.id}`, wordId: w.id, type: 'word', content: w.word });
      newCards.push({ id: `img-${w.id}`, wordId: w.id, type: 'image', content: w.image_url || w.word[0] });
    });
    // Shuffle
    for (let i = newCards.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [newCards[i], newCards[j]] = [newCards[j], newCards[i]];
    }
    setCards(newCards);
  }, [words]);

  const handleFlip = async (cardId: string) => {
    if (flipped.has(cardId) || matched.has(cardId) || selected.length >= 2) return;

    const newSelected = [...selected, cardId];
    setSelected(newSelected);
    setFlipped(prev => new Set([...prev, cardId]));

    if (newSelected.length === 2) {
      setMoves(m => m + 1);
      const card1 = cards.find(c => c.id === newSelected[0])!;
      const card2 = cards.find(c => c.id === newSelected[1])!;

      if (card1.wordId === card2.wordId) {
        setMatched(prev => new Set([...prev, newSelected[0], newSelected[1]]));
        setScore(s => s + 10);
        await recordResult(card1.wordId, true);
        setSelected([]);

        if (matched.size + 2 >= cards.length) {
          const correctCount = (matched.size + 2) / 2;
          await saveSession('memory-match', correctCount * 10, words.length, correctCount);
          setTimeout(() => setFinished(true), 500);
        }
      } else {
        await recordResult(card1.wordId, false);
        setTimeout(() => {
          setFlipped(prev => {
            const next = new Set(prev);
            next.delete(newSelected[0]);
            next.delete(newSelected[1]);
            return next;
          });
          setSelected([]);
        }, 1000);
      }
    }
  };

  const reset = () => {
    setFlipped(new Set());
    setMatched(new Set());
    setSelected([]);
    setScore(0);
    setMoves(0);
    setFinished(false);
    // Re-shuffle
    const shuffled = [...cards].sort(() => Math.random() - 0.5);
    setCards(shuffled);
  };

  if (loading) return <div className="text-center py-20 text-muted-foreground">Loading...</div>;
  if (words.length < 2) return <div className="text-center py-20 text-muted-foreground">Need at least 2 words!</div>;
  if (finished) return <GameResults score={score} total={words.length} correct={matched.size / 2} gameType="memory-match" onPlayAgain={reset} />;

  const cols = cards.length <= 8 ? 4 : cards.length <= 12 ? 4 : 4;

  return (
    <div className="max-w-2xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-display font-bold text-foreground">Memory Match 🧠</h1>
        <span className="text-sm text-muted-foreground font-semibold">Moves: {moves} · Score: {score}</span>
      </div>

      <div className={`grid grid-cols-${cols} gap-3`} style={{ gridTemplateColumns: `repeat(${cols}, 1fr)` }}>
        {cards.map(card => {
          const isFlipped = flipped.has(card.id) || matched.has(card.id);
          const isMatched = matched.has(card.id);
          return (
            <motion.button
              key={card.id}
              whileTap={{ scale: 0.95 }}
              onClick={() => handleFlip(card.id)}
              className={`aspect-square rounded-xl flex items-center justify-center text-center p-2 transition-all ${
                isMatched ? 'bg-secondary/30 ring-2 ring-secondary' :
                isFlipped ? 'bg-card game-card-shadow' :
                'bg-primary/20 hover:bg-primary/30 cursor-pointer'
              }`}
            >
              {isFlipped ? (
                <motion.div initial={{ rotateY: 90 }} animate={{ rotateY: 0 }} transition={{ duration: 0.3 }}>
                  {card.type === 'image' && card.content.startsWith('http') ? (
                    <img src={card.content} alt="?" className="w-full h-full object-cover rounded-lg" />
                  ) : card.type === 'image' ? (
                    <span className="text-3xl font-display font-bold text-primary">{card.content}</span>
                  ) : (
                    <span className="text-sm font-bold text-foreground">{card.content}</span>
                  )}
                </motion.div>
              ) : (
                <span className="text-2xl">❓</span>
              )}
            </motion.button>
          );
        })}
      </div>
    </div>
  );
};

export default MemoryMatchGame;
