import os
import json
import re
from groq import Groq

def get_client(api_key: str) -> Groq:
    if not api_key or not api_key.strip():
        raise ValueError("NO_API_KEY")
    return Groq(api_key=api_key.strip())

def analyze_with_groq(user_input: str, api_key: str = None):
    prompt = f"""
You are an AI Cybersecurity Expert.

Analyze the following input carefully.

The input may contain:
- Fake bank calls
- OTP scams
- WhatsApp scams
- Urgent money requests
- Phishing emails
- Malware indicators
- Brute force attacks
- Network attacks
- Ransomware
- SQL Injection
- XSS
- DDoS attacks
- Password attacks
- Social engineering
- Any cybersecurity incident

Return ONLY valid JSON with the following schema:

{{
    "detected": true,
    "attack_type": "Phishing",
    "mitre_tactic": "T1566 - Phishing",
    "risk": "High",
    "reason": "Detailed explanation of why this is dangerous.",
    "recommended_action": "Block sender IP and report to security team",
    "recommendations": [
        "Recommendation 1",
        "Recommendation 2",
        "Recommendation 3",
        "Recommendation 4"
    ],
    "trigger_phrases": ["urgent action required", "click here", "verify your account"]
}}

Rules:
- "mitre_tactic": Identify the exact MITRE ATT&CK tactic/technique ID and name (e.g., "T1110 - Brute Force", "T1059 - Command Execution"). If not applicable, return null.
- "recommended_action": one concise primary action for the analyst (e.g. "Block sender IP", "Force password reset", "Report to bank fraud line")
- "trigger_phrases": list of exact substrings from the input that most strongly indicate the threat. Include only strings that appear verbatim in the input. Maximum 6 phrases.
- "risk": must be one of: Low, Medium, High, Critical

If no threat exists return:

{{
    "detected": false,
    "attack_type": null,
    "mitre_tactic": null,
    "risk": "Low",
    "reason": "No cyber threat detected.",
    "recommended_action": null,
    "recommendations": [],
    "trigger_phrases": []
}}

Input:
{user_input}
"""

    try:
        client = get_client(api_key)
        response = client.chat.completions.create(
            model="openai/gpt-oss-120b",
            messages=[
                {
                    "role": "system",
                    "content": "You are a cybersecurity expert. Always return ONLY valid JSON. Do not include explanations, markdown, or code fences."
                },
                {
                    "role": "user",
                    "content": prompt
                }
            ],
            temperature=0.2,
        )

        text = response.choices[0].message.content.strip()

        print("\n========== GROQ RESPONSE ==========")
        print(text)
        print("===================================\n")

        # Remove markdown code blocks if present
        text = text.replace("```json", "").replace("```", "").strip()

        # Extract first JSON object
        match = re.search(r"\{[\s\S]*\}", text)

        if not match:
            return _fallback("The AI did not return valid JSON.")

        json_text = match.group()

        try:
            result = json.loads(json_text)
            # Ensure new fields have defaults if missing from response
            result.setdefault("recommended_action", None)
            result.setdefault("trigger_phrases", [])
            return result

        except json.JSONDecodeError as e:
            print("JSON Parsing Error:", e)
            print("Invalid JSON:\n", json_text)
            return _fallback("Unable to parse the AI response.")

    except ValueError:
        raise  # Let NO_API_KEY bubble up to the endpoint
    except Exception as e:
        print("Groq Error:", e)
        return _fallback(f"Groq API Error: {str(e)}")


def _fallback(reason: str) -> dict:
    return {
        "detected": False,
        "attack_type": None,
        "risk": "Low",
        "reason": reason,
        "recommended_action": None,
        "recommendations": [],
        "trigger_phrases": [],
    }


def ask_followup_question(incident_context: dict, question: str, api_key: str = None) -> str:
    prompt = f"""
You are an AI Cybersecurity Expert who already analyzed a security incident.

Original input:
{incident_context['input_text']}

Previous Analysis

Attack Type:
{incident_context['attack_type']}

Risk:
{incident_context['risk']}

Reason:
{incident_context['reason']}

Now answer this follow-up question in plain English.

Question:
{question}
"""

    try:
        client = get_client(api_key)
        response = client.chat.completions.create(
            model="openai/gpt-oss-120b",
            messages=[
                {
                    "role": "system",
                    "content": "You are a cybersecurity expert answering follow-up questions."
                },
                {
                    "role": "user",
                    "content": prompt
                }
            ],
            temperature=0.3,
        )

        return response.choices[0].message.content.strip()

    except ValueError:
        raise  # Let NO_API_KEY bubble up to the endpoint
    except Exception as e:
        print("Follow-up Error:", e)
        return "Sorry, I couldn't answer the follow-up question at the moment."
