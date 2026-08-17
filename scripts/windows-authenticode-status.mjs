import { execFile } from "node:child_process";
import path from "node:path";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);

export function windowsPowerShellRuntime(environment = process.env) {
  const systemRoot = environment.SystemRoot ?? environment.WINDIR;
  if (!systemRoot || !path.win32.isAbsolute(systemRoot)) {
    throw new Error(
      "Windows system root is unavailable for signature inspection.",
    );
  }
  const runtimeDirectory = path.win32.join(
    systemRoot,
    "System32",
    "WindowsPowerShell",
    "v1.0",
  );
  return {
    executablePath: path.win32.join(runtimeDirectory, "powershell.exe"),
    modulePath: path.win32.join(runtimeDirectory, "Modules"),
  };
}

export function authenticodePowerShellCommand(filePath) {
  const literalPath = filePath.replaceAll("'", "''");
  return [
    '$ErrorActionPreference = "Stop";',
    "Import-Module Microsoft.PowerShell.Security -ErrorAction Stop;",
    `$sig = Get-AuthenticodeSignature -LiteralPath '${literalPath}';`,
    "[pscustomobject]@{",
    "Status = [string]$sig.Status;",
    "SignerCertificate = if ($sig.SignerCertificate) { $sig.SignerCertificate.Subject } else { $null }",
    "} | ConvertTo-Json -Compress",
  ].join(" ");
}

export function parseAuthenticodeSignatureOutput(stdout) {
  let signature;
  try {
    signature = JSON.parse(stdout.trim());
  } catch {
    throw new Error("Authenticode inspection returned invalid JSON.");
  }
  if (
    !signature ||
    typeof signature.Status !== "string" ||
    signature.Status.length === 0 ||
    !Object.hasOwn(signature, "SignerCertificate") ||
    (signature.SignerCertificate !== null &&
      typeof signature.SignerCertificate !== "string")
  ) {
    throw new Error("Authenticode inspection returned an invalid status.");
  }
  return signature;
}

export async function inspectAuthenticodeSignature(
  filePath,
  { platform = process.platform, environment = process.env } = {},
) {
  if (platform !== "win32") return null;

  const runtime = windowsPowerShellRuntime(environment);
  const { stdout } = await execFileAsync(
    runtime.executablePath,
    [
      "-NoProfile",
      "-NonInteractive",
      "-Command",
      authenticodePowerShellCommand(filePath),
    ],
    {
      encoding: "utf8",
      env: { ...environment, PSModulePath: runtime.modulePath },
      maxBuffer: 1024 * 1024,
      timeout: 60_000,
      windowsHide: true,
    },
  );

  return parseAuthenticodeSignatureOutput(stdout);
}
