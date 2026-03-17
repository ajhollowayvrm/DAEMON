use std::process::Stdio;
use tauri::Emitter;
use tokio::io::{AsyncBufReadExt, BufReader};

#[derive(Clone, serde::Serialize)]
struct AgentOutput {
    task_id: String,
    line: String,
    done: bool,
}

#[tauri::command]
pub async fn run_agent_command(
    app: tauri::AppHandle,
    task_id: String,
    command: String,
    args: String,
) -> Result<(), String> {
    let prompt = if args.trim().is_empty() {
        command.clone()
    } else {
        format!("{} {}", command, args)
    };

    let mut child = tokio::process::Command::new("/Users/ajholloway/.local/bin/claude")
        .arg("--print")
        .arg(&prompt)
        .stdout(Stdio::piped())
        .stderr(Stdio::piped())
        .spawn()
        .map_err(|e| format!("Failed to spawn claude: {}", e))?;

    let stdout = child.stdout.take().ok_or("No stdout")?;
    let stderr = child.stderr.take().ok_or("No stderr")?;

    let app_clone = app.clone();
    let tid = task_id.clone();

    // Stream stdout
    let stdout_handle = tokio::spawn(async move {
        let reader = BufReader::new(stdout);
        let mut lines = reader.lines();
        while let Ok(Some(line)) = lines.next_line().await {
            let _ = app_clone.emit(
                "agent-output",
                AgentOutput {
                    task_id: tid.clone(),
                    line,
                    done: false,
                },
            );
        }
    });

    let app_clone2 = app.clone();
    let tid2 = task_id.clone();

    // Stream stderr
    let stderr_handle = tokio::spawn(async move {
        let reader = BufReader::new(stderr);
        let mut lines = reader.lines();
        while let Ok(Some(line)) = lines.next_line().await {
            let _ = app_clone2.emit(
                "agent-output",
                AgentOutput {
                    task_id: tid2.clone(),
                    line: format!("[stderr] {}", line),
                    done: false,
                },
            );
        }
    });

    // Wait for completion
    let _ = stdout_handle.await;
    let _ = stderr_handle.await;
    let status = child.wait().await.map_err(|e| e.to_string())?;

    let _ = app.emit(
        "agent-output",
        AgentOutput {
            task_id: task_id.clone(),
            line: if status.success() {
                "✓ Command completed".to_string()
            } else {
                format!("✗ Exited with code {}", status.code().unwrap_or(-1))
            },
            done: true,
        },
    );

    Ok(())
}
