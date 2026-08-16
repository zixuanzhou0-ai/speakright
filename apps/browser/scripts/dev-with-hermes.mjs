import { spawn } from "node:child_process";
import { resolve } from "node:path";
import { startHermesXaiBridge } from "./hermes-xai-bridge.mjs";

const origin = "http://127.0.0.1:3000";
const bridge = await startHermesXaiBridge({ additionalOrigins: [origin] });
if (!bridge.compatible) {
  console.warn(
    "端口 17831 已被其他程序占用，爱马仕 Grok 与 Vertex Gemini 本机 TTS 桥接未启动。",
  );
} else if (bridge.owned) {
  console.log("本机 TTS 桥接已启动：127.0.0.1:17831");
}

const nextBin = resolve(
  process.cwd(),
  "node_modules",
  "next",
  "dist",
  "bin",
  "next",
);
const child = spawn(
  process.execPath,
  [nextBin, "dev", "--turbopack", "--port", "3000"],
  {
    cwd: process.cwd(),
    env: process.env,
    stdio: "inherit",
    windowsHide: true,
  },
);

let stopping = false;
async function stop(signal) {
  if (stopping) return;
  stopping = true;
  if (!child.killed) child.kill(signal);
  await bridge.close();
}

process.on("SIGINT", () => void stop("SIGINT"));
process.on("SIGTERM", () => void stop("SIGTERM"));
child.once("exit", async (code) => {
  await bridge.close();
  process.exit(code ?? 0);
});
