import os
import sys
import time
import json
import shutil
import urllib.request
import platform
import subprocess
from datetime import datetime, timedelta

# ==========================================
# CONFIGURATION - Edit before running!
# ==========================================
API_URL = "https://cyber-defense-ai-assistant.onrender.com/watcher/ingest"
BEARER_TOKEN = "YOUR_TOKEN_HERE"

# ==========================================
# INSTALL SETTINGS (do not change)
# ==========================================
INSTALL_DIR  = r"C:\ProgramData\CyberDefenseAgent"
INSTALL_FILE = os.path.join(INSTALL_DIR, "agent.py")
TASK_NAME    = "CyberDefenseAgent"
PYTHON_EXE   = sys.executable  # path to whichever python is running this

# ─────────────────────────────────────────
# SEND LOG LINE TO DASHBOARD
# ─────────────────────────────────────────
def send_to_dashboard(line: str):
    if not line or not line.strip():
        return
    data = json.dumps({"line": line.strip()}).encode("utf-8")
    req = urllib.request.Request(API_URL, data=data, headers={
        "Content-Type": "application/json",
        "Authorization": f"Bearer {BEARER_TOKEN}"
    })
    try:
        urllib.request.urlopen(req, timeout=8)
        print(f"[SENT] {line.strip()[:80]}")
    except Exception as e:
        print(f"[ERROR] Failed to send: {e}")

# ─────────────────────────────────────────
# WINDOWS EVENT MONITOR
# ─────────────────────────────────────────
def watch_windows():
    print("[Agent] Windows Event Monitor running...")
    ps_script = r"""
param([string])
 = [datetime]::Parse()
 = @()
foreach ( in @('Security','System')) {
    try {
         = Get-WinEvent -FilterHashtable @{LogName=; StartTime=} -ErrorAction SilentlyContinue
        if () {  +=  }
    } catch {}
}
 | Sort-Object TimeCreated | ForEach-Object {
     = 
     = (.Message -replace "
"," " -replace ""," ")
     = if (.Length -gt 200) { .Substring(0,200) } else {  }
     = switch (.Id) {
        4625 { "WARN  Failed login attempt -- " }
        4624 { "INFO  Successful login -- " }
        4648 { "WARN  Login using explicit credentials -- " }
        4740 { "ALERT Account locked out -- " }
        4720 { "WARN  New user account created -- " }
        7045 { "ALERT New Windows service installed -- " }
        4698 { "ALERT Scheduled task created -- " }
        1102 { "ALERT Security audit log was cleared -- " }
        4688 { "INFO  New process created -- " }
        4697 { "ALERT Service installed in system -- " }
        default {  }
    }
    if () {  }
}
"""
    last_read_time = datetime.now() - timedelta(seconds=10)
    while True:
        since_str = last_read_time.strftime("%Y-%m-%dT%H:%M:%S")
        try:
            result = subprocess.run(
                ["powershell", "-NoProfile", "-NonInteractive", "-ExecutionPolicy", "Bypass",
                 "-Command", ps_script + f' -Since "{since_str}"'],
                capture_output=True, text=True, timeout=15
            )
            last_read_time = datetime.now()
            lines = [ln.strip() for ln in result.stdout.splitlines() if ln.strip()]
            if lines:
                print(f"[Windows] {len(lines)} new event(s)")
            for line in lines:
                send_to_dashboard(line)
        except Exception as e:
            print(f"[Monitor Error] {e}")
            last_read_time = datetime.now()
        time.sleep(5)

# ─────────────────────────────────────────
# LINUX/MAC MONITOR
# ─────────────────────────────────────────
def watch_linux_mac(log_file):
    print(f"[Agent] Tailing {log_file}...")
    if not os.path.exists(log_file):
        print(f"[ERROR] Log file {log_file} not found!")
        return
    try:
        with open(log_file, 'r', errors='ignore') as f:
            f.seek(0, 2)
            while True:
                line = f.readline()
                if not line:
                    time.sleep(1)
                    continue
                if "Failed password" in line or "authentication failure" in line:
                    send_to_dashboard(f"WARN  Failed login attempt -- {line.strip()}")
                elif "Accepted password" in line or "session opened" in line:
                    send_to_dashboard(f"INFO  Successful login -- {line.strip()}")
                elif "COMMAND=" in line:
                    send_to_dashboard(f"WARN  Sudo command executed -- {line.strip()}")
                elif any(w in line.lower() for w in ["error","warn","fail","attack"]):
                    send_to_dashboard(f"ALERT System Warning -- {line.strip()[:150]}")
    except PermissionError:
        print(f"[ERROR] Permission denied reading {log_file}. Run with sudo!")
        sys.exit(1)

