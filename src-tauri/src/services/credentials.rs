use std::collections::HashMap;
use std::fs;
use std::path::PathBuf;

fn config_path() -> PathBuf {
    let home = std::env::var("HOME").unwrap_or_else(|_| ".".into());
    let dir = PathBuf::from(home).join(".config").join("neondash");
    let _ = fs::create_dir_all(&dir);
    dir.join("credentials.json")
}

fn read_store() -> HashMap<String, String> {
    let path = config_path();
    match fs::read_to_string(&path) {
        Ok(data) => serde_json::from_str(&data).unwrap_or_default(),
        Err(_) => HashMap::new(),
    }
}

fn write_store(store: &HashMap<String, String>) -> Result<(), String> {
    let path = config_path();
    let data = serde_json::to_string_pretty(store).map_err(|e| e.to_string())?;
    fs::write(path, data).map_err(|e| e.to_string())
}

pub fn store_credential(key: &str, value: &str) -> Result<(), String> {
    let mut store = read_store();
    store.insert(key.to_string(), value.to_string());
    write_store(&store)
}

pub fn get_credential(key: &str) -> Result<Option<String>, String> {
    let store = read_store();
    Ok(store.get(key).cloned())
}
