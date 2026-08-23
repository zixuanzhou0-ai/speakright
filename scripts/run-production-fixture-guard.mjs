import { spawnSync } from "node:child_process";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const playwrightCli = path.join(
  root,
  "node_modules",
  "@playwright",
  "test",
  "cli.js",
);

if (process.env.NEXT_PUBLIC_SPEAKRIGHT_TEST_FIXTURES === "1") {
  console.error(
    "Production fixture guard refuses to run against a fixture-enabled environment.",
  );
  process.exit(1);
}

const result = spawnSync(
  process.execPath,
  [playwrightCli, "test", "apps/browser/e2e/production-fixture-guard.spec.ts"],
  {
    cwd: root,
    env: {
      ...process.env,
      NEXT_PUBLIC_SPEAKRIGHT_TEST_FIXTURES: "0",
      SPEAKRIGHT_VERIFY_PRODUCTION_FIXTURES: "1",
    },
    stdio: "inherit",
  },
);

if (result.error) {
  console.error(result.error.message);
  process.exit(1);
}
process.exit(result.status ?? 1);
