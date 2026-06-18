import type { LanguageId } from "@/types/language";

export interface LocalLanguagePhonemeAsset {
  languageId: Exclude<LanguageId, "en-US">;
  slug: string;
  label: string;
  source: string;
  sourceUrl: string;
  license?: string;
  attribution?: string;
  videoSrc: string;
  audioSrc?: string;
  folderName?: string;
  notes?: string[];
  audioIpa?: string;
  exactAssessmentAliases?: string[];
  isProxyForAssessment?: boolean;
}

interface ExactAssessmentAudioMetadata {
  audioIpa?: string;
  exactAssessmentAliases?: string[];
  isProxyForAssessment?: boolean;
}

const SPANISH_SOUNDS_OF_SPEECH_BASE =
  "https://soundsofspeech.uiowa.edu/assets/phonemes/es";
const FRENCH_PHONETIQUE_BASE = "https://www.phonetique.ca/documents";
const SEEING_SPEECH_BASE = "https://www.seeingspeech.ac.uk";
const SEEING_SPEECH_LICENSE =
  "CC BY-NC-ND 4.0; user-stated noncommercial educational/open-source local use; preserve unmodified file and attribution.";
const SEEING_SPEECH_ATTRIBUTION =
  "Lawson, E., Stuart-Smith, J., Scobbie, J. M., Nakai, S. (2018). Seeing Speech: an articulatory web resource for the study of Phonetics. University of Glasgow.";

function spanishAnimationAsset(
  slug: string,
  folderName: string,
  metadata?: ExactAssessmentAudioMetadata,
): LocalLanguagePhonemeAsset {
  const videoSrc = `/videos/language-assets/es-ES/animation/${slug}.mp4`;
  const audioSrc = `/audio/language-assets/es-ES/header-clips/${slug}.m4a`;

  return {
    languageId: "es-ES",
    slug,
    folderName,
    label: "Sounds of Speech Spanish 本地口型/舌位动画",
    source: "University of Iowa Sounds of Speech Spanish",
    sourceUrl: `${SPANISH_SOUNDS_OF_SPEECH_BASE}/${folderName}/animation/${folderName}.mp4`,
    videoSrc,
    audioSrc,
    ...metadata,
    notes: [
      "User stated authorization to bundle these official website resources locally on 2026-06-08.",
      "Header speaker uses a short derived audio clip from the local asset, not the full MP4 track.",
    ],
  };
}

function frenchPhonetiqueAsset(
  slug: string,
  resourcePath: string,
  metadata?: ExactAssessmentAudioMetadata,
): LocalLanguagePhonemeAsset {
  const videoSrc = `/videos/language-assets/fr-FR/articulation/${slug}.mp4`;
  const audioSrc = `/audio/language-assets/fr-FR/header-clips/${slug}.m4a`;

  return {
    languageId: "fr-FR",
    slug,
    folderName: resourcePath,
    label: "Phonétique.ca 本地法语口型/舌位视频",
    source: "Phonétique.ca / University of Sheffield IPA symbols",
    sourceUrl: `${FRENCH_PHONETIQUE_BASE}/${resourcePath}`,
    videoSrc,
    audioSrc,
    ...metadata,
    notes: [
      "User stated authorization to bundle these official website resources locally on 2026-06-08.",
      "Phonetique.ca credits University of Sheffield IPA symbols for the French vowel/consonant videos.",
      "Header speaker uses a short derived audio clip from the local asset, not the full MP4 track.",
      "Phrase-level units such as liaison, enchaînement, elision, and silent final consonants still need separate rule videos.",
    ],
  };
}

