import { useRef, useCallback } from 'react';

/* ── Phoneme-aware similarity engine ─────────────────────── */

// Common phonetic substitutions that speech recognition engines make
const PHONETIC_EQUIVALENCES: [string, string][] = [
  ['ph', 'f'], ['ck', 'k'], ['gh', 'f'], ['tion', 'shun'],
  ['sion', 'zhun'], ['th', 'z'], ['th', 'd'],
  ['ght', 't'], ['wr', 'r'], ['kn', 'n'],
  ['wh', 'w'], ['ce', 'se'], ['ci', 'si'],
];

function normalizePhonetic(word: string): string {
  let w = word.toLowerCase().trim().replace(/[^a-z0-9\s]/g, '');
  for (const [from, to] of PHONETIC_EQUIVALENCES) {
    w = w.replace(new RegExp(from, 'g'), to);
  }
  return w;
}

function levenshtein(a: string, b: string): number {
  const m = a.length, n = b.length;
  const dp: number[][] = Array.from({ length: m + 1 }, () => Array(n + 1).fill(0));
  for (let i = 0; i <= m; i++) dp[i][0] = i;
  for (let j = 0; j <= n; j++) dp[0][j] = j;
  for (let i = 1; i <= m; i++)
    for (let j = 1; j <= n; j++)
      dp[i][j] = a[i - 1] === b[j - 1]
        ? dp[i - 1][j - 1]
        : 1 + Math.min(dp[i - 1][j], dp[i][j - 1], dp[i - 1][j - 1]);
  return dp[m][n];
}

/**
 * Multi-strategy similarity: compares raw text AND phonetic normalization,
 * also checks if the target word appears as a substring of the spoken text.
 * Returns 0-100 score.
 */
export function advancedSimilarity(spoken: string, target: string): number {
  const a = spoken.toLowerCase().trim();
  const b = target.toLowerCase().trim();
  if (!a) return 0;
  if (a === b) return 100;

  // Strategy 1: Direct Levenshtein
  const directDist = levenshtein(a, b);
  const directScore = Math.max(0, Math.round((1 - directDist / Math.max(a.length, b.length)) * 100));

  // Strategy 2: Phonetic normalized Levenshtein
  const phonA = normalizePhonetic(a);
  const phonB = normalizePhonetic(b);
  const phonDist = levenshtein(phonA, phonB);
  const phonScore = Math.max(0, Math.round((1 - phonDist / Math.max(phonA.length, phonB.length)) * 100));

  // Strategy 3: Substring/contains check (speech API may add filler words)
  const words = a.split(/\s+/);
  let substringScore = 0;
  for (const w of words) {
    if (w === b) { substringScore = 100; break; }
    const wDist = levenshtein(w, b);
    const wScore = Math.max(0, Math.round((1 - wDist / Math.max(w.length, b.length)) * 100));
    substringScore = Math.max(substringScore, wScore);
  }

  // Strategy 4: Check phonetic version of individual words
  let phonWordScore = 0;
  for (const w of words) {
    const pw = normalizePhonetic(w);
    const pwDist = levenshtein(pw, phonB);
    const pwScore = Math.max(0, Math.round((1 - pwDist / Math.max(pw.length, phonB.length)) * 100));
    phonWordScore = Math.max(phonWordScore, pwScore);
  }

  // Take the best score across all strategies
  return Math.max(directScore, phonScore, substringScore, phonWordScore);
}

export interface SpeechRecognitionResult {
  text: string;
  accuracy: number;
  isCorrect: boolean;
}

const CORRECT_THRESHOLD = 75; // Balanced for children (0.75 confidence)

interface UseSpeechRecognitionOptions {
  lang?: string;
  onResult?: (result: SpeechRecognitionResult) => void;
  onError?: () => void;
  onStart?: () => void;
  onEnd?: () => void;
}

export function useSpeechRecognition(options: UseSpeechRecognitionOptions = {}) {
  const recognitionRef = useRef<any>(null);
  const { lang = 'en-US', onResult, onError, onStart, onEnd } = options;

  const isSupported = typeof window !== 'undefined' &&
    !!((window as any).SpeechRecognition || (window as any).webkitSpeechRecognition);

  const startListening = useCallback((targetWord: string) => {
    const SR = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SR) return;

    const recognition = new SR();
    recognition.lang = lang;
    recognition.continuous = false;
    recognition.interimResults = false;
    recognition.maxAlternatives = 5; // More alternatives for better matching

    recognitionRef.current = recognition;

    recognition.onstart = () => onStart?.();

    recognition.onresult = (event: any) => {
      let bestAccuracy = 0;
      let bestText = '';

      // Check all alternatives
      for (let i = 0; i < event.results[0].length; i++) {
        const transcript = event.results[0][i].transcript;
        const acc = advancedSimilarity(transcript, targetWord);
        if (acc > bestAccuracy) {
          bestAccuracy = acc;
          bestText = transcript;
        }
      }

      const result: SpeechRecognitionResult = {
        text: bestText,
        accuracy: bestAccuracy,
        isCorrect: bestAccuracy >= CORRECT_THRESHOLD,
      };

      onResult?.(result);
    };

    recognition.onerror = () => {
      onError?.();
    };

    recognition.onend = () => {
      onEnd?.();
    };

    recognition.start();
  }, [lang, onResult, onError, onStart, onEnd]);

  const stopListening = useCallback(() => {
    recognitionRef.current?.stop();
  }, []);

  return { isSupported, startListening, stopListening };
}
