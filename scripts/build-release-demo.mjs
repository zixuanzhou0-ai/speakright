import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { existsSync } from "node:fs";
import {
  mkdir,
  mkdtemp,
  readFile,
  rename,
  rm,
  writeFile,
} from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import process from "node:process";
import sharp from "sharp";
import {
  EXAMPLE_SCORE_DISCLOSURE,
  RELEASE_EVIDENCE_VERSION,
} from "./lib/release-evidence-fixtures.mjs";
import {
  releaseEvidenceGeneratorDigest,
  releaseEvidenceGeneratorGitProvenance,
} from "./lib/release-evidence-source-digest.mjs";

const root = process.cwd();
const demoRoot = path.join(root, "docs", "assets", "demo");
const finalFrameRoot = path.join(demoRoot, "frames");
const finalOutputPath = path.join(
  demoRoot,
  `speakright-v${RELEASE_EVIDENCE_VERSION}-overview.mp4`,
);
const finalSrtPath = path.join(
  demoRoot,
  `speakright-v${RELEASE_EVIDENCE_VERSION}-overview.en.srt`,
);
const finalVttPath = path.join(
  demoRoot,
  `speakright-v${RELEASE_EVIDENCE_VERSION}-overview.en.vtt`,
);
const finalManifestPath = path.join(demoRoot, "manifest.json");
const diagnosticRedactions = new Set([root]);

const scenes = [
  {
    id: "title",
    duration: 5,
    title: "SpeakRight v1.1.0",
    subtitle: "Pronunciation practice with evidence-first feedback",
    caption:
      "SpeakRight helps Chinese-speaking learners build repeatable pronunciation practice.",
  },
  {
    id: "browser-guided-repeat",
    duration: 8,
    source:
      "docs/assets/screenshots/release/v1.1.0/browser/1280x800/guided-repeat.png",
    caption:
      "Guided Repeat offers quick, standard, and intensive modes without imposing a fixed word limit.",
  },
  {
    id: "browser-free-practice",
    duration: 8,
    source:
      "docs/assets/screenshots/release/v1.1.0/browser/1280x800/free-practice.png",
    caption:
      "Free Practice keeps text, standard-demo TTS controls, recording, and feedback in one workspace.",
  },
  {
    id: "browser-diagnosis",
    duration: 8,
    source:
      "docs/assets/screenshots/release/v1.1.0/browser/1280x800/diagnosis-example.png",
    caption:
      "The diagnosis view connects evidence to a focused training prescription. Scores shown here are example data.",
    scoreDisclosureRequired: true,
  },
  {
    id: "browser-progress",
    duration: 8,
    source:
      "docs/assets/screenshots/release/v1.1.0/browser/1280x800/progress-example.png",
    caption:
      "Progress records evidence stages and retained practice history instead of claiming mastery from one score.",
    scoreDisclosureRequired: true,
  },
  {
    id: "browser-settings",
    duration: 8,
    source:
      "docs/assets/screenshots/release/v1.1.0/browser/1280x800/settings.png",
    caption:
      "Browser settings explain BYOK storage, provider boundaries, privacy controls, and release identity.",
  },
  {
    id: "desktop-guided-repeat",
    duration: 8,
    source:
      "docs/assets/screenshots/release/v1.1.0/desktop/1280x920/guided-repeat.png",
    caption:
      "The Windows Desktop preview follows the same learning flow while using local Tauri capabilities.",
  },
  {
    id: "desktop-diagnosis",
    duration: 8,
    source:
      "docs/assets/screenshots/release/v1.1.0/desktop/1280x920/diagnosis-example.png",
    caption:
      "Desktop evidence uses the same explicit example-data disclosure and never calls a paid API during capture.",
    scoreDisclosureRequired: true,
  },
  {
    id: "desktop-no-key",
    duration: 8,
    source:
      "docs/assets/screenshots/release/v1.1.0/desktop/1280x920/no-key.png",
    caption:
      "A no-key state remains usable for local learning content and clearly explains how cloud scoring is enabled.",
  },
  {
    id: "end",
    duration: 5,
    title: "Open source, transparent, and verifiable",
    subtitle: "Browser Stable · Desktop Preview",
    caption:
      "The repository publishes versioned, reviewable checks, privacy boundaries, and truthful release status.",
  },
];

