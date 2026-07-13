import manifest from "../content/training-speaker-manifest.json";

export interface TrainingSpeaker {
  id: string;
  assetDirectory: string;
  provider: "elevenlabs";
  voiceId: string;
  locale: "en-US";
  accent: "general-american";
  reviewStatus: "reviewed" | "needs-review";
}

export const TRAINING_SPEAKERS = manifest as readonly TrainingSpeaker[];

export type TrainingSpeakerId = "max" | "nichalia" | "eryn" | "brian";

export const DEFAULT_TRAINING_SPEAKER_IDS = TRAINING_SPEAKERS.map(
  (speaker) => speaker.id,
) as TrainingSpeakerId[];

export function getTrainingSpeaker(
  speakerId: string,
): TrainingSpeaker | undefined {
  return TRAINING_SPEAKERS.find((speaker) => speaker.id === speakerId);
}

export function trainingSpeakerAudioUri(
  word: string,
  speakerId: string,
): string {
  const speaker = getTrainingSpeaker(speakerId);
  const directory = speaker?.assetDirectory ?? speakerId;
  return `/audio/words/${directory}/${encodeURIComponent(word.toLowerCase())}.mp3`;
}
