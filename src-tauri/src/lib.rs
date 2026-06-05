use std::net::TcpStream;
use std::path::{Path, PathBuf};
use std::process::{Child, Command, Stdio};
use std::sync::Mutex;
use std::thread;
use std::time::Duration;
use tauri::{Manager, RunEvent};

const API_PORT: u16 = 8000;

struct ApiProcess(Mutex<Option<Child>>);

fn project_root() -> PathBuf {
    PathBuf::from(env!("CARGO_MANIFEST_DIR"))
        .parent()
        .expect("project root")
        .to_path_buf()
}

fn opal_config_dir() -> Option<String> {
    #[cfg(windows)]
    {
        std::env::var("APPDATA")
            .ok()
            .map(|appdata| format!("{}\\Opal", appdata))
    }
    #[cfg(target_os = "macos")]
    {
        std::env::var("HOME")
            .ok()
            .map(|home| format!("{}/Library/Application Support/Opal", home))
    }
    #[cfg(not(any(windows, target_os = "macos")))]
    {
        std::env::var("HOME")
            .ok()
            .map(|home| format!("{}/.config/opal", home))
    }
}

fn opal_python_from_file() -> Option<String> {
    let env_file = project_root().join("opal.env");
    let content = std::fs::read_to_string(&env_file).ok()?;
    for line in content.lines() {
        let line = line.trim();
        if line.is_empty() || line.starts_with('#') {
            continue;
        }
        let (key, value) = line.split_once('=')?;
        if key.trim() == "OPAL_PYTHON" {
            let value = value.trim().trim_matches('"');
            if !value.is_empty() {
                return Some(value.to_string());
            }
        }
    }
    None
}

fn load_opal_env() {
    if std::env::var("OPAL_PYTHON").is_ok() {
        return;
    }
    if let Some(python) = opal_python_from_file() {
        unsafe {
            std::env::set_var("OPAL_PYTHON", python);
        }
    }
}

fn configure_api_command(cmd: &mut Command, root: &Path) {
    cmd.current_dir(root)
        .env("OPAL_DESKTOP", "1")
        .stdout(Stdio::null())
        .stderr(Stdio::piped());

    if let Some(config_dir) = opal_config_dir() {
        cmd.env("OPAL_CONFIG_DIR", config_dir);
    }

    #[cfg(target_os = "macos")]
    {
        cmd.env("PYTORCH_ENABLE_MPS_FALLBACK", "1");
    }

    #[cfg(windows)]
    {
        use std::os::windows::process::CommandExt;
        const CREATE_NO_WINDOW: u32 = 0x08000000;
        cmd.creation_flags(CREATE_NO_WINDOW);
    }
}

fn windows_python_installs() -> Vec<PathBuf> {
    let mut paths = Vec::new();
    let Some(local_app_data) = std::env::var_os("LOCALAPPDATA") else {
        return paths;
    };

    let python_root = PathBuf::from(local_app_data)
        .join("Programs")
        .join("Python");

    if let Ok(entries) = std::fs::read_dir(&python_root) {
        for entry in entries.flatten() {
            let exe = entry.path().join("python.exe");
            if exe.is_file() {
                paths.push(exe);
            }
        }
    }

    paths.sort_by(|a, b| b.cmp(a));
    paths
}

fn spawn_with_exe(root: &Path, exe: &Path) -> Result<Child, String> {
    let mut cmd = Command::new(exe);
    cmd.args(["backend/run.py", "api"]);
    configure_api_command(&mut cmd, root);
    cmd.spawn()
        .map_err(|e| format!("{}: {e}", exe.display()))
}

fn spawn_with_py_launcher(root: &Path) -> Result<Child, String> {
    let mut cmd = Command::new("py");
    cmd.args(["-3", "backend/run.py", "api"]);
    configure_api_command(&mut cmd, root);
    cmd.spawn().map_err(|e| format!("py -3: {e}"))
}

