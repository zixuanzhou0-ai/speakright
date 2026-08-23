import { execFile } from "node:child_process";
import { createHash } from "node:crypto";
import { promises as fs } from "node:fs";
import path from "node:path";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);

export const ASSET_RIGHTS_DIGEST_PREFIX = "speakright-asset-rights-v1\0";

const MEDIA_EXTENSION_KIND = new Map([
  [".avif", "image"],
  [".gif", "image"],
  [".jpeg", "image"],
  [".jpg", "image"],
  [".m4a", "audio"],
  [".mp3", "audio"],
  [".mp4", "video"],
  [".oga", "audio"],
  [".ogg", "audio"],
  [".png", "image"],
  [".svg", "image"],
  [".wav", "audio"],
  [".webm", "video"],
  [".webp", "image"],
]);

const METADATA_EXTENSIONS = new Set([".json"]);
const REDISTRIBUTION_VALUES = new Set([
  "approved",
  "restricted-bundle",
  "reference-only",
]);
const EDITIONS = new Set(["browser", "desktop"]);
const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/u;
const DIGEST_PATTERN = /^[a-f0-9]{64}$/u;
const ID_PATTERN = /^[a-z0-9][a-z0-9-]+$/u;
const EVIDENCE_PATTERN = /^[A-Z0-9][A-Z0-9._:-]{5,127}$/u;
const REGISTRY_KEYS = new Set([
  "$schema",
  "version",
  "canonicalRoot",
  "generatedAt",
  "records",
]);
const RECORD_KEYS = new Set([
  "id",
  "path",
  "sha256",
  "assetCount",
  "kind",
  "sourceName",
  "sourceUrl",
  "sourceDetailsPath",
  "sourceDetailsSha256",
  "creator",
  "licenseSpdx",
  "evidenceRef",
  "redistribution",
  "modifications",
  "attribution",
  "editions",
  "reviewedAt",
]);

export function toPosixPath(value) {
  return value.split(path.sep).join("/");
}

export function mediaKindForPath(relativePath) {
  return MEDIA_EXTENSION_KIND.get(
    path.posix.extname(relativePath).toLowerCase(),
  );
}

export function globToRegExp(glob) {
  let expression = "^";

  for (let index = 0; index < glob.length; index += 1) {
    const character = glob[index];
    if (character === "*") {
      if (glob[index + 1] === "*") {
        index += 1;
        if (glob[index + 1] === "/") {
          index += 1;
          expression += "(?:.*/)?";
        } else {
          expression += ".*";
        }
      } else {
        expression += "[^/]*";
      }
      continue;
    }
    if (character === "?") {
      expression += "[^/]";
      continue;
    }
    expression += character.replace(/[|\\{}()[\]^$+?.]/gu, "\\$&");
  }

  return new RegExp(`${expression}$`, "u");
}

export function matchesGlob(relativePath, glob) {
  return globToRegExp(glob).test(relativePath);
}

export async function walkFiles(rootDirectory) {
  const files = [];

  async function visit(directory, prefix = "") {
    const entries = await fs.readdir(directory, { withFileTypes: true });
    entries.sort((left, right) => left.name.localeCompare(right.name));

    for (const entry of entries) {
      const relativePath = prefix ? `${prefix}/${entry.name}` : entry.name;
      const absolutePath = path.join(directory, entry.name);
      if (entry.isSymbolicLink()) {
        throw new Error(
          `Symbolic links are not allowed in packaged assets: ${relativePath}`,
        );
      }
      if (entry.isDirectory()) {
        await visit(absolutePath, relativePath);
      } else if (entry.isFile() && entry.name !== ".gitkeep") {
        files.push(relativePath);
      }
    }
  }

  await visit(rootDirectory);
  return files;
}

