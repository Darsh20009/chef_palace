/**
 * Notification Sound System — QIROX Cafe
 *
 * Rules:
 * - Only staff pages (dashboard, POS, kitchen, cashier) call playNotificationSound
 * - websocket.ts NEVER plays sounds
 * - Deduplication via in-memory map prevents multi-tab double-plays (600ms window)
 * - newOrder: TING TING bell sound (loud, media channel)
 * - cashierOrder: short double-beep
 * - statusChange: single pulse
 * - success: short 2-note rise
 * - alert: descending 2-note
 * - onlineOrderVoice: plays the real MP4 alert sound + ting ting
 *
 * AudioContext Keepalive:
 * After the first user interaction unlocks the AudioContext, a silent heartbeat
 * is played every 25 seconds to prevent the browser from suspending it.
 * This ensures sound alerts work on long-lived tabs (e.g. a POS that has been
 * open for hours without a click).
 */

export type NotificationSoundType =
  | 'newOrder'
  | 'onlineOrderVoice'
  | 'cashierOrder'
  | 'statusChange'
  | 'success'
  | 'alert';

// ─── Channel Sound Config ─────────────────────────────────────────────────────
// Each "channel" maps to a type of incoming order source.

export type SoundChannel = 'manual' | 'online' | 'car';

export interface ChannelSoundConfig {
  enabled: boolean;
  soundType: NotificationSoundType;
  volume: number; // 0.0 – 1.0
}

const CHANNEL_SOUND_KEY = 'qirox_channel_sounds';

const CHANNEL_DEFAULTS: Record<SoundChannel, ChannelSoundConfig> = {
  manual:  { enabled: true, soundType: 'newOrder',        volume: 0.6 },
  online:  { enabled: true, soundType: 'onlineOrderVoice', volume: 1.0 },
  car:     { enabled: true, soundType: 'onlineOrderVoice', volume: 1.0 },
};

export function getChannelConfig(channel: SoundChannel): ChannelSoundConfig {
  try {
    const raw = localStorage.getItem(CHANNEL_SOUND_KEY);
    if (!raw) return { ...CHANNEL_DEFAULTS[channel] };
    const map = JSON.parse(raw) as Record<SoundChannel, ChannelSoundConfig>;
    return map[channel] ? { ...CHANNEL_DEFAULTS[channel], ...map[channel] } : { ...CHANNEL_DEFAULTS[channel] };
  } catch {
    return { ...CHANNEL_DEFAULTS[channel] };
  }
}

export function setChannelConfig(channel: SoundChannel, config: Partial<ChannelSoundConfig>): void {
  try {
    const raw = localStorage.getItem(CHANNEL_SOUND_KEY);
    const map: Record<string, ChannelSoundConfig> = raw ? JSON.parse(raw) : {};
    map[channel] = { ...CHANNEL_DEFAULTS[channel], ...(map[channel] || {}), ...config };
    localStorage.setItem(CHANNEL_SOUND_KEY, JSON.stringify(map));
  } catch {}
}

export function getAllChannelConfigs(): Record<SoundChannel, ChannelSoundConfig> {
  return {
    manual: getChannelConfig('manual'),
    online: getChannelConfig('online'),
    car:    getChannelConfig('car'),
  };
}

/** Play a sound for a specific channel, respecting its enabled/volume/soundType settings. */
export async function playChannelSound(channel: SoundChannel): Promise<void> {
  const cfg = getChannelConfig(channel);
  if (!cfg.enabled) return;
  await playNotificationSound(cfg.soundType, cfg.volume);
}

// ─── AudioContext singleton ───────────────────────────────────────────────────

let sharedCtx: AudioContext | null = null;
let keepaliveTimer: ReturnType<typeof setInterval> | null = null;

function getCtx(): AudioContext | null {
  try {
    if (!sharedCtx || sharedCtx.state === 'closed') {
      sharedCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
    }
    return sharedCtx;
  } catch {
    return null;
  }
}

/** Resume the AudioContext and return true if it ends up running. */
async function ensureRunning(): Promise<boolean> {
  try {
    const ctx = getCtx();
    if (!ctx) return false;
    if (ctx.state === 'suspended') {
      await ctx.resume();
    }
    return ctx.state === 'running';
  } catch {
    return false;
  }
}

/**
 * Play a completely silent (zero-amplitude) buffer.
 * This acts as a keepalive ping — browsers keep the AudioContext alive
 * as long as audio nodes are actively being used.
 */
function playSilentPing(): void {
  try {
    const ctx = getCtx();
    if (!ctx || ctx.state !== 'running') return;
    const buf = ctx.createBuffer(1, 1, 22050);
    const src = ctx.createBufferSource();
    src.buffer = buf;
    src.connect(ctx.destination);
    src.start();
  } catch {}
}

/**
 * Start a 25-second heartbeat that keeps the AudioContext alive on long-lived
 * tabs. Called automatically after the first successful audio unlock.
 */
