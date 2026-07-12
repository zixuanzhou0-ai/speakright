import { spawn } from "node:child_process";
import { createServer } from "node:net";

const requestedPort = Number(process.env.PORT || 4173);

function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function isPortAvailable(port) {
  return new Promise((resolve) => {
    const probe = createServer()
      .once("error", () => resolve(false))
      .once("listening", () => {
        probe.close(() => resolve(true));
      })
      .listen(port, "127.0.0.1");
  });
}

async function findAvailablePort(startPort) {
  for (let port = startPort; port < startPort + 20; port += 1) {
    if (await isPortAvailable(port)) return port;
  }
  throw new Error(`No available static smoke port near ${startPort}`);
}

async function waitForServer(smokeUrl) {
  const deadline = Date.now() + 15_000;
  while (Date.now() < deadline) {
    try {
      const response = await fetch(smokeUrl);
      if (response.ok) return;
    } catch {
      // Server is still starting.
    }
    await delay(250);
  }
  throw new Error(`Static server did not become ready at ${smokeUrl}`);
}

function runNodeScript(script, env = {}) {
  const child = spawn(process.execPath, [script], {
    cwd: process.cwd(),
    env: { ...process.env, ...env },
    stdio: "inherit",
  });
  return new Promise((resolve, reject) => {
    child.on("error", reject);
    child.on("exit", (code) => {
      if (code === 0) resolve();
      else reject(new Error(`${script} exited with ${code}`));
    });
  });
}

const port = await findAvailablePort(requestedPort);
const smokeUrl = `http://127.0.0.1:${port}`;
const server = spawn(process.execPath, ["scripts/serve-static.mjs"], {
  cwd: process.cwd(),
  env: { ...process.env, PORT: String(port) },
  stdio: "inherit",
});

try {
  await waitForServer(smokeUrl);
  await runNodeScript("scripts/browser-smoke.mjs", {
    SPEAKRIGHT_BROWSER_SMOKE_URL: smokeUrl,
  });
} finally {
  if (!server.killed) {
    server.kill();
  }
}
