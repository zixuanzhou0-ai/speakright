import { spawnSync } from "node:child_process";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import process from "node:process";

const root = process.cwd();
const outputDir = path.join(root, "outputs", "release", "sbom");
const npmCli = process.env.npm_execpath;
if (!npmCli) {
  throw new Error("Run this generator through `npm run security:sbom:npm`");
}
const projects = [
  { name: "speakright-root", cwd: root },
  { name: "speakright-browser", cwd: path.join(root, "apps", "browser") },
];

function generateSbom({ name, cwd }) {
  const result = spawnSync(
    process.execPath,
    [
      npmCli,
      "sbom",
      "--package-lock-only",
      "--omit=dev",
      "--sbom-format=cyclonedx",
      "--sbom-type=application",
    ],
    { cwd, encoding: "utf8", maxBuffer: 32 * 1024 * 1024 },
  );
  if (result.error || result.status !== 0) {
    throw new Error(
      `${name} SBOM generation failed: ${result.error?.message || result.stderr || result.stdout || "unknown process error"}`,
    );
  }
  const parsed = JSON.parse(result.stdout);
  if (parsed.bomFormat !== "CycloneDX" || !Array.isArray(parsed.components)) {
    throw new Error(`${name} SBOM has an unexpected structure`);
  }
  return `${JSON.stringify(parsed, null, 2)}\n`;
}

async function main() {
  await mkdir(outputDir, { recursive: true });
  for (const project of projects) {
    const contents = generateSbom(project);
    const outputPath = path.join(outputDir, `${project.name}.cdx.json`);
    await writeFile(outputPath, contents, "utf8");
    console.log(`Generated ${path.relative(root, outputPath)}`);
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
