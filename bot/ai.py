
import os
import json
from pathlib import Path

from dotenv import load_dotenv
from google import genai
from google.genai import types


# -----------------------------
# CONFIGURATION
# -----------------------------

PROJECT_ROOT = Path(__file__).resolve().parent.parent

load_dotenv(PROJECT_ROOT / ".env")

GEMINI_API_KEY = os.getenv("GEMINI_API_KEY")

MODEL_NAME = os.getenv(
    "GEMINI_MODEL",
    "gemini-3.8-flash"
)

if not GEMINI_API_KEY:
    raise ValueError(
        "Gemini API key missing. Check your .env file."
    )


# -----------------------------
# GEMINI CLIENT
# -----------------------------

client = genai.Client(
    api_key=GEMINI_API_KEY
)


# -----------------------------
# AI REPORT ANALYSIS
# -----------------------------

async def analyze_report(report_data):

    """
    Analyze a rescue report using Gemini.

    Returns structured AI triage information.
    This is not a veterinary diagnosis.
    """

    animal = report_data.get("animal", "Unknown")

    description = report_data.get(
        "description",
        "No description provided."
    )

    prompt = f"""
You are an AI assistant helping an animal rescue
organization prioritize incoming rescue reports.

Analyze the following report.

Animal:
{animal}

Reported situation:
{description}

Return ONLY valid JSON with these fields:

{{
    "animal_type": "string",
    "urgency": "low, medium, high, critical, or unknown",
    "severity": "low, moderate, high, critical, or unknown",
    "visible_concerns": [],
    "confidence": 0.0,
    "recommended_action": "string",
    "requires_human_review": true,
    "uncertainties": []
}}

IMPORTANT RULES:

1. Do not invent symptoms or circumstances.
2. Do not provide a veterinary diagnosis.
3. Distinguish reported information from confirmed observations.
4. If information is insufficient, use unknown.
5. Recommend professional veterinary assessment when appropriate.
6. Critical cases should be flagged for urgent human attention.
7. Always require human review.
8. Keep recommendations practical and concise.
9. Confidence must be between 0 and 1.
"""

    response = await client.aio.models.generate_content(
        model=MODEL_NAME,
        contents=prompt,
        config=types.GenerateContentConfig(
            response_mime_type="application/json",
            temperature=0.2,
            max_output_tokens=700,
        ),
    )

    if not response.text:
        raise ValueError("Gemini returned an empty response.")

    try:
        result = json.loads(response.text)

    except json.JSONDecodeError as error:
        raise ValueError(
            "Gemini returned invalid JSON."
        ) from error

    # -----------------------------
    # VALIDATE AI RESPONSE
    # -----------------------------

    valid_urgencies = {
        "low", "medium", "high", "critical", "unknown"
    }

    valid_severities = {
        "low", "moderate", "high", "critical", "unknown"
    }

    if result.get("urgency") not in valid_urgencies:
        result["urgency"] = "unknown"

    if result.get("severity") not in valid_severities:
        result["severity"] = "unknown"

    try:
        confidence = float(result.get("confidence", 0))
    except (TypeError, ValueError):
        confidence = 0.0

    result["confidence"] = max(0.0, min(1.0, confidence))

    result["animal_type"] = str(
        result.get("animal_type", animal)
    )

    result["visible_concerns"] = (
        result.get("visible_concerns", [])
        if isinstance(result.get("visible_concerns"), list)
        else []
    )

    result["uncertainties"] = (
        result.get("uncertainties", [])
        if isinstance(result.get("uncertainties"), list)
        else []
    )

    result["recommended_action"] = str(
        result.get("recommended_action", "Human review required.")
    )

    # Human review is mandatory for every report.

    result["requires_human_review"] = True

    result["ai_status"] = "completed"

    return result