# ─────────────────────────────────────────
# INSTALL AS WINDOWS AUTO-START SERVICE
# ─────────────────────────────────────────
def install():
    """Install agent as a Windows Task Scheduler task that runs at system startup."""
    if platform.system() != "Windows":
        print("[Install] Auto-install is only supported on Windows.")
        return

    print("=" * 50)
    print("  Installing CyberDefense Agent as a Service...")
    print("=" * 50)

    # 1. Create install directory
    os.makedirs(INSTALL_DIR, exist_ok=True)

    # 2. Copy this script to the install directory
    src = os.path.abspath(__file__)
    if src != INSTALL_FILE:
        shutil.copy2(src, INSTALL_FILE)
        print(f"[Install] Copied agent to {INSTALL_FILE}")
    else:
        print(f"[Install] Already running from install directory.")

    # 3. Create a .bat launcher that runs silently (no console window)
    bat_file = os.path.join(INSTALL_DIR, "run_agent.bat")
    bat_content = f'@echo off\n"{PYTHON_EXE}" "{INSTALL_FILE}" --monitor\n'
    with open(bat_file, "w") as f:
        f.write(bat_content)
    print(f"[Install] Created launcher: {bat_file}")

    # 4. Create a VBScript wrapper to run with NO visible console window
    vbs_file = os.path.join(INSTALL_DIR, "run_silent.vbs")
    vbs_content = f'CreateObject("WScript.Shell").Run "{bat_file}", 0, False\n'
    with open(vbs_file, "w") as f:
        f.write(vbs_content)

    # 5. Register with Task Scheduler (runs at system startup, for all users)
    cmd = [
        "schtasks", "/create",
        "/tn", TASK_NAME,
        "/tr", f'wscript.exe "{vbs_file}"',
        "/sc", "onstart",
        "/ru", "SYSTEM",
        "/rl", "HIGHEST",
        "/f"   # force overwrite if already exists
    ]
    result = subprocess.run(cmd, capture_output=True, text=True)
    if result.returncode == 0:
        print(f"\n[Install] SUCCESS! Task '{TASK_NAME}' registered.")
        print("[Install] The agent will now auto-start every time this computer turns on.")
        print("[Install] Starting now for the first time...")
        # Start immediately without waiting
        subprocess.Popen(["wscript.exe", vbs_file])
        print("[Install] Agent is now RUNNING in the background!")
        print("\nTo UNINSTALL later, run:  python agent.py --uninstall")
    else:
        print(f"[Install] ERROR: {result.stderr}")
        print("[Install] Try running as Administrator!")

# ─────────────────────────────────────────
# UNINSTALL
# ─────────────────────────────────────────
def uninstall():
    """Remove the auto-start task and installed files."""
    print("[Uninstall] Removing CyberDefense Agent...")
    subprocess.run(["schtasks", "/delete", "/tn", TASK_NAME, "/f"], capture_output=True)
    if os.path.exists(INSTALL_DIR):
        shutil.rmtree(INSTALL_DIR, ignore_errors=True)
    print("[Uninstall] Done. Agent removed successfully.")

# ─────────────────────────────────────────
# MAIN ENTRY POINT
# ─────────────────────────────────────────
def main():
    args = sys.argv[1:]

    if "--uninstall" in args:
        uninstall()
        return

    if "--monitor" in args:
        # Called by the Task Scheduler / background process - just monitor
        _run_monitor()
        return

    # Default: first run by user
    print("=" * 50)
    print("  AI Cyber Defense - Lightweight Agent")
    print("=" * 50)

    if BEARER_TOKEN == "YOUR_TOKEN_HERE":
        print("\n[FATAL] Open agent.py and set your BEARER_TOKEN first!")
        print("        You can copy it from Live Monitor → Connect Real Device")
        input("Press Enter to exit...")
        sys.exit(1)

    print("\nChoose an option:")
    print("  1 = Install as permanent background service (recommended)")
    print("  2 = Run just this once (stops when window closes)")
    choice = input("\nEnter 1 or 2: ").strip()

    if choice == "1":
        install()
    else:
        _run_monitor()

def _run_monitor():
    if BEARER_TOKEN == "YOUR_TOKEN_HERE":
        print("[FATAL] Set your BEARER_TOKEN in agent.py first!")
        sys.exit(1)

    os_name = platform.system()
    print(f"[Agent] OS detected: {os_name}")

    if os_name == "Windows":
        watch_windows()
    elif os_name == "Linux":
        log_path = "/var/log/auth.log" if os.path.exists("/var/log/auth.log") else "/var/log/secure"
        watch_linux_mac(log_path)
    elif os_name == "Darwin":
        watch_linux_mac("/var/log/system.log")
    else:
        print(f"[ERROR] Unsupported OS: {os_name}")
        sys.exit(1)

if __name__ == "__main__":
    main()
