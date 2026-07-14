import { createHash } from "node:crypto";
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import Module, { createRequire } from "node:module";
import path from "node:path";
import ts from "typescript";

export const AUDIT_VERSION = 1;
export const AUDIT_DATE = "2026-07-14";
export const AUDIT_OUTPUT_NAME = `pronunciation-audit-${AUDIT_DATE}`;
export const WHISPER_MODEL_ID = "Systran/faster-whisper-large-v3";
export const WHISPER_MODEL_ROOT =
  "D:\\AI\\models\\whisper\\faster-whisper-large-v3";
export const WHISPER_CACHE_ROOT = "D:\\AI\\cache";
export const EXPECTED_CANONICAL_ASSET_COUNT = 6242;

export const LANGUAGE_IDS = ["en-US", "es-ES", "fr-FR", "ru-RU"];
export const LANGUAGE_CODES = {
  "en-US": "en",
  "es-ES": "es",
  "fr-FR": "fr",
  "ru-RU": "ru",
};

export const AUDIT_STATUSES = [
  "verified",
  "verified-variant",
  "needs-review",
  "needs-native-review",
  "confirmed-error",
  "regenerated-candidate",
  "replaced-and-verified",
];

const AUDIO_EXTENSIONS = new Set([".mp3", ".wav", ".ogg", ".m4a"]);
const SECRET_KEY_PATTERN =
  /(subscriptionKey|apiKey|token|authorization|ocp-apim-subscription-key|xi-api-key)/i;
const SUSPICIOUS_SECRET_VALUE = /^[A-Za-z0-9_+\-/=]{48,}$/;

export function assertNonCDrivePath(value, label = "path") {
  const resolved = path.resolve(value);
  if (/^c:\\/i.test(resolved)) {
    throw new Error(`${label} must not resolve to C drive: ${resolved}`);
  }
  return resolved;
}

export function sha256Bytes(value) {
  return createHash("sha256").update(value).digest("hex");
}

export function sha256File(filePath) {
  return sha256Bytes(readFileSync(filePath));
}

export function stableAssetId(relativePath) {
  return sha256Bytes(relativePath.replaceAll("\\", "/").toLowerCase()).slice(
    0,
    20,
  );
}

export function normalizeAuditText(value, languageId = "en-US") {
  let normalized = String(value ?? "")
    .normalize("NFKC")
    .toLocaleLowerCase(languageId)
    .replace(/[\p{P}\p{S}]+/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
  if (languageId === "ru-RU") {
    normalized = normalized.replaceAll("ё", "е");
  }
  return normalized;
}

export function compareTranscript(expected, actual, languageId = "en-US") {
  const expectedNormalized = normalizeAuditText(expected, languageId);
  const actualNormalized = normalizeAuditText(actual, languageId);
  if (!actualNormalized) return "no-speech";
  if (expectedNormalized === actualNormalized) return "exact";
  const foldMarks = (text) => text.normalize("NFD").replace(/\p{M}+/gu, "");
  if (foldMarks(expectedNormalized) === foldMarks(actualNormalized)) {
    return "orthographic-variant";
  }
  if (
    actualNormalized.split(" ").includes(expectedNormalized) ||
    expectedNormalized.split(" ").includes(actualNormalized)
  ) {
    return "contains-expected";
  }
  return "mismatch";
}

export function redactSecrets(value, keyName = "") {
  if (Array.isArray(value)) {
    return value.map((entry) => redactSecrets(entry, keyName));
  }
  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value).map(([key, entry]) => [
        key,
        SECRET_KEY_PATTERN.test(key) ? "[REDACTED]" : redactSecrets(entry, key),
      ]),
    );
  }
  const isSafeDigest =
    /(?:sha256|checksum|hash)$/iu.test(keyName) &&
    /^[a-f0-9]{64}$/iu.test(value);
  if (
    typeof value === "string" &&
    SUSPICIOUS_SECRET_VALUE.test(value) &&
    !isSafeDigest
  ) {
    return "[REDACTED-LONG-VALUE]";
  }
  return value;
}

let installedTypeScriptHookRoot = null;

