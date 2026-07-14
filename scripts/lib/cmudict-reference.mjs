import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import {
  assertNonCDrivePath,
  sha256File,
} from "./pronunciation-audit-core.mjs";

export const CMUDICT_ROOT = "D:\\AI\\lexicons\\cmudict";
export const CMUDICT_PATH = path.join(CMUDICT_ROOT, "cmudict.dict");

const ARPABET_TO_IPA = {
  AA: "ɑ",
  AE: "æ",
  AH0: "ə",
  AH: "ʌ",
  AO: "ɔ",
  AW: "aʊ",
  AY: "aɪ",
  B: "b",
  CH: "tʃ",
  D: "d",
  DH: "ð",
  EH: "e",
  ER0: "ər",
  ER: "ɜr",
  EY: "eɪ",
  F: "f",
  G: "ɡ",
  HH: "h",
  IH: "ɪ",
  IY: "i",
  JH: "dʒ",
  K: "k",
  L: "l",
  M: "m",
  N: "n",
  NG: "ŋ",
  OW: "oʊ",
  OY: "ɔɪ",
  P: "p",
  R: "r",
  S: "s",
  SH: "ʃ",
  T: "t",
  TH: "θ",
  UH: "ʊ",
  UW: "u",
  V: "v",
  W: "w",
  Y: "j",
  Z: "z",
  ZH: "ʒ",
};

function canonicalCmuWord(value) {
  return String(value ?? "")
    .normalize("NFKC")
    .toLocaleLowerCase("en-US")
    .replace(/[“”]/gu, '"')
    .replace(/[‘’]/gu, "'")
    .replace(/[^a-z'.-]/gu, "")
    .replace(/\(\d+\)$/u, "");
}

export function arpabetPronunciationToIpa(pronunciation) {
  return pronunciation
    .trim()
    .split(/\s+/u)
    .map((symbol) => {
      const base = symbol.replace(/\d$/u, "");
      const key =
        symbol.endsWith("0") && ["AH", "ER"].includes(base) ? `${base}0` : base;
      return ARPABET_TO_IPA[key] ?? `?${symbol}?`;
    })
    .join("");
}

export function normalizeComparableEnglishIpa(value) {
  return String(value ?? "")
    .normalize("NFD")
    .replace(/\p{M}+/gu, "")
    .replace(/[/[\]()ˈˌ.' ·-]/gu, "")
    .replaceAll("ː", "")
    .replaceAll("t͡ʃ", "tʃ")
    .replaceAll("d͡ʒ", "dʒ")
    .replaceAll("ɹ", "r")
    .replaceAll("ɫ", "l")
    .replaceAll("ɝ", "ɜr")
    .replaceAll("ɚ", "ər")
    .replaceAll("ɛ", "e")
    .replaceAll("g", "ɡ")
    .replaceAll("ɒ", "ɑ");
}

export function parseCmuDict(source) {
  const entries = new Map();
  for (const line of source.split(/\r?\n/u)) {
    const match = line.match(/^(\S+)\s+(.+)$/u);
    if (!match || line.startsWith(";;;")) continue;
    const word = canonicalCmuWord(match[1]);
    if (!word) continue;
    const pronunciations = entries.get(word) ?? [];
    pronunciations.push(match[2].trim());
    entries.set(word, pronunciations);
  }
  return entries;
}

function readRepositoryRevision(root) {
  const headPath = path.join(root, ".git", "HEAD");
  if (!existsSync(headPath)) return null;
  const head = readFileSync(headPath, "utf8").trim();
  if (/^[a-f0-9]{40}$/iu.test(head)) return head;
  const reference = head.match(/^ref:\s+(.+)$/u)?.[1];
  if (!reference) return null;
  const referencePath = path.join(
    root,
    ".git",
    reference.replaceAll("/", path.sep),
  );
  return existsSync(referencePath)
    ? readFileSync(referencePath, "utf8").trim()
    : null;
}

export function loadCmuDictReference() {
  assertNonCDrivePath(CMUDICT_ROOT, "CMUdict root");
  if (!existsSync(CMUDICT_PATH)) {
    throw new Error(`CMUdict is missing: ${CMUDICT_PATH}`);
  }
  const source = readFileSync(CMUDICT_PATH, "utf8");
  return {
    entries: parseCmuDict(source),
    revision: readRepositoryRevision(CMUDICT_ROOT),
    sha256: sha256File(CMUDICT_PATH),
    licensePath: path.join(CMUDICT_ROOT, "LICENSE"),
  };
}

export function compareProjectIpaToCmu(projectIpa, pronunciations) {
  if (!projectIpa) {
    return { status: "missing-project-ipa", candidates: [] };
  }
  if (!pronunciations?.length) {
    return { status: "cmudict-missing", candidates: [] };
  }
  const candidates = pronunciations.map((arpabet) => ({
    arpabet,
    ipa: arpabetPronunciationToIpa(arpabet),
  }));
  const expected = normalizeComparableEnglishIpa(projectIpa);
  const matched = candidates.some(
    (candidate) => normalizeComparableEnglishIpa(candidate.ipa) === expected,
  );
  return {
    status: matched ? "cmudict-segment-match" : "cmudict-conflict-needs-review",
    candidates,
  };
}

export function lookupCmuPronunciations(entries, text) {
  if (/\s/u.test(String(text ?? "").trim())) return [];
  return entries.get(canonicalCmuWord(text)) ?? [];
}
