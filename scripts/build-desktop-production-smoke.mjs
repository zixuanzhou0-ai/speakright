import { spawnSync } from "node:child_process";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const npmCli = process.env.npm_execpath;

if (!npmCli) {
  console.error("Run this helper through an npm script.");
  process.exit(1);
}

console.log(
  "Building a fixture-off Desktop validation artifact with local-only CDP. This artifact must never be published.",
);
const result = spawnSync(
  process.execPath,
  [
    npmCli,
    "run",
    "desktop:build",
    "--",
    "--speakright-production-smoke-artifact",
    "--config",
    "src-tauri/tauri.smoke.conf.json",
    "--no-bundle",
  ],
  {
    cwd: root,
    env: {
      ...process.env,
      NEXT_PUBLIC_SPEAKRIGHT_TEST_FIXTURES: "0",
      SPEAKRIGHT_TEST_ARTIFACT: "1",
    },
    stdio: "inherit",
  },
);

if (result.error) {
  console.error(result.error.message);
  process.exit(1);
}
process.exit(result.status ?? 1);
