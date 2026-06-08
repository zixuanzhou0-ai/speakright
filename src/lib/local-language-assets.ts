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
): LocalLanguagePhonemeAsset {
  const videoSrc = `/videos/language-assets/es-ES/animation/${slug}.mp4`;

  return {
    languageId: "es-ES",
    slug,
    folderName,
    label: "Sounds of Speech Spanish 本地口型/舌位动画",
    source: "University of Iowa Sounds of Speech Spanish",
    sourceUrl: `${SPANISH_SOUNDS_OF_SPEECH_BASE}/${folderName}/animation/${folderName}.mp4`,
    videoSrc,
    audioSrc: videoSrc,
    notes: [
      "User stated authorization to bundle these official website resources locally on 2026-06-08.",
      "The MP4 includes an AAC track, so the same local asset can back the sound-unit play button.",
    ],
  };
}

function frenchPhonetiqueAsset(
  slug: string,
  resourcePath: string,
): LocalLanguagePhonemeAsset {
  const videoSrc = `/videos/language-assets/fr-FR/articulation/${slug}.mp4`;

  return {
    languageId: "fr-FR",
    slug,
    folderName: resourcePath,
    label: "Phonétique.ca 本地法语口型/舌位视频",
    source: "Phonétique.ca / University of Sheffield IPA symbols",
    sourceUrl: `${FRENCH_PHONETIQUE_BASE}/${resourcePath}`,
    videoSrc,
    audioSrc: videoSrc,
    notes: [
      "User stated authorization to bundle these official website resources locally on 2026-06-08.",
      "Phonetique.ca credits University of Sheffield IPA symbols for the French vowel/consonant videos.",
      "Phrase-level units such as liaison, enchaînement, elision, and silent final consonants still need separate rule videos.",
    ],
  };
}

function russianSeeingSpeechAsset(
  slug: string,
  fileStem: string,
  notes: string[],
  options?: {
    audioSrc?: string;
    label?: string;
    sourceUrl?: string;
  },
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
      options?.audioSrc ??
      `/audio/language-assets/ru-RU/seeing-speech/${fileStem}.m4a`,
    notes: [
      "User stated noncommercial educational/open-source use on 2026-06-08.",
      "Original Seeing Speech MP4 is kept unmodified; .m4a is extracted from the local MP4 for app audio playback.",
      ...notes,
    ],
  };
}

