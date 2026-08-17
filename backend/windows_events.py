"""
windows_events.py — Real Windows Event Log Reader
===================================================
Reads Windows Security & System events using a PowerShell subprocess.
Tracks the last read timestamp to avoid re-processing old events.
Returns formatted log lines compatible with our detector pipeline.
"""
import subprocess
from datetime import datetime, timedelta
from typing import List

_last_read_time: datetime = None

# PowerShell script: reads Security + System logs since $Since,
# formats each relevant event as a single human-readable line.
_PS_SCRIPT = r"""
param([string]$Since)
$sinceDate = [datetime]::Parse($Since)
$events = @()
foreach ($log in @('Security','System','Application')) {
    try {
        $raw = Get-WinEvent -FilterHashtable @{LogName=$log; StartTime=$sinceDate} `
               -ErrorAction SilentlyContinue
        if ($raw) { $events += $raw }
    } catch {}
}
$events | Sort-Object TimeCreated | ForEach-Object {
    $e = $_
    # Truncate message to 200 chars, strip newlines
    $msg = ($e.Message -replace "`n"," " -replace "`r"," ")
    $short = if ($msg.Length -gt 200) { $msg.Substring(0,200) } else { $msg }
    $line = switch ($e.Id) {
        4625 { "WARN  Failed login attempt — $short" }
        4624 { "INFO  Successful login — $short" }
        4648 { "WARN  Login using explicit credentials — $short" }
        4740 { "ALERT Account locked out — $short" }
        4720 { "WARN  New user account created — $short" }
        4726 { "WARN  User account deleted — $short" }
        4728 { "WARN  User added to privileged security group — $short" }
        4732 { "WARN  User added to local Administrators group — $short" }
        4756 { "WARN  User added to universal security group — $short" }
        7045 { "ALERT New Windows service installed — $short" }
        4698 { "ALERT Scheduled task created — $short" }
        4719 { "ALERT System audit policy changed — $short" }
        4688 { "INFO  New process created — $short" }
        4697 { "ALERT Service installed in system — $short" }
        1102 { "ALERT Security audit log was cleared — $short" }
        4616 { "WARN  System time changed — $short" }
        4657 { "WARN  Registry value modified — $short" }
        default { $null }
    }
    if ($line) { $line }
}
"""


def reset():
    """Call this when the watcher starts so we only tail from now."""
    global _last_read_time
    _last_read_time = None


def get_windows_events() -> List[str]:
    """
    Pull new Windows event log entries since the last call.
    Returns a list of formatted log strings ready for the detector pipeline.
    """
    global _last_read_time
    now = datetime.now()

    if _last_read_time is None:
        # First call — look back 15 s so we don't miss anything
        # that happened right as the watcher started.
        _last_read_time = now - timedelta(seconds=15)

    since_str = _last_read_time.strftime("%Y-%m-%dT%H:%M:%S")

    try:
        result = subprocess.run(
            [
                "powershell",
                "-NoProfile",
                "-NonInteractive",
                "-ExecutionPolicy", "Bypass",
                "-Command",
                _PS_SCRIPT + f' -Since "{since_str}"',
            ],
            capture_output=True,
            text=True,
            timeout=15,
            creationflags=0x08000000,  # CREATE_NO_WINDOW — no popup console
        )
        _last_read_time = now

        lines = [ln.strip() for ln in result.stdout.splitlines() if ln.strip()]
        if lines:
            print(f"[WindowsEvents] {len(lines)} new event(s) since {since_str}")
        else:
            print(f"[WindowsEvents] No new relevant events since {since_str}")

        if result.stderr.strip():
            print(f"[WindowsEvents] stderr: {result.stderr.strip()[:200]}")

        return lines

    except subprocess.TimeoutExpired:
        print("[WindowsEvents] PowerShell query timed out — skipping this cycle")
        _last_read_time = now
        return []
    except FileNotFoundError:
        print("[WindowsEvents] ERROR: PowerShell not found. Windows Events mode unavailable.")
        _last_read_time = now
        return []
    except Exception as exc:
        print(f"[WindowsEvents] Unexpected error: {exc}")
        _last_read_time = now
        return []
