import { readFile } from "node:fs/promises";

function base64Json(value) {
  return Buffer.from(JSON.stringify(value), "utf8").toString("base64");
}

function collectEnglishPhonemes(words) {
  return words.flatMap((word) =>
    (word.Phonemes ?? []).map((phoneme) => ({
      phoneme: phoneme.Phoneme,
      accuracyScore: phoneme.PronunciationAssessment?.AccuracyScore ?? null,
      nBestPhonemes: phoneme.PronunciationAssessment?.NBestPhonemes ?? [],
    })),
  );
}

export function parseAzurePronunciationResponse(json, languageId) {
  const best = json.NBest?.[0];
  const assessment = best?.PronunciationAssessment ?? {};
  const words = Array.isArray(best?.Words) ? best.Words : [];
  const wordAssessments = words
    .map((word) => word?.PronunciationAssessment ?? {})
    .filter((item) => typeof item.AccuracyScore === "number");
  const averageWordAccuracy =
    wordAssessments.length > 0
      ? wordAssessments.reduce((sum, item) => sum + item.AccuracyScore, 0) /
        wordAssessments.length
      : null;
  return {
    ok:
      !["NoMatch", "InitialSilenceTimeout"].includes(json.RecognitionStatus) &&
      words.length > 0,
    recognitionStatus: json.RecognitionStatus,
    recognizedText: best?.Display ?? best?.Lexical ?? "",
    pronScore: assessment.PronScore ?? best?.PronScore ?? averageWordAccuracy,
    accuracyScore:
      assessment.AccuracyScore ?? best?.AccuracyScore ?? averageWordAccuracy,
    completenessScore:
      assessment.CompletenessScore ?? best?.CompletenessScore ?? null,
    fluencyScore: assessment.FluencyScore ?? best?.FluencyScore ?? null,
    prosodyScore:
      languageId === "en-US"
        ? (assessment.ProsodyScore ?? best?.ProsodyScore ?? null)
        : null,
    wordCount: words.length,
    words: words.map((word) => ({
      word: word.Word,
      accuracyScore: word.PronunciationAssessment?.AccuracyScore ?? null,
      errorType: word.PronunciationAssessment?.ErrorType ?? null,
      syllables:
        languageId === "en-US"
          ? (word.Syllables ?? []).map((syllable) => ({
              syllable: syllable.Syllable,
              grapheme: syllable.Grapheme,
              accuracyScore:
                syllable.PronunciationAssessment?.AccuracyScore ?? null,
              phonemes: collectEnglishPhonemes([syllable]),
            }))
          : undefined,
      phonemes:
        languageId === "en-US" ? collectEnglishPhonemes([word]) : undefined,
    })),
  };
}

export async function assessAzurePronunciation({
  subscriptionKey,
  region,
  languageId,
  referenceText,
  wavPath,
  role,
}) {
  const isEnglishPhrase =
    languageId === "en-US" && (role === "phrase" || role === "sentence");
  const config = {
    ReferenceText: referenceText,
    GradingSystem: "HundredMark",
    Granularity: "Phoneme",
    Dimension: "Comprehensive",
    EnableMiscue: true,
    ...(languageId === "en-US"
      ? { PhonemeAlphabet: "IPA", NBestPhonemeCount: 5 }
      : {}),
    ...(isEnglishPhrase ? { EnableProsodyAssessment: true } : {}),
  };
  const url =
    `https://${region}.stt.speech.microsoft.com/speech/recognition/conversation/cognitiveservices/v1` +
    `?language=${encodeURIComponent(languageId)}&format=detailed`;
  const response = await fetch(url, {
    method: "POST",
    headers: {
      "Ocp-Apim-Subscription-Key": subscriptionKey,
      "Content-Type": "audio/wav; codecs=audio/pcm; samplerate=16000",
      "Pronunciation-Assessment": base64Json(config),
      Accept: "application/json",
    },
    body: await readFile(wavPath),
  });
  const body = await response.text();
  if (!response.ok) {
    const error = new Error(`Azure ${response.status}: ${body.slice(0, 300)}`);
    error.status = response.status;
    throw error;
  }
  const rawResponse = JSON.parse(body);
  return {
    ...parseAzurePronunciationResponse(rawResponse, languageId),
    rawResponse,
  };
}
