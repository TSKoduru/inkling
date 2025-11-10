#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]
use std::{process::Command, thread, time::Duration, fs, path::PathBuf, sync::Mutex};
use tauri::Manager;

#[cfg(target_os = "windows")]
use std::os::windows::process::CommandExt;

// Track if backend is already running
static BACKEND_STARTED: Mutex<bool> = Mutex::new(false);

fn get_port_file_path(app_handle: &tauri::AppHandle) -> Result<PathBuf, String> {
    let data_dir = match app_handle.path().app_data_dir() {
        Ok(dir) => dir,
        Err(e) => return Err(format!("Could not find app data directory: {}", e)),
    };

    if !data_dir.exists() {
        fs::create_dir_all(&data_dir)
            .map_err(|e| format!("Failed to create data directory: {}", e))?;
    }

    Ok(data_dir.join("backend_port.txt"))
}

#[tauri::command]
fn start_backend(app_handle: tauri::AppHandle) -> Result<(), String> {
    // Only start backend once
    {
        let mut started = BACKEND_STARTED.lock().unwrap();
        if *started {
            return Ok(());
        }
        *started = true;
    }

    let port_file_path = get_port_file_path(&app_handle)?;
    let port_file_path_str = port_file_path.to_string_lossy().to_string();

    // Delete old port file to force fresh backend start
    let _ = fs::remove_file(&port_file_path);

    // Get Python executable path
    let resource_dir = app_handle.path().resource_dir()
        .map_err(|e| format!("Failed to find resource directory: {}", e))?;
    
    let python_exe = if cfg!(debug_assertions) {
        // Dev: use source directory
        let cargo_manifest_dir = std::env::var("CARGO_MANIFEST_DIR")
            .map_err(|e| format!("Failed to get CARGO_MANIFEST_DIR: {}", e))?;
        PathBuf::from(cargo_manifest_dir).join("resources").join("python").join("python.exe")
    } else {
        // Production: use bundled resources
        resource_dir.join("python").join("python.exe")
    };

    if !python_exe.exists() {
        eprintln!("❌ Python not found at: {:?}", python_exe);
        eprintln!("   Resource dir: {:?}", resource_dir);
        eprintln!("   Debug mode: {}", cfg!(debug_assertions));
        
        // List what's in resource_dir
        if let Ok(entries) = fs::read_dir(&resource_dir) {
            eprintln!("   Files in resource_dir:");
            for entry in entries.flatten() {
                eprintln!("     - {:?}", entry.path());
            }
        }
        
        return Err(format!(
            "Embedded Python not found at {:?}. \
            Make sure frontend/src-tauri/resources/python/python.exe exists.",
            python_exe
        ));
    }

    // Find the Python script - look in app data dir first, then try relative paths
    let backend_script = if cfg!(debug_assertions) {
        // Dev: look relative to current working directory
        let cwd = std::env::current_dir()
            .unwrap_or_else(|_| PathBuf::from("."));
        
        // Try: backend/app/main.py (run from project root)
        let mut path = cwd.join("backend").join("app").join("main.py");
        if !path.exists() {
            // Try: ../../../backend/app/main.py (run from frontend/src-tauri)
            path = cwd.join("..").join("..").join("backend").join("app").join("main.py");
        }
        if !path.exists() {
            // Try: ../../backend/app/main.py
            path = cwd.join("..").join("backend").join("app").join("main.py");
        }
        path
    } else {
        // Production - check _up_/_up_/backend (Tauri updater directory)
        let data_dir = app_handle.path().app_data_dir()
            .unwrap_or_else(|_| PathBuf::from("."));
        let mut path = data_dir.join("_up_").join("_up_").join("backend").join("app").join("main.py");
        
        // Fallback to same directory as exe
        if !path.exists() {
            let exe_dir = std::env::current_exe()
                .ok()
                .and_then(|p| p.parent().map(|p| p.to_path_buf()))
                .unwrap_or_else(|| PathBuf::from("."));
            path = exe_dir.join("backend").join("app").join("main.py");
        }
        
        path
    };

    let python_script_path = backend_script;

    if !python_script_path.exists() {
        eprintln!("❌ Backend script not found!");
        eprintln!("   Tried: {:?}", python_script_path);
        eprintln!("   Resource dir: {:?}", resource_dir);
        eprintln!("   CWD: {:?}", std::env::current_dir().unwrap_or_else(|_| PathBuf::from(".")));
        eprintln!("   Debug mode: {}", cfg!(debug_assertions));
        
        // List what's actually in resource_dir
        if let Ok(entries) = fs::read_dir(&resource_dir) {
            eprintln!("   Contents of resource_dir:");
            for entry in entries.flatten() {
                eprintln!("     - {:?}", entry.file_name());
            }
        }
        
        return Err(format!(
            "Python script not found at: {:?}",
            python_script_path
        ));
    }

    // Get the project root (parent of backend/)
    let project_root = python_script_path.parent()
        .and_then(|p| p.parent())
        .and_then(|p| p.parent())
        .ok_or("Could not determine project root")?;

    // Canonicalize the project root path
    let project_root_str = project_root.canonicalize()
        .map_err(|e| format!("Failed to canonicalize project root: {}", e))?
        .to_string_lossy()
        .to_string();

    // Spawn the backend process
    println!("🐍 Starting Python backend:");
    println!("  Python: {:?}", python_exe);
    println!("  Script: {:?}", python_script_path);
    println!("  Port file: {}", port_file_path_str);
    println!("  CWD: {}", project_root_str);
    println!("  PYTHONPATH: {}", project_root_str);
    
    let mut cmd = Command::new(&python_exe);
    cmd.arg(&python_script_path)
        .arg(&port_file_path_str)
        .current_dir(&project_root)
        .env("PYTHONPATH", &project_root_str)
        .env("PYTHONIOENCODING", "utf-8")
        .stdout(std::process::Stdio::null())
        .stderr(std::process::Stdio::null());
    
    #[cfg(target_os = "windows")]
    {
        // DETACHED_PROCESS (0x00000200) + CREATE_NO_WINDOW (0x00000008)
        cmd.creation_flags(0x00000200 | 0x00000008);
    }
    
    let _child = cmd.spawn()
        .map_err(|e| {
            eprintln!("❌ Failed to spawn: {}", e);
            format!("Failed to start backend: {}", e)
        })?;
    
    println!("✅ Backend process spawned, waiting for port file...");

    // Wait for the port file to appear
    for _ in 0..150 { // 30 seconds total
        if fs::metadata(&port_file_path).is_ok() {
            thread::sleep(Duration::from_millis(100));
            return Ok(());
        }
        thread::sleep(Duration::from_millis(200));
    }

    Err(format!(
        "Timeout waiting for backend to start after 30 seconds. Check that all Python dependencies are installed."
    ))
}