function escapeXml(value) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&apos;");
}

function wrapText(value, maxCharacters = 78) {
  const words = value.split(/\s+/);
  const lines = [];
  let line = "";
  for (const word of words) {
    const candidate = line ? `${line} ${word}` : word;
    if (candidate.length > maxCharacters && line) {
      lines.push(line);
      line = word;
    } else {
      line = candidate;
    }
  }
  if (line) lines.push(line);
  return lines.slice(0, 2);
}

function captionSvg(caption) {
  const lines = wrapText(caption);
  return Buffer.from(`
    <svg width="1280" height="720" xmlns="http://www.w3.org/2000/svg">
      <rect x="0" y="624" width="1280" height="96" fill="#071c1b" fill-opacity="0.96"/>
      ${lines
        .map(
          (line, index) =>
            `<text x="640" y="${662 + index * 28}" text-anchor="middle" fill="#f0fdfa" font-family="Arial, sans-serif" font-size="23" font-weight="600">${escapeXml(line)}</text>`,
        )
        .join("")}
    </svg>
  `);
}

function scoreDisclosureSvg() {
  return Buffer.from(`
    <svg width="1280" height="720" xmlns="http://www.w3.org/2000/svg">
      <rect x="330" y="12" width="620" height="40" rx="20" fill="#7c2d12" stroke="#fdba74" stroke-width="1"/>
      <text x="640" y="38" text-anchor="middle" fill="#fff7ed" font-family="Arial, Microsoft YaHei UI, sans-serif" font-size="18" font-weight="700">${escapeXml(EXAMPLE_SCORE_DISCLOSURE)}</text>
    </svg>
  `);
}

function titleSvg(scene) {
  return Buffer.from(`
    <svg width="1280" height="720" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stop-color="#062c2a"/>
          <stop offset="1" stop-color="#0f766e"/>
        </linearGradient>
      </defs>
      <rect width="1280" height="720" fill="url(#bg)"/>
      <circle cx="640" cy="245" r="72" fill="#ccfbf1" fill-opacity="0.13"/>
      <text x="640" y="270" text-anchor="middle" fill="#ccfbf1" font-family="Arial, sans-serif" font-size="78" font-weight="700">S</text>
      <text x="640" y="390" text-anchor="middle" fill="#ffffff" font-family="Arial, sans-serif" font-size="58" font-weight="700">${escapeXml(scene.title)}</text>
      <text x="640" y="445" text-anchor="middle" fill="#ccfbf1" font-family="Arial, sans-serif" font-size="27">${escapeXml(scene.subtitle)}</text>
      <text x="640" y="585" text-anchor="middle" fill="#99f6e4" font-family="Arial, sans-serif" font-size="18">Deterministic local capture · no paid API calls · no user data</text>
    </svg>
  `);
}

const evidenceManifestCache = new Map();

async function validateEvidenceSource(scene, source) {
  const normalizedSource = scene.source.replaceAll("\\", "/");
  const segments = normalizedSource.split("/");
  if (
    segments.length !== 8 ||
    segments.slice(0, 4).join("/") !== "docs/assets/screenshots/release" ||
    segments[4] !== `v${RELEASE_EVIDENCE_VERSION}` ||
    !["browser", "desktop"].includes(segments[5])
  ) {
    throw new Error(`Unexpected release-evidence source: ${scene.source}`);
  }
  const edition = segments[5];
  const viewport = segments[6];
  const id = path.basename(segments[7], ".png");
  const manifestPath = path.join(
    root,
    "docs",
    "assets",
    "screenshots",
    "release",
    `v${RELEASE_EVIDENCE_VERSION}`,
    edition,
    "manifest.json",
  );
  let manifest = evidenceManifestCache.get(manifestPath);
  if (!manifest) {
    manifest = JSON.parse(await readFile(manifestPath, "utf8"));
    evidenceManifestCache.set(manifestPath, manifest);
  }
  if (
    manifest.schemaVersion !== 1 ||
    manifest.version !== RELEASE_EVIDENCE_VERSION ||
    manifest.edition !== edition ||
    manifest.fixtureBuildRequired !== true ||
    manifest.paidApiCalls !== false
  ) {
    throw new Error(
      `Invalid ${edition} release-evidence manifest for demo source.`,
    );
  }
  const entry = manifest.artifacts?.find(
    (item) =>
      item.viewport === viewport &&
      item.id === id &&
      item.path === normalizedSource,
  );
  const sourceHash = sha256(source);
  const expectedDimensions = viewport.split("x").map(Number);
  if (
    !entry ||
    entry.edition !== edition ||
    entry.width !== expectedDimensions[0] ||
    entry.height !== expectedDimensions[1] ||
    entry.sha256 !== sourceHash
  ) {
    throw new Error(`Screenshot provenance mismatch: ${scene.source}`);
  }
  if (
    entry.geometry?.bannerCollisions !== 0 ||
    entry.geometry?.bannerWithinViewport !== true ||
    entry.geometry?.bannerOccludedPoints !== 0
  ) {
    throw new Error(`Screenshot banner geometry is invalid: ${scene.source}`);
  }
  if (
    scene.scoreDisclosureRequired &&
    entry.scoreDisclosure !== EXAMPLE_SCORE_DISCLOSURE
  ) {
    throw new Error(`Score disclosure provenance is missing: ${scene.source}`);
  }
  return {
    edition,
    id,
    path: normalizedSource,
    sha256: sourceHash,
    viewport,
    width: entry.width,
    height: entry.height,
  };
}

