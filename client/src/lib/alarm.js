/*
 * Alarm sound for reminders, generated with Web Audio (no audio file to download).
 * Browsers only allow sound after the person has interacted with the page, so we
 * unlock the audio context on the first tap/click/key press.
 */
let context = null;

const getContext = () => {
  if (typeof window === 'undefined') return null;
  const Ctor = window.AudioContext || window.webkitAudioContext;
  if (!Ctor) return null;
  if (!context) context = new Ctor();
  return context;
};

export const unlockAudio = () => {
  const ctx = getContext();
  if (ctx && ctx.state === 'suspended') ctx.resume().catch(() => {});
};

if (typeof window !== 'undefined') {
  const unlock = () => { unlockAudio(); ['pointerdown', 'keydown', 'touchstart'].forEach(name => window.removeEventListener(name, unlock)); };
  ['pointerdown', 'keydown', 'touchstart'].forEach(name => window.addEventListener(name, unlock, { passive: true }));
}

/** One "beep-beep-beep" burst starting at `at` (seconds on the audio clock). */
const burst = (ctx, at) => {
  [0, 0.18, 0.36].forEach((offset, index) => {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'square';
    osc.frequency.setValueAtTime(index === 2 ? 1175 : 880, at + offset);
    gain.gain.setValueAtTime(0.0001, at + offset);
    gain.gain.exponentialRampToValueAtTime(0.18, at + offset + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.0001, at + offset + 0.14);
    osc.connect(gain).connect(ctx.destination);
    osc.start(at + offset);
    osc.stop(at + offset + 0.16);
  });
};

/**
 * Plays the alarm in repeating bursts until stopped (or `seconds` pass).
 * Returns { stop, blocked } — `blocked` is true if the browser hasn't allowed sound yet.
 */
export const playAlarm = ({ seconds = 45 } = {}) => {
  const ctx = getContext();
  if (!ctx) return { stop: () => {}, blocked: true };
  if (ctx.state === 'suspended') ctx.resume().catch(() => {});
  let stopped = false;
  let timer = null;
  const started = Date.now();
  const loop = () => {
    if (stopped || Date.now() - started > seconds * 1000) return;
    if (ctx.state === 'running') burst(ctx, ctx.currentTime + 0.02);
    timer = setTimeout(loop, 1200);
  };
  loop();
  if (navigator.vibrate) navigator.vibrate([300, 150, 300, 150, 300]);
  return {
    stop: () => { stopped = true; clearTimeout(timer); if (navigator.vibrate) navigator.vibrate(0); },
    blocked: ctx.state !== 'running'
  };
};

/** Short preview for the settings "Test alarm" button. */
export const testAlarm = () => {
  const alarm = playAlarm({ seconds: 3 });
  return alarm;
};
