import { execFile } from "node:child_process";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);

const TARGETS = {
  azure: "speakright_azure_config.com.speakright.desktop",
  elevenlabs: "speakright_elevenlabs_config.com.speakright.desktop",
};

function parseSecretJson(raw) {
  if (!raw || typeof raw !== "string") return null;
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

export async function readSpeakRightCredential(kind) {
  if (!(kind in TARGETS)) throw new Error(`Unknown credential kind: ${kind}`);
  if (process.platform !== "win32") {
    throw new Error(
      "SpeakRight audit credentials require Windows Credential Manager",
    );
  }
  const target = TARGETS[kind].replaceAll('"', '""');
  const script = String.raw`
$ErrorActionPreference = "Stop"
Add-Type @"
using System;
using System.Runtime.InteropServices;
public static class SpeakRightAuditCredMan {
  [StructLayout(LayoutKind.Sequential, CharSet = CharSet.Unicode)]
  public struct CREDENTIAL {
    public UInt32 Flags; public UInt32 Type; public string TargetName;
    public string Comment; public System.Runtime.InteropServices.ComTypes.FILETIME LastWritten;
    public UInt32 CredentialBlobSize; public IntPtr CredentialBlob; public UInt32 Persist;
    public UInt32 AttributeCount; public IntPtr Attributes; public string TargetAlias; public string UserName;
  }
  [DllImport("advapi32.dll", SetLastError = true, CharSet = CharSet.Unicode)]
  public static extern bool CredRead(string target, UInt32 type, int reservedFlag, out IntPtr credentialPtr);
  [DllImport("advapi32.dll", SetLastError = true)]
  public static extern void CredFree(IntPtr buffer);
  public static string Read(string target) {
    IntPtr pointer;
    if (!CredRead(target, 1, 0, out pointer)) return null;
    try {
      CREDENTIAL value = (CREDENTIAL)Marshal.PtrToStructure(pointer, typeof(CREDENTIAL));
      if (value.CredentialBlobSize == 0) return "";
      byte[] bytes = new byte[value.CredentialBlobSize];
      Marshal.Copy(value.CredentialBlob, bytes, 0, (int)value.CredentialBlobSize);
      return System.Text.Encoding.Unicode.GetString(bytes).TrimEnd('\0');
    } finally { CredFree(pointer); }
  }
}
"@
[SpeakRightAuditCredMan]::Read("${target}")
`;
  const { stdout } = await execFileAsync(
    "powershell.exe",
    ["-NoProfile", "-NonInteractive", "-Command", script],
    { encoding: "utf8", windowsHide: true, maxBuffer: 1024 * 1024 },
  );
  const value = parseSecretJson(stdout.trim());
  if (!value) {
    throw new Error(
      `${kind} credential unavailable. Configure it in SpeakRight desktop settings.`,
    );
  }
  return { value, source: "windows-credential-manager" };
}
