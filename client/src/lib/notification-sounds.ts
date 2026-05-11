/**
 * Notification Sound System — مكان الشيف البخاري
 *
 * Rules:
 * - Only staff pages (dashboard, POS, kitchen, cashier) call playNotificationSound
 * - websocket.ts NEVER plays sounds
 * - Deduplication via localStorage prevents multi-tab double-plays (3s window)
 * - newOrder: TING TING bell sound (loud, media channel)
 * - cashierOrder: short double-beep
 * - statusChange: single pulse
 * - success: short 2-note rise
 * - alert: descending 2-note
 * - onlineOrderVoice: plays the real MP4 alert sound + ting ting
 */

export type NotificationSoundType =
  | 'newOrder'
  | 'onlineOrderVoice'
  | 'cashierOrder'
  | 'statusChange'
  | 'success'
  | 'alert';

// ─── AudioContext singleton ───────────────────────────────────────────────────

let sharedCtx: AudioContext | null = null;

function getCtx(): AudioContext | null {
  try {
    if (!sharedCtx || sharedCtx.state === 'closed') {
      sharedCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
    }
    if (sharedCtx.state === 'suspended') {
      sharedCtx.resume().catch(() => {});
    }
    return sharedCtx;
  } catch {
    return null;
  }
}

// Resume AudioContext on user interaction (browser autoplay policy)
if (typeof window !== 'undefined') {
  const resume = () => {
    if (sharedCtx && sharedCtx.state === 'suspended') {
      sharedCtx.resume().catch(() => {});
    }
  };
  ['click', 'keydown', 'touchstart', 'mousedown'].forEach(evt =>
    document.addEventListener(evt, resume, { capture: true, passive: true })
  );
}

// ─── Audio unlock state (for backward compat with audio-unlock-banner) ────────

let audioUnlocked = false;

export function isAudioUnlocked(): boolean {
  return audioUnlocked || (sharedCtx?.state === 'running');
}

export async function initAudioUnlock(): Promise<void> {
  try {
    const ctx = getCtx();
    if (ctx) {
      await ctx.resume();
      audioUnlocked = ctx.state === 'running';
    }
  } catch {}
}

// ─── Sound preference persistence ────────────────────────────────────────────

const SOUND_PREF_KEY = 'chefsplace_sound_enabled';

export function getSoundEnabled(pageKey = 'default'): boolean {
  try {
    const raw = localStorage.getItem(SOUND_PREF_KEY);
    if (!raw) return true;
    const map = JSON.parse(raw) as Record<string, boolean>;
    return map[pageKey] !== false;
  } catch {
    return true;
  }
}

export function setSoundEnabled(pageKey: string, enabled: boolean): void {
  try {
    const raw = localStorage.getItem(SOUND_PREF_KEY);
    const map = raw ? (JSON.parse(raw) as Record<string, boolean>) : {};
    map[pageKey] = enabled;
    localStorage.setItem(SOUND_PREF_KEY, JSON.stringify(map));
  } catch {}
}

// ─── Deduplication: per-type, 3 second window ────────────────────────────────

const DEDUP_KEY = 'chefsplace_sound_dedup';
const DEDUP_WINDOW_MS = 600;

function isDuplicate(type: NotificationSoundType): boolean {
  try {
    const raw = localStorage.getItem(DEDUP_KEY);
    if (!raw) return false;
    const map = JSON.parse(raw) as Record<string, number>;
    return !!map[type] && Date.now() - map[type] < DEDUP_WINDOW_MS;
  } catch {
    return false;
  }
}

function markPlayed(type: NotificationSoundType): void {
  try {
    const raw = localStorage.getItem(DEDUP_KEY);
    const map = raw ? (JSON.parse(raw) as Record<string, number>) : {};
    map[type] = Date.now();
    localStorage.setItem(DEDUP_KEY, JSON.stringify(map));
  } catch {}
}

// ─── TING TING Bell Sound via Web Audio API ────────────────────────────────
// Classic metallic bell: high fundamental + stretched overtones + long decay