export async function listGitTrackedPackagedFiles({
  projectRoot,
  canonicalRoot,
}) {
  const resolvedProjectRoot = path.resolve(projectRoot);
  const resolvedCanonicalRoot = path.resolve(canonicalRoot);
  const relativeCanonicalRoot = path.relative(
    resolvedProjectRoot,
    resolvedCanonicalRoot,
  );

  if (
    relativeCanonicalRoot === "" ||
    relativeCanonicalRoot === ".." ||
    relativeCanonicalRoot.startsWith(`..${path.sep}`) ||
    path.isAbsolute(relativeCanonicalRoot)
  ) {
    throw new Error(
      "The canonical asset root must be a child of the Git project root.",
    );
  }

  const gitPrefix = toPosixPath(relativeCanonicalRoot);
  const { stdout } = await execFileAsync(
    "git",
    ["-C", resolvedProjectRoot, "ls-files", "--cached", "-z", "--", gitPrefix],
    {
      encoding: "buffer",
      maxBuffer: 32 * 1024 * 1024,
    },
  );
  const prefix = `${gitPrefix}/`;

  return stdout
    .toString("utf8")
    .split("\0")
    .filter(Boolean)
    .map((trackedPath) => {
      const normalizedPath = trackedPath.replaceAll("\\", "/");
      if (!normalizedPath.startsWith(prefix)) {
        throw new Error(
          `Git returned a tracked path outside ${gitPrefix}: ${normalizedPath}`,
        );
      }
      return normalizedPath.slice(prefix.length);
    })
    .filter((relativePath) => path.posix.basename(relativePath) !== ".gitkeep")
    .sort((left, right) => left.localeCompare(right));
}

async function resolvePackagedFiles(canonicalRoot, packagedFiles) {
  if (packagedFiles === undefined) {
    return { files: await walkFiles(canonicalRoot), errors: [] };
  }
  if (!Array.isArray(packagedFiles)) {
    return {
      files: [],
      errors: ["packagedFiles must be an array of canonical-root paths."],
    };
  }

  const errors = [];
  const files = [];
  const seen = new Set();
  const resolvedCanonicalRoot = path.resolve(canonicalRoot);
  let realCanonicalRoot;
  try {
    realCanonicalRoot = await fs.realpath(resolvedCanonicalRoot);
  } catch (error) {
    return {
      files: [],
      errors: [`Cannot resolve canonical asset root (${error.message}).`],
    };
  }

  for (const relativePath of packagedFiles) {
    if (!hasSafeRelativePath(relativePath)) {
      errors.push(`Packaged asset path is unsafe: ${String(relativePath)}.`);
      continue;
    }
    if (path.posix.basename(relativePath) === ".gitkeep") continue;
    if (seen.has(relativePath)) {
      errors.push(`Duplicate packaged asset path: ${relativePath}.`);
      continue;
    }
    seen.add(relativePath);

    const absolutePath = path.resolve(
      resolvedCanonicalRoot,
      ...relativePath.split("/"),
    );
    const relativeToRoot = path.relative(resolvedCanonicalRoot, absolutePath);
    if (
      relativeToRoot === "" ||
      relativeToRoot === ".." ||
      relativeToRoot.startsWith(`..${path.sep}`) ||
      path.isAbsolute(relativeToRoot)
    ) {
      errors.push(`Packaged asset resolves outside public/: ${relativePath}.`);
      continue;
    }

    try {
      const info = await fs.lstat(absolutePath);
      if (info.isSymbolicLink()) {
        errors.push(
          `Packaged asset must not be a symbolic link: ${relativePath}.`,
        );
        continue;
      }
      if (!info.isFile()) {
        errors.push(`Packaged asset is not a regular file: ${relativePath}.`);
        continue;
      }
      const realFilePath = await fs.realpath(absolutePath);
      const relativeRealPath = path.relative(realCanonicalRoot, realFilePath);
      if (
        relativeRealPath === "" ||
        relativeRealPath === ".." ||
        relativeRealPath.startsWith(`..${path.sep}`) ||
        path.isAbsolute(relativeRealPath)
      ) {
        errors.push(
          `Packaged asset real path escapes the canonical root: ${relativePath}.`,
        );
        continue;
      }
    } catch (error) {
      errors.push(
        `Tracked packaged asset is unavailable: ${relativePath} (${error.message}).`,
      );
      continue;
    }

    files.push(relativePath);
  }

  return {
    files: files.sort((left, right) => left.localeCompare(right)),
    errors,
  };
}