async function buildFrame(scene, index, frameRoot) {
  const framePath = path.join(
    frameRoot,
    `${String(index + 1).padStart(2, "0")}-${scene.id}.png`,
  );
  if (!scene.source) {
    await sharp(titleSvg(scene))
      .composite([{ input: captionSvg(scene.caption), left: 0, top: 0 }])
      .png()
      .toFile(framePath);
    return { framePath, sourceEvidence: null };
  }

  const sourcePath = path.join(root, scene.source);
  const source = await readFile(sourcePath);
  const sourceEvidence = await validateEvidenceSource(scene, source);
  const resized = await sharp(source)
    .resize({
      width: scene.scoreDisclosureRequired ? 1180 : 1240,
      height: scene.scoreDisclosureRequired ? 540 : 588,
      fit: "contain",
      background: "#071c1b",
    })
    .png()
    .toBuffer();
  await sharp({
    create: {
      width: 1280,
      height: 720,
      channels: 3,
      background: "#071c1b",
    },
  })
    .composite([
      {
        input: resized,
        left: scene.scoreDisclosureRequired ? 50 : 20,
        top: scene.scoreDisclosureRequired ? 64 : 18,
      },
      ...(scene.scoreDisclosureRequired
        ? [{ input: scoreDisclosureSvg(), left: 0, top: 0 }]
        : []),
      { input: captionSvg(scene.caption), left: 0, top: 0 },
    ])
    .png()
    .toFile(framePath);
  return { framePath, sourceEvidence };
}

