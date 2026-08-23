#!/usr/bin/env python3
"""Offline signal and Whisper audit for SpeakRight pronunciation assets."""

from __future__ import annotations

import argparse
import hashlib
import json
import math
import os
import re
import sys
import unicodedata
from collections import Counter
from pathlib import Path
from typing import Any

MODEL_ID = "Systran/faster-whisper-large-v3"
MODEL_ROOT = Path(r"D:\AI\models\whisper\faster-whisper-large-v3")
CACHE_ROOT = Path(r"D:\AI\cache")
DEFAULT_OUTPUT = Path("outputs/pronunciation-audit-2026-07-14")
LANGUAGE_CODES = {"en-US": "en", "es-ES": "es", "fr-FR": "fr", "ru-RU": "ru"}
SKIPPED_WHISPER_ROLES = {"phoneme-anchor", "header-clip"}
SIGNAL_POLICY_VERSION = 2
WHISPER_POLICY_VERSION = 1


def require_non_c_drive(path: Path, label: str) -> Path:
    resolved = path.resolve()
    if str(resolved).lower().startswith("c:\\"):
        raise RuntimeError(f"{label} must not resolve to C drive: {resolved}")
    return resolved


def configure_non_c_caches() -> None:
    require_non_c_drive(MODEL_ROOT, "Whisper model path")
    require_non_c_drive(CACHE_ROOT, "Whisper cache path")
    values = {
        "HF_HOME": CACHE_ROOT / "huggingface",
        "HF_HUB_CACHE": CACHE_ROOT / "huggingface" / "hub",
        "TORCH_HOME": CACHE_ROOT / "torch",
        "XDG_CACHE_HOME": CACHE_ROOT / "xdg",
    }
    for key, value in values.items():
        os.environ[key] = str(require_non_c_drive(value, key))


