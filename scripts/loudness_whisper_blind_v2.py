#!/usr/bin/env python3
"""Reference-free local Whisper listener for safe loudness v2 candidates."""

from __future__ import annotations

import argparse
import hashlib
import json
import os
import sys
from pathlib import Path
from typing import Any

MODEL_ROOT = Path(r"D:\AI\models\whisper\faster-whisper-large-v3")
CACHE_ROOT = Path(r"D:\AI\cache")
LANGUAGE_CODES = {"en-US": "en", "es-ES": "es", "fr-FR": "fr", "ru-RU": "ru"}
FORBIDDEN_MANIFEST_KEYS = {
    "text",
    "expected",
    "expectedText",
    "ipa",
    "prompt",
    "initialPrompt",
    "targetUnit",
    "targetUnits",
}


def require_non_c_drive(value: Path, label: str) -> Path:
    resolved = value.resolve()
    if str(resolved).lower().startswith("c:\\"):
        raise RuntimeError(f"{label} must not resolve to C drive: {resolved}")
    return resolved


def configure_cache() -> None:
    require_non_c_drive(MODEL_ROOT, "Whisper model path")
    require_non_c_drive(CACHE_ROOT, "Whisper cache path")
    for key, value in {
        "HF_HOME": CACHE_ROOT / "huggingface",
        "HF_HUB_CACHE": CACHE_ROOT / "huggingface" / "hub",
        "TORCH_HOME": CACHE_ROOT / "torch",
        "XDG_CACHE_HOME": CACHE_ROOT / "xdg",
    }.items():
        os.environ[key] = str(require_non_c_drive(value, key))


def sha256_file(file_path: Path) -> str:
    digest = hashlib.sha256()
    with file_path.open("rb") as handle:
        for chunk in iter(lambda: handle.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


def validate_manifest(manifest: dict[str, Any]) -> list[dict[str, Any]]:
    if manifest.get("version") != 1:
        raise RuntimeError("Unsupported blind Whisper manifest version")
    if manifest.get("promptIncluded") is not False:
        raise RuntimeError("Blind Whisper manifest must explicitly disable prompts")
    assets = manifest.get("assets")
    if not isinstance(assets, list):
        raise RuntimeError("Blind Whisper manifest assets must be an array")
    validated: list[dict[str, Any]] = []
    for asset in assets:
        forbidden = sorted(FORBIDDEN_MANIFEST_KEYS.intersection(asset))
        if forbidden:
            raise RuntimeError(
                f"{asset.get('assetId', 'unknown')}: answer-bearing keys are forbidden: "
                + ", ".join(forbidden)
            )
        required = {
            "assetId",
            "anonymousWavSha256",
            "candidateSha256",
            "languageId",
            "audioPath",
        }
        if set(asset) != required:
            raise RuntimeError(
                f"{asset.get('assetId', 'unknown')}: blind manifest keys must be "
                + ", ".join(sorted(required))
            )
        language_id = asset["languageId"]
        if language_id not in LANGUAGE_CODES:
            raise RuntimeError(f"Unsupported language: {language_id}")
        audio_path = Path(asset["audioPath"]).resolve()
        if not audio_path.is_file():
            raise RuntimeError(f"Blind audio is missing: {audio_path}")
        if sha256_file(audio_path) != asset["anonymousWavSha256"]:
            raise RuntimeError(f"{asset['assetId']}: anonymous audio SHA mismatch")
        validated.append({**asset, "audioPath": str(audio_path)})
    return validated


def load_model() -> tuple[Any, str]:
    if not (MODEL_ROOT / "model.bin").is_file():
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
            WhisperModel(str(MODEL_ROOT), device="cuda", compute_type="int8_float16"),
            "int8_float16",
        )


def append_result(output_path: Path, value: dict[str, Any]) -> None:
    output_path.parent.mkdir(parents=True, exist_ok=True)
    with output_path.open("a", encoding="utf-8", newline="\n") as handle:
        handle.write(json.dumps(value, ensure_ascii=False, separators=(",", ":")))
        handle.write("\n")
        handle.flush()


def run(args: argparse.Namespace) -> int:
    configure_cache()
    manifest_path = Path(args.manifest).resolve()
    output_path = Path(args.output).resolve()
    manifest = json.loads(manifest_path.read_text(encoding="utf-8"))
    assets = validate_manifest(manifest)
    model, compute_type = load_model()
    for index, asset in enumerate(assets, start=1):
        segments, info = model.transcribe(
            asset["audioPath"],
            language=LANGUAGE_CODES[asset["languageId"]],
            beam_size=5,
            temperature=0.0,
            condition_on_previous_text=False,
            initial_prompt=None,
            vad_filter=False,
            word_timestamps=False,
        )
        collected = list(segments)
        heard_text = " ".join(segment.text.strip() for segment in collected).strip()
        average_log_probability = (
            sum(segment.avg_logprob for segment in collected) / len(collected)
            if collected
            else None
        )
        no_speech_probability = (
            max(segment.no_speech_prob for segment in collected) if collected else None
        )
        append_result(
            output_path,
            {
                "version": 1,
                "assetId": asset["assetId"],
                "candidateSha256": asset["candidateSha256"],
                "languageId": asset["languageId"],
                "heardText": heard_text,
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
                "computeType": compute_type,
                "promptIncluded": False,
            },
        )
        print(f"Whisper blind v2 {index}/{len(assets)}", flush=True)
    return 0


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--manifest", required=True)
    parser.add_argument("--output", required=True)
    return run(parser.parse_args())


if __name__ == "__main__":
    try:
        raise SystemExit(main())
    except Exception as error:  # noqa: BLE001
        print(f"ERROR: {type(error).__name__}: {error}", file=sys.stderr)
        raise SystemExit(1) from error
