export interface AzurePhoneme {
  phoneme: string;
  accuracyScore: number;
}

export type StressLevel = "primary" | "secondary" | "none";

export interface AzureSyllable {
  syllable: string;
  grapheme?: string;
  accuracyScore: number;
  stress?: StressLevel;
}

export interface AzureWord {
  word: string;
  accuracyScore: number;
  errorType: "None" | "Omission" | "Insertion" | "Mispronunciation";
  phonemes: AzurePhoneme[];
  syllables: AzureSyllable[];
  feedback?: {
    prosody?: {
      break?: {
        errorTypes?: string[];
        breakLength?: number;
      };
    };
  };
}

export interface AzureAssessmentResult {
  pronunciationScore: number;
  accuracyScore: number;
  fluencyScore: number;
  completenessScore: number;
  prosodyScore?: number;
  words: AzureWord[];
}
