import { createReadStream, existsSync, statSync } from "node:fs";
import { createServer } from "node:http";
import path from "node:path";
import process from "node:process";

const workspaceRoot = process.cwd();
const allowedRoot = path.join(
  path.dirname(workspaceRoot),
  `${path.basename(workspaceRoot)}ReleaseEvidenceTemp`,
);

function readArgument(name, fallback) {
  const index = process.argv.indexOf(name);
  return index >= 0 ? process.argv[index + 1] : fallback;
}

function assertSafeRoot(value) {
  const resolved = path.resolve(value);
  const relative = path.relative(allowedRoot, resolved);
  if (relative.startsWith("..") || path.isAbsolute(relative)) {
    throw new Error(`Static evidence root must stay inside ${allowedRoot}.`);
  }
  if (!existsSync(path.join(resolved, "index.html"))) {
    throw new Error(`Static export not found at ${resolved}.`);
  }
  return resolved;
}

const root = assertSafeRoot(
  readArgument(
    "--root",
    path.join(
      allowedRoot,
      "browser-fixture-workspace",
      "apps",
      "browser",
      "out",
    ),
  ),
);
const port = Number(readArgument("--port", "4273"));
if (!Number.isInteger(port) || port < 1024 || port > 65535) {
  throw new Error(
    "Evidence server port must be an integer from 1024 to 65535.",
  );
}

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

function resolveRequestPath(requestUrl) {
  const pathname = new URL(requestUrl, "http://127.0.0.1").pathname;
  const relative = path
    .normalize(decodeURIComponent(pathname))
    .replace(/^[/\\]+/, "");
  const candidate = path.resolve(root, relative);
  if (path.relative(root, candidate).startsWith("..")) return null;
  if (existsSync(candidate) && statSync(candidate).isFile()) return candidate;
  const indexPath = path.join(candidate, "index.html");
  if (existsSync(indexPath) && statSync(indexPath).isFile()) return indexPath;
  const htmlPath = `${candidate}.html`;
  if (existsSync(htmlPath) && statSync(htmlPath).isFile()) return htmlPath;
  return path.join(root, "index.html");
}

const server = createServer((request, response) => {
  const filePath = resolveRequestPath(request.url || "/");
  if (!filePath || !existsSync(filePath)) {
    response.writeHead(404);
    response.end("Not found");
    return;
  }
  response.writeHead(200, {
    "Cache-Control": "no-store",
    "Content-Type":
      contentTypes.get(path.extname(filePath)) ?? "application/octet-stream",
  });
  createReadStream(filePath).pipe(response);
});

server.listen(port, "127.0.0.1", () => {
  console.log(`Isolated release-evidence server: http://127.0.0.1:${port}`);
});

function close() {
  server.close(() => process.exit(0));
}
process.on("SIGINT", close);
process.on("SIGTERM", close);