function startKeepalive(): void {
  if (keepaliveTimer !== null) return; // already running
  keepaliveTimer = setInterval(() => {
    if (!sharedCtx || sharedCtx.state === 'closed') {
      if (keepaliveTimer !== null) clearInterval(keepaliveTimer);
      keepaliveTimer = null;
      return;
    }
    if (sharedCtx.state === 'suspended') {
      sharedCtx.resume().then(() => playSilentPing()).catch(() => {});
    } else {
      playSilentPing();
    }
  }, 25_000);
}

// Resume AudioContext on any user interaction (browser autoplay policy)
if (typeof window !== 'undefined') {
  const unlock = async () => {
    const running = await ensureRunning();
    if (running) {
      audioUnlocked = true;
      startKeepalive();
    }
  };
  ['click', 'keydown', 'touchstart', 'mousedown', 'pointerdown'].forEach(evt =>
    document.addEventListener(evt, unlock, { capture: true, passive: true })
  );
}

// ─── Audio unlock state (for backward compat with audio-unlock-banner) ────────

let audioUnlocked = false;

export function isAudioUnlocked(): boolean {
  return audioUnlocked || (sharedCtx?.state === 'running');
}

export async function initAudioUnlock(): Promise<void> {
  try {
    const running = await ensureRunning();
    if (running) {
      audioUnlocked = true;
      startKeepalive();
    }
  } catch {}
}

// ─── Sound preference persistence ────────────────────────────────────────────

const SOUND_PREF_KEY = 'qirox_sound_enabled';

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

// ─── Deduplication: per-type, 600ms window — in-memory per tab ───────────────
// Deliberately NOT using localStorage so each tab (POS, Kitchen, etc.) has its
// own independent dedup state and they don't block each other.

const DEDUP_WINDOW_MS = 600;
const dedupMap = new Map<string, number>();

function isDuplicate(type: NotificationSoundType): boolean {
  const last = dedupMap.get(type);
  return !!last && Date.now() - last < DEDUP_WINDOW_MS;
}

function markPlayed(type: NotificationSoundType): void {
  dedupMap.set(type, Date.now());
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
    master.gain.value = Math.min(1.0, volume * 1.4);
    master.connect(ctx.destination);

    const now = ctx.currentTime;
    const decayTime = 0.55;

    partials.forEach(({ freq, amp }) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = 'sine';
      osc.frequency.value = freq;

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
    const decay = Math.exp(-t * 6.5);
    const env = attack * decay * volume;

    let sample = 0;
    for (const { freq, amp } of partials) {
      sample += amp * Math.sin(2 * Math.PI * freq * t);
    }
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
  // Ensure AudioContext is running before attempting Web Audio
  await ensureRunning();

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
  await ensureRunning();
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

// ─── MP4 asset playback with graceful fallback ───────────────────────────────

/**
 * Attempt to play `/online-order-alert.mp4`.
 * Resolves true if the file loads and plays successfully; false otherwise
 * (file missing, codec unsupported, autoplay blocked, etc.).
 * The caller should fall back to synthetic tones on false.
 */
async function playMp4WithFallback(volume: number): Promise<boolean> {
  return new Promise((resolve) => {
    try {
      const audio = new Audio('/online-order-alert.mp4');
      audio.volume = Math.max(0, Math.min(1, volume));
      // Abort after 3 s in case the file stalls (e.g. slow network or redirect)
      const timeout = setTimeout(() => {
        audio.pause();
        audio.src = '';
        resolve(false);
      }, 3000);
      audio.oncanplaythrough = () => {
        audio.play().then(() => {
          clearTimeout(timeout);
          audio.onended = () => resolve(true);
          audio.onerror = () => { clearTimeout(timeout); resolve(false); };
        }).catch(() => {
          clearTimeout(timeout);
          resolve(false);
        });
      };
      audio.onerror = () => {
        clearTimeout(timeout);
        resolve(false);
      };
      audio.load();
    } catch {
      resolve(false);
    }
  });
}

// ─── Main export: playNotificationSound ──────────────────────────────────────

export async function playNotificationSound(
  type: NotificationSoundType = 'newOrder',
  volume: number = 0.95
): Promise<void> {
  if (isDuplicate(type)) return;
  markPlayed(type);

  // Always attempt to resume the AudioContext before playing.
  // This handles the case where a browser suspends the context on a long-lived
  // tab even after the keepalive heartbeat runs (e.g. tab was in background).
  await ensureRunning();

  if (type === 'onlineOrderVoice') {
    // Try the real MP4 alert first; fall back to synthetic bell if unavailable.
    const mp4Played = await playMp4WithFallback(volume);
    if (!mp4Played) {
      await playTingAudio(volume);
      await new Promise(r => setTimeout(r, 320));
      await playTingAudio(volume);
      await new Promise(r => setTimeout(r, 320));
      await playTingAudio(volume * 0.85);
    }
  } else if (type === 'newOrder') {
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
