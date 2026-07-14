#!/usr/bin/env node

import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const catalog = JSON.parse(
  await readFile(
    path.join(
      root,
      "packages/core/src/content/training-perception-catalog.json",
    ),
    "utf8",
  ),
);
const speakers = JSON.parse(
  await readFile(
    path.join(root, "packages/core/src/content/training-speaker-manifest.json"),
    "utf8",
  ),
);
const words = Array.from(
  new Set(
    catalog.flatMap((entry) =>
      entry.examples.flatMap((example) => [
        example.wordA.toLowerCase(),
        example.wordB.toLowerCase(),
      ]),
    ),
  ),
).sort();
const pendingSpeakers = speakers.filter(
  (speaker) => speaker.reviewStatus === "needs-review",
);
const outputDirectory = path.join(root, "outputs", "training-audio-review");

await mkdir(outputDirectory, { recursive: true });

const checklist = {
  generatedAt: new Date().toISOString(),
  instructions: [
    "Listen for the displayed target word, clipping, distortion, long silence, and abnormal loudness.",
    "Do not change reviewStatus to reviewed until every pending item has been heard.",
    "Record any issue against the exact speakerId and word.",
  ],
  speakers: [],
};

for (const speaker of pendingSpeakers) {
  const items = words.map((word) => {
    const audioPath = path.join(
      root,
      "public",
      "audio",
      "words",
      speaker.assetDirectory,
      `${word}.mp3`,
    );
    return {
      speakerId: speaker.id,
      word,
      audioPath,
      status: "pending",
      issue: "",
    };
  });
  const playlist = [
    "#EXTM3U",
    ...items.flatMap((item) => [
      `#EXTINF:-1,${item.speakerId} / ${item.word}`,
      pathToFileURL(item.audioPath).href,
    ]),
  ];
  await writeFile(
    path.join(outputDirectory, `${speaker.id}-review.m3u8`),
    `${playlist.join("\n")}\n`,
    "utf8",
  );
  checklist.speakers.push({ speakerId: speaker.id, items });
}

await writeFile(
  path.join(outputDirectory, "checklist.json"),
  `${JSON.stringify(checklist, null, 2)}\n`,
  "utf8",
);

console.log(
  `Prepared ${pendingSpeakers.length} review playlists × ${words.length} words in ${outputDirectory}`,
);
