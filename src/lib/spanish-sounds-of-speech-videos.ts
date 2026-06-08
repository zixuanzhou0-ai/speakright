import manifestJson from "../../public/videos/language-assets/es-ES/examples/manifest.json";

export interface SpanishSoundVideoClip {
  id: string;
  kind: "target" | "example";
  label: string;
  word?: string;
  ipaKey?: string;
  localSrc: string;
  sourceUrl?: string;
}

export interface SpanishSoundVideoSet {
  slug: string;
  folderName: string;
  animationSrc: string;
  targetClip: SpanishSoundVideoClip;
  exampleClips: SpanishSoundVideoClip[];
}

interface SpanishSoundManifestVideo {
  sourceUrl?: string;
  localSrc: string;
}

interface SpanishSoundManifestExample extends SpanishSoundManifestVideo {
  word: string;
  video: string;
  formattedWord?: string;
  officialIpaKey?: string;
  officialIpa?: string;
}

interface SpanishSoundManifestPhoneme {
  slug: string;
  folderName: string;
  officialIpaKeys?: string[];
  soundVideo: SpanishSoundManifestVideo;
  examples: SpanishSoundManifestExample[];
}

interface SpanishSoundManifest {
  phonemes: SpanishSoundManifestPhoneme[];
}

const EXAMPLES_PUBLIC_ROOT = "/videos/language-assets/es-ES/examples/";
const ANIMATION_PUBLIC_ROOT = "/videos/language-assets/es-ES/animation/";

const manifest = manifestJson as SpanishSoundManifest;

function assertPublicExamplePath(localSrc: string, slug: string): string {
  if (!localSrc.startsWith(`${EXAMPLES_PUBLIC_ROOT}${slug}/`)) {
    throw new Error(`Unexpected Spanish Sounds of Speech path: ${localSrc}`);
  }
  return localSrc;
}

function toVideoSet(phoneme: SpanishSoundManifestPhoneme): SpanishSoundVideoSet {
  const targetClip: SpanishSoundVideoClip = {
    id: `${phoneme.slug}-target`,
    kind: "target",
    label: "目标音",
    ipaKey: phoneme.officialIpaKeys?.[0],
    localSrc: assertPublicExamplePath(
      phoneme.soundVideo.localSrc,
      phoneme.slug,
    ),
    sourceUrl: phoneme.soundVideo.sourceUrl,
  };

  return {
    slug: phoneme.slug,
    folderName: phoneme.folderName,
    animationSrc: `${ANIMATION_PUBLIC_ROOT}${phoneme.slug}.mp4`,
    targetClip,
    exampleClips: phoneme.examples.map((example) => ({
      id: `${phoneme.slug}-${example.video.replace(/\.mp4$/i, "")}`,
      kind: "example",
      label: example.word,
      word: example.word,
      ipaKey: example.officialIpaKey ?? example.officialIpa,
      localSrc: assertPublicExamplePath(example.localSrc, phoneme.slug),
      sourceUrl: example.sourceUrl,
    })),
  };
}

const SPANISH_SOUND_VIDEO_SETS = manifest.phonemes.map(toVideoSet);

const SPANISH_SOUND_VIDEO_SET_BY_SLUG = new Map(
  SPANISH_SOUND_VIDEO_SETS.map((videoSet) => [videoSet.slug, videoSet]),
);

export function getSpanishSoundVideoSet(
  slug: string,
): SpanishSoundVideoSet | undefined {
  return SPANISH_SOUND_VIDEO_SET_BY_SLUG.get(slug);
}

export function getAllSpanishSoundVideoSets(): SpanishSoundVideoSet[] {
  return SPANISH_SOUND_VIDEO_SETS;
}
