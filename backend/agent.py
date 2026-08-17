import os
import sys
import time
import json
import urllib.request
import platform
import subprocess
from datetime import datetime, timedelta

# ==========================================
# CONFIGURATION - Edit before running!
# ==========================================
API_URL = "https://cyber-defense-ai-assistant.onrender.com/watcher/ingest"
BEARER_TOKEN = "YOUR_TOKEN_HERE"

def send_to_dashboard(line: str):
    if not line or not line.strip():
        return
    data = json.dumps({"line": line.strip()}).encode("utf-8")
    req = urllib.request.Request(API_URL, data=data, headers={
        "Content-Type": "application/json",
        "Authorization": f"Bearer {BEARER_TOKEN}"
    })
    try:
        urllib.request.urlopen(req, timeout=5)
        print(f"[SENT] {line.strip()[:80]}")
    except Exception as e:
        print(f"[ERROR] Failed to send: {e}")

def watch_windows():
    print("[Agent] Starting Windows Event Monitor...")
    ps_script = r"""
param([string]$Since)
$sinceDate = [datetime]::Parse($Since)
$events = @()
foreach ($log in @('Security','System')) {
    try {
        $raw = Get-WinEvent -FilterHashtable @{LogName=$log; StartTime=$sinceDate} -ErrorAction SilentlyContinue
        if ($raw) { $events += $raw }
    } catch {}
}
$events | Sort-Object TimeCreated | ForEach-Object {
    $e = $_
    $msg = ($e.Message -replace "
"," " -replace ""," ")
    $short = if ($msg.Length -gt 200) { $msg.Substring(0,200) } else { $msg }
    $line = switch ($e.Id) {
        4625 { "WARN  Failed login attempt -- $short" }
        4624 { "INFO  Successful login -- $short" }
        4648 { "WARN  Login using explicit credentials -- $short" }
        4740 { "ALERT Account locked out -- $short" }
        4720 { "WARN  New user account created -- $short" }
        7045 { "ALERT New Windows service installed -- $short" }
        4698 { "ALERT Scheduled task created -- $short" }
        1102 { "ALERT Security audit log was cleared -- $short" }
        4688 { "INFO  New process created -- $short" }
        4697 { "ALERT Service installed in system -- $short" }
        default { $null }
    }
    if ($line) { $line }
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
            print(f"[Windows Monitor Error] {e}")
            last_read_time = datetime.now()
        time.sleep(5)

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

def main():
    print("=" * 45)
    print("  AI Cyber Defense - Lightweight Agent")
    print("=" * 45)
    if BEARER_TOKEN == "YOUR_TOKEN_HERE":
        print("[FATAL] Set your BEARER_TOKEN in agent.py first!")
        sys.exit(1)
    os_name = platform.system()
    print(f"Detected OS: {os_name}")
    if os_name == "Windows":
        watch_windows()
    elif os_name == "Linux":
        log_path = "/var/log/auth.log" if os.path.exists("/var/log/auth.log") else "/var/log/secure"
        watch_linux_mac(log_path)
    elif os_name == "Darwin":
        watch_linux_mac("/var/log/system.log")
    else:
        print(f"Unsupported OS: {os_name}")
        sys.exit(1)

if __name__ == "__main__":
    main()