export async function digestAssetFamily(canonicalRoot, relativePaths) {
  const hash = createHash("sha256");
  hash.update(ASSET_RIGHTS_DIGEST_PREFIX);

  for (const relativePath of [...relativePaths].sort()) {
    hash.update(relativePath, "utf8");
    hash.update("\0");
    hash.update(
      await fs.readFile(path.join(canonicalRoot, ...relativePath.split("/"))),
    );
    hash.update("\0");
  }

  return hash.digest("hex");
}

export async function digestFile(filePath) {
  return createHash("sha256")
    .update(await fs.readFile(filePath))
    .digest("hex");
}

function hasSafeRelativeGlob(value) {
  if (typeof value !== "string" || value.length === 0) return false;
  if (
    value.includes("\\") ||
    value.startsWith("/") ||
    /^[A-Za-z]:/u.test(value)
  ) {
    return false;
  }
  return !value.split("/").includes("..");
}

function hasSafeRelativePath(value) {
  return hasSafeRelativeGlob(value) && !/[?*]/u.test(value);
}

function isHttpUrl(value) {
  try {
    return new Set(["http:", "https:"]).has(new URL(value).protocol);
  } catch {
    return false;
  }
}

export function validateRegistryShape(registry) {
  const errors = [];
  if (!registry || typeof registry !== "object" || Array.isArray(registry)) {
    return ["Registry must be a JSON object."];
  }
  if (registry.version !== 1) errors.push("Registry version must be 1.");
  if (registry.$schema !== "./asset-rights-registry.schema.json") {
    errors.push(
      "Registry $schema must reference the local asset-rights schema.",
    );
  }
  for (const key of Object.keys(registry)) {
    if (!REGISTRY_KEYS.has(key))
      errors.push(`Registry has unknown property: ${key}.`);
  }
  if (registry.canonicalRoot !== "public") {
    errors.push('Registry canonicalRoot must be "public".');
  }
  if (!DATE_PATTERN.test(registry.generatedAt ?? "")) {
    errors.push("Registry generatedAt must use YYYY-MM-DD.");
  }
  if (!Array.isArray(registry.records) || registry.records.length === 0) {
    errors.push("Registry records must be a non-empty array.");
    return errors;
  }

  const ids = new Set();
  for (const [index, record] of registry.records.entries()) {
    const label = record?.id || `record[${index}]`;
    if (!record || typeof record !== "object" || Array.isArray(record)) {
      errors.push(`${label}: record must be an object.`);
      continue;
    }
    for (const key of Object.keys(record)) {
      if (!RECORD_KEYS.has(key))
        errors.push(`${label}: unknown property ${key}.`);
    }
    if (!ID_PATTERN.test(record.id ?? "")) {
      errors.push(
        `${label}: id must use lowercase letters, numbers, and hyphens.`,
      );
    } else if (ids.has(record.id)) {
      errors.push(`${label}: duplicate id.`);
    }
    ids.add(record.id);
    if (!hasSafeRelativeGlob(record.path)) {
      errors.push(
        `${label}: path must be a safe POSIX glob relative to public/.`,
      );
    }
    if (!DIGEST_PATTERN.test(record.sha256 ?? "")) {
      errors.push(
        `${label}: sha256 must be 64 lowercase hexadecimal characters.`,
      );
    }
    if (!Number.isInteger(record.assetCount) || record.assetCount < 0) {
      errors.push(`${label}: assetCount must be a non-negative integer.`);
    }
    if (!["audio", "image", "video"].includes(record.kind)) {
      errors.push(`${label}: kind must be audio, image, or video.`);
    }
    for (const field of ["sourceName", "creator", "modifications"]) {
      if (
        typeof record[field] !== "string" ||
        record[field].trim().length === 0
      ) {
        errors.push(`${label}: ${field} must be a non-empty string.`);
      }
    }
    if (record.sourceUrl !== undefined) {
      if (!isHttpUrl(record.sourceUrl)) {
        errors.push(`${label}: sourceUrl must be a valid HTTP or HTTPS URL.`);
      }
    }
    if (
      record.sourceDetailsPath !== undefined &&
      !hasSafeRelativePath(record.sourceDetailsPath)
    ) {
      errors.push(
        `${label}: sourceDetailsPath must be a safe repository-relative path.`,
      );
    }
    if (
      (record.sourceDetailsPath === undefined) !==
      (record.sourceDetailsSha256 === undefined)
    ) {
      errors.push(
        `${label}: sourceDetailsPath and sourceDetailsSha256 must be provided together.`,
      );
    }
    if (
      record.sourceDetailsSha256 !== undefined &&
      !DIGEST_PATTERN.test(record.sourceDetailsSha256)
    ) {
      errors.push(
        `${label}: sourceDetailsSha256 must be 64 lowercase hexadecimal characters.`,
      );
    }
    if (
      record.licenseSpdx !== undefined &&
      (typeof record.licenseSpdx !== "string" ||
        record.licenseSpdx.length === 0)
    ) {
      errors.push(
        `${label}: licenseSpdx must be a non-empty string when present.`,
      );
    }
    if (
      record.attribution !== undefined &&
      (typeof record.attribution !== "string" ||
        record.attribution.length === 0)
    ) {
      errors.push(
        `${label}: attribution must be a non-empty string when present.`,
      );
    }
    if (!EVIDENCE_PATTERN.test(record.evidenceRef ?? "")) {
      errors.push(
        `${label}: evidenceRef must be an opaque, non-sensitive identifier.`,
      );
    }
    if (!REDISTRIBUTION_VALUES.has(record.redistribution)) {
      errors.push(`${label}: invalid redistribution value.`);
    }
    if (!Array.isArray(record.editions) || record.editions.length === 0) {
      errors.push(`${label}: editions must be a non-empty array.`);
    } else {
      const uniqueEditions = new Set(record.editions);
      if (uniqueEditions.size !== record.editions.length) {
        errors.push(`${label}: editions must not contain duplicates.`);
      }
      for (const edition of uniqueEditions) {
        if (!EDITIONS.has(edition))
          errors.push(`${label}: unknown edition ${edition}.`);
      }
    }
    if (!DATE_PATTERN.test(record.reviewedAt ?? "")) {
      errors.push(`${label}: reviewedAt must use YYYY-MM-DD.`);
    }
  }

  return errors;
}

