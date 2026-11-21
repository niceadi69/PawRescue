
import os
import uuid
import logging
import re
import math

from pathlib import Path
from datetime import datetime, timedelta, timezone
from difflib import SequenceMatcher

from dotenv import load_dotenv
from supabase import create_client, Client


# -----------------------------
# CONFIGURATION
# -----------------------------

PROJECT_ROOT = Path(__file__).resolve().parent.parent
load_dotenv(PROJECT_ROOT / ".env")

SUPABASE_URL = os.getenv("SUPABASE_URL")
SUPABASE_SERVICE_ROLE_KEY = os.getenv("SUPABASE_SERVICE_ROLE_KEY")

BUCKET_NAME = "rescue-photos"

logger = logging.getLogger(__name__)

if not SUPABASE_URL or not SUPABASE_SERVICE_ROLE_KEY:
    raise ValueError("Supabase credentials missing. Check your .env file.")

supabase: Client = create_client(
    SUPABASE_URL,
    SUPABASE_SERVICE_ROLE_KEY
)

print("🐾 PawRescue Supabase connection initialized!")


# -----------------------------
# TEXT NORMALIZATION
# -----------------------------

def normalize_text(value):
    if not value:
        return ""

    value = str(value).lower().strip()
    value = re.sub(r"[^a-z0-9\s]", " ", value)
    value = re.sub(r"\s+", " ", value)

    return value


# -----------------------------
# DISTANCE CALCULATION
# -----------------------------

def calculate_distance(lat1, lon1, lat2, lon2):
    earth_radius = 6371000

    lat1 = math.radians(float(lat1))
    lon1 = math.radians(float(lon1))
    lat2 = math.radians(float(lat2))
    lon2 = math.radians(float(lon2))

    delta_lat = lat2 - lat1
    delta_lon = lon2 - lon1

    a = (
        math.sin(delta_lat / 2) ** 2
        + math.cos(lat1)
        * math.cos(lat2)
        * math.sin(delta_lon / 2) ** 2
    )

    c = 2 * math.atan2(math.sqrt(a), math.sqrt(1 - a))

    return earth_radius * c


# -----------------------------
# DUPLICATE DETECTION
# -----------------------------

def find_possible_duplicate(report_data):

    animal = normalize_text(report_data.get("animal"))
    description = normalize_text(report_data.get("description"))
    location = normalize_text(report_data.get("location_text"))

    latitude = report_data.get("latitude")
    longitude = report_data.get("longitude")

    cutoff = (
        datetime.now(timezone.utc) - timedelta(hours=24)
    ).isoformat()

    response = (
        supabase.table("rescue_reports")
        .select(
            "id, animal_type, description, location_text, "
            "latitude, longitude, created_at"
        )
        .gte("created_at", cutoff)
        .order("created_at", desc=True)
        .limit(100)
        .execute()
    )

    candidates = response.data or []

    best_match = None
    best_score = 0

    for candidate in candidates:

        if normalize_text(candidate.get("animal_type")) != animal:
            continue

        candidate_description = normalize_text(
            candidate.get("description")
        )

        candidate_location = normalize_text(
            candidate.get("location_text")
        )

        description_similarity = SequenceMatcher(
            None, description, candidate_description
        ).ratio()

        gps_match = False

        candidate_lat = candidate.get("latitude")
        candidate_lon = candidate.get("longitude")

        if (
            latitude is not None
            and longitude is not None
            and candidate_lat is not None
            and candidate_lon is not None
        ):

            distance = calculate_distance(
                latitude,
                longitude,
                candidate_lat,
                candidate_lon
            )

            gps_match = distance <= 500

        location_similarity = SequenceMatcher(
            None, location, candidate_location
        ).ratio()

        location_match = (
            gps_match or location_similarity >= 0.75
        )

        if not location_match or description_similarity < 0.50:
            continue

        score = (
            description_similarity * 0.7
            + max(
                location_similarity,
                1.0 if gps_match else 0.0
            ) * 0.3
        )

        if score > best_score:
            best_score = score
            best_match = candidate["id"]

    if best_match:
        logger.info("Possible duplicate found: %s", best_match)

    return best_match


# -----------------------------
# SAVE RESCUE REPORT
# -----------------------------

def save_report(report_data):

    possible_duplicate_id = None

    try:
        possible_duplicate_id = find_possible_duplicate(report_data)
    except Exception:
        logger.exception("Duplicate detection failed.")

    report_record = {
        "animal_type": report_data["animal"],
        "description": report_data["description"],
        "location_text": report_data["location_text"],
        "latitude": report_data.get("latitude"),
        "longitude": report_data.get("longitude"),
        "source": "telegram",
        "possible_duplicate_of": possible_duplicate_id,
    }

    response = (
        supabase.table("rescue_reports")
        .insert(report_record)
        .execute()
    )

    report_id = response.data[0]["id"]

    try:

        private_data = {
            "report_id": report_id,
            "contact_number": report_data["phone"],
            "telegram_user_id": str(
                report_data["telegram_user_id"]
            ),
        }

        supabase.table("report_private_metadata").insert(
            private_data
        ).execute()

    except Exception:

        supabase.table("rescue_reports").delete().eq(
            "id", report_id
        ).execute()

        raise

    return report_id


# -----------------------------
# UPLOAD REPORT PHOTO
# -----------------------------

def upload_report_photo(
    report_id,
    photo_bytes,
    mime_type="image/jpeg",
    extension="jpg"
):

    unique_name = f"{uuid.uuid4().hex}.{extension}"
    storage_path = f"{report_id}/{unique_name}"

    try:

        supabase.storage.from_(BUCKET_NAME).upload(
            storage_path,
            photo_bytes,
            {
                "content-type": mime_type,
                "upsert": "false",
            }
        )

        photo_record = {
            "report_id": report_id,
            "storage_path": storage_path,
            "mime_type": mime_type,
        }

        supabase.table("report_photos").insert(
            photo_record
        ).execute()

        return storage_path

    except Exception:

        try:
            supabase.storage.from_(BUCKET_NAME).remove(
                [storage_path]
            )
        except Exception:
            pass

        raise


# -----------------------------
# SAVE AI ANALYSIS
# -----------------------------

def save_ai_analysis(report_id, ai_result):

    return supabase.table("rescue_reports").update({
        "urgency": ai_result.get("urgency", "unknown"),
        "severity": ai_result.get("severity", "unknown"),
        "ai_analysis": ai_result,
        "ai_status": ai_result.get("ai_status", "completed"),
    }).eq("id", report_id).execute()


# -----------------------------
# MARK AI FAILURE
# -----------------------------

def mark_ai_failed(report_id, error=None):

    failure_record = {
        "status": "failed",
        "message": "AI analysis unavailable. Human review required.",
    }

    return supabase.table("rescue_reports").update({
        "urgency": "unknown",
        "severity": "unknown",
        "ai_analysis": failure_record,
        "ai_status": "failed",
    }).eq("id", report_id).execute()
