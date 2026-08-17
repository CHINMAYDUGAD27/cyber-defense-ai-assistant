SQL_KEYWORDS = [
    "drop table", "drop database", "insert into", "delete from",
    "union select", "union all select", "exec(", "xp_cmdshell",
    "or 1=1", "' or '", "'; --", "'; drop", "--", "/**/",
    "information_schema", "sleep(", "benchmark(", "load_file(",
    "outfile", "' and '", "1=1--", "admin'--",
]

def analyze_sql_injection(text: str) -> dict:
    lower_text = text.lower()

    hits = [kw for kw in SQL_KEYWORDS if kw in lower_text]
    score = len(hits)

    if score == 0:
        return {
            "detected": False,
            "attack_type": None,
            "risk": "Low",
            "reason": "No SQL injection patterns found.",
            "recommendations": []
        }

    if score >= 4:
        risk = "Critical"
    elif score >= 3:
        risk = "High"
    elif score >= 2:
        risk = "Medium"
    else:
        risk = "Low"

    return {
        "detected": True,
        "attack_type": "SQL Injection",
        "risk": risk,
        "reason": f"Detected SQL injection patterns: {', '.join(hits[:4])}.",
        "recommendations": [
            "Use parameterized queries / prepared statements — never string-concatenate SQL.",
            "Block the source IP at the WAF/firewall immediately.",
            "Audit the database for unauthorized changes.",
            "Review application logs for other injection attempts from the same session.",
        ]
    }
