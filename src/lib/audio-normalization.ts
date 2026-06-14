const DEFAULT_VOLUME = 1;
const ENGLISH_WORD_BOOST = 1.25;
const MIN_PLAYBACK_VOLUME = 0.08;
const TARGET_RMS = 0.12;
const MAX_PEAK = 0.94;
const MIN_GAIN = 0.45;
const MAX_GAIN = 12;
const SILENCE_FLOOR = 0.000_001;

interface AudioLevelInput {
  rms: number;
  peak: number;
}

export interface AudioLevelAnalysis extends AudioLevelInput {
  sampleCount: number;
}

export interface AudioNormalizationResult extends AudioLevelAnalysis {
  gain: number;
}

type DecodableAudioBuffer = Pick<
  AudioBuffer,
  "numberOfChannels" | "getChannelData"
>;

const normalizationCache = new Map<string, Promise<number>>();

export function shouldNormalizeLocalAudioSrc(src: string): boolean {
  return (
    src.startsWith("/audio/words/") ||
    src.startsWith("/audio/language-packs/")
  );
}

export function toSafeHowlerVolume(value: number): number {
  if (!Number.isFinite(value) || value <= 0) return DEFAULT_VOLUME;
  return Math.min(DEFAULT_VOLUME, Math.max(MIN_PLAYBACK_VOLUME, value));
}

export function toSafePlaybackGain(value: number): number {
  if (!Number.isFinite(value) || value <= 0) return DEFAULT_VOLUME;
  return Math.min(MAX_GAIN, Math.max(MIN_PLAYBACK_VOLUME, value));
}

export function getLocalAudioPlaybackVolume(src: string): number {
  if (!shouldNormalizeLocalAudioSrc(src)) return DEFAULT_VOLUME;

  const normalizedSrc = src.toLowerCase();
  const isPink =
    normalizedSrc.includes("/pink/") || normalizedSrc.includes("-pink-");

  if (normalizedSrc.includes("/audio/language-packs/fr-fr/")) {
    return toSafePlaybackGain(isPink ? 12 : 2.2);
  }

  if (normalizedSrc.includes("/audio/language-packs/es-es/")) {
    return toSafePlaybackGain(isPink ? 2.5 : 1.25);
  }

  if (normalizedSrc.includes("/audio/language-packs/ru-ru/")) {
    return toSafePlaybackGain(isPink ? 1.75 : 5);
  }

  if (normalizedSrc.includes("/audio/words/")) {
    return toSafePlaybackGain(isPink ? 1.15 : ENGLISH_WORD_BOOST);
  }

  return DEFAULT_VOLUME;
}

export function analyzeAudioLevel(
  buffer: DecodableAudioBuffer,
): AudioLevelAnalysis {
  let sumSquares = 0;
  let peak = 0;
  let sampleCount = 0;

  for (let channel = 0; channel < buffer.numberOfChannels; channel += 1) {
    const samples = buffer.getChannelData(channel);
    sampleCount += samples.length;

    for (let index = 0; index < samples.length; index += 1) {
      const absolute = Math.abs(samples[index] ?? 0);
      peak = Math.max(peak, absolute);
      sumSquares += absolute * absolute;
    }
  }

  return {
    rms: sampleCount > 0 ? Math.sqrt(sumSquares / sampleCount) : 0,
    peak,
    sampleCount,
  };
}

export function calculateNormalizationGain(
  { rms, peak }: AudioLevelInput,
  {
    targetRms = TARGET_RMS,
    maxPeak = MAX_PEAK,
    minGain = MIN_GAIN,
    maxGain = MAX_GAIN,
  }: {
    targetRms?: number;
    maxPeak?: number;
    minGain?: number;
    maxGain?: number;
  } = {},
): number {
  if (rms <= SILENCE_FLOOR || peak <= SILENCE_FLOOR) return DEFAULT_VOLUME;

  const rmsGain = targetRms / rms;
  const peakGain = maxPeak / peak;
  const safeGain = Math.min(rmsGain, peakGain, maxGain);

  return Math.max(minGain, safeGain);
}

export function calculateAudioNormalization(
  buffer: DecodableAudioBuffer,
): AudioNormalizationResult {
  const analysis = analyzeAudioLevel(buffer);
  return {
    ...analysis,
    gain: calculateNormalizationGain(analysis),
  };
}

export function selectPeakSafePlaybackGain(
  { gain, peak }: Pick<AudioNormalizationResult, "gain" | "peak">,
  fallbackGain: number,
  {
    maxPeak = MAX_PEAK,
    maxGain = MAX_GAIN,
  }: {
    maxPeak?: number;
    maxGain?: number;
  } = {},
): number {
  const preferredGain = Math.max(
    toSafePlaybackGain(gain),
    toSafePlaybackGain(fallbackGain),
  );

  if (peak <= SILENCE_FLOOR) return preferredGain;

  const peakSafeMax = Math.min(maxGain, maxPeak / peak);
  return toSafePlaybackGain(Math.min(preferredGain, peakSafeMax));
}

function getAudioContextConstructor():
  | typeof AudioContext
  | undefined {
  if (typeof window === "undefined") return undefined;
  return (
    window.AudioContext ??
    (window as unknown as { webkitAudioContext?: typeof AudioContext })
      .webkitAudioContext
  );
}

async function decodeLocalAudio(src: string): Promise<DecodableAudioBuffer | null> {
  const AudioContextConstructor = getAudioContextConstructor();
  if (!AudioContextConstructor || typeof fetch !== "function") return null;

  const audioContext = new AudioContextConstructor();
  try {
    const response = await fetch(src);
    if (!response.ok) return null;

    const encodedAudio = await response.arrayBuffer();
    return await audioContext.decodeAudioData(encodedAudio.slice(0));
  } catch {
    return null;
  } finally {
    await audioContext.close?.().catch(() => {});
  }
}

export async function getNormalizedPlaybackVolume(src: string): Promise<number> {
  if (!shouldNormalizeLocalAudioSrc(src)) return DEFAULT_VOLUME;

  if (!normalizationCache.has(src)) {
    const fallbackGain = getLocalAudioPlaybackVolume(src);
    normalizationCache.set(
      src,
      decodeLocalAudio(src).then((buffer) =>
        buffer
          ? selectPeakSafePlaybackGain(
              calculateAudioNormalization(buffer),
              fallbackGain,
            )
          : fallbackGain,
      ),
    );
  }

  return normalizationCache.get(src) ?? Promise.resolve(DEFAULT_VOLUME);
}

export function clearAudioNormalizationCache(): void {
  normalizationCache.clear();
}
