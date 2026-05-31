import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const projectRoot = process.cwd();

function readJson<T>(path: string): T {
  return JSON.parse(readFileSync(join(projectRoot, path), "utf8")) as T;
}

function cspDirectives(): Map<string, string> {
  const config = readJson<{
    app?: { security?: { csp?: string } };
  }>("src-tauri/tauri.conf.json");
  const csp = config.app?.security?.csp ?? "";
  return new Map(
    csp
      .split(";")
      .map((part) => part.trim())
      .filter(Boolean)
      .map((part) => {
        const [name, ...tokens] = part.split(/\s+/);
        return [name, tokens.join(" ")] as const;
      }),
  );
}

describe("release security configuration", () => {
  it("does not allow arbitrary HTTPS requests from Tauri HTTP", () => {
    const capability = readJson<{
      permissions: Array<
        | string
        | {
            identifier?: string;
            allow?: Array<{ url?: string }>;
          }
      >;
    }>("src-tauri/capabilities/default.json");

    const urls = capability.permissions.flatMap((permission) =>
      typeof permission === "string"
        ? []
        : (permission.allow ?? []).map((item) => item.url),
    );

    expect(urls).not.toContain("https://**");
  });

  it("does not allow plaintext HTTP endpoints in desktop capabilities", () => {
    const capability = readJson<{
      permissions: Array<
        | string
        | {
            identifier?: string;
            allow?: Array<{ url?: string }>;
          }
      >;
    }>("src-tauri/capabilities/default.json");

    const urls = capability.permissions.flatMap((permission) =>
      typeof permission === "string"
        ? []
        : (permission.allow ?? []).map((item) => item.url ?? ""),
    );

    expect(urls.every((url) => !url.startsWith("http://"))).toBe(true);
  });

  it("keeps Tauri HTTP permission scoped to the allowlisted default object", () => {
    const capability = readJson<{
      permissions: Array<
        | string
        | {
            identifier?: string;
            allow?: Array<{ url?: string }>;
          }
      >;
    }>("src-tauri/capabilities/default.json");

    const bareHttpPermissions = capability.permissions.filter(
      (permission): permission is string =>
        typeof permission === "string" && permission.startsWith("http:"),
    );
    const scopedHttpDefaults = capability.permissions.filter(
      (
        permission,
      ): permission is { identifier: string; allow: Array<{ url?: string }> } =>
        typeof permission !== "string" &&
        permission.identifier === "http:default" &&
        Array.isArray(permission.allow),
    );

    expect(bareHttpPermissions).toEqual([]);
    expect(scopedHttpDefaults).toHaveLength(1);
    expect(scopedHttpDefaults[0].allow.length).toBeGreaterThan(0);
  });

  it("keeps Tauri store permissions limited to the settings store operations in use", () => {
    const capability = readJson<{
      permissions: Array<string | Record<string, unknown>>;
    }>("src-tauri/capabilities/default.json");
    const permissions = capability.permissions.filter(
      (permission): permission is string => typeof permission === "string",
    );

    expect(permissions).toContain("store:allow-load");
    expect(permissions).toContain("store:allow-get");
    expect(permissions).toContain("store:allow-set");
    expect(permissions).toContain("store:allow-delete");
    expect(permissions).toContain("store:allow-save");
    expect(permissions).not.toContain("store:default");
    expect(permissions).not.toContain("store:allow-clear");
    expect(permissions).not.toContain("store:allow-reset");
    expect(permissions).not.toContain("store:allow-keys");
    expect(permissions).not.toContain("store:allow-has");
    expect(permissions).not.toContain("store:allow-values");
    expect(permissions).not.toContain("store:allow-entries");
    expect(permissions).not.toContain("store:allow-length");
    expect(permissions).not.toContain("store:allow-reload");
    expect(permissions).not.toContain("store:allow-get-store");
  });

  it("keeps core permissions scoped to the desktop titlebar interactions in use", () => {
    const capability = readJson<{
      permissions: Array<string | Record<string, unknown>>;
    }>("src-tauri/capabilities/default.json");
    const permissions = capability.permissions.filter(
      (permission): permission is string => typeof permission === "string",
    );

    expect(permissions).not.toContain("core:default");
    expect(permissions).toContain("core:event:allow-listen");
    expect(permissions).toContain("core:event:allow-unlisten");
    expect(permissions).toContain("core:window:allow-minimize");
    expect(permissions).toContain("core:window:allow-toggle-maximize");
    expect(permissions).toContain("core:window:allow-is-maximized");
    expect(permissions).toContain("core:window:allow-close");
    expect(permissions).toContain("core:window:allow-start-dragging");
    expect(permissions).toContain("core:window:allow-set-focus");
  });

  it("does not ship Tauri devtools in the release dependency feature set", () => {
    const cargoToml = readFileSync(
      join(projectRoot, "src-tauri/Cargo.toml"),
      "utf8",
    );

    expect(cargoToml).not.toMatch(/features\s*=\s*\[[^\]]*"devtools"/);
  });

  it("does not expose the Tauri API on the global window object", () => {
    const config = readJson<{
      app?: { withGlobalTauri?: boolean };
    }>("src-tauri/tauri.conf.json");

    expect(config.app?.withGlobalTauri).toBe(false);
  });

  it("uses a bundle identifier that will not collide with platform bundle extensions", () => {
    const config = readJson<{
      identifier?: string;
    }>("src-tauri/tauri.conf.json");

    expect(config.identifier).toBe("com.speakright.desktop");
    expect(config.identifier).not.toMatch(/\.(app|exe|msi|dmg)$/);
  });

  it("disables desktop webview drag and drop because the app has no file import flow", () => {
    const config = readJson<{
      app?: { windows?: Array<{ dragDropEnabled?: boolean }> };
    }>("src-tauri/tauri.conf.json");
    const mainWindow = config.app?.windows?.[0];

    expect(mainWindow?.dragDropEnabled).toBe(false);
  });

  it("stores desktop API keys through an OS credential store backend", () => {
    const cargoToml = readFileSync(
      join(projectRoot, "src-tauri/Cargo.toml"),
      "utf8",
    );
    const rustEntry = readFileSync(
      join(projectRoot, "src-tauri/src/lib.rs"),
      "utf8",
    );

    expect(cargoToml).toContain("keyring =");
    expect(cargoToml).toContain("windows-native");
    expect(rustEntry).toContain('const SECURE_STORE_SERVICE: &str = "com.speakright.desktop"');
    expect(rustEntry).toContain("ALLOWED_SECURE_STORE_KEYS");
    expect(rustEntry).toContain("validate_secure_store_key(key)?");
    expect(rustEntry).toContain("secure_store_get");
    expect(rustEntry).toContain("secure_store_set");
    expect(rustEntry).toContain("secure_store_delete");
    expect(rustEntry).toContain("desktop_diagnostics");
  });

  it("keeps release desktop diagnostics enabled without logging secret values", () => {
    const rustEntry = readFileSync(
      join(projectRoot, "src-tauri/src/lib.rs"),
      "utf8",
    );

    expect(rustEntry).toContain("tauri_plugin_log::Builder::new()");
    expect(rustEntry).toContain("TargetKind::LogDir");
    expect(rustEntry).toContain('file_name: Some(LOG_FILE_NAME.into())');
    expect(rustEntry).toContain("RotationStrategy::KeepSome(LOG_ARCHIVE_COUNT)");
    expect(rustEntry).toContain("LOG_MAX_FILE_SIZE_BYTES");
    expect(rustEntry).toContain("LOG_TAIL_LINE_COUNT");
    expect(rustEntry).toContain("LOG_TAIL_MAX_LINE_CHARS");
    expect(rustEntry).toContain("LevelFilter::Info");
    expect(rustEntry).not.toMatch(/if\s+cfg!\(debug_assertions\)[\s\S]{0,160}tauri_plugin_log/);

    const rustLogCalls = rustEntry.match(/log::\w+!\([^)]+\)/g) ?? [];
    expect(rustLogCalls.join("\n")).not.toMatch(/\b(key|value)\b/);
  });

  it("keeps blob permission scoped to media and avoids unsafe eval", () => {
    const config = readJson<{
      app?: { security?: { csp?: string } };
    }>("src-tauri/tauri.conf.json");
    const csp = config.app?.security?.csp ?? "";

    expect(csp).not.toContain("'unsafe-eval'");
    expect(csp).toContain("media-src 'self' blob:");
    expect(csp).not.toMatch(/default-src[^;]*\sblob:/);
    expect(csp).not.toMatch(/connect-src[^;]*\sblob:/);
  });

  it("does not allow data media sources in the desktop CSP", () => {
    const directives = cspDirectives();

    expect(directives.get("media-src")?.split(/\s+/)).toEqual([
      "'self'",
      "blob:",
      "asset:",
      "http://asset.localhost",
    ]);
    expect(directives.get("media-src")).not.toContain("data:");
  });

  it("keeps unused document embedding and navigation sinks closed in the desktop CSP", () => {
    const directives = cspDirectives();

    expect(directives.get("default-src")?.split(/\s+/)).toEqual([
      "'self'",
      "asset:",
      "http://asset.localhost",
    ]);
    expect(directives.get("object-src")).toBe("'none'");
    expect(directives.get("frame-src")).toBe("'none'");
    expect(directives.get("base-uri")).toBe("'none'");
    expect(directives.get("form-action")).toBe("'none'");
  });

  it("does not allow arbitrary remote image beacons in the desktop CSP", () => {
    const config = readJson<{
      app?: { security?: { csp?: string } };
    }>("src-tauri/tauri.conf.json");
    const csp = config.app?.security?.csp ?? "";
    const imgDirective =
      csp
        .split(";")
        .map((part) => part.trim())
        .find((part) => part.startsWith("img-src ")) ?? "";

    expect(imgDirective).toBeTruthy();
    const remoteOrigins = imgDirective.match(/https?:\/\/[^\s;]+/g) ?? [];

    expect(imgDirective).not.toMatch(/\shttps:/);
    expect(remoteOrigins).toEqual(["http://asset.localhost"]);
    expect(imgDirective).not.toContain("*");
    expect(imgDirective).toContain("'self'");
    expect(imgDirective).toContain("asset:");
    expect(imgDirective).toContain("blob:");
    expect(imgDirective).toContain("data:");
  });

  it("does not allow remote font hosts in the desktop CSP", () => {
    const config = readJson<{
      app?: { security?: { csp?: string } };
    }>("src-tauri/tauri.conf.json");
    const csp = config.app?.security?.csp ?? "";

    expect(csp).not.toContain("fonts.googleapis.com");
    expect(csp).not.toContain("fonts.gstatic.com");
    expect(cspDirectives().get("font-src")?.split(/\s+/)).toEqual(["'self'"]);
    expect(cspDirectives().get("style-src")?.split(/\s+/)).toEqual([
      "'self'",
      "'unsafe-inline'",
    ]);
  });

  it("does not allow plaintext external hosts in the desktop CSP", () => {
    const config = readJson<{
      app?: { security?: { csp?: string } };
    }>("src-tauri/tauri.conf.json");
    const csp = config.app?.security?.csp ?? "";
    const plaintextOrigins = csp.match(/http:\/\/[^\s;]+/g) ?? [];

    expect(plaintextOrigins).not.toContain("http://dict.youdao.com");
    expect(
      plaintextOrigins.every(
        (origin) =>
          origin === "http://asset.localhost" ||
          origin === "http://ipc.localhost",
      ),
    ).toBe(true);
  });
});
