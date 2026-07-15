import { existsSync, renameSync, rmSync, writeFileSync } from "node:fs";
import { sha256Bytes, sha256File } from "./pronunciation-audit-core.mjs";

function cleanup(paths) {
  for (const filePath of paths) rmSync(filePath, { force: true });
}

export function atomicPromoteBatch({
  operations,
  ledgerPath,
  ledgerBytes,
  faultInjector = null,
}) {
  const transaction = `${Date.now()}-${process.pid}`;
  const targets = operations.flatMap((operation) =>
    [operation.desktopPath, operation.browserPath].map((targetPath) => ({
      targetPath,
      temporaryPath: `${targetPath}.regen-${transaction}.tmp`,
      backupPath: `${targetPath}.regen-${transaction}.bak`,
      bytes: operation.bytes,
      candidateSha256: operation.candidateSha256,
      expectedOldSha256: operation.expectedOldSha256,
    })),
  );
  const ledger = {
    targetPath: ledgerPath,
    temporaryPath: `${ledgerPath}.regen-${transaction}.tmp`,
    backupPath: `${ledgerPath}.regen-${transaction}.bak`,
    existed: existsSync(ledgerPath),
    bytes: ledgerBytes,
    sha256: sha256Bytes(ledgerBytes),
  };
  const allTemporary = [
    ...targets.map((target) => target.temporaryPath),
    ledger.temporaryPath,
  ];
  const allBackups = [
    ...targets.map((target) => target.backupPath),
    ledger.backupPath,
  ];

  const rollback = () => {
    if (existsSync(ledger.backupPath)) {
      rmSync(ledger.targetPath, { force: true });
      renameSync(ledger.backupPath, ledger.targetPath);
    } else if (!ledger.existed) {
      rmSync(ledger.targetPath, { force: true });
    }
    for (const target of [...targets].reverse()) {
      if (existsSync(target.backupPath)) {
        rmSync(target.targetPath, { force: true });
        renameSync(target.backupPath, target.targetPath);
      }
    }
    cleanup([...allTemporary, ...allBackups]);
  };

  try {
    for (const candidatePath of [...allTemporary, ...allBackups]) {
      if (existsSync(candidatePath)) {
        throw new Error(`Promotion transaction path exists: ${candidatePath}`);
      }
    }
    for (const target of targets) {
      if (
        !existsSync(target.targetPath) ||
        sha256File(target.targetPath) !== target.expectedOldSha256
      ) {
        throw new Error(`Formal source SHA changed: ${target.targetPath}`);
      }
      writeFileSync(target.temporaryPath, target.bytes);
      if (sha256File(target.temporaryPath) !== target.candidateSha256) {
        throw new Error(`Staged candidate SHA mismatch: ${target.targetPath}`);
      }
    }
    writeFileSync(ledger.temporaryPath, ledger.bytes);
    if (sha256File(ledger.temporaryPath) !== ledger.sha256) {
      throw new Error("Staged promotion ledger SHA mismatch");
    }
    faultInjector?.("after-staging");

    for (const target of targets) {
      renameSync(target.targetPath, target.backupPath);
      renameSync(target.temporaryPath, target.targetPath);
    }
    for (const target of targets) {
      if (sha256File(target.targetPath) !== target.candidateSha256) {
        throw new Error(`Post-promotion SHA mismatch: ${target.targetPath}`);
      }
    }
    faultInjector?.("before-ledger-activation");

    if (ledger.existed) renameSync(ledger.targetPath, ledger.backupPath);
    renameSync(ledger.temporaryPath, ledger.targetPath);
    if (sha256File(ledger.targetPath) !== ledger.sha256) {
      throw new Error("Activated promotion ledger SHA mismatch");
    }
    faultInjector?.("after-ledger-activation");
  } catch (error) {
    rollback();
    throw error;
  }

  cleanup([...allTemporary, ...allBackups]);
}