export const LOCAL_LANGUAGE_PHONEME_ASSETS: LocalLanguagePhonemeAsset[] = [
  spanishAnimationAsset("es-a", "a-sound"),
  spanishAnimationAsset("es-e", "e-sound"),
  spanishAnimationAsset("es-i", "i-sound"),
  spanishAnimationAsset("es-o", "o-sound"),
  spanishAnimationAsset("es-u", "u-sound"),
  spanishAnimationAsset("es-bv", "beta-low-sound"),
  spanishAnimationAsset("es-d", "eth-low-sound"),
  spanishAnimationAsset("es-g", "gamma-sound"),
  spanishAnimationAsset("es-theta", "theta-sound"),
  spanishAnimationAsset("es-x", "chi-sound"),
  spanishAnimationAsset("es-ny", "n-left-sound"),
  spanishAnimationAsset("es-tap-r", "r-short-sound"),
  spanishAnimationAsset("es-trill-r", "r-rolled-sound"),
  spanishAnimationAsset("es-s", "s-sound"),
  spanishAnimationAsset("es-ch", "ch-sound"),
  spanishAnimationAsset("es-y-ll", "yot-sound"),
  spanishAnimationAsset("es-l", "l-sound"),
  spanishAnimationAsset("es-nasal-place", "n-right1-sound"),
  spanishAnimationAsset("es-diphthongs-j", "j-sound"),
  spanishAnimationAsset("es-diphthongs-w", "w-sound"),
  frenchPhonetiqueAsset("fr-i", "Tb_Resources/i2.mp4"),
  frenchPhonetiqueAsset("fr-y", "Tb_Resources/u2.mp4"),
  frenchPhonetiqueAsset("fr-u", "Tb_Resources/ou2.mp4"),
  frenchPhonetiqueAsset("fr-e", "Tb_Resources/e-ferme2.mp4"),
  frenchPhonetiqueAsset("fr-e-open", "Tb_Resources/e-ouvert2.mp4"),
  frenchPhonetiqueAsset("fr-eu-close", "Tb_Resources/eu-ferme2.mp4"),
  frenchPhonetiqueAsset("fr-eu-open", "Tb_Resources/eu-ouvert2.mp4"),
  frenchPhonetiqueAsset("fr-an", "Tb_Resources/an2.mp4"),
  frenchPhonetiqueAsset("fr-in", "Tb_Resources/in2.mp4"),
  frenchPhonetiqueAsset("fr-on", "Tb_Resources/on2.mp4"),
  frenchPhonetiqueAsset("fr-a", "Tb_Resources/a-anterieur2.mp4"),
  frenchPhonetiqueAsset("fr-schwa", "Tb_Resources/schwa2.mp4"),
  frenchPhonetiqueAsset("fr-o-close", "Tb_Resources/o-ferme2.mp4"),
  frenchPhonetiqueAsset("fr-o-open", "Tb_Resources/o-ouvert2.mp4"),
  frenchPhonetiqueAsset("fr-un", "Tb_Resources/un2.mp4"),
  frenchPhonetiqueAsset("fr-r", "C_Resources/r.mp4"),
  frenchPhonetiqueAsset("fr-sh", "C_Resources/ch.mp4"),
  frenchPhonetiqueAsset("fr-zh", "C_Resources/j.mp4"),
  frenchPhonetiqueAsset("fr-ny", "C_Resources/gn.mp4"),
  frenchPhonetiqueAsset("fr-glide-j", "C_Resources/y.mp4"),
  frenchPhonetiqueAsset("fr-glide-hui", "C_Resources/ua.mp4"),
  frenchPhonetiqueAsset("fr-glide-w", "C_Resources/w.mp4"),
  russianSeeingSpeechAsset("ru-a", "ru-a", [
    "Russian а /a/ primary local asset.",
  ]),
  russianSeeingSpeechAsset("ru-o", "ru-o", [
    "Russian stressed о /o/ primary local asset.",
  ]),
  russianSeeingSpeechAsset("ru-i", "ru-i", [
    "Russian и /i/ primary local asset.",
  ]),
  russianSeeingSpeechAsset("ru-y", "ru-y", [
    "Russian ы /ɨ/ primary local asset; Commons /ɨ/ audio is available as extra reference.",
  ]),
  russianSeeingSpeechAsset("ru-u", "ru-u", [
    "Russian у /u/ primary local asset.",
  ]),
  russianSeeingSpeechAsset("ru-e", "ru-e", [
    "Russian stressed э/е /e/ primary local asset.",
  ]),
  russianSeeingSpeechAsset("ru-r", "ru-r", [
    "Russian trilled р /r/ primary local asset; palatalized trill audio is also available.",
  ]),
  russianSeeingSpeechAsset("ru-x", "ru-x", [
    "Russian х /x/ primary local asset.",
  ]),
  russianSeeingSpeechAsset("ru-ts", "ru-ts", [
    "Russian ц /ts/ primary local asset; Commons /ts/ audio is available as extra reference.",
  ]),
  russianSeeingSpeechAsset(
    "ru-ch",
    "ru-shch-proxy",
    [
      "Video proxy: Seeing Speech /ɕ/ shows the soft alveolo-palatal area; audio is Commons /tɕ/, closer to Russian ч.",
    ],
    {
      audioSrc: "/audio/language-assets/ru-RU/commons/ru-ch.ogg",
    },
  ),
  russianSeeingSpeechAsset(
    "ru-shch",
    "ru-shch-proxy",
    [
      "Proxy: Commons/Seeing Speech asset is /ɕ/; Russian щ target should be taught as long/soft /ɕː/.",
    ],
    {
      audioSrc: "/audio/language-assets/ru-RU/commons/ru-shch-proxy.ogg",
    },
  ),
  russianSeeingSpeechAsset("ru-sh-zh", "ru-sh", [
    "ш/ж contrast: ш is primary; ж is bundled as a related local asset.",
  ]),
  russianSeeingSpeechAsset("ru-ts-ch-shch", "ru-ts", [
    "ц/ч/щ group: ц /ts/ is primary; ч and щ use Commons audio plus /ɕ/ proxy video.",
  ]),
  russianSeeingSpeechAsset("ru-hard-soft", "ru-j", [
    "Proxy: /j/ MRI shows palatal tongue-body raising, but Russian soft consonants are not a full added й.",
  ]),
  russianSeeingSpeechAsset("ru-soft-sign", "ru-j", [
    "Proxy: ь marks palatalization and is not pronounced as an independent /j/ sound.",
  ]),
  russianSeeingSpeechAsset("ru-j", "ru-j", [
    "Russian й /j/ primary local asset.",
  ]),
  russianSeeingSpeechAsset("ru-iotated-vowels", "ru-j", [
    "Iotated vowels: /j/ onset or softening marker depending on position; /j/ video is a rule proxy.",
  ]),
  russianSeeingSpeechAsset("ru-soft-t-d", "ru-t", [
    "Soft т/д contrast: hard /t/ is primary anchor; /d/ is a related local asset.",
  ]),
  russianSeeingSpeechAsset("ru-soft-s-z", "ru-s", [
    "Soft с/з contrast: hard /s/ is primary anchor; /z/ is a related local asset.",
  ]),
  russianSeeingSpeechAsset("ru-soft-n-l-r", "ru-l", [
    "Soft н/л/р contrast: /l/ is primary anchor; /n/, /r/, and palatalized trill audio are related.",
  ]),
  russianSeeingSpeechAsset("ru-soft-labials", "ru-p", [
    "Soft labials: /p/ is primary anchor; /b m f v/ are related local assets.",
  ]),
  russianSeeingSpeechAsset("ru-stress-reduction", "ru-reduction-schwa", [
    "Rule/prosody unit: this is a reduced-vowel quality reference, not a full stress lesson by itself.",
  ]),
  russianSeeingSpeechAsset("ru-unstressed-o-a", "ru-reduction-open-back", [
    "Unstressed о/а reduction: open/back/centralized vowel quality reference.",
  ]),
  russianSeeingSpeechAsset("ru-unstressed-e-ya", "ru-reduction-schwa", [
    "Unstressed е/я reduction: schwa/central-vowel proxy; lesson must still explain [ɪ] and softening environment.",
  ]),
  russianSeeingSpeechAsset("ru-final-devoicing", "ru-k", [
    "Final devoicing: /k/ is primary because current example друг ends as /druk/.",
  ]),
  russianSeeingSpeechAsset("ru-voicing-assimilation", "ru-v", [
    "Voicing assimilation: /v/ is primary anchor; related assets cover devoiced/voiced counterparts.",
  ]),
  russianSeeingSpeechAsset("ru-clusters", "ru-t", [
    "Cluster unit has no single-phoneme perfect video; use /t/ as segment anchor and rely on Russian word/phrase drills.",
  ]),
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