function russianSeeingSpeechAsset(
  slug: string,
  fileStem: string,
  notes: string[],
  options?: {
    headerAudioSrc?: string;
    label?: string;
    sourceUrl?: string;
  } & ExactAssessmentAudioMetadata,
): LocalLanguagePhonemeAsset {
  return {
    languageId: "ru-RU",
    slug,
    folderName: fileStem,
    label: options?.label ?? "Seeing Speech 本地俄语 IPA 口腔/MRI 发音素材",
    source: "Seeing Speech / University of Glasgow IPA Charts",
    sourceUrl: options?.sourceUrl ?? `${SEEING_SPEECH_BASE}/ipa-charts/`,
    license: SEEING_SPEECH_LICENSE,
    attribution: SEEING_SPEECH_ATTRIBUTION,
    videoSrc: `/videos/language-assets/ru-RU/seeing-speech/${fileStem}.mp4`,
    audioSrc:
      options?.headerAudioSrc ??
      `/audio/language-assets/ru-RU/header-clips/${fileStem}.m4a`,
    audioIpa: options?.audioIpa,
    exactAssessmentAliases: options?.exactAssessmentAliases,
    isProxyForAssessment: options?.isProxyForAssessment,
    notes: [
      "User stated noncommercial educational/open-source use on 2026-06-08.",
      "Original Seeing Speech MP4 is kept unmodified; header speaker uses a short derived audio clip.",
      ...notes,
    ],
  };
}

