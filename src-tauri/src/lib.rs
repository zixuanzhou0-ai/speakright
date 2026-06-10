use keyring::{Entry, Error as KeyringError};
use log::LevelFilter;
use serde::Serialize;
use std::fs;
use std::path::Path;
use tauri::{AppHandle, Manager};
use tauri_plugin_log::{RotationStrategy, Target, TargetKind};

const SECURE_STORE_SERVICE: &str = "com.speakright.desktop";
const LOG_FILE_NAME: &str = "speakright";
const LOG_MAX_FILE_SIZE_BYTES: u128 = 1_000_000;
const LOG_ARCHIVE_COUNT: usize = 5;
const LOG_TAIL_LINE_COUNT: usize = 200;
const LOG_TAIL_MAX_LINE_CHARS: usize = 500;
const ALLOWED_SECURE_STORE_KEYS: [&str; 3] = [
    "speakright_azure_config",
    "speakright_elevenlabs_config",
    "speakright_llm_config",
];

#[derive(Serialize)]
struct DesktopDiagnosticsLog {
    path: Option<String>,
    bytes: Option<u64>,
    tail: Vec<String>,
    error: Option<String>,
}

#[derive(Serialize)]
struct DesktopDiagnostics {
    app_identifier: &'static str,
    log: DesktopDiagnosticsLog,
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

fn secure_entry(key: &str) -> Result<Entry, String> {
    validate_secure_store_key(key)?;
    Entry::new(SECURE_STORE_SERVICE, key).map_err(|error| {
        let message = error.to_string();
        log::warn!("secure credential store entry could not be opened: {message}");
        message
    })
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
fn desktop_diagnostics(app: AppHandle) -> DesktopDiagnostics {
    match app.path().app_log_dir() {
        Ok(log_dir) => {
            let log_path = log_dir.join(format!("{LOG_FILE_NAME}.log"));
            match read_log_tail(&log_path) {
                Ok((bytes, tail)) => DesktopDiagnostics {
                    app_identifier: SECURE_STORE_SERVICE,
                    log: DesktopDiagnosticsLog {
                        path: Some(log_path.display().to_string()),
                        bytes,
                        tail,
                        error: None,
                    },
                },
                Err(error) => DesktopDiagnostics {
                    app_identifier: SECURE_STORE_SERVICE,
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
            app_identifier: SECURE_STORE_SERVICE,
            log: DesktopDiagnosticsLog {
                path: None,
                bytes: None,
                tail: Vec::new(),
                error: Some(error.to_string()),
            },
        },
    }
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .plugin(
            tauri_plugin_log::Builder::new()
                .level(desktop_log_level())
                .max_file_size(LOG_MAX_FILE_SIZE_BYTES)
                .rotation_strategy(RotationStrategy::KeepSome(LOG_ARCHIVE_COUNT))
                .targets([
                    Target::new(TargetKind::Stdout),
                    Target::new(TargetKind::LogDir {
                        file_name: Some(LOG_FILE_NAME.into()),
                    }),
                ])
                .build(),
        )
        .plugin(tauri_plugin_http::init())
        .plugin(tauri_plugin_store::Builder::default().build())
        .invoke_handler(tauri::generate_handler![
            desktop_diagnostics,
            secure_store_get,
            secure_store_set,
            secure_store_delete
        ])
        .setup(|_app| {
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