export function installTypeScriptRequireHook(root) {
  if (installedTypeScriptHookRoot === root) return;
  const originalResolve = Module._resolveFilename;
  Module._resolveFilename = function resolveAlias(
    request,
    parent,
    isMain,
    options,
  ) {
    if (typeof request === "string" && request.startsWith("@/")) {
      return originalResolve.call(
        this,
        path.resolve(root, "src", request.slice(2)),
        parent,
        isMain,
        options,
      );
    }
    return originalResolve.call(this, request, parent, isMain, options);
  };
  Module._extensions[".ts"] = function compileTypeScript(module, filename) {
    const source = readFileSync(filename, "utf8");
    const output = ts.transpileModule(source, {
      compilerOptions: {
        esModuleInterop: true,
        module: ts.ModuleKind.CommonJS,
        target: ts.ScriptTarget.ES2022,
      },
      fileName: filename,
    });
    module._compile(output.outputText, filename);
  };
  installedTypeScriptHookRoot = root;
}

export function loadEnglishContent(root) {
  installTypeScriptRequireHook(root);
  const require = createRequire(import.meta.url);
  const { PHONEMES } = require(path.resolve(root, "src/lib/phoneme-data.ts"));
  const { WORD_BANK } = require(path.resolve(root, "src/lib/word-bank.ts"));
  return { PHONEMES, WORD_BANK };
}

export function loadLanguagePhonemeContent(root) {
  installTypeScriptRequireHook(root);
  const require = createRequire(import.meta.url);
  const { LANGUAGE_PHONEMES } = require(
    path.resolve(root, "src/lib/language-phonemes.ts"),
  );
  return LANGUAGE_PHONEMES;
}

export function loadPhonemeAssessmentAliases(root) {
  installTypeScriptRequireHook(root);
  const require = createRequire(import.meta.url);
  const { phonemeAssessmentAliases } = require(
    path.resolve(root, "src/lib/azure-phoneme-map.ts"),
  );
  return phonemeAssessmentAliases;
}

function listAudioFiles(directory) {
  const files = [];
  const visit = (current) => {
    for (const entry of readdirSync(current, { withFileTypes: true })) {
      const resolved = path.join(current, entry.name);
      if (entry.isDirectory()) visit(resolved);
      else if (AUDIO_EXTENSIONS.has(path.extname(entry.name).toLowerCase())) {
        files.push(resolved);
      }
    }
  };
  visit(directory);
  return files.sort((a, b) => a.localeCompare(b));
}

function relativePublicPath(root, filePath) {
  return `/${path
    .relative(path.join(root, "public"), filePath)
    .replaceAll("\\", "/")}`;
}

function roleFromLanguageItem(item) {
  if (item.kinds?.includes("sentence")) return "sentence";
  if (/\s/u.test(String(item.text ?? "").trim())) return "phrase";
  return "example-word";
}

function resolveSpeakerByDirectory(manifest, directory) {
  return manifest.find((speaker) => speaker.assetDirectory === directory);
}

function buildEnglishWordReference(PHONEMES, WORD_BANK) {
  const references = new Map();
  const add = (entry, phoneme) => {
    if (!entry?.word) return;
    const key = entry.word.toLocaleLowerCase("en-US");
    const current = references.get(key) ?? {
      ipas: new Set(),
      targetUnits: new Set(),
    };
    if (entry.ipa) current.ipas.add(entry.ipa);
    if (phoneme?.ipa) current.targetUnits.add(phoneme.ipa);
    references.set(key, current);
  };
  for (const phoneme of PHONEMES) {
    for (const entry of phoneme.keywords ?? []) add(entry, phoneme);
    for (const entry of WORD_BANK[phoneme.slug] ?? []) add(entry, phoneme);
  }
  return references;
}