function resolveSourceDetailsPath(canonicalRoot, sourceDetailsPath) {
  const projectRoot = path.dirname(canonicalRoot);
  const detailsPath = path.resolve(
    projectRoot,
    ...sourceDetailsPath.split("/"),
  );
  const relativeDetailsPath = path.relative(projectRoot, detailsPath);
  if (
    relativeDetailsPath === "" ||
    relativeDetailsPath === ".." ||
    relativeDetailsPath.startsWith(`..${path.sep}`) ||
    path.isAbsolute(relativeDetailsPath)
  ) {
    return undefined;
  }
  return detailsPath;
}

async function validateStrictSourceDetails({
  canonicalRoot,
  details,
  record,
  matchingFiles,
}) {
  const errors = [];
  if (!Array.isArray(details.assets)) {
    return [
      `${record.id}: strict source details must contain an assets array.`,
    ];
  }

  const relevantEntries = details.assets.filter((entry) =>
    matchesGlob(entry?.localFile ?? "", record.path),
  );
  const matchingFileSet = new Set(matchingFiles);
  const paths = new Set();
  let expectedSourceHostname;
  if (record.sourceUrl) {
    expectedSourceHostname = new URL(record.sourceUrl).hostname;
  }

  for (const entry of relevantEntries) {
    const relativePath = entry?.localFile;
    if (!hasSafeRelativePath(relativePath)) {
      errors.push(`${record.id}: source detail has an unsafe localFile.`);
      continue;
    }
    if (paths.has(relativePath)) {
      errors.push(`${record.id}: duplicate source detail for ${relativePath}.`);
    }
    paths.add(relativePath);

    if (!isHttpUrl(entry.sourcePageUrl)) {
      errors.push(
        `${record.id}: ${relativePath} has an invalid sourcePageUrl.`,
      );
    } else if (
      expectedSourceHostname &&
      new URL(entry.sourcePageUrl).hostname !== expectedSourceHostname
    ) {
      errors.push(
        `${record.id}: ${relativePath} sourcePageUrl must use ${expectedSourceHostname}.`,
      );
    }
    const hasCreator =
      typeof entry.creator === "string" && entry.creator.trim().length > 0;
    const hasAttribution =
      typeof entry.attribution === "string" &&
      entry.attribution.trim().length > 0;
    if (!hasCreator && !hasAttribution) {
      errors.push(
        `${record.id}: ${relativePath} is missing creator or attribution.`,
      );
    }
    if (
      typeof entry.license !== "string" ||
      entry.license.trim().length === 0
    ) {
      errors.push(`${record.id}: ${relativePath} is missing license.`);
    }
    if (!DIGEST_PATTERN.test(entry.sha256 ?? "")) {
      errors.push(`${record.id}: ${relativePath} has an invalid sha256.`);
    }
    if (
      entry.localPublicPath !== undefined &&
      entry.localPublicPath !== `/${relativePath}`
    ) {
      errors.push(
        `${record.id}: ${relativePath} has a mismatched localPublicPath.`,
      );
    }
    if (!matchingFileSet.has(relativePath)) continue;

    const absoluteAssetPath = path.join(
      canonicalRoot,
      ...relativePath.split("/"),
    );
    if (
      DIGEST_PATTERN.test(entry.sha256 ?? "") &&
      entry.sha256 !== (await digestFile(absoluteAssetPath))
    ) {
      errors.push(
        `${record.id}: ${relativePath} sha256 does not match the packaged file.`,
      );
    }
    if (Number.isInteger(entry.bytes)) {
      const statistics = await fs.stat(absoluteAssetPath);
      if (entry.bytes !== statistics.size) {
        errors.push(
          `${record.id}: ${relativePath} bytes does not match the packaged file.`,
        );
      }
    }
  }

  for (const relativePath of matchingFiles) {
    if (!paths.has(relativePath)) {
      errors.push(`${record.id}: missing source detail for ${relativePath}.`);
    }
  }
  for (const entryPath of paths) {
    if (!matchingFileSet.has(entryPath)) {
      errors.push(
        `${record.id}: source detail points to a non-packaged file: ${entryPath}.`,
      );
    }
  }
  return errors;
}

