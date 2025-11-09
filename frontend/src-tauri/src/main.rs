#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]
use std::{process::Command, thread, time::Duration, fs, path::PathBuf};
use tauri::Manager;

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
    let port_file_path = get_port_file_path(&app_handle)?;
    let port_file_path_str = port_file_path.to_string_lossy().to_string();

    // Delete old port file to force fresh backend start
    let _ = fs::remove_file(&port_file_path);

    // Find the Python script - different paths for dev vs production
    let python_script_path = if cfg!(debug_assertions) {
        // In development: from src-tauri, go ../../backend/app/main.py
        let cargo_manifest_dir = std::env::var("CARGO_MANIFEST_DIR")
            .map_err(|e| format!("Failed to get CARGO_MANIFEST_DIR: {}", e))?;
        let src_tauri_dir = PathBuf::from(cargo_manifest_dir);
        src_tauri_dir.join("..").join("..").join("backend").join("app").join("main.py")
    } else {
        // In production, use the bundled resources
        let resource_dir = match app_handle.path().resource_dir() {
            Ok(dir) => dir,
            Err(e) => return Err(format!("Failed to find bundled resource directory: {}", e)),
        };
        resource_dir.join("backend").join("app").join("main.py")
    };

    // Canonicalize the path to resolve .. components
    let python_script_path = python_script_path.canonicalize()
        .map_err(|e| format!("Failed to canonicalize path {:?}: {}", python_script_path, e))?;

    if !python_script_path.exists() {
        return Err(format!("Python script not found at: {:?}", python_script_path));
    }

    // Get the backend directory (parent of app/)
    let backend_dir = python_script_path.parent()
        .and_then(|p| p.parent())
        .ok_or("Could not determine backend directory")?;

    // Determine which Python to use
    let (python_cmd, python_desc) = if cfg!(debug_assertions) {
        // In development, try to use venv
        let venv_python = backend_dir.parent()
            .map(|p| p.join("venv").join("Scripts").join("python.exe"));
        
        if let Some(venv_py) = venv_python {
            if venv_py.exists() {
                (venv_py.to_string_lossy().to_string(), "venv python")
            } else {
                ("python".to_string(), "system python")
            }
        } else {
            ("python".to_string(), "system python")
        }
    } else {
        // In production, use bundled Python or system python
        ("python".to_string(), "system python")
    };

    #[cfg(debug_assertions)]
    {
        println!("=== Backend Startup Debug Info ===");
        println!("Python script path: {:?}", python_script_path);
        println!("Backend directory: {:?}", backend_dir);
        println!("Using Python: {} ({})", python_cmd, python_desc);
        println!("Port file path: {:?}", port_file_path);
        println!("==================================");
    }

    // Get the project root (parent of backend/)
    let project_root = backend_dir.parent()
        .ok_or("Could not determine project root")?;

    // Spawn the backend process
    let mut child = Command::new(&python_cmd)
        .arg(&python_script_path)
        .arg(&port_file_path_str)
        .current_dir(project_root)
        .env("PYTHONPATH", project_root)
        .spawn();

    // If the first attempt fails, try fallbacks
    if child.is_err() {
        #[cfg(debug_assertions)]
        println!("{} not found, trying fallbacks...", python_desc);
        
        // Try python3
        child = if cfg!(debug_assertions) {
            Command::new("python3")
                .arg(&python_script_path)
                .arg(&port_file_path_str)
                .current_dir(project_root)
                .env("PYTHONPATH", project_root)
                .stdout(std::process::Stdio::inherit())
                .stderr(std::process::Stdio::inherit())
                .spawn()
        } else {
            Command::new("python3")
                .arg(&python_script_path)
                .arg(&port_file_path_str)
                .current_dir(project_root)
                .env("PYTHONPATH", project_root)
                .spawn()
        };
        
        // If that fails, try python
        if child.is_err() {
            child = if cfg!(debug_assertions) {
                Command::new("python")
                    .arg(&python_script_path)
                    .arg(&port_file_path_str)
                    .current_dir(project_root)
                    .env("PYTHONPATH", project_root)
                    .stdout(std::process::Stdio::inherit())
                    .stderr(std::process::Stdio::inherit())
                    .spawn()
            } else {
                Command::new("python")
                    .arg(&python_script_path)
                    .arg(&port_file_path_str)
                    .current_dir(project_root)
                    .env("PYTHONPATH", project_root)
                    .spawn()
            };
        }
    }

    child.map_err(|e| {
        format!(
            "Failed to start backend: {}. \
            Ensure Python is in your PATH and the backend is bundled. \
            Script path: {:?}",
            e, python_script_path
        )
    })?;

    // Wait for the port file to appear (increased timeout for ML model loading)
    for i in 0..150 { // 30 seconds total (150 × 200ms)
        if i % 10 == 0 {
            #[cfg(debug_assertions)]
            println!("Waiting for backend to write port file... (attempt {}/150)", i + 1);
        }
        
        if fs::metadata(&port_file_path).is_ok() {
            #[cfg(debug_assertions)]
            println!("✅ Backend port file found!");
            
            // Give it a moment to write the port
            thread::sleep(Duration::from_millis(100));
            return Ok(());
        }
        thread::sleep(Duration::from_millis(200));
    }

    Err(format!(
        "Timeout waiting for backend to start after 30 seconds. Expected file at: {}",
        port_file_path_str
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

fn main() {
    tauri::Builder::default()
        .invoke_handler(tauri::generate_handler![start_backend, get_backend_port])
        .setup(|_app| {
            #[cfg(debug_assertions)]
            println!("Inkling app started in debug mode");
            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("error while running Inkling Tauri app");
}