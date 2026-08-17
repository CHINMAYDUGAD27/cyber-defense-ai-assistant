import pytest
from groq_analyzer import analyze_with_groq

# Each case: (input_text, expected_detected, description)
TEST_CASES = [
    (
        "Failed login attempt from 192.168.1.5 repeated 20 times in 2 minutes",
        True,
        "brute force pattern"
    ),
    (
        "Your OTP is 4521, do not share with anyone, verify your account now or it will be suspended",
        True,
        "OTP phishing scam"
    ),
    (
        "User logged in successfully from a recognized device at 9:00 AM",
        False,
        "normal, benign login"
    ),
    (
        "Sir aapka bank account block ho gaya hai. Turant apna OTP share kariye.",
        True,
        "Hinglish OTP scam"
    ),
    (
        "Meeting rescheduled to 3 PM tomorrow, please confirm your availability",
        False,
        "unrelated benign business message"
    ),
]


@pytest.mark.parametrize("input_text,expected_detected,description", TEST_CASES)
def test_groq_detection(input_text, expected_detected, description):
    result = analyze_with_groq(input_text)

    assert "detected" in result
    assert "risk" in result
    assert "reason" in result
    assert "recommendations" in result

    assert result["detected"] == expected_detected, (
        f"Failed on case '{description}': "
        f"expected detected={expected_detected}, got {result['detected']} "
        f"(attack_type={result.get('attack_type')}, reason={result.get('reason')})"
    )

    if result["detected"]:
        assert result["risk"] in ["Low", "Medium", "High", "Critical"]
        assert len(result["recommendations"]) > 0