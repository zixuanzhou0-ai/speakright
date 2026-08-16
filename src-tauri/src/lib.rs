use base64::{
    engine::general_purpose::{STANDARD as BASE64_STANDARD, URL_SAFE_NO_PAD},
    Engine as _,
};
use keyring::{Entry, Error as KeyringError};
use log::LevelFilter;
use serde::{Deserialize, Serialize};
use serde_json::json;
use std::collections::VecDeque;
use std::env;
use std::fs;
use std::io::{Read, Write};
use std::path::{Path, PathBuf};
use std::process::{Command, Stdio};
use std::sync::{
    atomic::{AtomicBool, AtomicUsize, Ordering},
    Arc, Mutex,
};
use std::thread;
use std::time::{Duration, Instant, SystemTime, UNIX_EPOCH};
use tauri::{AppHandle, Manager};
use tauri_plugin_log::{RotationStrategy, Target, TargetKind};
use tiny_http::{Header, Method, Request, Response, Server, StatusCode};
use wait_timeout::ChildExt;

const DEFAULT_SECURE_STORE_SERVICE: &str = "com.speakright.desktop";
const SECURE_STORE_SERVICE_ENV: &str = "SPEAKRIGHT_SECURE_STORE_SERVICE";
const LOG_DIR_ENV: &str = "SPEAKRIGHT_LOG_DIR";
const SETTINGS_STORE_PATH_ENV: &str = "SPEAKRIGHT_SETTINGS_STORE_PATH";
const SETTINGS_STORE_FILE_NAME: &str = "speakright-settings.json";
const LOG_FILE_NAME: &str = "speakright";
const LOG_MAX_FILE_SIZE_BYTES: u128 = 1_000_000;
const LOG_ARCHIVE_COUNT: usize = 5;
const LOG_TAIL_LINE_COUNT: usize = 200;
const LOG_TAIL_MAX_LINE_CHARS: usize = 500;
const HERMES_BRIDGE_ADDRESS: &str = "127.0.0.1:17831";
const HERMES_TTS_MAX_CHARS: usize = 500;
const HERMES_TTS_MAX_AUDIO_BYTES: u64 = 8 * 1024 * 1024;
const HERMES_TTS_TIMEOUT_SECONDS: u64 = 75;
const HERMES_STATUS_TIMEOUT_SECONDS: u64 = 20;
const HERMES_BRIDGE_RATE_LIMIT: usize = 60;
const HERMES_BRIDGE_RATE_WINDOW_SECONDS: u64 = 60;
const HERMES_BRIDGE_PROTOCOL_VERSION: u8 = 1;
const HERMES_BRIDGE_MAX_CONCURRENT_TTS: usize = 2;
const HERMES_HEALTH_CACHE_SECONDS: u64 = 10;
const VERTEX_GEMINI_TTS_MODEL: &str = "gemini-3.1-flash-tts-preview";
const VERTEX_GEMINI_LOCATION: &str = "global";
const VERTEX_TTS_SAMPLE_RATE: u32 = 24_000;
const VERTEX_TTS_MAX_CHARS: usize = 500;
const VERTEX_TTS_MAX_CONTENT_BYTES: usize = 8_000;
const VERTEX_TTS_MAX_AUDIO_BYTES: usize = 8 * 1024 * 1024;
const VERTEX_TTS_MAX_RESPONSE_BYTES: u64 = 12 * 1024 * 1024;
const VERTEX_TTS_TIMEOUT_SECONDS: u64 = 75;
const VERTEX_STATUS_TIMEOUT_SECONDS: u64 = 20;
const VERTEX_VOICES: [&str; 30] = [
    "Achernar",
    "Achird",
    "Algenib",
    "Algieba",
    "Alnilam",
    "Aoede",
    "Autonoe",
    "Callirrhoe",
    "Charon",
    "Despina",
    "Enceladus",
    "Erinome",
    "Fenrir",
    "Gacrux",
    "Iapetus",
    "Kore",
    "Laomedeia",
    "Leda",
    "Orus",
    "Pulcherrima",
    "Puck",
    "Rasalgethi",
    "Sadachbia",
    "Sadaltager",
    "Schedar",
    "Sulafat",
    "Umbriel",
    "Vindemiatrix",
    "Zephyr",
    "Zubenelgenubi",
];
const ALLOWED_SECURE_STORE_KEYS: [&str; 3] = [
    "speakright_azure_config",
    "speakright_elevenlabs_config",
    "speakright_llm_config",
];

const HERMES_PYTHON_BRIDGE: &str = r#"
import json
import logging
import os
import sys

logging.disable(logging.CRITICAL)

try:
    from tools.tts_tool import _generate_xai_tts, _get_provider, _load_tts_config

    mode = sys.argv[1]
    config = _load_tts_config()
    provider = _get_provider(config)
    xai_config = dict(config.get("xai") or {})
    voice_id = str(xai_config.get("voice_id") or "eve")

    if mode == "status":
        from tools.xai_http import resolve_xai_http_credentials

        credentials = resolve_xai_http_credentials()
        available = provider == "xai" and bool(str(credentials.get("api_key") or "").strip())
        message = (
            "已检测到爱马仕 Grok TTS"
            if available
            else "爱马仕尚未启用 xAI TTS 或 Grok 授权不可用"
        )
        print(json.dumps({
            "ok": True,
            "available": available,
            "provider": provider,
            "voiceId": voice_id,
            "message": message,
        }, ensure_ascii=False))
        raise SystemExit(0)

    if mode != "tts":
        raise RuntimeError("Unsupported Hermes bridge mode")
    if provider != "xai":
        raise RuntimeError("Hermes TTS provider is not xai")

    output_path = sys.argv[2]
    language = sys.argv[3]
    speed = float(sys.argv[4])
    text = sys.stdin.read()

    request_config = dict(config)
    xai_config["language"] = language
    xai_config["speed"] = speed
    request_config["xai"] = xai_config
    _generate_xai_tts(text, output_path, request_config)
    print(json.dumps({
        "ok": True,
        "available": True,
        "provider": "xai",
        "voiceId": voice_id,
        "message": "音频生成成功",
    }, ensure_ascii=False))
except SystemExit:
    raise
except Exception as exc:
    print(json.dumps({"ok": False, "error": str(exc)}, ensure_ascii=False))
    raise SystemExit(1)
"#;

#[derive(Serialize)]
struct DesktopDiagnosticsLog {
    path: Option<String>,
    bytes: Option<u64>,
    tail: Vec<String>,
    error: Option<String>,
}

#[derive(Serialize)]
struct DesktopDiagnostics {
    app_identifier: String,
    log: DesktopDiagnosticsLog,
}

#[derive(Clone, Debug, Serialize)]
#[serde(rename_all = "camelCase")]
struct HermesXaiStatus {
    available: bool,
    provider: String,
    voice_id: Option<String>,
    message: String,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
struct HermesXaiAudio {
    audio_base64: String,
    mime_type: &'static str,
    provider: String,
    voice_id: Option<String>,
}

#[derive(Clone, Debug, Serialize)]
#[serde(rename_all = "camelCase")]
struct VertexGeminiStatus {
    available: bool,
    model: &'static str,
    auth_ready: bool,
    project_configured: bool,
    detail: Option<String>,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
struct VertexGeminiAudio {
    audio_base64: String,
    mime_type: &'static str,
    provider: &'static str,
    model: &'static str,
    voice_name: String,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
struct HermesBridgeHealthResponse {
    protocol_version: u8,
    session_token: String,
    #[serde(flatten)]
    status: HermesXaiStatus,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
struct VertexBridgeHealthResponse {
    protocol_version: u8,
    session_token: String,
    #[serde(flatten)]
    status: VertexGeminiStatus,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
struct HermesHttpTtsRequest {
    text: String,
    language_id: Option<String>,
    speed: Option<f64>,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
struct VertexHttpTtsRequest {
    text: String,
    language_id: Option<String>,
    speed: Option<f64>,
    voice_name: Option<String>,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
struct HermesPythonResult {
    ok: bool,
    available: Option<bool>,
    provider: Option<String>,
    voice_id: Option<String>,
    message: Option<String>,
    error: Option<String>,
}

#[derive(Clone)]
struct HermesBridgeRateLimiter {
    attempts: Arc<Mutex<VecDeque<Instant>>>,
}

impl HermesBridgeRateLimiter {
    fn new() -> Self {
        Self {
            attempts: Arc::new(Mutex::new(VecDeque::new())),
        }
    }

    fn allow(&self) -> bool {
        let Ok(mut attempts) = self.attempts.lock() else {
            return false;
        };
        let now = Instant::now();
        let window = Duration::from_secs(HERMES_BRIDGE_RATE_WINDOW_SECONDS);
        while attempts
            .front()
            .is_some_and(|attempt| now.duration_since(*attempt) >= window)
        {
            attempts.pop_front();
        }
        if attempts.len() >= HERMES_BRIDGE_RATE_LIMIT {
            return false;
        }
        attempts.push_back(now);
        true
    }
}

#[derive(Clone)]
struct CachedHermesHealth {
    checked_at: Instant,
    status: HermesXaiStatus,
}

#[derive(Clone)]
struct HermesBridgeHealthCache {
    value: Arc<Mutex<Option<CachedHermesHealth>>>,
    refreshing: Arc<AtomicBool>,
}

impl HermesBridgeHealthCache {
    fn new() -> Self {
        Self {
            value: Arc::new(Mutex::new(None)),
            refreshing: Arc::new(AtomicBool::new(false)),
        }
    }
}

#[derive(Clone)]
struct CachedVertexHealth {
    checked_at: Instant,
    status: VertexGeminiStatus,
}

#[derive(Clone)]
struct VertexBridgeHealthCache {
    value: Arc<Mutex<Option<CachedVertexHealth>>>,
    refreshing: Arc<AtomicBool>,
}

impl VertexBridgeHealthCache {
    fn new() -> Self {
        Self {
            value: Arc::new(Mutex::new(None)),
            refreshing: Arc::new(AtomicBool::new(false)),
        }
    }
}

#[derive(Clone)]
struct HermesBridgeState {
    session_token: Arc<str>,
    rate_limiter: HermesBridgeRateLimiter,
    health_cache: HermesBridgeHealthCache,
    vertex_health_cache: VertexBridgeHealthCache,
    active_tts: Arc<AtomicUsize>,
}

impl HermesBridgeState {
    fn new(session_token: String) -> Self {
        Self {
            session_token: Arc::from(session_token),
            rate_limiter: HermesBridgeRateLimiter::new(),
            health_cache: HermesBridgeHealthCache::new(),
            vertex_health_cache: VertexBridgeHealthCache::new(),
            active_tts: Arc::new(AtomicUsize::new(0)),
        }
    }

