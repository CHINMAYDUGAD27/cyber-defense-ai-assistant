PHISHING_KEYWORDS = [
    "verify your account", "click here immediately", "suspended",
    "confirm your password", "urgent action required", "won a prize",
    "update your billing", "unusual activity detected", "limited time",
    "your account will be closed"
]

SUSPICIOUS_DOMAINS_HINTS = ["bit.ly", "tinyurl", ".ru", ".xyz", "secure-", "-verify"]

def analyze_phishing(text: str) -> dict:
    lower_text = text.lower()

    keyword_hits = [kw for kw in PHISHING_KEYWORDS if kw in lower_text]
    domain_hits = [d for d in SUSPICIOUS_DOMAINS_HINTS if d in lower_text]

    score = len(keyword_hits) + len(domain_hits)

    if score == 0:
        return {
            "detected": False,
            "attack_type": None,
            "risk": "Low",
            "reason": "No phishing indicators found.",
            "recommendations": []
        }

    if score >= 5:
        risk = "Critical"
    elif score >= 3:
        risk = "High"
    elif score >= 1:
        risk = "Medium"
    else:
        risk = "Low"

    reasons = []
    if keyword_hits:
        reasons.append(f"contains urgency/social-engineering phrases ({', '.join(keyword_hits[:3])})")
    if domain_hits:
        reasons.append(f"references suspicious link patterns ({', '.join(domain_hits[:3])})")

    return {
        "detected": True,
        "attack_type": "Phishing",
        "risk": risk,
        "reason": f"Email flagged because it {' and '.join(reasons)}.",
        "recommendations": [
            "Do not click any links or download attachments.",
            "Report the email to your security team.",
            "Verify sender address against known legitimate domains.",
            "Block the sender and enable email filtering rules."
        ]
    }