
import os
import json
import asyncio
from pathlib import Path

from dotenv import load_dotenv
from groq import AsyncGroq


# -----------------------------
# CONFIGURATION
# -----------------------------

PROJECT_ROOT = Path(__file__).resolve().parent.parent

load_dotenv(PROJECT_ROOT / ".env")

GROQ_API_KEY = os.getenv("GROQ_API_KEY")

MODEL_NAME = os.getenv(
    "GROQ_MODEL",
    "openai/gpt-oss-20b"
)

if not GROQ_API_KEY:
    raise ValueError(
        "Groq API key missing. Check your .env file."
    )


# -----------------------------
# GROQ CLIENT
# -----------------------------

client = AsyncGroq(
    api_key=GROQ_API_KEY
)


# -----------------------------
# AI REPORT ANALYSIS
# -----------------------------

async def analyze_report(report_data):

    """
    Analyze a rescue report using Groq.

    Returns structured AI triage information.
    This is not a veterinary diagnosis.
    """

    animal = report_data.get("animal", "Unknown")

    description = report_data.get(
        "description",
        "No description provided."
    )

    system_prompt = """
You are an AI assistant helping an animal rescue
organization prioritize incoming rescue reports.

Analyze reports carefully and return ONLY valid JSON.

The JSON must contain these fields:

{
    "animal_type": "string",
    "urgency": "low, medium, high, critical, or unknown",
    "severity": "low, moderate, high, critical, or unknown",
    "visible_concerns": [],
    "confidence": 0.0,
    "recommended_action": "string",
    "requires_human_review": true,
    "uncertainties": []
}

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

    user_prompt = f"""
Animal:
{animal}

Reported situation:
{description}
"""

    # -----------------------------
    # GROQ REQUEST WITH RETRIES
    # -----------------------------

    response = None

    for attempt in range(3):

        try:
            print(
                f"Groq request: attempt {attempt + 1}/3",
                flush=True
            )

            response = await asyncio.wait_for(
                client.chat.completions.create(
                    model=MODEL_NAME,
                    messages=[
                        {
                            "role": "system",
                            "content": system_prompt
                        },
                        {
                            "role": "user",
                            "content": user_prompt
                        }
                    ],
                    response_format={
                        "type": "json_object"
                    },
                    temperature=0.2,
                    max_tokens=700,
                ),
                timeout=30
            )

            break

        except Exception as error:

            if attempt == 2:
                raise

            print(
                f"Groq temporarily unavailable: {error}",
                flush=True
            )

            await asyncio.sleep(2 ** (attempt + 1))

    if response is None:
        raise ValueError("Groq returned no response.")

    content = response.choices[0].message.content

    if not content:
        raise ValueError("Groq returned an empty response.")

    try:
        result = json.loads(content)

    except json.JSONDecodeError as error:
        raise ValueError(
            "Groq returned invalid JSON."
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

    result["confidence"] = max(
        0.0,
        min(1.0, confidence)
    )

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
        result.get(
            "recommended_action",
            "Human review required."
        )
    )

    # Human review is mandatory for every report.

    result["requires_human_review"] = True

    result["ai_status"] = "completed"

    return result