async function validateSourceDetails({
  canonicalRoot,
  record,
  matchingFiles,
  verifyDigests,
}) {
  if (!record.sourceDetailsPath) return [];
  const errors = [];
  const detailsPath = resolveSourceDetailsPath(
    canonicalRoot,
    record.sourceDetailsPath,
  );
  if (!detailsPath) {
    return [`${record.id}: sourceDetailsPath resolves outside the repository.`];
  }

  let details;
  let detailsBytes;
  try {
    detailsBytes = await fs.readFile(detailsPath);
    details = JSON.parse(detailsBytes.toString("utf8"));
  } catch (error) {
    return [`${record.id}: cannot read source details (${error.message}).`];
  }
  if (
    verifyDigests &&
    createHash("sha256").update(detailsBytes).digest("hex") !==
      record.sourceDetailsSha256
  ) {
    errors.push(`${record.id}: source details SHA-256 does not match.`);
  }
  if (details.rightsDetailsContract === "asset-file-rights-v1") {
    errors.push(
      ...(await validateStrictSourceDetails({
        canonicalRoot,
        details,
        record,
        matchingFiles,
      })),
    );
    return errors;
  }
  if (!details || details.version !== 1 || !Array.isArray(details.entries)) {
    errors.push(`${record.id}: source details must contain version 1 entries.`);
    return errors;
  }

  const relevantEntries = details.entries.filter((entry) =>
    matchesGlob(entry?.path ?? "", record.path),
  );
  const paths = new Set();
  for (const entry of relevantEntries) {
    if (!hasSafeRelativePath(entry.path)) {
      errors.push(`${record.id}: source detail has an unsafe path.`);
      continue;
    }
    if (paths.has(entry.path)) {
      errors.push(`${record.id}: duplicate source detail for ${entry.path}.`);
    }
    paths.add(entry.path);
    for (const field of ["title", "creator"]) {
      if (
        typeof entry[field] !== "string" ||
        entry[field].trim().length === 0
      ) {
        errors.push(`${record.id}: ${entry.path} is missing ${field}.`);
      }
    }
    if (!isHttpUrl(entry.sourceUrl)) {
      errors.push(`${record.id}: ${entry.path} has an invalid sourceUrl.`);
    }
    if (entry.evidenceRef !== record.evidenceRef) {
      errors.push(`${record.id}: ${entry.path} has a mismatched evidenceRef.`);
    }
  }

  for (const relativePath of matchingFiles) {
    if (!paths.has(relativePath)) {
      errors.push(`${record.id}: missing source detail for ${relativePath}.`);
    }
  }
  for (const entryPath of paths) {
    if (!matchingFiles.includes(entryPath)) {
      errors.push(
        `${record.id}: source detail points to a non-packaged file: ${entryPath}.`,
      );
    }
  }
  return errors;
}

