import { useCallback, useEffect, useRef } from 'react';

let globalMuted = false;
const listeners = new Set<(muted: boolean) => void>();

export function getGlobalMuted() { return globalMuted; }
export function setGlobalMuted(v: boolean) {
  globalMuted = v;
  listeners.forEach(fn => fn(v));
}
export function subscribeGlobalMuted(fn: (muted: boolean) => void) {
  listeners.add(fn);
  return () => { listeners.delete(fn); };
}

function createOscillatorSound(
  ctx: AudioContext,
  frequency: number,
  duration: number,
  type: OscillatorType = 'sine',
  gainVal = 0.3
) {
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(frequency, ctx.currentTime);
  gain.gain.setValueAtTime(gainVal, ctx.currentTime);
  gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + duration);
  osc.connect(gain);
  gain.connect(ctx.destination);
  osc.start(ctx.currentTime);
  osc.stop(ctx.currentTime + duration);
}

export function useGameSounds() {
  const ctxRef = useRef<AudioContext | null>(null);

  const getCtx = useCallback(() => {
    if (!ctxRef.current) ctxRef.current = new AudioContext();
    if (ctxRef.current.state === 'suspended') ctxRef.current.resume();
    return ctxRef.current;
  }, []);

  const playCorrect = useCallback(() => {
    if (globalMuted) return;
    const ctx = getCtx();
    // Bright ding: two quick ascending tones
    createOscillatorSound(ctx, 880, 0.15, 'sine', 0.25);
    setTimeout(() => createOscillatorSound(ctx, 1320, 0.2, 'sine', 0.2), 80);
  }, [getCtx]);

  const playLeuLeu = useCallback(() => {
    if (globalMuted) return;
    const u = new SpeechSynthesisUtterance('Lêu lêu lêu');
    u.lang = 'vi-VN';
    u.pitch = 1.5;
    u.rate = 1.2;
    speechSynthesis.speak(u);
  }, []);

  const playWrong = useCallback(() => {
    playLeuLeu();
  }, [playLeuLeu]);

  const playApplause = useCallback(() => {
    if (globalMuted) return;
    const ctx = getCtx();
    // Applause-like: burst of noise + ascending chime
    const bufferSize = ctx.sampleRate * 0.8;
    const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
      data[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / bufferSize, 1.5);
    }
    const noise = ctx.createBufferSource();
    noise.buffer = buffer;
    const filter = ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.value = 3000;
    filter.Q.value = 0.5;
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0.2, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.8);
    noise.connect(filter);
    filter.connect(gain);
    gain.connect(ctx.destination);
    noise.start();

    // Ascending chime
    [523, 659, 784, 1047].forEach((freq, i) => {
      setTimeout(() => createOscillatorSound(ctx, freq, 0.25, 'sine', 0.15), i * 120);
    });
  }, [getCtx]);

  const playFinish = useCallback((masteryPercent?: number) => {
    if (masteryPercent !== undefined && masteryPercent < 80) {
      playLeuLeu();
    } else {
      playApplause();
    }
  }, [playLeuLeu, playApplause]);

  return { playCorrect, playWrong, playFinish, playLeuLeu };
}
