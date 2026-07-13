export interface StorageAdapter {
  getItem(key: string): string | null | Promise<string | null>;
  setItem(key: string, value: string): void | Promise<void>;
  removeItem(key: string): void | Promise<void>;
}

export interface SpeechAssessmentAdapter<TInput, TResult> {
  assess(input: TInput): Promise<TResult>;
  supportsLocale(locale: string): boolean;
}

export interface AudioAsset {
  url: string;
  source: "bundled" | "cache" | "remote";
}

export interface AudioAssetAdapter {
  resolve(reference: string, languageId: string): Promise<AudioAsset | null>;
}

export interface ApiCredentialAdapter {
  getCredential(service: string): Promise<string | null>;
  setCredential(service: string, value: string): Promise<void>;
  removeCredential(service: string): Promise<void>;
}