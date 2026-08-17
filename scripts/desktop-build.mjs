import { spawn } from "node:child_process";

const env = { ...process.env };
const rawArguments = process.argv.slice(2);
const uiSmokeFlag = "--speakright-ui-smoke-artifact";
const productionSmokeFlag = "--speakright-production-smoke-artifact";
const internalFlags = rawArguments.filter(
  (argument) => argument === uiSmokeFlag || argument === productionSmokeFlag,
);
if (internalFlags.length > 1) {
  console.error("desktop-build: conflicting internal artifact modes.");
  process.exit(1);
}
const argumentsForTauri = rawArguments.filter(
  (argument) => argument !== uiSmokeFlag && argument !== productionSmokeFlag,
);
const artifactMode =
  internalFlags[0] === uiSmokeFlag
    ? "ui-smoke"
    : internalFlags[0] === productionSmokeFlag
      ? "production-smoke"
      : "publishable";
if (
  artifactMode === "publishable" &&
  argumentsForTauri.some((argument) =>
    argument.replaceAll("\\", "/").endsWith("/tauri.smoke.conf.json"),
  )
) {
  console.error(
    "desktop-build: the smoke-only Tauri config requires an explicit internal smoke artifact mode.",
  );
  process.exit(1);
}
if (
  artifactMode !== "publishable" &&
  !argumentsForTauri.includes("--no-bundle")
) {
  argumentsForTauri.push("--no-bundle");
}

env.NEXT_PUBLIC_SPEAKRIGHT_TEST_FIXTURES =
  artifactMode === "ui-smoke" ? "1" : "0";
env.SPEAKRIGHT_TEST_ARTIFACT = artifactMode === "publishable" ? "0" : "1";
console.log(
  `desktop-build: mode=${artifactMode} fixtures=${env.NEXT_PUBLIC_SPEAKRIGHT_TEST_FIXTURES} testArtifact=${env.SPEAKRIGHT_TEST_ARTIFACT}`,
);

if (process.platform === "win32" && !env.CARGO_BUILD_JOBS) {
  env.CARGO_BUILD_JOBS = "1";
  console.log(
    "desktop-build: defaulting CARGO_BUILD_JOBS=1 on Windows to reduce Rust/LLVM release-build memory peaks.",
  );
}

const command = process.platform === "win32" ? "tauri.cmd" : "tauri";
const child = spawn(command, ["build", ...argumentsForTauri], {
  env,
  shell: process.platform === "win32",
  stdio: "inherit",
});

child.on("error", (error) => {
  console.error(
    `desktop-build: failed to start Tauri build: ${
      error instanceof Error ? error.message : String(error)
    }`,
  );
  process.exit(1);
});

child.on("exit", (code, signal) => {
  if (signal) {
    console.error(`desktop-build: Tauri build stopped by signal ${signal}.`);
    process.exit(1);
  }
  process.exit(code ?? 1);
});