function playTingWebAudio(volume: number): boolean {
  try {
    const ctx = getCtx();
    if (!ctx || ctx.state !== 'running') return false;

    // Bell overtone series (slightly stretched for metallic quality)
    const partials = [
      { freq: 1760, amp: 1.0 },     // A6 — fundamental
      { freq: 3136, amp: 0.55 },    // G7 — 2nd partial
      { freq: 4400, amp: 0.30 },    // ~A7+
      { freq: 6000, amp: 0.15 },    // high shimmer
    ];

    const master = ctx.createGain();
    master.gain.value = Math.min(1.0, volume * 1.4); // loud!
    master.connect(ctx.destination);

    const now = ctx.currentTime;
    const decayTime = 0.55; // seconds — bell ring length

    partials.forEach(({ freq, amp }) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = 'sine';
      osc.frequency.value = freq;

      // Sharp attack (2ms), then exponential decay
      gain.gain.setValueAtTime(0, now);
      gain.gain.linearRampToValueAtTime(amp, now + 0.002);
      gain.gain.exponentialRampToValueAtTime(0.001, now + decayTime);

      osc.connect(gain);
      gain.connect(master);
      osc.start(now);
      osc.stop(now + decayTime);
    });

    audioUnlocked = true;
    return true;
  } catch {
    return false;
  }
}

// ─── WAV Ting Bell Generator (fallback when AudioContext unavailable) ─────────

function generateTingWav(volume = 0.9, sampleRate = 22050): string {
  const durationMs = 550;
  const numSamples = Math.floor((sampleRate * durationMs) / 1000);
  const buffer = new ArrayBuffer(44 + numSamples * 2);
  const view = new DataView(buffer);
  const write = (offset: number, str: string) => {
    for (let i = 0; i < str.length; i++) view.setUint8(offset + i, str.charCodeAt(i));
  };
  write(0, 'RIFF');
  view.setUint32(4, 36 + numSamples * 2, true);
  write(8, 'WAVE');
  write(12, 'fmt ');
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, 1, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * 2, true);
  view.setUint16(32, 2, true);
  view.setUint16(34, 16, true);
  write(36, 'data');
  view.setUint32(40, numSamples * 2, true);

  const partials = [
    { freq: 1760, amp: 1.0 },
    { freq: 3136, amp: 0.55 },
    { freq: 4400, amp: 0.30 },
    { freq: 6000, amp: 0.15 },
  ];

  for (let i = 0; i < numSamples; i++) {
    const t = i / sampleRate;
    const attack = Math.min(1, i / (sampleRate * 0.002));
    const decay = Math.exp(-t * 6.5); // exponential bell decay
    const env = attack * decay * volume;

    let sample = 0;
    for (const { freq, amp } of partials) {
      sample += amp * Math.sin(2 * Math.PI * freq * t);
    }
    // Normalize
    const totalAmp = partials.reduce((s, p) => s + p.amp, 0);
    sample /= totalAmp;

    view.setInt16(44 + i * 2, Math.round(sample * env * 29000), true);
  }

  const bytes = new Uint8Array(buffer);
  let binary = '';
  for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]);
  return 'data:audio/wav;base64,' + btoa(binary);
}

// ─── WAV Beep Generator (for other sound types) ───────────────────────────────

function generateBeepWav(frequencies: number[], durationMs: number, sampleRate = 22050): string {
  const numSamples = Math.floor((sampleRate * durationMs) / 1000);
  const buffer = new ArrayBuffer(44 + numSamples * 2);
  const view = new DataView(buffer);
  const write = (offset: number, str: string) => {
    for (let i = 0; i < str.length; i++) view.setUint8(offset + i, str.charCodeAt(i));
  };
  write(0, 'RIFF');
  view.setUint32(4, 36 + numSamples * 2, true);
  write(8, 'WAVE');
  write(12, 'fmt ');
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, 1, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * 2, true);
  view.setUint16(32, 2, true);
  view.setUint16(34, 16, true);
  write(36, 'data');
  view.setUint32(40, numSamples * 2, true);
  for (let i = 0; i < numSamples; i++) {
    const t = i / sampleRate;
    const attack = Math.min(1, i / (sampleRate * 0.01));
    const fade = Math.min(1, (numSamples - i) / (numSamples * 0.25));
    const env = attack * fade;
    let sample = 0;
    for (const f of frequencies) {
      sample += Math.sin(2 * Math.PI * f * t) / frequencies.length;
    }
    view.setInt16(44 + i * 2, Math.round(sample * env * 28000), true);
  }
  const bytes = new Uint8Array(buffer);
  let binary = '';
  for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]);
  return 'data:audio/wav;base64,' + btoa(binary);
}

let tingWavUrl: string | null = null;
const audioCache: Partial<Record<NotificationSoundType, string>> = {};