def sha256_file(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as handle:
        for chunk in iter(lambda: handle.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


def model_files() -> list[Path]:
    if not MODEL_ROOT.exists():
        return []
    return sorted(
        path
        for path in MODEL_ROOT.rglob("*")
        if path.is_file() and path.name != "speakright-model-manifest.json"
    )


def model_revision() -> str | None:
    metadata_root = MODEL_ROOT / ".cache" / "huggingface" / "download"
    if not metadata_root.exists():
        return None
    for metadata in sorted(metadata_root.glob("*.metadata")):
        first_line = metadata.read_text(encoding="utf-8", errors="ignore").splitlines()
        if first_line and re.fullmatch(r"[a-f0-9]{40}", first_line[0]):
            return first_line[0]
    return None


def model_report(include_hashes: bool) -> dict[str, Any]:
    files = model_files()
    required = [MODEL_ROOT / "model.bin", MODEL_ROOT / "config.json"]
    complete = all(path.exists() and path.stat().st_size > 0 for path in required)
    return {
        "modelId": MODEL_ID,
        "modelRoot": str(MODEL_ROOT),
        "cacheRoot": str(CACHE_ROOT),
        "complete": complete,
        "repositoryRevision": model_revision(),
        "fileCount": len(files),
        "totalBytes": sum(path.stat().st_size for path in files),
        "files": [
            {
                "path": str(path.relative_to(MODEL_ROOT)).replace("\\", "/"),
                "bytes": path.stat().st_size,
                **({"sha256": sha256_file(path)} if include_hashes else {}),
            }
            for path in files
        ],
    }


def write_json(path: Path, value: Any) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    temporary = path.with_suffix(path.suffix + ".tmp")
    temporary.write_text(
        json.dumps(value, ensure_ascii=False, indent=2) + "\n", encoding="utf-8"
    )
    temporary.replace(path)


def command_model_check(args: argparse.Namespace) -> int:
    configure_non_c_caches()
    report = model_report(include_hashes=args.hashes)
    print(json.dumps(report, ensure_ascii=False, indent=2))
    return 0 if report["complete"] else 2


def command_model_download(args: argparse.Namespace) -> int:
    configure_non_c_caches()
    if not args.confirm:
        raise RuntimeError("Refusing model download without --confirm")
    before = model_report(include_hashes=False)
    if before["complete"]:
        report = model_report(include_hashes=True)
        write_json(MODEL_ROOT / "speakright-model-manifest.json", report)
        print(f"Whisper model already present: {MODEL_ROOT}")
        return 0
    MODEL_ROOT.mkdir(parents=True, exist_ok=True)
    CACHE_ROOT.mkdir(parents=True, exist_ok=True)
    from huggingface_hub import snapshot_download

    resolved = snapshot_download(
        repo_id=MODEL_ID,
        local_dir=str(MODEL_ROOT),
        cache_dir=str(CACHE_ROOT / "huggingface" / "hub"),
    )
    report = model_report(include_hashes=True)
    report["resolvedSnapshot"] = str(resolved)
    if not report["complete"]:
        raise RuntimeError("Whisper download completed without required model files")
    write_json(MODEL_ROOT / "speakright-model-manifest.json", report)
    print(
        f"Downloaded {MODEL_ID}: {report['fileCount']} files, "
        f"{report['totalBytes']} bytes -> {MODEL_ROOT}"
    )
    return 0


def normalize_text(value: str, language_id: str) -> str:
    normalized = unicodedata.normalize("NFKC", value or "").casefold()
    normalized = "".join(
        " " if unicodedata.category(char)[0] in {"P", "S"} else char
        for char in normalized
    )
    normalized = re.sub(r"\s+", " ", normalized).strip()
    if language_id == "ru-RU":
        normalized = normalized.replace("ё", "е")
    return normalized


def compare_transcript(expected: str, actual: str, language_id: str) -> str:
    left = normalize_text(expected, language_id)
    right = normalize_text(actual, language_id)
    if not right:
        return "no-speech"
    if left == right:
        return "exact"
    strip_marks = lambda text: "".join(
        char for char in unicodedata.normalize("NFD", text)
        if unicodedata.category(char) != "Mn"
    )
    if strip_marks(left) == strip_marks(right):
        return "orthographic-variant"
    if left in right.split(" ") or right in left.split(" "):
        return "contains-expected"
    return "mismatch"


def load_jsonl(path: Path) -> dict[str, dict[str, Any]]:
    entries: dict[str, dict[str, Any]] = {}
    if not path.exists():
        return entries
    with path.open("r", encoding="utf-8") as handle:
        for line in handle:
            try:
                item = json.loads(line)
            except json.JSONDecodeError:
                continue
            key = item.get("sha256")
            if key:
                entries[key] = item
    return entries


def append_jsonl(path: Path, value: dict[str, Any]) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    with path.open("a", encoding="utf-8") as handle:
        handle.write(json.dumps(value, ensure_ascii=False, separators=(",", ":")))
        handle.write("\n")
        handle.flush()

def compact_jsonl(path: Path, values: Any) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    temporary = path.with_suffix(path.suffix + ".tmp")
    with temporary.open("w", encoding="utf-8", newline="\n") as handle:
        for value in values:
            handle.write(json.dumps(value, ensure_ascii=False, separators=(",", ":")))
            handle.write("\n")
    temporary.replace(path)


def decode_signal(path: Path, role: str) -> dict[str, Any]:
    import av
    import numpy as np

    issues: list[str] = []
    try:
        container = av.open(str(path))
        stream = next(stream for stream in container.streams if stream.type == "audio")
        sample_rate = int(stream.codec_context.sample_rate or 0)
        channels = int(stream.codec_context.channels or 0)
        chunks: list[Any] = []
        for frame in container.decode(stream):
            array = frame.to_ndarray()
            if array.ndim == 1:
                array = array.reshape(1, -1)
            if np.issubdtype(array.dtype, np.integer):
                info = np.iinfo(array.dtype)
                scale = float(max(abs(info.min), info.max))
                array = array.astype(np.float32) / scale
            else:
                array = array.astype(np.float32)
            chunks.append(array.mean(axis=0))
        container.close()
        samples = np.concatenate(chunks) if chunks else np.array([], dtype=np.float32)
    except Exception as error:  # noqa: BLE001 - report decoder failures per asset
        return {
            "ok": False,
            "issues": ["decode-failed"],
            "error": f"{type(error).__name__}: {error}",
        }

    if sample_rate <= 0 or samples.size == 0:
        return {"ok": False, "issues": ["empty-decoded-audio"]}
    absolute = np.abs(samples)
    duration = float(samples.size / sample_rate)
    peak = float(absolute.max(initial=0.0))
    rms = float(math.sqrt(float(np.mean(np.square(samples)))))
    threshold = 10 ** (-50 / 20)
    active = np.flatnonzero(absolute >= threshold)
    if active.size:
        leading = float(active[0] / sample_rate)
        trailing = float((samples.size - 1 - active[-1]) / sample_rate)
    else:
        leading = duration
        trailing = duration
    silence_ratio = float(np.mean(absolute < threshold))
    clipping_ratio = float(np.mean(absolute >= 0.999))
    peak_db = 20 * math.log10(max(peak, 1e-12))
    mean_db = 20 * math.log10(max(rms, 1e-12))

    minimum = 0.08 if role in SKIPPED_WHISPER_ROLES else 0.15
    maximum = 30.0 if role in {"phrase", "sentence", "header-clip"} else 6.0
    if duration < minimum:
        issues.append("duration-too-short")
    if duration > maximum:
        issues.append("duration-too-long")
    if silence_ratio > 0.8:
        issues.append("excessive-silence")
    if mean_db < -45:
        issues.append("mean-volume-too-low")
    if clipping_ratio > 0.001:
        issues.append("possible-clipping")
    return {
        "ok": not issues,
        "durationSeconds": round(duration, 6),
        "sampleRate": sample_rate,
        "channels": channels,
        "meanDb": round(mean_db, 4),
        "peakDb": round(peak_db, 4),
        "leadingSilenceSeconds": round(leading, 6),
        "trailingSilenceSeconds": round(trailing, 6),
        "silenceRatio": round(silence_ratio, 6),
        "clippingRatio": round(clipping_ratio, 8),
        "issues": issues,
    }


def load_whisper_model() -> tuple[Any, str]:
    if not model_report(include_hashes=False)["complete"]:
        raise RuntimeError(f"Whisper model is missing: {MODEL_ROOT}")
    from faster_whisper import WhisperModel

    try:
        return (
            WhisperModel(str(MODEL_ROOT), device="cuda", compute_type="float16"),
            "float16",
        )
    except RuntimeError as error:
        if "out of memory" not in str(error).lower():
            raise
        return (
            WhisperModel(
                str(MODEL_ROOT), device="cuda", compute_type="int8_float16"
            ),
            "int8_float16",
        )


def transcribe_asset(model: Any, path: Path, asset: dict[str, Any]) -> dict[str, Any]:
    segments, info = model.transcribe(
        str(path),
        language=LANGUAGE_CODES[asset["languageId"]],
        beam_size=5,
        temperature=0.0,
        condition_on_previous_text=False,
        vad_filter=False,
        word_timestamps=False,
    )
    collected = list(segments)
    transcript = " ".join(segment.text.strip() for segment in collected).strip()
    average_log_probability = (
        sum(segment.avg_logprob for segment in collected) / len(collected)
        if collected
        else None
    )
    no_speech_probability = (
        max(segment.no_speech_prob for segment in collected) if collected else None
    )
    return {
        "applicable": True,
        "transcript": transcript,
        "match": compare_transcript(
            str(asset.get("text") or ""), transcript, asset["languageId"]
        ),
        "forcedLanguage": LANGUAGE_CODES[asset["languageId"]],
        "detectedLanguage": info.language,
        "languageProbability": round(float(info.language_probability), 6),
        "averageLogProbability": (
            round(float(average_log_probability), 6)
            if average_log_probability is not None
            else None
        ),
        "noSpeechProbability": (
            round(float(no_speech_probability), 6)
            if no_speech_probability is not None
            else None
        ),
    }


def command_offline(args: argparse.Namespace) -> int:
    configure_non_c_caches()
    root = Path(args.root).resolve()
    inventory_path = Path(args.inventory).resolve()
    output = Path(args.output).resolve()
    inventory = json.loads(inventory_path.read_text(encoding="utf-8-sig"))
    assets = inventory["assets"]
    if args.limit:
        assets = assets[: args.limit]
    signal_path = output / "signal.jsonl"
    whisper_path = output / "whisper.jsonl"
    signal_cache = {
        digest: entry
        for digest, entry in load_jsonl(signal_path).items()
        if entry.get("signalPolicyVersion") == SIGNAL_POLICY_VERSION
    }
    current_model_revision = model_revision()
    whisper_cache = {
        digest: entry
        for digest, entry in load_jsonl(whisper_path).items()
        if entry.get("whisperPolicyVersion") == WHISPER_POLICY_VERSION
        and entry.get("modelRevision") == current_model_revision
    }
    model = None
    compute_type = None
    if not args.signal_only:
        model, compute_type = load_whisper_model()

    for index, asset in enumerate(assets, start=1):
        digest = asset.get("sha256")
        source = root / asset["desktopPath"]
        if digest not in signal_cache:
            signal = {
                "assetId": asset["assetId"],
                "sha256": digest,
                "signalPolicyVersion": SIGNAL_POLICY_VERSION,
                "signal": decode_signal(source, asset["role"]),
            }
            append_jsonl(signal_path, signal)
            signal_cache[digest] = signal
        if not args.signal_only and digest not in whisper_cache:
            if asset["role"] in SKIPPED_WHISPER_ROLES or not asset.get("text"):
                result = {
                    "applicable": False,
                    "reason": "isolated-anchor-or-missing-text",
                }
            else:
                try:
                    result = transcribe_asset(model, source, asset)
                except Exception as error:  # noqa: BLE001 - preserve per-asset failure
                    result = {
                        "applicable": True,
                        "error": f"{type(error).__name__}: {error}",
                        "match": "error",
                    }
            observation = {
                "assetId": asset["assetId"],
                "sha256": digest,
                "whisperPolicyVersion": WHISPER_POLICY_VERSION,
                "modelRevision": current_model_revision,
                "whisper": result,
            }
            append_jsonl(whisper_path, observation)
            whisper_cache[digest] = observation
        if index % 100 == 0 or index == len(assets):
            print(f"Offline audit {index}/{len(assets)}", flush=True)

    compact_jsonl(signal_path, signal_cache.values())
    if not args.signal_only:
        compact_jsonl(whisper_path, whisper_cache.values())

    signal_issues = sum(
        bool(entry.get("signal", {}).get("issues")) for entry in signal_cache.values()
    )
    whisper_matches = Counter(
        entry.get("whisper", {}).get("match", "not-applicable")
        for entry in whisper_cache.values()
    )
    duration = sum(
        float(entry.get("signal", {}).get("durationSeconds") or 0)
        for entry in signal_cache.values()
    )
    summary = {
        "version": 1,
        "inventoryPath": str(inventory_path),
        "assetsRequested": len(assets),
        "signalObservations": len(signal_cache),
        "signalIssueCount": signal_issues,
        "whisperObservations": len(whisper_cache),
        "whisperMatches": dict(whisper_matches),
        "totalDurationSeconds": round(duration, 3),
        "modelId": MODEL_ID if model else None,
        "modelPath": str(MODEL_ROOT) if model else None,
        "computeType": compute_type,
        "modelRevision": current_model_revision if model else None,
        "signalPolicyVersion": SIGNAL_POLICY_VERSION,
        "whisperPolicyVersion": WHISPER_POLICY_VERSION,
    }
    write_json(output / "offline-summary.json", summary)
    print(json.dumps(summary, ensure_ascii=False, indent=2))
    return 0


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser()
    subparsers = parser.add_subparsers(dest="command", required=True)

    check = subparsers.add_parser("model-check")
    check.add_argument("--hashes", action="store_true")
    check.set_defaults(handler=command_model_check)

    download = subparsers.add_parser("model-download")
    download.add_argument("--confirm", action="store_true")
    download.set_defaults(handler=command_model_download)

    offline = subparsers.add_parser("offline")
    offline.add_argument("--root", default=".")
    offline.add_argument(
        "--inventory", default=str(DEFAULT_OUTPUT / "inventory.json")
    )
    offline.add_argument("--output", default=str(DEFAULT_OUTPUT))
    offline.add_argument("--signal-only", action="store_true")
    offline.add_argument("--limit", type=int, default=0)
    offline.set_defaults(handler=command_offline)
    return parser


def main() -> int:
    args = build_parser().parse_args()
    return int(args.handler(args))


if __name__ == "__main__":
    try:
        raise SystemExit(main())
    except Exception as error:  # noqa: BLE001 - CLI boundary
        print(f"ERROR: {type(error).__name__}: {error}", file=sys.stderr)
        raise SystemExit(1) from error
