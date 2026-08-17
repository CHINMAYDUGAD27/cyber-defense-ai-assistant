def analyze_brute_force(log_text: str) -> dict:
    lines = log_text.strip().split("\n")
    failed_attempts = [line for line in lines if "failed" in line.lower() and "login" in line.lower()]

    count = len(failed_attempts)

    if count == 0:
        return {
            "detected": False,
            "attack_type": None,
            "risk": "Low",
            "reason": "No failed login patterns found.",
            "recommendations": []
        }

    if count >= 50:
        risk = "Critical"
    elif count >= 20:
        risk = "High"
    elif count >= 5:
        risk = "Medium"
    else:
        risk = "Low"

    return {
        "detected": True,
        "attack_type": "Brute Force",
        "mitre_tactic": "T1110 - Brute Force",
        "risk": risk,
        "reason": f"Detected {count} failed login attempts in the provided log.",
        "recommendations": [
            "Block the source IP address.",
            "Enable Multi-Factor Authentication (MFA).",
            "Temporarily lock the affected account.",
            "Review authentication logs for related activity."
        ]
    }