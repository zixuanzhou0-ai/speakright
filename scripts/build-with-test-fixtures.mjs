import { spawnSync } from "node:child_process";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const npmCli = process.env.npm_execpath;
const edition = process.argv[2];

const commands = {
  browser: ["--prefix", "apps/browser", "run", "build"],
  desktop: ["run", "desktop:build"],
};

if (!(edition in commands)) {
  console.error(
    "Usage: node scripts/build-with-test-fixtures.mjs <browser|desktop>",
  );
  process.exit(1);
}
if (!npmCli) {
  console.error("Run this helper through an npm script.");
  process.exit(1);
}

console.log(
  `Building ${edition} test artifact with NEXT_PUBLIC_SPEAKRIGHT_TEST_FIXTURES=1. This artifact must never be published.`,
);
const result = spawnSync(process.execPath, [npmCli, ...commands[edition]], {
  cwd: root,
  env: {
    ...process.env,
    NEXT_PUBLIC_SPEAKRIGHT_TEST_FIXTURES: "1",
    SPEAKRIGHT_TEST_ARTIFACT: "1",
  },
  stdio: "inherit",
});

if (result.error) {
  console.error(result.error.message);
  process.exit(1);
}
process.exit(result.status ?? 1);