function getAudioDataUrl(type: NotificationSoundType): string {
  if (type === 'newOrder' || type === 'onlineOrderVoice') {
    if (!tingWavUrl) tingWavUrl = generateTingWav(0.95);
    return tingWavUrl;
  }
  if (!audioCache[type]) {
    switch (type) {
      case 'cashierOrder':
        audioCache[type] = generateBeepWav([660, 880], 180);
        break;
      case 'success':
        audioCache[type] = generateBeepWav([523, 659], 250);
        break;
      case 'statusChange':
        audioCache[type] = generateBeepWav([440], 300);
        break;
      case 'alert':
        audioCache[type] = generateBeepWav([880, 659], 300);
        break;
      default:
        (audioCache as Record<string, string>)[type] = generateBeepWav([523, 659, 784], 350);
    }
  }
  return audioCache[type]!;
}

// ─── Play a single TING via HTML Audio (media channel) ───────────────────────

async function playTingAudio(volume: number): Promise<void> {
  // Try Web Audio API first (best quality + volume control)
  if (playTingWebAudio(volume)) return;

  // Fallback: HTML Audio with WAV data URL
  try {
    const audio = new Audio(getAudioDataUrl('newOrder'));
    audio.volume = Math.min(1, volume);
    await audio.play();
    await new Promise<void>((resolve) => {
      audio.onended = () => resolve();
      audio.onerror = () => resolve();
      setTimeout(resolve, 700);
    });
  } catch {}
}

// ─── Web Audio API beep (for other sound types) ──────────────────────────────

function playBeepWebAudio(type: NotificationSoundType, volume: number): boolean {
  try {
    const ctx = getCtx();
    if (!ctx || ctx.state !== 'running') return false;

    const freqMap: Record<string, number[]> = {
      cashierOrder: [660, 880],
      success: [523, 659],
      statusChange: [440],
      alert: [880, 659],
    };
    const freqs = freqMap[type] || [523, 659, 784];
    const master = ctx.createGain();
    master.gain.value = volume;
    master.connect(ctx.destination);

    freqs.forEach((freq, i) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(master);
      osc.type = 'sine';
      osc.frequency.value = freq;
      const start = ctx.currentTime + i * 0.12;
      gain.gain.setValueAtTime(0, start);
      gain.gain.linearRampToValueAtTime(1 / freqs.length, start + 0.01);
      gain.gain.exponentialRampToValueAtTime(0.001, start + 0.28);
      osc.start(start);
      osc.stop(start + 0.3);
    });

    audioUnlocked = true;
    return true;
  } catch {
    return false;
  }
}

async function playBeep(type: NotificationSoundType, volume: number): Promise<void> {
  if (playBeepWebAudio(type, volume)) return;

  try {
    const audio = new Audio(getAudioDataUrl(type));
    audio.volume = Math.max(0, Math.min(1, volume));
    await audio.play();
    await new Promise<void>((resolve) => {
      audio.onended = () => resolve();
      audio.onerror = () => resolve();
      setTimeout(resolve, 800);
    });
  } catch {}
}

// ─── Test sound (bypasses dedup, forces unlock) ───────────────────────────────

export async function testSound(type: NotificationSoundType = 'success', volume = 0.8): Promise<boolean> {
  try {
    await initAudioUnlock();
    if (type === 'newOrder' || type === 'onlineOrderVoice') {
      await playTingAudio(volume);
      await new Promise(r => setTimeout(r, 350));
      await playTingAudio(volume);
    } else {
      await playBeep(type, volume);
    }
    return true;
  } catch {
    return false;
  }
}

// ─── Main export: playNotificationSound ──────────────────────────────────────

export async function playNotificationSound(
  type: NotificationSoundType = 'newOrder',
  volume: number = 0.95
): Promise<void> {
  if (isDuplicate(type)) return;
  markPlayed(type);

  if (type === 'newOrder' || type === 'onlineOrderVoice') {
    // TING ... TING — loud bell sound, plays through media channel
    await playTingAudio(volume);
    await new Promise(r => setTimeout(r, 320));
    await playTingAudio(volume);
    await new Promise(r => setTimeout(r, 320));
    await playTingAudio(volume * 0.85);
  } else if (type === 'cashierOrder') {
    await playBeep('cashierOrder', volume);
    await new Promise(r => setTimeout(r, 200));
    await playBeep('cashierOrder', volume * 0.8);
  } else {
    await playBeep(type, volume);
  }
}

export async function playNotificationSequence(
  types: NotificationSoundType[],
  delayMs = 300
): Promise<void> {
  for (const type of types) {
    await playNotificationSound(type);
    if (delayMs > 0) await new Promise(r => setTimeout(r, delayMs));
  }
}
