use crate::error::AppError;

const SERVICE: &str = "dev.nandan.gitflow-studio";
const AI_API_KEY_ACCOUNT: &str = "ai-api-key";

fn entry() -> Result<keyring::Entry, AppError> {
    keyring::Entry::new(SERVICE, AI_API_KEY_ACCOUNT)
        .map_err(|e| AppError::Other(format!("Keychain unavailable: {e}")))
}

/// Reads the AI assistant's API key from the OS credential store (macOS
/// Keychain / Windows Credential Manager / Linux Secret Service). Runs on a
/// blocking thread since keychain access can block on native platform APIs.
#[tauri::command]
pub async fn cmd_get_ai_api_key() -> Result<Option<String>, AppError> {
    tauri::async_runtime::spawn_blocking(|| match entry()?.get_password() {
        Ok(password) => Ok(Some(password)),
        Err(keyring::Error::NoEntry) => Ok(None),
        Err(e) => Err(AppError::Other(format!("Keychain read failed: {e}"))),
    })
    .await
    .map_err(|e| AppError::Other(format!("Task failed: {e}")))?
}

/// Writes the AI assistant's API key to the OS credential store. An empty
/// key deletes the stored entry instead of writing an empty secret.
#[tauri::command]
pub async fn cmd_set_ai_api_key(key: String) -> Result<(), AppError> {
    tauri::async_runtime::spawn_blocking(move || {
        let entry = entry()?;
        if key.is_empty() {
            match entry.delete_credential() {
                Ok(()) | Err(keyring::Error::NoEntry) => Ok(()),
                Err(e) => Err(AppError::Other(format!("Keychain delete failed: {e}"))),
            }
        } else {
            entry
                .set_password(&key)
                .map_err(|e| AppError::Other(format!("Keychain write failed: {e}")))
        }
    })
    .await
    .map_err(|e| AppError::Other(format!("Task failed: {e}")))?
}