export const LOCAL_LANGUAGE_PHONEME_ASSETS: LocalLanguagePhonemeAsset[] = [
  spanishAnimationAsset("es-a", "a-sound", {
    audioIpa: "/a/",
    exactAssessmentAliases: ["a"],
  }),
  spanishAnimationAsset("es-e", "e-sound", {
    audioIpa: "/e/",
    exactAssessmentAliases: ["e"],
  }),
  spanishAnimationAsset("es-i", "i-sound", {
    audioIpa: "/i/",
    exactAssessmentAliases: ["i"],
  }),
  spanishAnimationAsset("es-o", "o-sound", {
    audioIpa: "/o/",
    exactAssessmentAliases: ["o"],
  }),
  spanishAnimationAsset("es-u", "u-sound", {
    audioIpa: "/u/",
    exactAssessmentAliases: ["u"],
  }),
  spanishAnimationAsset("es-bv", "beta-low-sound", {
    audioIpa: "/β/",
    exactAssessmentAliases: ["β", "β̞"],
  }),
  spanishAnimationAsset("es-d", "eth-low-sound", {
    audioIpa: "/ð/",
    exactAssessmentAliases: ["ð", "ð̞"],
  }),
  spanishAnimationAsset("es-g", "gamma-sound", {
    audioIpa: "/ɣ/",
    exactAssessmentAliases: ["ɣ", "ɣ̞"],
  }),
  spanishAnimationAsset("es-theta", "theta-sound", {
    audioIpa: "/θ/",
    exactAssessmentAliases: ["θ", "th"],
  }),
  spanishAnimationAsset("es-x", "chi-sound", {
    audioIpa: "/x/",
    exactAssessmentAliases: ["x"],
  }),
  spanishAnimationAsset("es-ny", "n-left-sound", {
    audioIpa: "/ɲ/",
    exactAssessmentAliases: ["ɲ", "ny"],
  }),
  spanishAnimationAsset("es-tap-r", "r-short-sound", {
    audioIpa: "/ɾ/",
    exactAssessmentAliases: ["ɾ"],
  }),
  spanishAnimationAsset("es-trill-r", "r-rolled-sound", {
    audioIpa: "/r/",
    exactAssessmentAliases: ["r"],
  }),
  spanishAnimationAsset("es-s", "s-sound", {
    audioIpa: "/s/",
    exactAssessmentAliases: ["s"],
  }),
  spanishAnimationAsset("es-ch", "ch-sound", {
    audioIpa: "/tʃ/",
    exactAssessmentAliases: ["ch", "tʃ", "t͡ʃ"],
  }),
  spanishAnimationAsset("es-y-ll", "yot-sound", {
    audioIpa: "/ʝ/",
    exactAssessmentAliases: ["ʝ"],
  }),
  spanishAnimationAsset("es-l", "l-sound", {
    audioIpa: "/l/",
    exactAssessmentAliases: ["l"],
  }),
  spanishAnimationAsset("es-nasal-place", "n-right1-sound", {
    isProxyForAssessment: true,
  }),
  spanishAnimationAsset("es-diphthongs-j", "j-sound", {
    audioIpa: "/j/",
    exactAssessmentAliases: ["j", "i̯"],
  }),
  spanishAnimationAsset("es-diphthongs-w", "w-sound", {
    audioIpa: "/w/",
    exactAssessmentAliases: ["w", "u̯"],
  }),
  frenchPhonetiqueAsset("fr-i", "Tb_Resources/i2.mp4", {
    audioIpa: "/i/",
    exactAssessmentAliases: ["i"],
  }),
  frenchPhonetiqueAsset("fr-y", "Tb_Resources/u2.mp4", {
    audioIpa: "/y/",
    exactAssessmentAliases: ["y"],
  }),
  frenchPhonetiqueAsset("fr-u", "Tb_Resources/ou2.mp4", {
    audioIpa: "/u/",
    exactAssessmentAliases: ["u"],
  }),
  frenchPhonetiqueAsset("fr-e", "Tb_Resources/e-ferme2.mp4", {
    audioIpa: "/e/",
    exactAssessmentAliases: ["e"],
  }),
  frenchPhonetiqueAsset("fr-e-open", "Tb_Resources/e-ouvert2.mp4", {
    audioIpa: "/ɛ/",
    exactAssessmentAliases: ["ɛ", "eh"],
  }),
  frenchPhonetiqueAsset("fr-eu-close", "Tb_Resources/eu-ferme2.mp4", {
    audioIpa: "/ø/",
    exactAssessmentAliases: ["ø"],
  }),
  frenchPhonetiqueAsset("fr-eu-open", "Tb_Resources/eu-ouvert2.mp4", {
    audioIpa: "/œ/",
    exactAssessmentAliases: ["œ"],
  }),
  frenchPhonetiqueAsset("fr-an", "Tb_Resources/an2.mp4", {
    audioIpa: "/ɑ̃/",
    exactAssessmentAliases: ["ɑ̃", "ã", "an"],
  }),
  frenchPhonetiqueAsset("fr-in", "Tb_Resources/in2.mp4", {
    audioIpa: "/ɛ̃/",
    exactAssessmentAliases: ["ɛ̃", "in"],
  }),
  frenchPhonetiqueAsset("fr-on", "Tb_Resources/on2.mp4", {
    audioIpa: "/ɔ̃/",
    exactAssessmentAliases: ["ɔ̃", "õ", "on"],
  }),
  frenchPhonetiqueAsset("fr-a", "Tb_Resources/a-anterieur2.mp4", {
    audioIpa: "/a/",
    exactAssessmentAliases: ["a"],
  }),
  frenchPhonetiqueAsset("fr-schwa", "Tb_Resources/schwa2.mp4", {
    audioIpa: "/ə/",
    exactAssessmentAliases: ["ə", "ax"],
  }),
  frenchPhonetiqueAsset("fr-o-close", "Tb_Resources/o-ferme2.mp4", {
    audioIpa: "/o/",
    exactAssessmentAliases: ["o"],
  }),
  frenchPhonetiqueAsset("fr-o-open", "Tb_Resources/o-ouvert2.mp4", {
    audioIpa: "/ɔ/",
    exactAssessmentAliases: ["ɔ"],
  }),
  frenchPhonetiqueAsset("fr-un", "Tb_Resources/un2.mp4", {
    audioIpa: "/œ̃/",
    exactAssessmentAliases: ["œ̃", "un"],
  }),
  frenchPhonetiqueAsset("fr-r", "C_Resources/r.mp4", {
    audioIpa: "/ʁ/",
    exactAssessmentAliases: ["ʁ", "r", "χ"],
  }),
  frenchPhonetiqueAsset("fr-sh", "C_Resources/ch.mp4", {
    audioIpa: "/ʃ/",
    exactAssessmentAliases: ["ʃ", "sh"],
  }),
  frenchPhonetiqueAsset("fr-zh", "C_Resources/j.mp4", {
    audioIpa: "/ʒ/",
    exactAssessmentAliases: ["ʒ", "zh"],
  }),
  frenchPhonetiqueAsset("fr-ny", "C_Resources/gn.mp4", {
    audioIpa: "/ɲ/",
    exactAssessmentAliases: ["ɲ", "ny"],
  }),
  frenchPhonetiqueAsset("fr-glide-j", "C_Resources/y.mp4", {
    audioIpa: "/j/",
    exactAssessmentAliases: ["j"],
  }),
  frenchPhonetiqueAsset("fr-glide-hui", "C_Resources/ua.mp4", {
    audioIpa: "/ɥ/",
    exactAssessmentAliases: ["ɥ"],
  }),
  frenchPhonetiqueAsset("fr-glide-w", "C_Resources/w.mp4", {
    audioIpa: "/w/",
    exactAssessmentAliases: ["w"],
  }),
  russianSeeingSpeechAsset("ru-a", "ru-a", [
    "Russian а /a/ primary local asset.",
  ], {
    audioIpa: "/a/",
    exactAssessmentAliases: ["a"],
  }),
  russianSeeingSpeechAsset("ru-o", "ru-o", [
    "Russian stressed о /o/ primary local asset.",
  ], {
    audioIpa: "/o/",
    exactAssessmentAliases: ["o"],
  }),
  russianSeeingSpeechAsset("ru-i", "ru-i", [
    "Russian и /i/ primary local asset.",
  ], {
    audioIpa: "/i/",
    exactAssessmentAliases: ["i"],
  }),
  russianSeeingSpeechAsset("ru-y", "ru-y", [
    "Russian ы /ɨ/ primary local asset; Commons /ɨ/ audio is available as extra reference.",
  ], {
    audioIpa: "/ɨ/",
    exactAssessmentAliases: ["ɨ"],
  }),
  russianSeeingSpeechAsset("ru-u", "ru-u", [
    "Russian у /u/ primary local asset.",
  ], {
    audioIpa: "/u/",
    exactAssessmentAliases: ["u"],
  }),
  russianSeeingSpeechAsset("ru-e", "ru-e", [
    "Russian stressed э/е /e/ primary local asset.",
  ], {
    audioIpa: "/e/",
    exactAssessmentAliases: ["e", "ɛ"],
  }),
  russianSeeingSpeechAsset("ru-p", "ru-p", [
    "Russian hard п /p/ exact local asset.",
  ], {
    audioIpa: "/p/",
    exactAssessmentAliases: ["p"],
  }),
  russianSeeingSpeechAsset("ru-b", "ru-b", [
    "Russian hard б /b/ exact local asset; final devoicing is a separate rule.",
  ], {
    audioIpa: "/b/",
    exactAssessmentAliases: ["b"],
  }),
  russianSeeingSpeechAsset("ru-t", "ru-t", [
    "Russian hard т /t/ exact local asset.",
  ], {
    audioIpa: "/t/",
    exactAssessmentAliases: ["t"],
  }),
  russianSeeingSpeechAsset("ru-d", "ru-d", [
    "Russian hard д /d/ exact local asset; final devoicing is a separate rule.",
  ], {
    audioIpa: "/d/",
    exactAssessmentAliases: ["d"],
  }),
  russianSeeingSpeechAsset("ru-k", "ru-k", [
    "Russian hard к /k/ exact local asset.",
  ], {
    audioIpa: "/k/",
    exactAssessmentAliases: ["k"],
  }),
  russianSeeingSpeechAsset("ru-g", "ru-g", [
    "Russian hard г /g/ exact local asset; final devoicing is a separate rule.",
  ], {
    audioIpa: "/g/",
    exactAssessmentAliases: ["g"],
  }),
  russianSeeingSpeechAsset("ru-f", "ru-f", [
    "Russian hard ф /f/ exact local asset; soft /fʲ/ remains a separate contrast target.",
  ], {
    audioIpa: "/f/",
    exactAssessmentAliases: ["f"],
  }),
  russianSeeingSpeechAsset("ru-v", "ru-v", [
    "Russian hard в /v/ exact local asset; /v/ assimilation behavior is a separate rule.",
  ], {
    audioIpa: "/v/",
    exactAssessmentAliases: ["v"],
  }),
  russianSeeingSpeechAsset("ru-s", "ru-s", [
    "Russian hard с /s/ exact local asset; soft /sʲ/ remains a separate contrast target.",
  ], {
    audioIpa: "/s/",
    exactAssessmentAliases: ["s"],
  }),
  russianSeeingSpeechAsset("ru-z", "ru-z", [
    "Russian hard з /z/ exact local asset; final devoicing is a separate rule.",
  ], {
    audioIpa: "/z/",
    exactAssessmentAliases: ["z"],
  }),
  russianSeeingSpeechAsset("ru-m", "ru-m", [
    "Russian hard м /m/ exact local asset; soft /mʲ/ remains a separate contrast target.",
  ], {
    audioIpa: "/m/",
    exactAssessmentAliases: ["m"],
  }),
  russianSeeingSpeechAsset("ru-n", "ru-n", [
    "Russian hard н /n/ exact local asset; soft /nʲ/ remains a separate contrast target.",
  ], {
    audioIpa: "/n/",
    exactAssessmentAliases: ["n"],
  }),
  russianSeeingSpeechAsset("ru-l", "ru-l", [
    "Russian hard л /l/ exact local asset; soft /lʲ/ remains a separate contrast target.",
  ], {
    audioIpa: "/l/",
    exactAssessmentAliases: ["l"],
  }),
  russianSeeingSpeechAsset("ru-r", "ru-r", [
    "Russian trilled р /r/ primary local asset; palatalized trill audio is also available.",
  ], {
    audioIpa: "/r/",
    exactAssessmentAliases: ["r"],
  }),
  russianSeeingSpeechAsset("ru-x", "ru-x", [
    "Russian х /x/ primary local asset.",
  ], {
    audioIpa: "/x/",
    exactAssessmentAliases: ["x"],
  }),
  russianSeeingSpeechAsset("ru-ts", "ru-ts", [
    "Russian ц /ts/ primary local asset; Commons /ts/ audio is available as extra reference.",
  ], {
    audioIpa: "/ts/",
    exactAssessmentAliases: ["ts", "t͡s"],
  }),
  russianSeeingSpeechAsset(
    "ru-ch",
    "ru-shch-proxy",
    [
      "Video proxy: Seeing Speech /ɕ/ shows the soft alveolo-palatal area; audio is Commons /tɕ/, closer to Russian ч.",
    ],
    {
      headerAudioSrc: "/audio/language-assets/ru-RU/header-clips/ru-ch.m4a",
      audioIpa: "/tɕ/",
      exactAssessmentAliases: ["tɕ", "t͡ɕ"],
    },
  ),
  russianSeeingSpeechAsset(
    "ru-shch",
    "ru-shch-proxy",
    [
      "Proxy: Commons/Seeing Speech asset is /ɕ/; Russian щ target should be taught as long/soft /ɕː/.",
    ],
    {
      headerAudioSrc: "/audio/language-assets/ru-RU/header-clips/ru-shch.m4a",
      audioIpa: "/ɕː/",
      exactAssessmentAliases: ["ɕː"],
    },
  ),
  russianSeeingSpeechAsset("ru-sh-zh", "ru-sh", [
    "ш/ж contrast: standalone ш and ж units carry exact tile audio; this grouped contrast stays a teaching proxy.",
  ], {
    isProxyForAssessment: true,
  }),
  russianSeeingSpeechAsset("ru-sh", "ru-sh", [
    "Russian always-hard ш /ʂ/ exact local asset; distinct from soft щ /ɕː/.",
  ], {
    audioIpa: "/ʂ/",
    exactAssessmentAliases: ["ʂ"],
  }),
  russianSeeingSpeechAsset("ru-zh", "ru-zh", [
    "Russian always-hard ж /ʐ/ exact local asset; final devoicing is a separate rule.",
  ], {
    audioIpa: "/ʐ/",
    exactAssessmentAliases: ["ʐ"],
  }),
  russianSeeingSpeechAsset("ru-ts-ch-shch", "ru-ts", [
    "ц/ч/щ group: ц /ts/ is primary; ч and щ use Commons audio plus /ɕ/ proxy video.",
  ], {
    isProxyForAssessment: true,
  }),
  russianSeeingSpeechAsset("ru-hard-soft", "ru-j", [
    "Proxy: /j/ MRI shows palatal tongue-body raising, but Russian soft consonants are not a full added й.",
  ], {
    isProxyForAssessment: true,
  }),
  russianSeeingSpeechAsset("ru-soft-sign", "ru-j", [
    "Proxy: ь marks palatalization and is not pronounced as an independent /j/ sound.",
  ], {
    isProxyForAssessment: true,
  }),
  russianSeeingSpeechAsset("ru-j", "ru-j", [
    "Russian й /j/ primary local asset.",
  ], {
    audioIpa: "/j/",
    exactAssessmentAliases: ["j", "y"],
  }),
  russianSeeingSpeechAsset("ru-iotated-vowels", "ru-j", [
    "Iotated vowels: /j/ onset or softening marker depending on position; /j/ video is a rule proxy.",
  ], {
    isProxyForAssessment: true,
  }),
  russianSeeingSpeechAsset("ru-soft-t-d", "ru-t", [
    "Soft т/д contrast: hard /t/ is primary anchor; /d/ is a related local asset.",
  ], {
    isProxyForAssessment: true,
  }),
  russianSeeingSpeechAsset("ru-soft-s-z", "ru-s", [
    "Soft с/з contrast: hard /s/ is primary anchor; /z/ is a related local asset.",
  ], {
    isProxyForAssessment: true,
  }),
  russianSeeingSpeechAsset("ru-soft-n-l-r", "ru-l", [
    "Soft н/л/р contrast: /l/ is primary anchor; /n/, /r/, and palatalized trill audio are related.",
  ], {
    isProxyForAssessment: true,
  }),
  russianSeeingSpeechAsset("ru-soft-labials", "ru-p", [
    "Soft labials: /p/ is primary anchor; /b m f v/ are related local assets.",
  ], {
    isProxyForAssessment: true,
  }),
  russianSeeingSpeechAsset("ru-stress-reduction", "ru-reduction-schwa", [
    "Rule/prosody unit: this is a reduced-vowel quality reference, not a full stress lesson by itself.",
  ], {
    isProxyForAssessment: true,
  }),
  russianSeeingSpeechAsset("ru-unstressed-o-a", "ru-reduction-open-back", [
    "Unstressed о/а reduction: open/back/centralized vowel quality reference.",
  ], {
    isProxyForAssessment: true,
  }),
  russianSeeingSpeechAsset("ru-unstressed-e-ya", "ru-reduction-schwa", [
    "Unstressed е/я reduction: schwa/central-vowel proxy; lesson must still explain [ɪ] and softening environment.",
  ], {
    isProxyForAssessment: true,
  }),
  russianSeeingSpeechAsset("ru-final-devoicing", "ru-k", [
    "Final devoicing proxy: /k/ is a voiceless-stop anchor for isolated devoiced endings such as друг /druk/; current sentence practice uses Нож тупой /noʂ tʊˈpoj/ to show devoicing before voiceless /t/.",
  ], {
    isProxyForAssessment: true,
  }),
  russianSeeingSpeechAsset("ru-voicing-assimilation", "ru-v", [
    "Voicing assimilation: /v/ is primary anchor; related assets cover devoiced/voiced counterparts.",
  ], {
    isProxyForAssessment: true,
  }),
  russianSeeingSpeechAsset("ru-clusters", "ru-t", [
    "Cluster unit has no single-phoneme perfect video; use /t/ as segment anchor and rely on Russian word/phrase drills.",
  ], {
    isProxyForAssessment: true,
  }),
];

export function getLocalLanguagePhonemeAsset(
  languageId: LanguageId,
  slug: string,
): LocalLanguagePhonemeAsset | undefined {
  if (languageId === "en-US") return undefined;

  return LOCAL_LANGUAGE_PHONEME_ASSETS.find(
    (asset) => asset.languageId === languageId && asset.slug === slug,
  );
}