function createAsset(root, metadata) {
  const desktopAbsolute = path.resolve(
    root,
    "public",
    metadata.publicPath.slice(1),
  );
  const browserAbsolute = path.resolve(
    root,
    "apps/browser/public",
    metadata.publicPath.slice(1),
  );
  const issues = [];
  if (!existsSync(desktopAbsolute)) issues.push("desktop-missing");
  if (!existsSync(browserAbsolute)) issues.push("browser-missing");
  const desktopBytes = existsSync(desktopAbsolute)
    ? statSync(desktopAbsolute).size
    : 0;
  const browserBytes = existsSync(browserAbsolute)
    ? statSync(browserAbsolute).size
    : 0;
  if (desktopBytes === 0) issues.push("desktop-empty");
  if (browserBytes === 0) issues.push("browser-empty");
  const desktopHash = desktopBytes > 0 ? sha256File(desktopAbsolute) : null;
  const browserHash = browserBytes > 0 ? sha256File(browserAbsolute) : null;
  if (desktopHash && browserHash && desktopHash !== browserHash) {
    issues.push("platform-hash-mismatch");
  }
  return {
    version: AUDIT_VERSION,
    assetId: stableAssetId(metadata.publicPath),
    languageId: metadata.languageId,
    locale: metadata.languageId,
    role: metadata.role,
    text: metadata.text,
    expectedIpa: metadata.expectedIpa,
    targetUnits: metadata.targetUnits ?? [],
    voiceSlot: metadata.voiceSlot,
    speakerId: metadata.speakerId,
    publicPath: metadata.publicPath,
    desktopPath: path.relative(root, desktopAbsolute).replaceAll("\\", "/"),
    browserPath: path.relative(root, browserAbsolute).replaceAll("\\", "/"),
    bytes: desktopBytes,
    sha256: desktopHash,
    referenceStatus: metadata.referenceStatus ?? "project-metadata",
    issues,
  };
}