async function findAbsolutePathLeaks(canonicalRoot, relativePaths) {
  const leaks = [];
  const windowsAbsolutePath =
    /(?:^|["'\s])[A-Za-z]:(?:\\\\|\\\/|\/)[^"'\r\n]*/gu;

  for (const relativePath of relativePaths) {
    if (path.posix.extname(relativePath).toLowerCase() !== ".json") continue;
    const content = await fs.readFile(
      path.join(canonicalRoot, ...relativePath.split("/")),
      "utf8",
    );
    const matches = content.match(windowsAbsolutePath);
    if (matches)
      leaks.push({ path: relativePath, matches: [...new Set(matches)] });
  }

  return leaks;
}

export async function analyzeAssetRights({
  canonicalRoot,
  registry,
  packagedFiles,
  verifyDigests = true,
}) {
  const errors = validateRegistryShape(registry);
  if (errors.length > 0) {
    return {
      errors,
      files: [],
      claimsByFile: new Map(),
      recordResults: [],
      metadataFiles: [],
    };
  }

  const packagedFileResult = await resolvePackagedFiles(
    canonicalRoot,
    packagedFiles,
  );
  errors.push(...packagedFileResult.errors);
  const files = packagedFileResult.files;
  const claimsByFile = new Map();
  const recordResults = [];

  for (const record of registry.records) {
    const matchingFiles = files.filter((relativePath) =>
      matchesGlob(relativePath, record.path),
    );
    const digest = await digestAssetFamily(canonicalRoot, matchingFiles);
    recordResults.push({ record, matchingFiles, digest });
    errors.push(
      ...(await validateSourceDetails({
        canonicalRoot,
        record,
        matchingFiles,
        verifyDigests,
      })),
    );

    if (
      record.redistribution === "reference-only" &&
      matchingFiles.length > 0
    ) {
      errors.push(
        `${record.id}: reference-only record matches packaged files (${matchingFiles.length}).`,
      );
    }
    if (
      record.redistribution !== "reference-only" &&
      matchingFiles.length === 0
    ) {
      errors.push(`${record.id}: approved bundle pattern matches no files.`);
    }
    if (verifyDigests && record.assetCount !== matchingFiles.length) {
      errors.push(
        `${record.id}: assetCount is ${record.assetCount}, found ${matchingFiles.length}.`,
      );
    }
    if (verifyDigests && record.sha256 !== digest) {
      errors.push(
        `${record.id}: SHA-256 tree digest does not match canonical files.`,
      );
    }

    for (const relativePath of matchingFiles) {
      const claims = claimsByFile.get(relativePath) ?? [];
      claims.push(record);
      claimsByFile.set(relativePath, claims);
      const actualKind = mediaKindForPath(relativePath);
      if (actualKind && actualKind !== record.kind) {
        errors.push(
          `${record.id}: ${relativePath} is ${actualKind}, not ${record.kind}.`,
        );
      }
    }
  }

  const metadataFiles = [];
  for (const relativePath of files) {
    const mediaKind = mediaKindForPath(relativePath);
    const claims = claimsByFile.get(relativePath) ?? [];
    if (mediaKind) {
      if (claims.length === 0) {
        errors.push(`Unregistered packaged media: ${relativePath}.`);
      } else if (claims.length > 1) {
        errors.push(
          `Packaged media has overlapping rights records: ${relativePath} (${claims
            .map((record) => record.id)
            .join(", ")}).`,
        );
      }
      continue;
    }
    const extension = path.posix.extname(relativePath).toLowerCase();
    if (!METADATA_EXTENSIONS.has(extension)) {
      errors.push(`Unsupported unregistered public file: ${relativePath}.`);
    } else {
      metadataFiles.push(relativePath);
    }
  }

  for (const leak of await findAbsolutePathLeaks(
    canonicalRoot,
    metadataFiles,
  )) {
    errors.push(
      `${leak.path}: contains local absolute path metadata (${leak.matches.join(", ")}).`,
    );
  }

  return { errors, files, claimsByFile, recordResults, metadataFiles };
}

export function filesForEdition(analysis, edition) {
  if (!EDITIONS.has(edition)) throw new Error(`Unknown edition: ${edition}`);
  const selected = new Set(analysis.metadataFiles);

  for (const [relativePath, claims] of analysis.claimsByFile) {
    if (claims.length !== 1) continue;
    const [record] = claims;
    if (
      record.redistribution !== "reference-only" &&
      record.editions.includes(edition)
    ) {
      selected.add(relativePath);
    }
  }

  return [...selected].sort();
}

export async function refreshRegistryDigests({
  canonicalRoot,
  registry,
  packagedFiles,
}) {
  const analysis = await analyzeAssetRights({
    canonicalRoot,
    registry,
    packagedFiles,
    verifyDigests: false,
  });
  if (analysis.errors.length > 0) {
    throw new Error(
      `Cannot refresh registry:\n- ${analysis.errors.join("\n- ")}`,
    );
  }

  const resultsById = new Map(
    analysis.recordResults.map((result) => [result.record.id, result]),
  );
  const sourceDetailsDigests = new Map();
  for (const record of registry.records) {
    if (!record.sourceDetailsPath) continue;
    const detailsPath = resolveSourceDetailsPath(
      canonicalRoot,
      record.sourceDetailsPath,
    );
    if (!detailsPath) {
      throw new Error(
        `${record.id}: sourceDetailsPath resolves outside the repository.`,
      );
    }
    sourceDetailsDigests.set(record.id, await digestFile(detailsPath));
  }
  return {
    ...registry,
    records: registry.records.map((record) => {
      const result = resultsById.get(record.id);
      return {
        ...record,
        sha256: result.digest,
        assetCount: result.matchingFiles.length,
        ...(record.sourceDetailsPath
          ? { sourceDetailsSha256: sourceDetailsDigests.get(record.id) }
          : {}),
      };
    }),
  };
}

export async function readJson(filePath) {
  return JSON.parse(await fs.readFile(filePath, "utf8"));
}

export async function validateAssetRightsDocuments(projectRoot) {
  const errors = [];
  const documents = [
    {
      path: "THIRD_PARTY_NOTICES.md",
      required: [
        "docs/assets/asset-rights-registry.json",
        "evidenceRef",
        "reference-only",
      ],
    },
    {
      path: "docs/browser-edition/THIRD_PARTY_NOTICES.md",
      required: [
        "scripts/sync-browser-assets.mjs",
        "reference-only",
        "Hermes and Vertex AI local bridges",
      ],
    },
  ];
  const staleClaims = [
    "user-stated authorization",
    "must be reviewed before public release",
    "public redistribution still requires a rights review",
  ];

  const license = await fs.readFile(path.join(projectRoot, "LICENSE"), "utf8");
  if (!license.startsWith("MIT License\n")) {
    errors.push("LICENSE must contain the standard MIT License text.");
  }
  if (license.includes("Additional project notice")) {
    errors.push(
      "Media notices must not be appended to the standard MIT License.",
    );
  }

  for (const document of documents) {
    const content = await fs.readFile(
      path.join(projectRoot, document.path),
      "utf8",
    );
    for (const required of document.required) {
      if (!content.includes(required)) {
        errors.push(
          `${document.path}: missing required boundary text: ${required}.`,
        );
      }
    }
    for (const staleClaim of staleClaims) {
      if (content.toLowerCase().includes(staleClaim.toLowerCase())) {
        errors.push(
          `${document.path}: contains stale rights wording: ${staleClaim}.`,
        );
      }
    }
  }

  return errors;
}
