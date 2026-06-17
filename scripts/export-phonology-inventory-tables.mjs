import fs from "node:fs";
import Module from "node:module";
import path from "node:path";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
import ts from "typescript";

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(scriptDir, "..");
const require = createRequire(import.meta.url);
const checkOnly = process.argv.includes("--check");

const docs = [
  ["es-ES", "SPANISH_PHONOLOGY_INVENTORY_TABLE.md"],
  ["fr-FR", "FRENCH_PHONOLOGY_INVENTORY_TABLE.md"],
  ["ru-RU", "RUSSIAN_PHONOLOGY_INVENTORY_TABLE.md"],
];

const originalResolveFilename = Module._resolveFilename;
Module._resolveFilename = function resolveFilename(
  request,
  parent,
  isMain,
  options,
) {
  if (request.startsWith("@/")) {
    return originalResolveFilename.call(
      this,
      path.join(rootDir, "src", request.slice(2)),
      parent,
      isMain,
      options,
    );
  }

  return originalResolveFilename.call(this, request, parent, isMain, options);
};

function registerTypeScriptExtension(extension) {
  require.extensions[extension] = (module, filename) => {
    const source = fs.readFileSync(filename, "utf8");
    const output = ts.transpileModule(source, {
      compilerOptions: {
        esModuleInterop: true,
        jsx: ts.JsxEmit.ReactJSX,
        module: ts.ModuleKind.CommonJS,
        resolveJsonModule: true,
        target: ts.ScriptTarget.ES2020,
      },
      fileName: filename,
    });

    module._compile(output.outputText, filename);
  };
}

registerTypeScriptExtension(".ts");
registerTypeScriptExtension(".tsx");

const { formatLanguagePhonologyInventoryMarkdownDocument } = require(
  "../src/lib/language-phonology-inventory.ts",
);

let hasDrift = false;

for (const [languageId, filename] of docs) {
  const targetPath = path.join(rootDir, "docs", "operations", filename);
  const expected = formatLanguagePhonologyInventoryMarkdownDocument(languageId);
  const existing = fs.existsSync(targetPath)
    ? fs.readFileSync(targetPath, "utf8").replace(/\r\n/g, "\n")
    : null;

  if (checkOnly) {
    if (existing !== expected) {
      hasDrift = true;
      console.error(`Phonology inventory table is stale: ${targetPath}`);
    }
    continue;
  }

  fs.writeFileSync(targetPath, expected, "utf8");
  console.log(`Wrote ${path.relative(rootDir, targetPath)}`);
}

if (hasDrift) {
  console.error(
    "Run npm.cmd run phonology:inventory:export and commit the regenerated docs.",
  );
  process.exit(1);
}

if (checkOnly) {
  console.log("Phonology inventory tables are up to date.");
}
