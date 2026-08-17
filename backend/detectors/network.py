import re

SUSPICIOUS_PORTS = ["4444", "1337", "31337", "6667", "6666", "12345"]
SUSPICIOUS_KEYWORDS = [
    "unusual outbound traffic", "data exfiltration", "large data transfer",
    "connection to unknown host", "beaconing", "port scan",
    "unauthorized access attempt", "traffic spike", "unusual geo location",
    "connection outside business hours", "tor exit node", "c2 server"
]

def analyze_network(text: str) -> dict:
    lower_text = text.lower()

    port_hits = [p for p in SUSPICIOUS_PORTS if p in text]
    keyword_hits = [kw for kw in SUSPICIOUS_KEYWORDS if kw in lower_text]

    ip_matches = re.findall(r'\b(?:\d{1,3}\.){3}\d{1,3}\b', text)
    many_ips = len(set(ip_matches)) >= 5

    score = len(port_hits) + len(keyword_hits) + (2 if many_ips else 0)

    if score == 0:
        return {
            "detected": False,
            "attack_type": None,
            "risk": "Low",
            "reason": "No suspicious network activity found.",
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
    if port_hits:
        reasons.append(f"references known malicious ports ({', '.join(port_hits[:3])})")
    if keyword_hits:
        reasons.append(f"describes suspicious network behavior ({', '.join(keyword_hits[:3])})")
    if many_ips:
        reasons.append("involves an unusually high number of distinct IP addresses")

    return {
        "detected": True,
        "attack_type": "Suspicious Network Activity",
        "risk": risk,
        "reason": f"Input flagged because it {' and '.join(reasons)}.",
        "recommendations": [
            "Block the suspicious IP addresses and ports at the firewall.",
            "Review network traffic logs for the affected time window.",
            "Check for signs of data exfiltration on affected hosts.",
            "Alert the network security team for deeper investigation."
        ]
    }