export function buildPronunciationInventory(root) {
  const { PHONEMES, WORD_BANK } = loadEnglishContent(root);
  const speakerManifest = JSON.parse(
    readFileSync(
      path.resolve(
        root,
        "packages/core/src/content/training-speaker-manifest.json",
      ),
      "utf8",
    ),
  );
  const assets = [];

  for (const phoneme of PHONEMES) {
    const word = phoneme.chartWord.toLocaleLowerCase("en-US");
    const common = {
      languageId: "en-US",
      text: word,
      expectedIpa: phoneme.chartIpa,
      targetUnits: [phoneme.ipa],
    };
    assets.push(
      createAsset(root, {
        ...common,
        role: "phoneme-anchor",
        text: phoneme.ipa,
        expectedIpa: phoneme.ipa,
        publicPath: `/audio/ipa/phoneme/${encodeURIComponent(word)}.mp3`,
      }),
      createAsset(root, {
        ...common,
        role: "ipa-word-normal",
        publicPath: `/audio/ipa/normal/${encodeURIComponent(word)}.mp3`,
      }),
      createAsset(root, {
        ...common,
        role: "ipa-word-slow",
        publicPath: `/audio/ipa/slow/${encodeURIComponent(word)}.mp3`,
      }),
    );
  }

  const references = buildEnglishWordReference(PHONEMES, WORD_BANK);
  const wordsRoot = path.resolve(root, "public/audio/words");
  for (const filePath of listAudioFiles(wordsRoot)) {
    const voiceSlot = path.basename(path.dirname(filePath));
    const speaker = resolveSpeakerByDirectory(speakerManifest, voiceSlot);
    const word = path.basename(filePath, path.extname(filePath));
    const reference = references.get(word.toLocaleLowerCase("en-US"));
    const ipas = reference ? [...reference.ipas] : [];
    assets.push(
      createAsset(root, {
        languageId: "en-US",
        role:
          voiceSlot === "green" || voiceSlot === "amber"
            ? "training-word"
            : "example-word",
        text: word,
        expectedIpa: ipas.length === 1 ? ipas[0] : undefined,
        targetUnits: reference ? [...reference.targetUnits] : [],
        voiceSlot,
        speakerId: speaker?.id ?? voiceSlot,
        referenceStatus:
          ipas.length === 1
            ? "project-metadata"
            : ipas.length > 1
              ? "ambiguous-project-metadata"
              : "missing-project-metadata",
        publicPath: relativePublicPath(root, filePath),
      }),
    );
  }

  for (const languageId of ["es-ES", "fr-FR", "ru-RU"]) {
    const manifest = JSON.parse(
      readFileSync(
        path.resolve(
          root,
          `public/audio/language-packs/${languageId}/manifest.json`,
        ),
        "utf8",
      ),
    );
    for (const item of manifest.items ?? []) {
      for (const [voiceSlot, publicPath] of Object.entries(
        item.audioByVoice ?? { blue: item.audioSrc },
      )) {
        if (!publicPath) continue;
        assets.push(
          createAsset(root, {
            languageId,
            role: roleFromLanguageItem(item),
            text: item.text,
            expectedIpa: item.ipa,
            targetUnits: item.soundUnitSlugs ?? [],
            voiceSlot,
            speakerId:
              manifest.voices?.[voiceSlot]?.voiceName ??
              manifest.voices?.[voiceSlot]?.voiceId ??
              voiceSlot,
            referenceStatus: item.ipa
              ? "project-metadata"
              : "missing-project-metadata",
            publicPath,
          }),
        );
      }
    }

    const headerRoot = path.resolve(
      root,
      `public/audio/language-assets/${languageId}`,
    );
    for (const filePath of listAudioFiles(headerRoot)) {
      const slug = path.basename(filePath, path.extname(filePath));
      assets.push(
        createAsset(root, {
          languageId,
          role: "header-clip",
          text: slug,
          targetUnits: [slug],
          referenceStatus: "needs-human-anchor-review",
          publicPath: relativePublicPath(root, filePath),
        }),
      );
    }
  }

  const byPath = new Map();
  for (const asset of assets) {
    if (byPath.has(asset.publicPath)) {
      throw new Error(`Duplicate canonical asset path: ${asset.publicPath}`);
    }
    byPath.set(asset.publicPath, asset);
  }

  const physicalFiles = listAudioFiles(path.resolve(root, "public/audio"));
  const physicalPaths = new Set(
    physicalFiles.map((filePath) => relativePublicPath(root, filePath)),
  );
  const untrackedAudio = [...physicalPaths].filter((item) => !byPath.has(item));
  const missingPhysical = [...byPath.keys()].filter(
    (item) => !physicalPaths.has(item),
  );
  const countsByLanguage = Object.fromEntries(
    LANGUAGE_IDS.map((languageId) => [
      languageId,
      assets.filter((asset) => asset.languageId === languageId).length,
    ]),
  );
  const countsByRole = Object.fromEntries(
    [...new Set(assets.map((asset) => asset.role))]
      .sort()
      .map((role) => [
        role,
        assets.filter((asset) => asset.role === role).length,
      ]),
  );
  const issues = assets.flatMap((asset) =>
    asset.issues.map((issue) => ({ assetId: asset.assetId, issue })),
  );
  if (assets.length !== EXPECTED_CANONICAL_ASSET_COUNT) {
    issues.push({
      assetId: null,
      issue: `asset-count-${assets.length}-expected-${EXPECTED_CANONICAL_ASSET_COUNT}`,
    });
  }
  return {
    version: AUDIT_VERSION,
    generatedAt: new Date().toISOString(),
    expectedAssetCount: EXPECTED_CANONICAL_ASSET_COUNT,
    assetCount: assets.length,
    totalBytes: assets.reduce((sum, asset) => sum + asset.bytes, 0),
    countsByLanguage,
    countsByRole,
    untrackedAudio,
    missingPhysical,
    issues,
    assets: assets.sort((a, b) => a.publicPath.localeCompare(b.publicPath)),
  };
}

export function classifyOfflineAsset(asset, signal, whisper) {
  if (asset.issues.length > 0 || signal?.issues?.length > 0) {
    return { status: "needs-review", reasons: ["asset-or-signal-issue"] };
  }
  if (asset.role === "phoneme-anchor" || asset.role === "header-clip") {
    return {
      status: "needs-review",
      reasons: ["human-anchor-review-required"],
    };
  }
  if (!asset.text || asset.referenceStatus !== "project-metadata") {
    return { status: "needs-review", reasons: [asset.referenceStatus] };
  }
  if (!whisper || whisper.match === "no-speech") {
    return { status: "needs-review", reasons: ["whisper-no-speech"] };
  }
  if (whisper.match === "mismatch") {
    return { status: "needs-review", reasons: ["whisper-mismatch"] };
  }
  return {
    status: "needs-review",
    reasons: ["azure-and-human-evidence-pending"],
  };
}
