import { spawn } from "node:child_process";
import { createReadStream, existsSync, statSync, writeFileSync } from "node:fs";
import { createServer } from "node:http";
import { extname, join, normalize, resolve } from "node:path";
import { startHermesXaiBridge } from "./hermes-xai-bridge.mjs";

const appRoot = resolve(process.cwd());
const root = resolve(appRoot, "out");
const ports = [4173, 4174, 4175, 4176, 4177, 4178];

const contentTypes = new Map([
  [".css", "text/css; charset=utf-8"],
  [".html", "text/html; charset=utf-8"],
  [".js", "text/javascript; charset=utf-8"],
  [".json", "application/json; charset=utf-8"],
  [".mp3", "audio/mpeg"],
  [".mp4", "video/mp4"],
  [".png", "image/png"],
  [".svg", "image/svg+xml"],
  [".wasm", "application/wasm"],
  [".wav", "audio/wav"],
  [".webp", "image/webp"],
]);

function resolveRequestPath(urlPath) {
  const normalized = normalize(decodeURIComponent(urlPath.split("?")[0]));
  const safePath = normalized.replace(/^(\.\.[/\\])+/, "");
  const candidate = join(root, safePath);
  if (!candidate.startsWith(root)) return null;
  if (existsSync(candidate) && statSync(candidate).isFile()) return candidate;
  const indexPath = join(candidate, "index.html");
  if (existsSync(indexPath)) return indexPath;
  const htmlPath = `${candidate}.html`;
  if (existsSync(htmlPath) && statSync(htmlPath).isFile()) return htmlPath;
  return join(root, "index.html");
}

function createAppServer() {
  return createServer((request, response) => {
    const filePath = resolveRequestPath(request.url || "/");
    if (!filePath || !existsSync(filePath)) {
      response.writeHead(404);
      response.end("Not found");
      return;
    }

    response.writeHead(200, {
      "Content-Type":
        contentTypes.get(extname(filePath)) ?? "application/octet-stream",
    });
    createReadStream(filePath).pipe(response);
  });
}

function listenOnPort(port) {
  return new Promise((resolveListen, rejectListen) => {
    const server = createAppServer();
    server.once("error", (error) => {
      if (error && error.code === "EADDRINUSE") {
        resolveListen(null);
        return;
      }
      rejectListen(error);
    });
    server.listen(port, "127.0.0.1", () => resolveListen(server));
  });
}

function openBrowser(url) {
  try {
    if (process.platform === "win32") {
      const child = spawn("cmd.exe", ["/c", "start", "", url], {
        detached: true,
        stdio: "ignore",
        windowsHide: true,
      });
      child.unref();
      return;
    }
    const opener = process.platform === "darwin" ? "open" : "xdg-open";
    const child = spawn(opener, [url], { detached: true, stdio: "ignore" });
    child.unref();
  } catch {
    // Browser auto-open is a convenience only. The URL is printed and written below.
  }
}

if (!existsSync(root) || !existsSync(join(root, "index.html"))) {
  console.error("Static build not found: out/index.html");
  console.error("Run npm run build first, then start again.");
  process.exit(1);
}

let server = null;
let selectedPort = null;
for (const port of ports) {
  server = await listenOnPort(port);
  if (server) {
    selectedPort = port;
    break;
  }
}

if (!server || !selectedPort) {
  console.error(
    "Ports 4173-4178 are busy. Close other Speak Right windows and try again.",
  );
  process.exit(1);
}

const url = `http://127.0.0.1:${selectedPort}/`;
const bridge = await startHermesXaiBridge({
  additionalOrigins: [
    `http://127.0.0.1:${selectedPort}`,
    `http://localhost:${selectedPort}`,
  ],
});
if (!bridge.compatible) {
  console.warn(
    "端口 17831 已被其他程序占用，爱马仕 Grok 与 Vertex Gemini 本机 TTS 桥接未启动。",
  );
}
writeFileSync(
  resolve(appRoot, "02_打开网页端.url"),
  `[InternetShortcut]\r\nURL=${url}\r\n`,
  "utf8",
);

console.log("");
console.log("Speak Right Browser Edition is running.");
console.log(`Open: ${url}`);
console.log("Keep this window open while using Speak Right.");
console.log("Press Ctrl+C to stop the server.");
console.log("");

if (process.env.SPEAKRIGHT_NO_OPEN !== "1") openBrowser(url);

async function close() {
  await bridge.close();
  server.close(() => process.exit(0));
}
process.on("SIGINT", () => void close());
process.on("SIGTERM", () => void close());
