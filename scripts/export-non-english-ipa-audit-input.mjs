#!/usr/bin/env node

import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import Module from "node:module";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import ts from "typescript";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, "..");
const DEFAULT_OUT = resolve(
  ROOT,
  "docs",
  "operations",
  "non-english-ipa-audit-input.json",
);

function parseArgs() {
  const args = process.argv.slice(2);
  const parsed = {
    out: DEFAULT_OUT,
  };

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];

    if (arg === "--out" && args[i + 1]) {
      parsed.out = resolve(process.cwd(), args[++i]);
    } else {
      throw new Error(`Unknown argument: ${arg}`);
    }
  }

  return parsed;
}

function installTypeScriptRequireHook() {
  const originalResolve = Module._resolveFilename;

  Module._resolveFilename = function resolveAlias(request, parent, isMain, options) {
    if (typeof request === "string" && request.startsWith("@/")) {
      return originalResolve.call(
        this,
        resolve(ROOT, "src", request.slice(2)),
        parent,
        isMain,
        options,
      );
    }

    return originalResolve.call(this, request, parent, isMain, options);
  };

  Module._extensions[".ts"] = function compileTypeScript(module, filename) {
    const source = readFileSync(filename, "utf8");
    const output = ts.transpileModule(source, {
      compilerOptions: {
        esModuleInterop: true,
        module: ts.ModuleKind.CommonJS,
        target: ts.ScriptTarget.ES2022,
      },
      fileName: filename,
    });

    module._compile(output.outputText, filename);
  };
}

function main() {
  const args = parseArgs();
  installTypeScriptRequireHook();

  const { buildNonEnglishIpaAuditInput } = Module.createRequire(import.meta.url)(
    resolve(ROOT, "src", "lib", "non-english-ipa-audit.ts"),
  );

  const output = buildNonEnglishIpaAuditInput();

  mkdirSync(dirname(args.out), { recursive: true });
  writeFileSync(args.out, `${JSON.stringify(output, null, 2)}\n`);

  const roleCounts = output.rows.reduce((counts, row) => {
    counts[row.auditRole] = (counts[row.auditRole] ?? 0) + 1;
    return counts;
  }, {});

  console.log(`Non-English IPA audit input written: ${args.out}`);
  console.log(`Rows: ${output.rowCount}`);
  console.log(
    `Roles: ${Object.entries(roleCounts)
      .map(([role, count]) => `${role} ${count}`)
      .join(" | ")}`,
  );
}

try {
  main();
} catch (error) {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
}
