#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

use std::process::{Child, Command};
use std::sync::Mutex;
use tauri::Manager;

struct ServerProcess(Mutex<Option<Child>>);

/// 定位 sidecar 的路径
fn sidecar_path() -> Option<String> {
    // 常规路径：与 examgen.exe 同目录下的 sidecar/examgen-server.exe
    let paths = vec![
        "sidecar/examgen-server.exe",
        "../sidecar/examgen-server.exe",
        "examgen-server.exe",
    ];

    let exe_dir = std::env::current_exe()
        .ok()
        .and_then(|p| p.parent().map(|p| p.to_path_buf()));

    if let Some(ref dir) = exe_dir {
        for p in &paths {
            let full = dir.join(p);
            if full.exists() {
                return Some(full.to_string_lossy().to_string());
            }
        }
    }

    None
}

/// 启动 FastAPI sidecar
fn start_server() -> Option<Child> {
    if cfg!(debug_assertions) {
        // 开发模式：直接调 python
        Command::new("python")
            .args([
                "-m",
                "uvicorn",
                "examgen.web.app:app",
                "--host",
                "127.0.0.1",
                "--port",
                "8765",
            ])
            .spawn()
            .ok()
    } else if let Some(path) = sidecar_path() {
        Command::new(&path).spawn().ok()
    } else {
        eprintln!("[ExamGen] sidecar not found - trying python fallback");
        Command::new("python")
            .args([
                "-m",
                "uvicorn",
                "examgen.web.app:app",
                "--host",
                "127.0.0.1",
                "--port",
                "8765",
            ])
            .spawn()
            .ok()
    }
}

#[tauri::command]
fn get_server_url() -> String {
    "http://127.0.0.1:8765".to_string()
}

fn main() {
    let child = start_server();
    // 等待 FastAPI 启动
    std::thread::sleep(std::time::Duration::from_millis(2500));

    tauri::Builder::default()
        .plugin(tauri_plugin_shell::init())
        .manage(ServerProcess(Mutex::new(child)))
        .invoke_handler(tauri::generate_handler![get_server_url])
        .on_window_event(|_window, event| {
            if let tauri::WindowEvent::Destroyed = event {
                std::process::exit(0);
            }
        })
        .run(tauri::generate_context!())
        .expect("error while running ExamGen");
}
