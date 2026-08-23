import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const markdownLinkPattern =
  /!?\[[^\]]*]\((?<target>[^)\s]+)(?:\s+"[^"]*")?\)/g;

function listMarkdownFiles() {
  const files = [
    "README.md",
    "README.zh-CN.md",
    "START_HERE.md",
    "CONTRIBUTING.md",
    "SECURITY.md",
    "SUPPORT.md",
    "CODE_OF_CONDUCT.md",
    "PRIVACY.md",
    "CHANGELOG.md",
    "ROADMAP.md",
    "MAINTAINERS.md",
    "NOTICE.md",
    "THIRD_PARTY_NOTICES.md",
  ];

  const walk = (dir) => {
    if (!fs.existsSync(dir)) return;
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const entryPath = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        if (entry.name !== "archive") walk(entryPath);
      } else if (entry.isFile() && entry.name.endsWith(".md")) {
        files.push(entryPath);
      }
    }
  }
  walk("docs");
  return [...new Set(files.filter((file) => fs.existsSync(file)))];
}

function isExternalLink(target) {
  return (
    target.startsWith("#") ||
    /^[a-z][a-z0-9+.-]*:/i.test(target) ||
    target.startsWith("//")
  );
}

const missing = [];

for (const file of listMarkdownFiles()) {
  const markdown = fs.readFileSync(file, "utf8");
  for (const match of markdown.matchAll(markdownLinkPattern)) {
    const rawTarget = match.groups?.target?.trim();
    if (!rawTarget || isExternalLink(rawTarget)) continue;

    const [targetWithoutAnchor] = rawTarget.split("#");
    if (!targetWithoutAnchor) continue;

    const decodedTarget = decodeURIComponent(targetWithoutAnchor);
    const candidate = decodedTarget.startsWith("/")
      ? path.join(root, decodedTarget)
      : path.resolve(path.dirname(file), decodedTarget);

    if (!fs.existsSync(candidate)) {
      missing.push(`${file} -> ${rawTarget}`);
    }
  }
}

if (missing.length > 0) {
  console.error("Missing markdown targets:");
  console.error(missing.join("\n"));
  process.exit(1);
}

console.log("Markdown relative links ok.");