fn spawn_api() -> Result<Child, String> {
    load_opal_env();
    let root = project_root();
    let mut errors = Vec::new();

    if let Ok(custom) = std::env::var("OPAL_PYTHON") {
        match spawn_with_exe(&root, Path::new(&custom)) {
            Ok(child) => return Ok(child),
            Err(err) => errors.push(format!("OPAL_PYTHON ({custom}): {err}")),
        }
    }

    #[cfg(windows)]
    {
        for exe in windows_python_installs() {
            match spawn_with_exe(&root, &exe) {
                Ok(child) => return Ok(child),
                Err(err) => errors.push(err),
            }
        }

        match spawn_with_py_launcher(&root) {
            Ok(child) => return Ok(child),
            Err(err) => errors.push(err),
        }
    }

    for name in ["python3", "python"] {
        match spawn_with_exe(&root, Path::new(name)) {
            Ok(child) => return Ok(child),
            Err(err) => errors.push(format!("{name}: {err}")),
        }
    }

    Err(format!(
        "Could not start Python API. Tried:\n{}\n\nInstall Python 3.11+ and dependencies (pip install -r backend/requirements.txt), or set OPAL_PYTHON to your python.exe path.",
        errors.join("\n")
    ))
}

fn wait_for_api(port: u16, max_wait_ms: u64) -> bool {
    let step_ms = 100;
    let attempts = max_wait_ms / step_ms;
    for _ in 0..attempts {
        if TcpStream::connect(format!("127.0.0.1:{port}")).is_ok() {
            return true;
        }
        thread::sleep(Duration::from_millis(step_ms));
    }
    false
}

fn stop_api(state: &ApiProcess) {
    if let Ok(mut guard) = state.0.lock() {
        if let Some(mut child) = guard.take() {
            let _ = child.kill();
            let _ = child.wait();
        }
    }
}

#[tauri::command]
fn reveal_in_file_manager(path: String) -> Result<(), String> {
    let path = Path::new(&path);
    if !path.exists() {
        return Err(format!("Path not found: {}", path.display()));
    }

    #[cfg(target_os = "windows")]
    {
        Command::new("explorer")
            .args(["/select,", &path.to_string_lossy()])
            .spawn()
            .map_err(|e| e.to_string())?;
    }

    #[cfg(target_os = "macos")]
    {
        Command::new("open")
            .args(["-R", &path.to_string_lossy()])
            .spawn()
            .map_err(|e| e.to_string())?;
    }

    #[cfg(not(any(target_os = "windows", target_os = "macos")))]
    {
        return Err("Reveal in file manager is not supported on this platform".to_string());
    }

    Ok(())
}

#[tauri::command]
fn copy_file(from: String, to: String) -> Result<(), String> {
    std::fs::copy(&from, &to).map_err(|e| e.to_string())?;
    Ok(())
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    let mut api_child = match spawn_api() {
        Ok(child) => child,
        Err(err) => {
            eprintln!("{err}");
            std::process::exit(1);
        }
    };

    if !wait_for_api(API_PORT, 45_000) {
        let _ = api_child.kill();
        eprintln!("Opal API did not start on port {API_PORT} within 45 seconds.");
        std::process::exit(1);
    }

    let api_state = ApiProcess(Mutex::new(Some(api_child)));

    tauri::Builder::default()
        .plugin(
            tauri_plugin_frame::FramePluginBuilder::new()
                .auto_titlebar(false)
                .snap_overlay(true)
                .titlebar_height(32)
                .build(),
        )
        .plugin(tauri_plugin_shell::init())
        .plugin(tauri_plugin_dialog::init())
        .manage(api_state)
        .invoke_handler(tauri::generate_handler![reveal_in_file_manager, copy_file])
        .build(tauri::generate_context!())
        .expect("failed to build Tauri application")
        .run(move |app_handle, event| {
            if let RunEvent::Exit = event {
                if let Some(state) = app_handle.try_state::<ApiProcess>() {
                    stop_api(&state);
                }
            }
        });
}