#[tauri::command]
fn get_backend_port(app_handle: tauri::AppHandle) -> Result<u16, String> {
    let port_file_path = get_port_file_path(&app_handle)?;
    
    let port_str = fs::read_to_string(&port_file_path)
        .map_err(|e| format!("Failed to read port file at {:?}: {}", port_file_path, e))?;
    
    port_str.trim().parse::<u16>()
        .map_err(|e| format!("Invalid port format in file: {}", e))
}

#[tauri::command]
fn cleanup_backend() -> Result<(), String> {
    // Kill any python processes
    #[cfg(target_os = "windows")]
    {
        let _ = Command::new("taskkill")
            .args(&["/IM", "python.exe", "/F"])
            .output();
    }
    
    #[cfg(target_os = "linux")]
    {
        let _ = Command::new("pkill")
            .args(&["-f", "python.*main.py"])
            .output();
    }
    
    #[cfg(target_os = "macos")]
    {
        let _ = Command::new("pkill")
            .args(&["-f", "python.*main.py"])
            .output();
    }
    
    Ok(())
}

fn main() {
    tauri::Builder::default()
        .invoke_handler(tauri::generate_handler![start_backend, get_backend_port, cleanup_backend])
        .on_window_event(|_window, event| {
            if let tauri::WindowEvent::CloseRequested { .. } = event {
                // Cleanup backend when window closes
                let _ = cleanup_backend();
            }
        })
        .run(tauri::generate_context!())
        .expect("error while running Inkling Tauri app");
}