function formatTimestamp(seconds) {
  const totalMilliseconds = Math.round(seconds * 1000);
  const hours = Math.floor(totalMilliseconds / 3_600_000);
  const minutes = Math.floor((totalMilliseconds % 3_600_000) / 60_000);
  const secs = Math.floor((totalMilliseconds % 60_000) / 1000);
  const millis = totalMilliseconds % 1000;
  return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}:${String(secs).padStart(2, "0")},${String(millis).padStart(3, "0")}`;
}

function subtitleDocuments() {
  let cursor = 0;
  const entries = scenes.map((scene, index) => {
    const start = cursor;
    cursor += scene.duration;
    return {
      index: index + 1,
      start,
      end: cursor,
      caption: scene.caption,
    };
  });
  const srt = entries
    .map(
      (entry) =>
        `${entry.index}\n${formatTimestamp(entry.start)} --> ${formatTimestamp(entry.end)}\n${entry.caption}\n`,
    )
    .join("\n");
  const vtt = `WEBVTT\n\n${entries
    .map(
      (entry) =>
        `${formatTimestamp(entry.start).replace(",", ".")} --> ${formatTimestamp(entry.end).replace(",", ".")}\n${entry.caption}\n`,
    )
    .join("\n")}`;
  return { duration: cursor, srt, vtt };
}

function ffmpegPath(value) {
  return value.replaceAll("\\", "/").replaceAll("'", "'\\''");
}

function sha256(buffer) {
  return createHash("sha256").update(buffer).digest("hex");
}

function configuredExecutable(environmentName, fallback) {
  const configured = process.env[environmentName]?.trim();
  const executable = configured || fallback;
  if (path.isAbsolute(executable)) diagnosticRedactions.add(executable);
  return executable;
}

function runTool(executable, args, label, maxBuffer = 8 * 1024 * 1024) {
  const result = spawnSync(executable, args, {
    cwd: root,
    encoding: "utf8",
    maxBuffer,
    windowsHide: true,
  });
  if (result.error || result.status !== 0) {
    throw new Error(
      `${label} failed (exit ${result.status ?? "unavailable"}).`,
    );
  }
  return result.stdout ?? "";
}

async function preflightToolchain() {
  const ffmpegExecutable = configuredExecutable("FFMPEG_PATH", "ffmpeg");
  const ffprobeExecutable = configuredExecutable("FFPROBE_PATH", "ffprobe");
  runTool(ffmpegExecutable, ["-version"], "ffmpeg preflight");
  const encoders = runTool(
    ffmpegExecutable,
    ["-hide_banner", "-encoders"],
    "ffmpeg encoder preflight",
    16 * 1024 * 1024,
  );
  if (!/(?:^|\s)libx264(?:\s|$)/m.test(encoders)) {
    throw new Error("ffmpeg preflight failed: libx264 is unavailable.");
  }
  runTool(ffprobeExecutable, ["-version"], "ffprobe preflight");
  if (typeof sharp !== "function" || !sharp.versions?.sharp) {
    throw new Error("Sharp preflight failed: runtime metadata is unavailable.");
  }
  const sharpProbe = await sharp({
    create: {
      width: 2,
      height: 2,
      channels: 3,
      background: "#0f766e",
    },
  })
    .png()
    .toBuffer();
  const sharpMetadata = await sharp(sharpProbe).metadata();
  if (sharpMetadata.width !== 2 || sharpMetadata.height !== 2) {
    throw new Error("Sharp preflight failed: PNG round trip was invalid.");
  }
  return { ffmpegExecutable, ffprobeExecutable };
}

function probeMedia(ffprobeExecutable, mediaPath, expectedDuration) {
  const stdout = runTool(
    ffprobeExecutable,
    [
      "-v",
      "error",
      "-show_entries",
      "format=duration:stream=index,codec_type,codec_name,width,height",
      "-of",
      "json",
      mediaPath,
    ],
    "ffprobe media validation",
  );
  let media;
  try {
    media = JSON.parse(stdout);
  } catch {
    throw new Error("ffprobe media validation returned invalid JSON.");
  }
  const streams = Array.isArray(media.streams) ? media.streams : [];
  const videoStreams = streams.filter(
    (stream) => stream.codec_type === "video",
  );
  const audioStreams = streams.filter(
    (stream) => stream.codec_type === "audio",
  );
  const duration = Number(media.format?.duration);
  const video = videoStreams[0];
  if (
    streams.length !== 1 ||
    videoStreams.length !== 1 ||
    audioStreams.length !== 0 ||
    video?.codec_name !== "h264" ||
    video.width !== 1280 ||
    video.height !== 720 ||
    !Number.isFinite(duration) ||
    Math.abs(duration - expectedDuration) > 0.15
  ) {
    throw new Error(
      "Demo media validation failed: expected one 1280x720 H.264 video stream, no audio, and a 74-second timeline.",
    );
  }
  return { duration, video };
}

async function commitArtifacts(targets) {
  const backupRoot = await mkdtemp(
    path.join(demoRoot, ".release-demo-backup-"),
  );
  diagnosticRedactions.add(backupRoot);
  const backups = [];
  const promoted = [];
  try {
    for (const [index, target] of targets.entries()) {
      if (!existsSync(target.final)) continue;
      const backup = path.join(
        backupRoot,
        `${index}-${path.basename(target.final)}`,
      );
      await rename(target.final, backup);
      backups.push({ backup, final: target.final });
    }
    for (const target of targets) {
      await rename(target.staged, target.final);
      promoted.push(target.final);
    }
  } catch (error) {
    for (const final of promoted.reverse()) {
      await rm(final, { force: true, recursive: true }).catch(() => {});
    }
    for (const record of backups.reverse()) {
      if (existsSync(record.backup)) await rename(record.backup, record.final);
    }
    throw error;
  } finally {
    await rm(backupRoot, { force: true, recursive: true }).catch(() => {});
  }
}

function sanitizeDiagnostic(value) {
  let sanitized = String(value);
  for (const candidate of [...diagnosticRedactions].sort(
    (left, right) => right.length - left.length,
  )) {
    if (!candidate) continue;
    sanitized = sanitized.replaceAll(candidate, "<local-path>");
    sanitized = sanitized.replaceAll(
      candidate.replaceAll("\\", "/"),
      "<local-path>",
    );
  }
  return sanitized;
}

async function main() {
  const evidenceManifests = await Promise.all(
    ["browser", "desktop"].map((edition) =>
      readFile(
        path.join(
          root,
          "docs",
          "assets",
          "screenshots",
          "release",
          `v${RELEASE_EVIDENCE_VERSION}`,
          edition,
          "manifest.json",
        ),
        "utf8",
      ).then(JSON.parse),
    ),
  );
  const sourceCommit = evidenceManifests[0]?.sourceCommit;
  if (
    !/^[a-f0-9]{40}$/.test(sourceCommit ?? "") ||
    evidenceManifests.some((manifest) => manifest.sourceCommit !== sourceCommit)
  ) {
    throw new Error(
      "Demo evidence editions must share one full source commit.",
    );
  }
  releaseEvidenceGeneratorGitProvenance(root, sourceCommit);
  const generatorSnapshot = await releaseEvidenceGeneratorDigest(root);
  const { ffmpegExecutable, ffprobeExecutable } = await preflightToolchain();
  await mkdir(demoRoot, { recursive: true });
  let stagingRoot;
  let systemTemporaryRoot;
  try {
    stagingRoot = await mkdtemp(path.join(demoRoot, ".release-demo-stage-"));
    systemTemporaryRoot = await mkdtemp(
      path.join(tmpdir(), "speakright-release-demo-"),
    );
    diagnosticRedactions.add(stagingRoot);
    diagnosticRedactions.add(systemTemporaryRoot);

    const frameRoot = path.join(stagingRoot, "frames");
    const outputPath = path.join(stagingRoot, path.basename(finalOutputPath));
    const srtPath = path.join(stagingRoot, path.basename(finalSrtPath));
    const vttPath = path.join(stagingRoot, path.basename(finalVttPath));
    const manifestPath = path.join(stagingRoot, "manifest.json");
    await mkdir(frameRoot, { recursive: true });

    const frameRecords = [];
    for (const [index, scene] of scenes.entries()) {
      frameRecords.push(await buildFrame(scene, index, frameRoot));
    }
    const framePaths = frameRecords.map((record) => record.framePath);

    const subtitles = subtitleDocuments();
    if (subtitles.duration !== 74) {
      throw new Error(
        `Demo timeline must be exactly 74 seconds; received ${subtitles.duration}.`,
      );
    }
    await writeFile(srtPath, subtitles.srt, "utf8");
    await writeFile(vttPath, subtitles.vtt, "utf8");

    const concatPath = path.join(systemTemporaryRoot, "frames.concat.txt");
    const concat = framePaths
      .flatMap((framePath, index) => [
        `file '${ffmpegPath(framePath)}'`,
        `duration ${scenes[index].duration}`,
      ])
      .concat(`file '${ffmpegPath(framePaths.at(-1))}'`)
      .join("\n");
    await writeFile(concatPath, `${concat}\n`, "utf8");

    runTool(
      ffmpegExecutable,
      [
        "-hide_banner",
        "-loglevel",
        "error",
        "-y",
        "-f",
        "concat",
        "-safe",
        "0",
        "-i",
        concatPath,
        "-t",
        String(subtitles.duration),
        "-r",
        "30",
        "-c:v",
        "libx264",
        "-preset",
        "medium",
        "-crf",
        "20",
        "-pix_fmt",
        "yuv420p",
        "-movflags",
        "+faststart",
        "-an",
        "-metadata",
        `title=SpeakRight v${RELEASE_EVIDENCE_VERSION} deterministic overview`,
        "-metadata",
        "comment=No live provider calls, no user data, and no audio track.",
        outputPath,
      ],
      "ffmpeg demo render",
    );

    const { duration, video } = probeMedia(
      ffprobeExecutable,
      outputPath,
      subtitles.duration,
    );
    const videoBuffer = await readFile(outputPath);
    const srtBuffer = await readFile(srtPath);
    const vttBuffer = await readFile(vttPath);
    if (
      srtBuffer.toString("utf8") !== subtitles.srt ||
      vttBuffer.toString("utf8") !== subtitles.vtt
    ) {
      throw new Error("Staged subtitle verification failed.");
    }
    const frameArtifacts = await Promise.all(
      frameRecords.map(async (record, index) => {
        const buffer = await readFile(record.framePath);
        const metadata = await sharp(buffer).metadata();
        if (metadata.width !== 1280 || metadata.height !== 720) {
          throw new Error(
            `Unexpected demo frame dimensions for scene ${scenes[index].id}.`,
          );
        }
        const finalFramePath = path.join(
          finalFrameRoot,
          path.basename(record.framePath),
        );
        return {
          edition: "demo",
          id: scenes[index].id,
          durationSeconds: scenes[index].duration,
          caption: scenes[index].caption,
          path: path.relative(root, finalFramePath).replaceAll("\\", "/"),
          width: metadata.width,
          height: metadata.height,
          sha256: sha256(buffer),
          scoreDisclosureOverlay: Boolean(
            scenes[index].scoreDisclosureRequired,
          ),
          sourceEvidence: record.sourceEvidence,
        };
      }),
    );
    const manifest = {
      schemaVersion: 1,
      version: RELEASE_EVIDENCE_VERSION,
      edition: "browser-and-desktop",
      durationSeconds: duration,
      dimensions: { width: video.width, height: video.height },
      codec: video.codec_name,
      videoStreams: 1,
      audioStreams: 0,
      subtitleLanguage: "en",
      burnedCaptions: true,
      subtitles: [
        {
          format: "srt",
          path: path.relative(root, finalSrtPath).replaceAll("\\", "/"),
          sha256: sha256(srtBuffer),
        },
        {
          format: "webvtt",
          path: path.relative(root, finalVttPath).replaceAll("\\", "/"),
          sha256: sha256(vttBuffer),
        },
      ],
      scoreDisclosure: EXAMPLE_SCORE_DISCLOSURE,
      paidApiCalls: false,
      userData: false,
      sourceCommit,
      generatorSnapshot,
      path: path.relative(root, finalOutputPath).replaceAll("\\", "/"),
      sha256: sha256(videoBuffer),
      frames: frameArtifacts,
    };
    const serializedManifest = `${JSON.stringify(manifest, null, 2)}\n`;
    if (
      serializedManifest.includes(root) ||
      /[A-Za-z]:[\\/]/.test(serializedManifest)
    ) {
      throw new Error("Demo manifest contains a local absolute path.");
    }
    await writeFile(manifestPath, serializedManifest, "utf8");
    JSON.parse(await readFile(manifestPath, "utf8"));

    releaseEvidenceGeneratorGitProvenance(root, sourceCommit);
    const postBuildGeneratorSnapshot =
      await releaseEvidenceGeneratorDigest(root);
    if (
      JSON.stringify(postBuildGeneratorSnapshot) !==
      JSON.stringify(generatorSnapshot)
    ) {
      throw new Error("Release-evidence generators changed during demo build.");
    }

    await commitArtifacts([
      { staged: frameRoot, final: finalFrameRoot },
      { staged: srtPath, final: finalSrtPath },
      { staged: vttPath, final: finalVttPath },
      { staged: outputPath, final: finalOutputPath },
      { staged: manifestPath, final: finalManifestPath },
    ]);
    console.log(
      `Built ${path.relative(root, finalOutputPath)} (${duration.toFixed(1)}s, no audio).`,
    );
  } finally {
    if (systemTemporaryRoot) {
      await rm(systemTemporaryRoot, { force: true, recursive: true }).catch(
        () => {},
      );
    }
    if (stagingRoot) {
      await rm(stagingRoot, { force: true, recursive: true }).catch(() => {});
    }
  }
}

main().catch((error) => {
  console.error(
    sanitizeDiagnostic(error instanceof Error ? error.message : String(error)),
  );
  process.exit(1);
});