    fn try_acquire_tts(&self) -> Option<HermesTtsPermit> {
        self.active_tts
            .fetch_update(Ordering::AcqRel, Ordering::Acquire, |active| {
                (active < HERMES_BRIDGE_MAX_CONCURRENT_TTS).then_some(active + 1)
            })
            .ok()?;
        Some(HermesTtsPermit {
            active_tts: Arc::clone(&self.active_tts),
        })
    }
}

struct HermesTtsPermit {
    active_tts: Arc<AtomicUsize>,
}

impl Drop for HermesTtsPermit {
    fn drop(&mut self) {
        self.active_tts.fetch_sub(1, Ordering::AcqRel);
    }
}

fn desktop_log_level() -> LevelFilter {
    if cfg!(debug_assertions) {
        LevelFilter::Debug
    } else {
        LevelFilter::Info
    }
}

fn is_allowed_secure_store_key(key: &str) -> bool {
    ALLOWED_SECURE_STORE_KEYS.contains(&key) || (cfg!(test) && key.starts_with("speakright-test-"))
}

fn validate_secure_store_key(key: &str) -> Result<(), String> {
    if key.trim().is_empty() {
        return Err("secure store key must not be empty".to_string());
    }
    if !is_allowed_secure_store_key(key) {
        return Err("secure store key is not allowed".to_string());
    }
    Ok(())
}

fn validate_secure_store_service(service: &str) -> Result<(), String> {
    if service == DEFAULT_SECURE_STORE_SERVICE {
        return Ok(());
    }
    let Some(suffix) = service.strip_prefix("com.speakright.desktop.") else {
        return Err("secure store namespace override is invalid".to_string());
    };
    if suffix.is_empty()
        || service.len() > 128
        || !suffix
            .chars()
            .all(|character| character.is_ascii_alphanumeric() || matches!(character, '.' | '-'))
    {
        return Err("secure store namespace override is invalid".to_string());
    }
    Ok(())
}

fn secure_store_service() -> Result<String, String> {
    match env::var(SECURE_STORE_SERVICE_ENV) {
        Ok(service) => {
            validate_secure_store_service(&service)?;
            Ok(service)
        }
        Err(env::VarError::NotPresent) => Ok(DEFAULT_SECURE_STORE_SERVICE.to_string()),
        Err(env::VarError::NotUnicode(_)) => {
            Err("secure store namespace override is invalid".to_string())
        }
    }
}

fn secure_entry(key: &str) -> Result<Entry, String> {
    validate_secure_store_key(key)?;
    let service = secure_store_service()?;
    Entry::new(&service, key).map_err(|error| {
        let message = error.to_string();
        log::warn!("secure credential store entry could not be opened: {message}");
        message
    })
}

fn validate_log_directory_override(path: &Path) -> Result<PathBuf, String> {
    if !path.is_absolute() {
        return Err("desktop log directory override is invalid".to_string());
    }
    let resolved = fs::canonicalize(path)
        .map_err(|_| "desktop log directory override is invalid".to_string())?;
    if !resolved.is_dir() {
        return Err("desktop log directory override is invalid".to_string());
    }
    let temp_root = fs::canonicalize(env::temp_dir())
        .map_err(|_| "desktop log directory override is invalid".to_string())?;
    let relative = resolved
        .strip_prefix(&temp_root)
        .map_err(|_| "desktop log directory override is invalid".to_string())?;
    if relative.as_os_str().is_empty() {
        return Err("desktop log directory override is invalid".to_string());
    }
    Ok(resolved)
}

fn log_directory_override() -> Result<Option<PathBuf>, String> {
    match env::var(LOG_DIR_ENV) {
        Ok(value) => validate_log_directory_override(Path::new(&value)).map(Some),
        Err(env::VarError::NotPresent) => Ok(None),
        Err(env::VarError::NotUnicode(_)) => {
            Err("desktop log directory override is invalid".to_string())
        }
    }
}

fn validate_settings_store_path_override(path: &Path) -> Result<PathBuf, String> {
    let invalid = || "desktop settings store path override is invalid".to_string();
    if !path.is_absolute()
        || path.file_name().and_then(|name| name.to_str()) != Some(SETTINGS_STORE_FILE_NAME)
    {
        return Err(invalid());
    }

    let parent = path.parent().ok_or_else(&invalid)?;
    let resolved_parent = fs::canonicalize(parent).map_err(|_| invalid())?;
    if !resolved_parent.is_dir() {
        return Err(invalid());
    }
    let temp_root = fs::canonicalize(env::temp_dir()).map_err(|_| invalid())?;
    let relative = resolved_parent
        .strip_prefix(&temp_root)
        .map_err(|_| invalid())?;
    if relative.as_os_str().is_empty() {
        return Err(invalid());
    }

    if path.exists() {
        let metadata = fs::symlink_metadata(path).map_err(|_| invalid())?;
        if metadata.file_type().is_symlink() || !metadata.is_file() {
            return Err(invalid());
        }
        let resolved_file = fs::canonicalize(path).map_err(|_| invalid())?;
        if resolved_file.parent() != Some(resolved_parent.as_path()) {
            return Err(invalid());
        }
    }

    Ok(resolved_parent.join(SETTINGS_STORE_FILE_NAME))
}

fn settings_store_path_override() -> Result<Option<PathBuf>, String> {
    match env::var(SETTINGS_STORE_PATH_ENV) {
        Ok(value) => validate_settings_store_path_override(Path::new(&value)).map(Some),
        Err(env::VarError::NotPresent) => Ok(None),
        Err(env::VarError::NotUnicode(_)) => {
            Err("desktop settings store path override is invalid".to_string())
        }
    }
}

fn desktop_log_target() -> Result<Target, String> {
    match log_directory_override()? {
        Some(path) => Ok(Target::new(TargetKind::Folder {
            path,
            file_name: Some(LOG_FILE_NAME.into()),
        })),
        None => Ok(Target::new(TargetKind::LogDir {
            file_name: Some(LOG_FILE_NAME.into()),
        })),
    }
}

fn desktop_log_directory(app: &AppHandle) -> Result<PathBuf, String> {
    match log_directory_override()? {
        Some(path) => Ok(path),
        None => app.path().app_log_dir().map_err(|error| error.to_string()),
    }
}

fn truncate_log_line(line: &str) -> String {
    line.chars().take(LOG_TAIL_MAX_LINE_CHARS).collect()
}

fn find_case_insensitive(haystack: &str, needle: &str, from: usize) -> Option<usize> {
    haystack
        .get(from..)?
        .to_ascii_lowercase()
        .find(&needle.to_ascii_lowercase())
        .map(|index| from + index)
}

fn secret_delimiter(character: char) -> bool {
    character.is_whitespace() || matches!(character, '"' | '\'' | ',' | '}' | ']' | '&' | '#')
}

fn replace_secret_ranges(mut text: String, marker: &str, keep_marker: bool) -> String {
    let mut search_start = 0;
    while let Some(marker_start) = find_case_insensitive(&text, marker, search_start) {
        let mut value_start = marker_start + marker.len();
        while text
            .get(value_start..)
            .is_some_and(|tail| tail.starts_with(' '))
        {
            value_start += 1;
        }
        let value_end = text
            .get(value_start..)
            .and_then(|tail| {
                tail.char_indices()
                    .find(|(_, character)| secret_delimiter(*character))
                    .map(|(index, _)| value_start + index)
            })
            .unwrap_or(text.len());
        if value_end > value_start {
            let replace_start = if keep_marker {
                value_start
            } else {
                marker_start
            };
            text.replace_range(replace_start..value_end, "[REDACTED]");
            search_start = replace_start + "[REDACTED]".len();
        } else {
            search_start = value_start;
        }
    }
    text
}

fn redact_json_string_value(mut text: String, key: &str) -> String {
    let needle = format!("\"{key}\"");
    let mut search_start = 0;
    while let Some(key_start) = text.get(search_start..).and_then(|tail| tail.find(&needle)) {
        let key_start = search_start + key_start;
        let after_key = key_start + needle.len();
        let Some(colon_index) = text.get(after_key..).and_then(|tail| tail.find(':')) else {
            break;
        };
        let mut quote_index = after_key + colon_index + 1;
        while text
            .get(quote_index..)
            .is_some_and(|tail| tail.starts_with(' '))
        {
            quote_index += 1;
        }
        if !text
            .get(quote_index..)
            .is_some_and(|tail| tail.starts_with('"'))
        {
            search_start = quote_index;
            continue;
        }
        let value_start = quote_index + 1;
        let mut escaped = false;
        let mut value_end = None;
        for (index, character) in text[value_start..].char_indices() {
            if escaped {
                escaped = false;
                continue;
            }
            if character == '\\' {
                escaped = true;
                continue;
            }
            if character == '"' {
                value_end = Some(value_start + index);
                break;
            }
        }
        let Some(value_end) = value_end else {
            break;
        };
        text.replace_range(value_start..value_end, "[REDACTED]");
        search_start = value_start + "[REDACTED]".len();
    }
    text
}

fn redact_log_line(line: &str) -> String {
    let mut redacted = line.to_string();
    for key in [
        "apiKey",
        "subscriptionKey",
        "Authorization",
        "Ocp-Apim-Subscription-Key",
        "xi-api-key",
        "x-api-key",
    ] {
        redacted = redact_json_string_value(redacted, key);
    }
    for marker in [
        "?key=",
        "&key=",
        "?api_key=",
        "&api_key=",
        "?apiKey=",
        "&apiKey=",
        "?subscriptionKey=",
        "&subscriptionKey=",
        "Bearer ",
    ] {
        redacted = replace_secret_ranges(redacted, marker, true);
    }
    for marker in [
        "Ocp-Apim-Subscription-Key:",
        "xi-api-key:",
        "x-api-key:",
        "apiKey:",
        "subscriptionKey:",
    ] {
        redacted = replace_secret_ranges(redacted, marker, true);
    }
    truncate_log_line(&redacted)
}

fn read_log_tail(path: &Path) -> Result<(Option<u64>, Vec<String>), String> {
    let bytes = fs::metadata(path).ok().map(|metadata| metadata.len());
    let contents = fs::read_to_string(path).map_err(|error| error.to_string())?;
    let mut tail = contents
        .lines()
        .rev()
        .take(LOG_TAIL_LINE_COUNT)
        .map(redact_log_line)
        .collect::<Vec<_>>();
    tail.reverse();
    Ok((bytes, tail))
}

fn normalize_hermes_language(language_id: Option<&str>) -> Result<&'static str, String> {
    match language_id.unwrap_or("en-US") {
        "en" | "en-US" => Ok("en"),
        "es" | "es-ES" => Ok("es-ES"),
        "fr" | "fr-FR" => Ok("fr"),
        "ru" | "ru-RU" => Ok("ru"),
        _ => Err("爱马仕 Grok TTS 暂不支持当前学习语言。".to_string()),
    }
}

fn normalize_hermes_speed(speed: Option<f64>) -> Result<f64, String> {
    let speed = speed.unwrap_or(1.0);
    if speed.is_finite() && (0.7..=1.5).contains(&speed) {
        Ok(speed)
    } else {
        Err("爱马仕 Grok TTS 语速必须在 0.7x 到 1.5x 之间。".to_string())
    }
}

fn validate_hermes_text(text: &str) -> Result<String, String> {
    let text = text.trim();
    if text.is_empty() {
        return Err("请输入需要朗读的文字。".to_string());
    }
    if text.chars().count() > HERMES_TTS_MAX_CHARS {
        return Err(format!(
            "标准示范文本过长，请控制在 {HERMES_TTS_MAX_CHARS} 个字符以内。"
        ));
    }
    Ok(text.to_string())
}

#[cfg(windows)]
fn configure_hidden_process(command: &mut Command) {
    use std::os::windows::process::CommandExt;

    const CREATE_NO_WINDOW: u32 = 0x0800_0000;
    command.creation_flags(CREATE_NO_WINDOW);
}

#[cfg(not(windows))]
fn configure_hidden_process(_command: &mut Command) {}

fn hermes_runtime() -> Result<(PathBuf, PathBuf), String> {
    let mut roots = Vec::new();
    if let Some(explicit_root) = env::var_os("HERMES_AGENT_HOME") {
        roots.push(PathBuf::from(explicit_root));
    }
    if let Some(local_app_data) = env::var_os("LOCALAPPDATA") {
        roots.push(
            PathBuf::from(local_app_data)
                .join("hermes")
                .join("hermes-agent"),
        );
    }

    for root in roots {
        let python = root.join("venv").join("Scripts").join("python.exe");
        if python.is_file() && root.join("tools").join("tts_tool.py").is_file() {
            return Ok((python, root));
        }
    }

    let mut where_command = Command::new("where.exe");
    where_command.arg("hermes.exe");
    configure_hidden_process(&mut where_command);
    if let Ok(output) = where_command.output() {
        if output.status.success() {
            for line in String::from_utf8_lossy(&output.stdout).lines() {
                let hermes = PathBuf::from(line.trim());
                let Some(scripts) = hermes.parent() else {
                    continue;
                };
                let python = scripts.join("python.exe");
                let Some(root) = scripts.parent().and_then(Path::parent) else {
                    continue;
                };
                if python.is_file() && root.join("tools").join("tts_tool.py").is_file() {
                    return Ok((python, root.to_path_buf()));
                }
            }
        }
    }

    Err("未找到本机爱马仕运行环境。请先安装或启动爱马仕，并确认 Grok TTS 已启用。".to_string())
}

fn hermes_temp_audio_path() -> PathBuf {
    let nonce = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .unwrap_or_default()
        .as_nanos();
    env::temp_dir().join(format!(
        "speakright-hermes-{}-{nonce}.mp3",
        std::process::id()
    ))
}

fn parse_hermes_python_result(stdout: &[u8]) -> Result<HermesPythonResult, String> {
    let output = String::from_utf8_lossy(stdout);
    output
        .lines()
        .rev()
        .find_map(|line| serde_json::from_str::<HermesPythonResult>(line.trim()).ok())
        .ok_or_else(|| "爱马仕没有返回有效结果，请重启爱马仕后再试。".to_string())
}

fn run_hermes_python(
    mode: &str,
    output_path: Option<&Path>,
    language: &str,
    speed: f64,
    text: &str,
) -> Result<HermesPythonResult, String> {
    let (python, root) = hermes_runtime()?;
    let mut command = Command::new(python);
    command
        .arg("-c")
        .arg(HERMES_PYTHON_BRIDGE)
        .arg(mode)
        .current_dir(root)
        .env("PYTHONIOENCODING", "utf-8")
        .stdin(Stdio::piped())
        .stdout(Stdio::piped())
        .stderr(Stdio::null());

    if mode == "tts" {
        let output_path =
            output_path.ok_or_else(|| "爱马仕 Grok TTS 临时音频路径不可用。".to_string())?;
        command
            .arg(output_path)
            .arg(language)
            .arg(format!("{speed:.2}"));
    }

    configure_hidden_process(&mut command);

    let mut child = command
        .spawn()
        .map_err(|_| "无法启动本机爱马仕，请确认安装完整并重启爱马仕。".to_string())?;

    if let Some(mut stdin) = child.stdin.take() {
        if stdin.write_all(text.as_bytes()).is_err() {
            let _ = child.kill();
            let _ = child.wait();
            return Err("无法把练习文本交给爱马仕，请重试。".to_string());
        }
    }

    let timeout_seconds = if mode == "status" {
        HERMES_STATUS_TIMEOUT_SECONDS
    } else {
        HERMES_TTS_TIMEOUT_SECONDS
    };

    match child
        .wait_timeout(Duration::from_secs(timeout_seconds))
        .map_err(|_| "等待爱马仕响应时发生本机错误，请重试。".to_string())?
    {
        Some(_) => {
            let output = child
                .wait_with_output()
                .map_err(|_| "无法读取爱马仕返回结果，请重启爱马仕后重试。".to_string())?;
            parse_hermes_python_result(&output.stdout)
        }
        None => {
            let _ = child.kill();
            let _ = child.wait();
            Err(if mode == "status" {
                "爱马仕状态检测超时，请确认本机配置后重试。".to_string()
            } else {
                "爱马仕 Grok TTS 响应超时，请检查网络和 Grok 授权后重试。".to_string()
            })
        }
    }
}

fn hermes_python_error_message(error: Option<&str>) -> String {
    let error = error.unwrap_or_default().to_ascii_lowercase();
    if error.contains("provider is not xai") {
        return "爱马仕当前没有启用 xAI TTS，请先在爱马仕中切换到 Grok TTS。".to_string();
    }
    if error.contains("credential") || error.contains("oauth") || error.contains("api key") {
        return "爱马仕的 Grok 授权不可用，请先在爱马仕中重新登录或配置 xAI。".to_string();
    }
    if error.contains("429") || error.contains("quota") || error.contains("rate limit") {
        return "Grok TTS 请求过于频繁或额度不足，请稍后重试并检查 xAI 用量。".to_string();
    }
    "爱马仕 Grok TTS 调用失败，请检查爱马仕状态、Grok 授权和网络后重试。".to_string()
}

fn resolve_hermes_xai_status() -> HermesXaiStatus {
    match run_hermes_python("status", None, "en", 1.0, "") {
        Ok(result) if result.ok => HermesXaiStatus {
            available: result.available.unwrap_or(false),
            provider: result.provider.unwrap_or_else(|| "xai".to_string()),
            voice_id: result.voice_id,
            message: result
                .message
                .unwrap_or_else(|| "已检测本机爱马仕状态。".to_string()),
        },
        Ok(result) => HermesXaiStatus {
            available: false,
            provider: result.provider.unwrap_or_else(|| "xai".to_string()),
            voice_id: result.voice_id,
            message: hermes_python_error_message(result.error.as_deref()),
        },
        Err(message) => HermesXaiStatus {
            available: false,
            provider: "xai".to_string(),
            voice_id: None,
            message,
        },
    }
}

fn generate_bridge_session_token() -> Result<String, String> {
    let mut random_bytes = [0_u8; 32];
    getrandom::fill(&mut random_bytes)
        .map_err(|_| "无法建立安全的爱马仕桥接会话，请重启 SpeakRight 后重试。".to_string())?;
    Ok(URL_SAFE_NO_PAD.encode(random_bytes))
}

fn pending_hermes_xai_status() -> HermesXaiStatus {
    HermesXaiStatus {
        available: false,
        provider: "xai".to_string(),
        voice_id: None,
        message: "正在检测本机爱马仕 Grok TTS，请稍后重试。".to_string(),
    }
}

fn prewarm_hermes_health_cache(cache: HermesBridgeHealthCache) {
    if cache
        .refreshing
        .compare_exchange(false, true, Ordering::AcqRel, Ordering::Acquire)
        .is_err()
    {
        return;
    }

    let worker_cache = cache.clone();
    let spawn_result = thread::Builder::new()
        .name("speakright-hermes-health".to_string())
        .spawn(move || {
            let status = resolve_hermes_xai_status();
            if let Ok(mut value) = worker_cache.value.lock() {
                *value = Some(CachedHermesHealth {
                    checked_at: Instant::now(),
                    status,
                });
            }
            worker_cache.refreshing.store(false, Ordering::Release);
        });
    if spawn_result.is_err() {
        cache.refreshing.store(false, Ordering::Release);
        log::warn!("SpeakRight Hermes health worker could not start");
    }
}

fn current_hermes_xai_status(cache: &HermesBridgeHealthCache) -> HermesXaiStatus {
    let cached = cache.value.lock().ok().and_then(|value| value.clone());
    let needs_refresh = cached.as_ref().is_none_or(|entry| {
        entry.checked_at.elapsed() >= Duration::from_secs(HERMES_HEALTH_CACHE_SECONDS)
    });
    if needs_refresh {
        prewarm_hermes_health_cache(cache.clone());
    }
    cached
        .map(|entry| entry.status)
        .unwrap_or_else(pending_hermes_xai_status)
}

fn synthesize_hermes_xai(
    text: String,
    language_id: Option<String>,
    speed: Option<f64>,
) -> Result<HermesXaiAudio, String> {
    let text = validate_hermes_text(&text)?;
    let language = normalize_hermes_language(language_id.as_deref())?;
    let speed = normalize_hermes_speed(speed)?;
    let output_path = hermes_temp_audio_path();

    let result = (|| {
        let python_result = run_hermes_python("tts", Some(&output_path), language, speed, &text)?;
        if !python_result.ok {
            return Err(hermes_python_error_message(python_result.error.as_deref()));
        }

        let metadata = fs::metadata(&output_path)
            .map_err(|_| "爱马仕没有生成可播放音频，请检查 Grok TTS 配置后重试。".to_string())?;
        if metadata.len() == 0 || metadata.len() > HERMES_TTS_MAX_AUDIO_BYTES {
            return Err("爱马仕返回的音频大小异常，请重试。".to_string());
        }
        let audio =
            fs::read(&output_path).map_err(|_| "无法读取爱马仕生成的音频，请重试。".to_string())?;
        Ok(HermesXaiAudio {
            audio_base64: BASE64_STANDARD.encode(audio),
            mime_type: "audio/mpeg",
            provider: python_result.provider.unwrap_or_else(|| "xai".to_string()),
            voice_id: python_result.voice_id,
        })
    })();

    let _ = fs::remove_file(output_path);
    result
}

fn normalize_vertex_language(language_id: Option<&str>) -> Result<&'static str, String> {
    match language_id.unwrap_or("en-US").to_ascii_lowercase().as_str() {
        "en" | "en-us" => Ok("en-us"),
        "es" | "es-es" => Ok("es-es"),
        "fr" | "fr-fr" => Ok("fr-fr"),
        "ru" | "ru-ru" => Ok("ru-ru"),
        _ => Err("Vertex Gemini TTS 暂不支持当前学习语言。".to_string()),
    }
}

fn vertex_language_name(language: &str) -> &'static str {
    match language {
        "es-es" => "European Spanish",
        "fr-fr" => "French",
        "ru-ru" => "Russian",
        _ => "American English",
    }
}

fn normalize_vertex_speed(speed: Option<f64>) -> Result<f64, String> {
    let speed = speed.unwrap_or(1.0);
    if speed.is_finite() && (0.7..=1.5).contains(&speed) {
        Ok(speed)
    } else {
        Err("Vertex Gemini TTS 语速必须在 0.7x 到 1.5x 之间。".to_string())
    }
}

fn normalize_vertex_voice(voice_name: Option<&str>) -> Result<&'static str, String> {
    let requested = voice_name.unwrap_or("Kore").trim();
    VERTEX_VOICES
        .iter()
        .copied()
        .find(|voice| voice.eq_ignore_ascii_case(requested))
        .ok_or_else(|| "请选择受支持的 Vertex Gemini TTS 音色。".to_string())
}

fn validate_vertex_text(text: &str) -> Result<String, String> {
    let text = text.trim();
    if text.is_empty() {
        return Err("请输入需要朗读的文字。".to_string());
    }
    if text.chars().count() > VERTEX_TTS_MAX_CHARS {
        return Err(format!(
            "标准示范文本过长，请控制在 {VERTEX_TTS_MAX_CHARS} 个字符以内。"
        ));
    }
    Ok(text.to_string())
}

#[cfg(windows)]
fn gcloud_command() -> Command {
    if let Some(explicit_path) = env::var_os("GCLOUD_CLI_PATH") {
        return Command::new(explicit_path);
    }

    for base in [
        env::var_os("ProgramFiles(x86)"),
        env::var_os("LOCALAPPDATA"),
    ]
    .into_iter()
    .flatten()
    {
        let candidate = PathBuf::from(base)
            .join("Google")
            .join("Cloud SDK")
            .join("google-cloud-sdk")
            .join("bin")
            .join("gcloud.cmd");
        if candidate.is_file() {
            return Command::new(candidate);
        }
    }

    let mut command = Command::new("cmd.exe");
    command.args(["/D", "/Q", "/C", "gcloud.cmd"]);
    command
}

#[cfg(not(windows))]
fn gcloud_command() -> Command {
    Command::new(env::var_os("GCLOUD_CLI_PATH").unwrap_or_else(|| "gcloud".into()))
}

fn run_gcloud(args: &[&str], timeout_seconds: u64) -> Result<String, String> {
    let mut command = gcloud_command();
    command
        .args(args)
        .stdin(Stdio::null())
        .stdout(Stdio::piped())
        .stderr(Stdio::null());
    configure_hidden_process(&mut command);

    let mut child = command
        .spawn()
        .map_err(|_| "未找到 Google Cloud CLI，请先安装 gcloud。".to_string())?;
    match child
        .wait_timeout(Duration::from_secs(timeout_seconds))
        .map_err(|_| "Google Cloud 本机授权检查失败，请稍后重试。".to_string())?
    {
        Some(status) if status.success() => {
            let output = child
                .wait_with_output()
                .map_err(|_| "无法读取 Google Cloud 本机授权状态。".to_string())?;
            let value = String::from_utf8_lossy(&output.stdout).trim().to_string();
            if value.len() > 4096 {
                return Err("Google Cloud CLI 返回结果异常。".to_string());
            }
            Ok(value)
        }
        Some(_) => {
            let _ = child.wait();
            Err("Google Cloud 本机授权尚未就绪。".to_string())
        }
        None => {
            let _ = child.kill();
            let _ = child.wait();
            Err("Google Cloud 本机授权检查超时。".to_string())
        }
    }
}

fn validate_vertex_project(project: &str) -> Result<String, String> {
    let project = project.trim();
    if project.is_empty()
        || project == "(unset)"
        || project.len() > 128
        || !project.chars().all(|character| {
            character.is_ascii_alphanumeric() || matches!(character, '-' | '_' | '.' | ':')
        })
    {
        return Err("请先使用 gcloud 选择有效的 Google Cloud 项目。".to_string());
    }
    Ok(project.to_string())
}

fn resolve_vertex_project() -> Result<String, String> {
    if let Ok(project) = env::var("GOOGLE_CLOUD_PROJECT") {
        if !project.trim().is_empty() {
            return validate_vertex_project(&project);
        }
    }
    let project = run_gcloud(
        &["config", "get-value", "project", "--quiet"],
        VERTEX_STATUS_TIMEOUT_SECONDS,
    )?;
    validate_vertex_project(&project)
}

fn resolve_vertex_access_token() -> Result<String, String> {
    let token = match env::var("GOOGLE_OAUTH_ACCESS_TOKEN") {
        Ok(token) if !token.trim().is_empty() => token,
        _ => run_gcloud(
            &[
                "auth",
                "application-default",
                "print-access-token",
                "--quiet",
            ],
            VERTEX_STATUS_TIMEOUT_SECONDS,
        )?,
    };
    let token = token.trim();
    if token.len() <= 20 || token.len() > 4096 || token.chars().any(char::is_whitespace) {
        return Err("Vertex AI 的 ADC 授权不可用，请重新登录 Google Cloud。".to_string());
    }
    Ok(token.to_string())
}

fn resolve_vertex_gemini_status() -> VertexGeminiStatus {
    let project = resolve_vertex_project();
    let token = resolve_vertex_access_token();
    let project_configured = project.is_ok();
    let auth_ready = token.is_ok();
    let available = project_configured && auth_ready;
    VertexGeminiStatus {
        available,
        model: VERTEX_GEMINI_TTS_MODEL,
        auth_ready,
        project_configured,
        detail: Some(if available {
            "本机 Google Cloud 项目与 ADC 授权已就绪。".to_string()
        } else if !project_configured {
            "请先使用 gcloud 选择 Google Cloud 项目。".to_string()
        } else {
            "请先运行 gcloud auth application-default login 完成 ADC 授权。".to_string()
        }),
    }
}

fn pending_vertex_gemini_status() -> VertexGeminiStatus {
    VertexGeminiStatus {
        available: false,
        model: VERTEX_GEMINI_TTS_MODEL,
        auth_ready: false,
        project_configured: false,
        detail: Some("正在检测本机 Vertex AI 配置，请稍后重试。".to_string()),
    }
}

fn prewarm_vertex_health_cache(cache: VertexBridgeHealthCache) {
    if cache
        .refreshing
        .compare_exchange(false, true, Ordering::AcqRel, Ordering::Acquire)
        .is_err()
    {
        return;
    }

    let worker_cache = cache.clone();
    let spawn_result = thread::Builder::new()
        .name("speakright-vertex-health".to_string())
        .spawn(move || {
            let status = resolve_vertex_gemini_status();
            if let Ok(mut value) = worker_cache.value.lock() {
                *value = Some(CachedVertexHealth {
                    checked_at: Instant::now(),
                    status,
                });
            }
            worker_cache.refreshing.store(false, Ordering::Release);
        });
    if spawn_result.is_err() {
        cache.refreshing.store(false, Ordering::Release);
        log::warn!("SpeakRight Vertex health worker could not start");
    }
}

fn current_vertex_gemini_status(cache: &VertexBridgeHealthCache) -> VertexGeminiStatus {
    let cached = cache.value.lock().ok().and_then(|value| value.clone());
    let needs_refresh = cached.as_ref().is_none_or(|entry| {
        entry.checked_at.elapsed() >= Duration::from_secs(HERMES_HEALTH_CACHE_SECONDS)
    });
    if needs_refresh {
        prewarm_vertex_health_cache(cache.clone());
    }
    cached
        .map(|entry| entry.status)
        .unwrap_or_else(pending_vertex_gemini_status)
}

fn vertex_pace_instruction(speed: f64) -> &'static str {
    if speed <= 0.75 {
        "very slow"
    } else if speed < 0.95 {
        "slow"
    } else if speed <= 1.05 {
        "natural"
    } else if speed < 1.3 {
        "slightly fast"
    } else {
        "fast"
    }
}

fn pcm_s16le_to_wav(pcm: &[u8]) -> Result<Vec<u8>, String> {
    if pcm.is_empty() || pcm.len() % 2 != 0 || pcm.len() > VERTEX_TTS_MAX_AUDIO_BYTES {
        return Err("Vertex Gemini TTS 返回的音频大小异常，请重试。".to_string());
    }
    let data_size =
        u32::try_from(pcm.len()).map_err(|_| "Vertex Gemini TTS 返回的音频过大。".to_string())?;
    let mut wav = Vec::with_capacity(44 + pcm.len());
    wav.extend_from_slice(b"RIFF");
    wav.extend_from_slice(&(36_u32 + data_size).to_le_bytes());
    wav.extend_from_slice(b"WAVEfmt ");
    wav.extend_from_slice(&16_u32.to_le_bytes());
    wav.extend_from_slice(&1_u16.to_le_bytes());
    wav.extend_from_slice(&1_u16.to_le_bytes());
    wav.extend_from_slice(&VERTEX_TTS_SAMPLE_RATE.to_le_bytes());
    wav.extend_from_slice(&(VERTEX_TTS_SAMPLE_RATE * 2).to_le_bytes());
    wav.extend_from_slice(&2_u16.to_le_bytes());
    wav.extend_from_slice(&16_u16.to_le_bytes());
    wav.extend_from_slice(b"data");
    wav.extend_from_slice(&data_size.to_le_bytes());
    wav.extend_from_slice(pcm);
    Ok(wav)
}

fn decode_vertex_audio_response(response_bytes: &[u8]) -> Result<Vec<u8>, String> {
    let response_json: serde_json::Value = serde_json::from_slice(response_bytes)
        .map_err(|_| "Vertex Gemini TTS 返回了无法识别的结果。".to_string())?;
    let inline_data = response_json
        .pointer("/candidates/0/content/parts/0/inlineData")
        .or_else(|| response_json.pointer("/candidates/0/content/parts/0/inline_data"))
        .ok_or_else(|| "Vertex Gemini TTS 没有返回音频，请重试。".to_string())?;
    let mime_type = inline_data
        .get("mimeType")
        .or_else(|| inline_data.get("mime_type"))
        .and_then(serde_json::Value::as_str)
        .unwrap_or("audio/L16;rate=24000");
    if !mime_type.to_ascii_lowercase().starts_with("audio/") {
        return Err("Vertex Gemini TTS 返回的内容不是音频。".to_string());
    }
    let encoded_audio = inline_data
        .get("data")
        .and_then(serde_json::Value::as_str)
        .ok_or_else(|| "Vertex Gemini TTS 音频数据为空，请重试。".to_string())?;
    if encoded_audio.len() > ((VERTEX_TTS_MAX_AUDIO_BYTES * 4 / 3) + 8) {
        return Err("Vertex Gemini TTS 返回的音频过大。".to_string());
    }
    let pcm = BASE64_STANDARD
        .decode(encoded_audio)
        .map_err(|_| "Vertex Gemini TTS 音频编码无效。".to_string())?;
    pcm_s16le_to_wav(&pcm)
}

fn vertex_http_error(status: u16) -> String {
    match status {
        400 => "Vertex Gemini TTS 拒绝了当前文本或配置，请检查语言与音色。".to_string(),
        401 => "Vertex AI ADC 授权已失效，请重新登录 Google Cloud。".to_string(),
        403 => {
            "当前 Google Cloud 账号无权调用 Vertex AI，请检查 API、结算与 aiplatform.user 权限。"
                .to_string()
        }
        404 => "当前项目或 global 区域暂时找不到 Gemini 3.1 TTS 模型。".to_string(),
        429 => "Vertex Gemini TTS 请求过于频繁或额度不足，请稍后重试并检查用量。".to_string(),
        500..=599 => "Vertex Gemini TTS 服务暂时不可用，请稍后重试。".to_string(),
        _ => "Vertex Gemini TTS 调用失败，请检查本机 Google Cloud 配置。".to_string(),
    }
}

fn synthesize_vertex_gemini(
    text: String,
    language_id: Option<String>,
    speed: Option<f64>,
    voice_name: Option<String>,
) -> Result<VertexGeminiAudio, String> {
    let text = validate_vertex_text(&text)?;
    let language = normalize_vertex_language(language_id.as_deref())?;
    let speed = normalize_vertex_speed(speed)?;
    let voice = normalize_vertex_voice(voice_name.as_deref())?;
    let project = resolve_vertex_project()?;
    let access_token = resolve_vertex_access_token()?;
    let prompt = format!(
        "Speak exactly the following text without adding, removing, spelling out, or explaining anything. Use clear, neutral {} pronunciation at a {} pace: {}",
        vertex_language_name(language),
        vertex_pace_instruction(speed),
        text
    );
    if prompt.as_bytes().len() > VERTEX_TTS_MAX_CONTENT_BYTES {
        return Err("Vertex Gemini TTS 请求超过 8,000 字节限制，请缩短文本。".to_string());
    }

    let endpoint = format!(
        "https://aiplatform.googleapis.com/v1beta1/projects/{project}/locations/{VERTEX_GEMINI_LOCATION}/publishers/google/models/{VERTEX_GEMINI_TTS_MODEL}:generateContent"
    );
    let request_body = json!({
        "contents": {
            "role": "user",
            "parts": { "text": prompt }
        },
        "generation_config": {
            "speech_config": {
                "language_code": language,
                "voice_config": {
                    "prebuilt_voice_config": {
                        "voice_name": voice.to_ascii_lowercase()
                    }
                }
            }
        }
    });

    let client = reqwest::blocking::Client::builder()
        .timeout(Duration::from_secs(VERTEX_TTS_TIMEOUT_SECONDS))
        .build()
        .map_err(|_| "无法初始化 Vertex AI 网络连接。".to_string())?;
    let response = client
        .post(endpoint)
        .bearer_auth(access_token)
        .header("x-goog-user-project", &project)
        .json(&request_body)
        .send()
        .map_err(|_| "无法连接 Vertex Gemini TTS，请检查网络后重试。".to_string())?;
    let status = response.status();
    if !status.is_success() {
        return Err(vertex_http_error(status.as_u16()));
    }
    if response
        .content_length()
        .is_some_and(|length| length > VERTEX_TTS_MAX_RESPONSE_BYTES)
    {
        return Err("Vertex Gemini TTS 返回内容过大，已停止读取。".to_string());
    }
    let response_bytes = response
        .bytes()
        .map_err(|_| "无法读取 Vertex Gemini TTS 返回结果。".to_string())?;
    if response_bytes.len() as u64 > VERTEX_TTS_MAX_RESPONSE_BYTES {
        return Err("Vertex Gemini TTS 返回内容过大，已停止读取。".to_string());
    }
    let wav = decode_vertex_audio_response(&response_bytes)?;

    Ok(VertexGeminiAudio {
        audio_base64: BASE64_STANDARD.encode(wav),
        mime_type: "audio/wav",
        provider: "vertex-gemini",
        model: VERTEX_GEMINI_TTS_MODEL,
        voice_name: voice.to_string(),
    })
}

fn request_header(request: &Request, name: &'static str) -> Option<String> {
    request
        .headers()
        .iter()
        .find(|header| header.field.equiv(name))
        .map(|header| header.value.as_str().trim().to_string())
}

fn allowed_bridge_host(host: Option<&str>) -> bool {
    let Some(host) = host else {
        return false;
    };
    let host = host.trim().to_ascii_lowercase();
    host == "127.0.0.1:17831" || host == "localhost:17831"
}

fn allowed_bridge_origin(origin: &str) -> bool {
    let origin = origin.trim().to_ascii_lowercase();
    let port = ["http://localhost:", "http://127.0.0.1:"]
        .iter()
        .find_map(|prefix| origin.strip_prefix(prefix))
        .and_then(|value| {
            let port = value.parse::<u16>().ok()?;
            (value == port.to_string()).then_some(port)
        });

    matches!(port, Some(3000 | 3002 | 4173..=4192))
}

fn http_header(name: &str, value: &str) -> Header {
    Header::from_bytes(name.as_bytes(), value.as_bytes()).expect("static HTTP header is valid")
}

fn add_bridge_cors_headers<T: Read + Send + 'static>(
    response: &mut Response<T>,
    origin: Option<&str>,
    private_network: bool,
) {
    if let Some(origin) = origin {
        response.add_header(http_header("Access-Control-Allow-Origin", origin));
        response.add_header(http_header(
            "Vary",
            "Origin, Access-Control-Request-Private-Network",
        ));
    }
    response.add_header(http_header(
        "Access-Control-Allow-Methods",
        "GET, POST, OPTIONS",
    ));
    response.add_header(http_header(
        "Access-Control-Allow-Headers",
        "Content-Type, Accept, X-SpeakRight-Bridge-Token",
    ));
    if private_network {
        response.add_header(http_header("Access-Control-Allow-Private-Network", "true"));
    }
}

fn respond_bridge_json(
    request: Request,
    status: u16,
    body: serde_json::Value,
    origin: Option<&str>,
) {
    let mut response = Response::from_string(body.to_string()).with_status_code(StatusCode(status));
    response.add_header(http_header(
        "Content-Type",
        "application/json; charset=utf-8",
    ));
    response.add_header(http_header("Cache-Control", "no-store"));
    response.add_header(http_header("X-Content-Type-Options", "nosniff"));
    add_bridge_cors_headers(&mut response, origin, false);
    let _ = request.respond(response);
}

fn bridge_error(code: &str, message: &str) -> serde_json::Value {
    json!({
        "protocolVersion": HERMES_BRIDGE_PROTOCOL_VERSION,
        "code": code,
        "error": message,
    })
}

fn bridge_token_matches(supplied: Option<&str>, expected: &str) -> bool {
    let Some(supplied) = supplied else {
        return false;
    };
    let supplied = supplied.as_bytes();
    let expected = expected.as_bytes();
    if supplied.len() != expected.len() {
        return false;
    }

    supplied
        .iter()
        .zip(expected)
        .fold(0_u8, |difference, (left, right)| {
            difference | (left ^ right)
        })
        == 0
}

fn handle_hermes_bridge_request(
    mut request: Request,
    state: &HermesBridgeState,
    tts_permit: Option<HermesTtsPermit>,
) {
    let host = request_header(&request, "Host");
    if !allowed_bridge_host(host.as_deref()) {
        respond_bridge_json(
            request,
            403,
            bridge_error("invalid_host", "仅允许本机访问爱马仕桥接服务。"),
            None,
        );
        return;
    }

    let origin = request_header(&request, "Origin");
    let Some(origin_value) = origin.as_deref() else {
        respond_bridge_json(
            request,
            403,
            bridge_error(
                "missing_origin",
                "爱马仕桥接只接受 SpeakRight 本机网页请求。",
            ),
            None,
        );
        return;
    };
    if !allowed_bridge_origin(origin_value) {
        respond_bridge_json(
            request,
            403,
            bridge_error("invalid_origin", "当前网页来源无权访问爱马仕桥接服务。"),
            None,
        );
        return;
    }

    let path = request.url().split('?').next().unwrap_or(request.url());
    if request.method() == &Method::Options {
        if !matches!(path, "/health" | "/tts" | "/vertex/health" | "/vertex/tts") {
            respond_bridge_json(
                request,
                404,
                bridge_error("route_not_found", "本机桥接路由不存在。"),
                Some(origin_value),
            );
            return;
        }
        let private_network = request_header(&request, "Access-Control-Request-Private-Network")
            .is_some_and(|value| value.eq_ignore_ascii_case("true"));
        let mut response = Response::empty(StatusCode(204));
        add_bridge_cors_headers(&mut response, Some(origin_value), private_network);
        response.add_header(http_header("Access-Control-Max-Age", "600"));
        response.add_header(http_header("Cache-Control", "no-store"));
        let _ = request.respond(response);
        return;
    }

    if request.method() == &Method::Get && path == "/health" {
        if !state.rate_limiter.allow() {
            respond_bridge_json(
                request,
                429,
                bridge_error("rate_limited", "本机桥接状态检查过于频繁，请稍后重试。"),
                Some(origin_value),
            );
            return;
        }
        let status = current_hermes_xai_status(&state.health_cache);
        let response = HermesBridgeHealthResponse {
            protocol_version: HERMES_BRIDGE_PROTOCOL_VERSION,
            session_token: state.session_token.to_string(),
            status,
        };
        respond_bridge_json(
            request,
            200,
            serde_json::to_value(response).unwrap_or_else(|_| {
                bridge_error("health_encoding_failed", "无法读取本机桥接状态。")
            }),
            Some(origin_value),
        );
        return;
    }

    if request.method() == &Method::Get && path == "/vertex/health" {
        if !state.rate_limiter.allow() {
            respond_bridge_json(
                request,
                429,
                bridge_error("rate_limited", "本机桥接状态检查过于频繁，请稍后重试。"),
                Some(origin_value),
            );
            return;
        }
        let status = current_vertex_gemini_status(&state.vertex_health_cache);
        let response = VertexBridgeHealthResponse {
            protocol_version: HERMES_BRIDGE_PROTOCOL_VERSION,
            session_token: state.session_token.to_string(),
            status,
        };
        respond_bridge_json(
            request,
            200,
            serde_json::to_value(response).unwrap_or_else(|_| {
                bridge_error("health_encoding_failed", "无法读取本机 Vertex AI 状态。")
            }),
            Some(origin_value),
        );
        return;
    }

    let is_vertex_tts = path == "/vertex/tts";
    if request.method() != &Method::Post || (!is_vertex_tts && path != "/tts") {
        respond_bridge_json(
            request,
            404,
            bridge_error("route_not_found", "本机桥接路由不存在。"),
            Some(origin_value),
        );
        return;
    }

    let supplied_token = request_header(&request, "X-SpeakRight-Bridge-Token");
    if !bridge_token_matches(supplied_token.as_deref(), state.session_token.as_ref()) {
        respond_bridge_json(
            request,
            401,
            bridge_error(
                "invalid_bridge_session",
                "本机 TTS 桥接会话无效或已过期，请刷新 SpeakRight 后重试。",
            ),
            Some(origin_value),
        );
        return;
    }

    let Some(_tts_permit) = tts_permit else {
        respond_bridge_json(
            request,
            503,
            bridge_error("bridge_busy", "本机 TTS 正在处理其他示范，请稍后重试。"),
            Some(origin_value),
        );
        return;
    };

    if !state.rate_limiter.allow() {
        respond_bridge_json(
            request,
            429,
            bridge_error("rate_limited", "本机 TTS 请求过于频繁，请稍后重试。"),
            Some(origin_value),
        );
        return;
    }

    let content_type = request_header(&request, "Content-Type").unwrap_or_default();
    if !content_type
        .to_ascii_lowercase()
        .starts_with("application/json")
    {
        respond_bridge_json(
            request,
            415,
            bridge_error("invalid_content_type", "本机 TTS 桥接只接受 JSON 请求。"),
            Some(origin_value),
        );
        return;
    }
    if request.body_length().is_some_and(|length| length > 4096) {
        respond_bridge_json(
            request,
            413,
            bridge_error("request_too_large", "标准示范请求过长。"),
            Some(origin_value),
        );
        return;
    }

    let mut body = String::new();
    let read_result = request.as_reader().take(4097).read_to_string(&mut body);
    if read_result.is_err() || body.len() > 4096 {
        respond_bridge_json(
            request,
            400,
            bridge_error("request_read_failed", "无法读取标准示范请求。"),
            Some(origin_value),
        );
        return;
    }
    if is_vertex_tts {
        let payload = match serde_json::from_str::<VertexHttpTtsRequest>(&body) {
            Ok(payload) => payload,
            Err(_) => {
                respond_bridge_json(
                    request,
                    400,
                    bridge_error("invalid_request", "Vertex TTS 请求格式无效。"),
                    Some(origin_value),
                );
                return;
            }
        };
        match synthesize_vertex_gemini(
            payload.text,
            payload.language_id,
            payload.speed,
            payload.voice_name,
        ) {
            Ok(audio) => respond_bridge_json(
                request,
                200,
                serde_json::to_value(audio)
                    .unwrap_or_else(|_| bridge_error("audio_encoding_failed", "音频编码失败。")),
                Some(origin_value),
            ),
            Err(message) => respond_bridge_json(
                request,
                503,
                bridge_error("vertex_tts_failed", &message),
                Some(origin_value),
            ),
        }
        return;
    }

    let payload = match serde_json::from_str::<HermesHttpTtsRequest>(&body) {
        Ok(payload) => payload,
        Err(_) => {
            respond_bridge_json(
                request,
                400,
                bridge_error("invalid_request", "标准示范请求格式无效。"),
                Some(origin_value),
            );
            return;
        }
    };
    match synthesize_hermes_xai(payload.text, payload.language_id, payload.speed) {
        Ok(audio) => respond_bridge_json(
            request,
            200,
            serde_json::to_value(audio)
                .unwrap_or_else(|_| bridge_error("audio_encoding_failed", "音频编码失败。")),
            Some(origin_value),
        ),
        Err(message) => respond_bridge_json(
            request,
            503,
            bridge_error("hermes_tts_failed", &message),
            Some(origin_value),
        ),
    }
}

fn start_hermes_bridge() {
    let spawn_result = thread::Builder::new()
        .name("speakright-hermes-bridge".to_string())
        .spawn(|| {
            let Ok(server) = Server::http(HERMES_BRIDGE_ADDRESS) else {
                log::warn!("SpeakRight Hermes bridge could not bind to its loopback port");
                return;
            };
            let Ok(session_token) = generate_bridge_session_token() else {
                log::warn!("SpeakRight Hermes bridge could not create a secure session");
                return;
            };
            let state = HermesBridgeState::new(session_token);
            prewarm_hermes_health_cache(state.health_cache.clone());
            prewarm_vertex_health_cache(state.vertex_health_cache.clone());
            log::info!("SpeakRight local TTS bridge is listening on the loopback interface");
            for request in server.incoming_requests() {
                let path = request.url().split('?').next().unwrap_or(request.url());
                let needs_tts_worker =
                    request.method() == &Method::Post && matches!(path, "/tts" | "/vertex/tts");
                if !needs_tts_worker {
                    handle_hermes_bridge_request(request, &state, None);
                    continue;
                }

                let Some(tts_permit) = state.try_acquire_tts() else {
                    handle_hermes_bridge_request(request, &state, None);
                    continue;
                };
                let worker_state = state.clone();
                let spawn_result = thread::Builder::new()
                    .name("speakright-local-tts".to_string())
                    .spawn(move || {
                        handle_hermes_bridge_request(request, &worker_state, Some(tts_permit));
                    });
                if spawn_result.is_err() {
                    log::warn!("SpeakRight Hermes TTS request worker could not start");
                }
            }
        });
    if spawn_result.is_err() {
        log::warn!("SpeakRight Hermes bridge worker could not start");
    }
}

#[tauri::command]
async fn hermes_xai_status() -> HermesXaiStatus {
    tauri::async_runtime::spawn_blocking(resolve_hermes_xai_status)
        .await
        .unwrap_or_else(|_| HermesXaiStatus {
            available: false,
            provider: "xai".to_string(),
            voice_id: None,
            message: "无法启动爱马仕状态检测，请重启 SpeakRight 后重试。".to_string(),
        })
}

#[tauri::command]
async fn hermes_xai_tts(
    text: String,
    language_id: Option<String>,
    speed: Option<f64>,
) -> Result<HermesXaiAudio, String> {
    tauri::async_runtime::spawn_blocking(move || synthesize_hermes_xai(text, language_id, speed))
        .await
        .map_err(|_| "爱马仕 Grok TTS 本机任务异常，请重启 SpeakRight 后重试。".to_string())?
}

#[tauri::command]
async fn vertex_gemini_status() -> VertexGeminiStatus {
    tauri::async_runtime::spawn_blocking(resolve_vertex_gemini_status)
        .await
        .unwrap_or_else(|_| VertexGeminiStatus {
            available: false,
            model: VERTEX_GEMINI_TTS_MODEL,
            auth_ready: false,
            project_configured: false,
            detail: Some("无法启动 Vertex AI 状态检测，请重启 SpeakRight 后重试。".to_string()),
        })
}

#[tauri::command]
async fn vertex_gemini_tts(
    text: String,
    language_id: Option<String>,
    speed: Option<f64>,
    voice_name: Option<String>,
) -> Result<VertexGeminiAudio, String> {
    tauri::async_runtime::spawn_blocking(move || {
        synthesize_vertex_gemini(text, language_id, speed, voice_name)
    })
    .await
    .map_err(|_| "Vertex Gemini TTS 本机任务异常，请重启 SpeakRight 后重试。".to_string())?
}

#[tauri::command]
fn secure_store_get(key: String) -> Result<Option<String>, String> {
    let entry = secure_entry(&key)?;
    match entry.get_password() {
        Ok(value) => Ok(Some(value)),
        Err(KeyringError::NoEntry) => Ok(None),
        Err(error) => {
            let message = error.to_string();
            log::warn!("secure credential read failed: {message}");
            Err(message)
        }
    }
}

#[tauri::command]
fn secure_store_set(key: String, value: String) -> Result<(), String> {
    secure_entry(&key)?.set_password(&value).map_err(|error| {
        let message = error.to_string();
        log::warn!("secure credential write failed: {message}");
        message
    })
}

#[tauri::command]
fn secure_store_delete(key: String) -> Result<(), String> {
    let entry = secure_entry(&key)?;
    match entry.delete_credential() {
        Ok(()) | Err(KeyringError::NoEntry) => Ok(()),
        Err(error) => {
            let message = error.to_string();
            log::warn!("secure credential delete failed: {message}");
            Err(message)
        }
    }
}

#[tauri::command]
fn exit_app(app: AppHandle) {
    app.exit(0);
}

#[tauri::command]
fn desktop_diagnostics(app: AppHandle) -> DesktopDiagnostics {
    let app_identifier =
        secure_store_service().unwrap_or_else(|_| "invalid secure-store namespace".to_string());
    match desktop_log_directory(&app) {
        Ok(log_dir) => {
            let log_path = log_dir.join(format!("{LOG_FILE_NAME}.log"));
            match read_log_tail(&log_path) {
                Ok((bytes, tail)) => DesktopDiagnostics {
                    app_identifier: app_identifier.clone(),
                    log: DesktopDiagnosticsLog {
                        path: Some(log_path.display().to_string()),
                        bytes,
                        tail,
                        error: None,
                    },
                },
                Err(error) => DesktopDiagnostics {
                    app_identifier: app_identifier.clone(),
                    log: DesktopDiagnosticsLog {
                        path: Some(log_path.display().to_string()),
                        bytes: None,
                        tail: Vec::new(),
                        error: Some(error),
                    },
                },
            }
        }
        Err(error) => DesktopDiagnostics {
            app_identifier,
            log: DesktopDiagnosticsLog {
                path: None,
                bytes: None,
                tail: Vec::new(),
                error: Some(error.to_string()),
            },
        },
    }
}

#[tauri::command]
fn desktop_settings_store_path() -> Result<Option<String>, String> {
    settings_store_path_override()?
        .map(|path| {
            path.to_str()
                .map(str::to_owned)
                .ok_or_else(|| "desktop settings store path override is invalid".to_string())
        })
        .transpose()
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    let log_target = desktop_log_target()
        .unwrap_or_else(|error| panic!("SpeakRight desktop logging could not initialize: {error}"));
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .plugin(
            tauri_plugin_log::Builder::new()
                .level(desktop_log_level())
                .max_file_size(LOG_MAX_FILE_SIZE_BYTES)
                .rotation_strategy(RotationStrategy::KeepSome(LOG_ARCHIVE_COUNT))
                .targets([Target::new(TargetKind::Stdout), log_target])
                .build(),
        )
        .plugin(tauri_plugin_http::init())
        .plugin(tauri_plugin_store::Builder::default().build())
        .invoke_handler(tauri::generate_handler![
            exit_app,
            desktop_diagnostics,
            desktop_settings_store_path,
            hermes_xai_status,
            hermes_xai_tts,
            vertex_gemini_status,
            vertex_gemini_tts,
            secure_store_get,
            secure_store_set,
            secure_store_delete
        ])
        .setup(|_app| {
            start_hermes_bridge();
            log::info!("SpeakRight desktop runtime initialized");
            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::time::{SystemTime, UNIX_EPOCH};

    fn unique_test_key(label: &str) -> String {
        let nanos = SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .expect("system clock is before unix epoch")
            .as_nanos();
        format!("speakright-test-{label}-{nanos}")
    }

    #[test]
    fn secure_store_rejects_blank_keys() {
        let result = secure_store_set("  ".to_string(), "secret".to_string());

        assert!(result.is_err());
        assert_eq!(
            result.expect_err("blank secure store key should fail"),
            "secure store key must not be empty"
        );
    }

    #[test]
    fn hermes_bridge_accepts_only_supported_languages_and_speeds() {
        assert_eq!(normalize_hermes_language(Some("en-US")).unwrap(), "en");
        assert_eq!(normalize_hermes_language(Some("es-ES")).unwrap(), "es-ES");
        assert_eq!(normalize_hermes_language(Some("fr-FR")).unwrap(), "fr");
        assert_eq!(normalize_hermes_language(Some("ru-RU")).unwrap(), "ru");
        assert!(normalize_hermes_language(Some("ja-JP")).is_err());
        assert_eq!(normalize_hermes_speed(Some(0.7)).unwrap(), 0.7);
        assert_eq!(normalize_hermes_speed(Some(1.5)).unwrap(), 1.5);
        assert!(normalize_hermes_speed(Some(0.69)).is_err());
        assert!(normalize_hermes_speed(Some(f64::NAN)).is_err());
    }

    #[test]
    fn hermes_bridge_rejects_blank_and_oversized_text() {
        assert!(validate_hermes_text("  ").is_err());
        assert_eq!(validate_hermes_text("  hello  ").unwrap(), "hello");
        assert!(validate_hermes_text(&"x".repeat(HERMES_TTS_MAX_CHARS + 1)).is_err());
    }

    #[test]
    fn hermes_bridge_allows_only_loopback_hosts_and_origins() {
        assert!(allowed_bridge_host(Some("127.0.0.1:17831")));
        assert!(allowed_bridge_host(Some("localhost:17831")));
        assert!(!allowed_bridge_host(Some("localhost:3000")));
        assert!(!allowed_bridge_host(Some("example.com:17831")));

        assert!(allowed_bridge_origin("http://localhost:3000"));
        assert!(allowed_bridge_origin("http://localhost:3002"));
        assert!(allowed_bridge_origin("http://127.0.0.1:4173"));
        assert!(allowed_bridge_origin("http://127.0.0.1:4192"));
        assert!(!allowed_bridge_origin("http://localhost:4172"));
        assert!(!allowed_bridge_origin("http://localhost:4193"));
        assert!(!allowed_bridge_origin("https://localhost:4173"));
        assert!(!allowed_bridge_origin("http://localhost"));
        assert!(!allowed_bridge_origin("http://localhost:03000"));
        assert!(!allowed_bridge_origin("http://localhost:3000/path"));
        assert!(!allowed_bridge_origin("https://example.com"));
        assert!(!allowed_bridge_origin("http://localhost.evil.test:3000"));
        assert!(!allowed_bridge_origin("null"));
    }

    #[test]
    fn hermes_bridge_rate_limiter_caps_requests_in_the_window() {
        let limiter = HermesBridgeRateLimiter::new();
        for _ in 0..HERMES_BRIDGE_RATE_LIMIT {
            assert!(limiter.allow());
        }
        assert!(!limiter.allow());
    }

    #[test]
    fn hermes_bridge_session_tokens_are_random_and_checked() {
        let first = generate_bridge_session_token().unwrap();
        let second = generate_bridge_session_token().unwrap();
        assert_ne!(first, second);
        assert!(first.len() >= 43);
        assert!(bridge_token_matches(Some(&first), &first));
        assert!(!bridge_token_matches(Some(&second), &first));
        assert!(!bridge_token_matches(None, &first));
    }

    #[test]
    fn hermes_bridge_limits_concurrent_tts_workers() {
        let state = HermesBridgeState::new("test-session".to_string());
        let first = state.try_acquire_tts().unwrap();
        let second = state.try_acquire_tts().unwrap();
        assert!(state.try_acquire_tts().is_none());
        drop(first);
        assert!(state.try_acquire_tts().is_some());
        drop(second);
    }

    #[test]
    fn vertex_bridge_accepts_supported_languages_speeds_and_voices() {
        assert_eq!(normalize_vertex_language(Some("en-US")).unwrap(), "en-us");
        assert_eq!(normalize_vertex_language(Some("es-ES")).unwrap(), "es-es");
        assert_eq!(normalize_vertex_language(Some("fr-FR")).unwrap(), "fr-fr");
        assert_eq!(normalize_vertex_language(Some("ru-RU")).unwrap(), "ru-ru");
        assert!(normalize_vertex_language(Some("ja-JP")).is_err());
        assert_eq!(normalize_vertex_speed(Some(0.7)).unwrap(), 0.7);
        assert_eq!(normalize_vertex_speed(Some(1.5)).unwrap(), 1.5);
        assert!(normalize_vertex_speed(Some(0.69)).is_err());
        assert_eq!(normalize_vertex_voice(None).unwrap(), "Kore");
        assert_eq!(normalize_vertex_voice(Some("charon")).unwrap(), "Charon");
        assert_eq!(normalize_vertex_voice(Some("Aoede")).unwrap(), "Aoede");
        assert!(normalize_vertex_voice(Some("unknown")).is_err());
    }

    #[test]
    fn vertex_bridge_rejects_invalid_text_and_project_values() {
        assert!(validate_vertex_text("  ").is_err());
        assert_eq!(validate_vertex_text("  hello  ").unwrap(), "hello");
        assert!(validate_vertex_text(&"x".repeat(VERTEX_TTS_MAX_CHARS + 1)).is_err());
        assert_eq!(
            validate_vertex_project("speakright-demo-123").unwrap(),
            "speakright-demo-123"
        );
        assert!(validate_vertex_project("(unset)").is_err());
        assert!(validate_vertex_project("project/with/path").is_err());
    }

    #[test]
    fn vertex_pcm_response_is_wrapped_in_a_valid_wav_header() {
        let pcm = [0_u8, 0, 1, 0, 255, 255, 2, 0];
        let encoded = BASE64_STANDARD.encode(pcm);
        let response = json!({
            "candidates": [{
                "content": {
                    "parts": [{
                        "inlineData": {
                            "mimeType": "audio/L16;rate=24000",
                            "data": encoded
                        }
                    }]
                }
            }]
        });

        let wav = decode_vertex_audio_response(response.to_string().as_bytes()).unwrap();

        assert_eq!(&wav[0..4], b"RIFF");
        assert_eq!(&wav[8..12], b"WAVE");
        assert_eq!(u32::from_le_bytes(wav[24..28].try_into().unwrap()), 24_000);
        assert_eq!(u16::from_le_bytes(wav[34..36].try_into().unwrap()), 16);
        assert_eq!(&wav[44..], &pcm);
    }

    #[test]
    fn vertex_response_rejects_non_audio_parts() {
        let response = json!({
            "candidates": [{
                "content": {
                    "parts": [{
                        "inlineData": {
                            "mimeType": "text/plain",
                            "data": BASE64_STANDARD.encode([0_u8, 0])
                        }
                    }]
                }
            }]
        });

        assert!(decode_vertex_audio_response(response.to_string().as_bytes()).is_err());
    }

    #[test]
    fn secure_store_rejects_unregistered_keys() {
        let result = secure_store_set("speakright_unregistered".to_string(), "secret".to_string());

        assert!(result.is_err());
        assert_eq!(
            result.expect_err("unregistered secure store key should fail"),
            "secure store key is not allowed"
        );
    }

    #[test]
    fn secure_store_allows_only_registered_app_keys() {
        for key in ALLOWED_SECURE_STORE_KEYS {
            assert!(validate_secure_store_key(key).is_ok());
        }
        assert!(validate_secure_store_key("speakright_azure_config_extra").is_err());
    }

    #[test]
    fn secure_store_namespace_override_is_strictly_scoped() {
        assert!(validate_secure_store_service(DEFAULT_SECURE_STORE_SERVICE).is_ok());
        assert!(validate_secure_store_service("com.speakright.desktop.ui-smoke").is_ok());
        assert!(validate_secure_store_service("com.speakright.desktop.release-evidence-1").is_ok());
        for invalid in [
            "",
            "com.speakright.desktop.",
            "com.speakright.desktop/escape",
            "com.speakright.desktop.ui_smoke",
            "com.other.application",
        ] {
            assert!(
                validate_secure_store_service(invalid).is_err(),
                "{invalid} must be rejected"
            );
        }
    }

    #[test]
    fn desktop_log_override_requires_an_existing_temp_child() {
        let test_root = env::temp_dir().join(format!(
            "speakright-log-override-test-{}",
            SystemTime::now()
                .duration_since(UNIX_EPOCH)
                .expect("system clock is before unix epoch")
                .as_nanos()
        ));
        let log_dir = test_root.join("logs");
        fs::create_dir_all(&log_dir).expect("create isolated log directory");
        let validated =
            validate_log_directory_override(&log_dir).expect("valid temp child log directory");
        assert_eq!(
            validated,
            fs::canonicalize(&log_dir).expect("canonical log directory")
        );
        assert!(validate_log_directory_override(Path::new("relative-logs")).is_err());
        assert!(validate_log_directory_override(&env::temp_dir()).is_err());
        assert!(validate_log_directory_override(&test_root.join("missing")).is_err());
        let current_dir = env::current_dir().expect("current directory");
        if !current_dir.starts_with(env::temp_dir()) {
            assert!(validate_log_directory_override(&current_dir).is_err());
        }
        fs::remove_dir_all(test_root).expect("remove isolated log directory");
    }

    #[test]
    fn desktop_settings_store_override_requires_a_named_file_in_a_temp_child() {
        let test_root = env::temp_dir().join(format!(
            "speakright-settings-store-test-{}",
            SystemTime::now()
                .duration_since(UNIX_EPOCH)
                .expect("system clock is before unix epoch")
                .as_nanos()
        ));
        let store_dir = test_root.join("settings");
        fs::create_dir_all(&store_dir).expect("create isolated settings directory");
        let store_path = store_dir.join(SETTINGS_STORE_FILE_NAME);
        let validated = validate_settings_store_path_override(&store_path)
            .expect("valid temp child settings store path");
        assert_eq!(
            validated,
            fs::canonicalize(&store_dir)
                .expect("canonical settings directory")
                .join(SETTINGS_STORE_FILE_NAME)
        );

        assert!(
            validate_settings_store_path_override(Path::new(SETTINGS_STORE_FILE_NAME)).is_err()
        );
        assert!(validate_settings_store_path_override(&store_dir.join("other.json")).is_err());
        assert!(validate_settings_store_path_override(
            &env::temp_dir().join(SETTINGS_STORE_FILE_NAME)
        )
        .is_err());
        assert!(validate_settings_store_path_override(
            &test_root.join("missing").join(SETTINGS_STORE_FILE_NAME)
        )
        .is_err());

        fs::write(&store_path, "{}\n").expect("create isolated settings store file");
        assert!(validate_settings_store_path_override(&store_path).is_ok());
        fs::remove_dir_all(test_root).expect("remove isolated settings directory");
    }

    #[test]
    fn secure_store_roundtrips_through_platform_keychain() {
        let key = unique_test_key("roundtrip");
        let value = r#"{"apiKey":"desktop-secret","region":"eastus"}"#.to_string();

        secure_store_delete(key.clone()).expect("pre-test cleanup should succeed");
        secure_store_set(key.clone(), value.clone()).expect("set should succeed");

        let stored = secure_store_get(key.clone()).expect("get should succeed");
        assert_eq!(stored, Some(value));

        secure_store_delete(key.clone()).expect("delete should succeed");
        let deleted = secure_store_get(key).expect("get after delete should succeed");
        assert_eq!(deleted, None);
    }

    #[test]
    fn log_tail_is_limited_and_preserves_recent_order() {
        let lines = (0..(LOG_TAIL_LINE_COUNT + 5))
            .map(|index| format!("line-{index}"))
            .collect::<Vec<_>>()
            .join("\n");
        let path = std::env::temp_dir().join(unique_test_key("diagnostics-log"));
        fs::write(&path, lines).expect("test log should be written");

        let (bytes, tail) = read_log_tail(&path).expect("tail should be read");

        assert!(bytes.unwrap_or_default() > 0);
        assert_eq!(tail.len(), LOG_TAIL_LINE_COUNT);
        assert_eq!(tail.first().map(String::as_str), Some("line-5"));
        assert_eq!(tail.last().map(String::as_str), Some("line-204"));

        fs::remove_file(path).expect("test log should be removed");
    }

    #[test]
    fn log_tail_truncates_long_lines() {
        let path = std::env::temp_dir().join(unique_test_key("long-diagnostics-log"));
        fs::write(&path, "x".repeat(LOG_TAIL_MAX_LINE_CHARS + 10))
            .expect("test log should be written");

        let (_, tail) = read_log_tail(&path).expect("tail should be read");

        assert_eq!(tail[0].chars().count(), LOG_TAIL_MAX_LINE_CHARS);

        fs::remove_file(path).expect("test log should be removed");
    }

    #[test]
    fn log_tail_redacts_json_secrets() {
        let path = std::env::temp_dir().join(unique_test_key("secret-json-diagnostics-log"));
        fs::write(
            &path,
            r#"failed request {"apiKey":"sk-live-secret","subscriptionKey":"azure-secret","safe":"visible"}"#,
        )
        .expect("test log should be written");

        let (_, tail) = read_log_tail(&path).expect("tail should be read");

        assert!(!tail[0].contains("sk-live-secret"));
        assert!(!tail[0].contains("azure-secret"));
        assert!(tail[0].contains(r#""apiKey":"[REDACTED]""#));
        assert!(tail[0].contains(r#""subscriptionKey":"[REDACTED]""#));
        assert!(tail[0].contains(r#""safe":"visible""#));

        fs::remove_file(path).expect("test log should be removed");
    }

    #[test]
    fn log_tail_redacts_bearer_headers_and_query_keys() {
        let path = std::env::temp_dir().join(unique_test_key("secret-url-diagnostics-log"));
        fs::write(
            &path,
            "Authorization: Bearer anth-secret-token url=https://api.openai.com/v1/chat/completions?key=llm-secret&format=json",
        )
        .expect("test log should be written");

        let (_, tail) = read_log_tail(&path).expect("tail should be read");

        assert!(!tail[0].contains("anth-secret-token"));
        assert!(!tail[0].contains("mw-secret"));
        assert!(tail[0].contains("Bearer [REDACTED]"));
        assert!(tail[0].contains("?key=[REDACTED]"));
        assert!(tail[0].contains("format=json"));

        fs::remove_file(path).expect("test log should be removed");
    }
}
