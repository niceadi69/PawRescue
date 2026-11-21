
import os
import uuid
from pathlib import Path

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


if not SUPABASE_URL or not SUPABASE_SERVICE_ROLE_KEY:
    raise ValueError(
        "Supabase credentials missing. Check your .env file."
    )


# -----------------------------
# SUPABASE CONNECTION
# -----------------------------

supabase: Client = create_client(
    SUPABASE_URL,
    SUPABASE_SERVICE_ROLE_KEY
)

print("🐾 PawRescue Supabase connection initialized!")


# -----------------------------
# SAVE RESCUE REPORT
# -----------------------------

def save_report(report_data):
    """
    Save a rescue report and its private contact details.
    Returns the new report ID.
    """

    report_record = {
        "animal_type": report_data["animal"],
        "description": report_data["description"],
        "location_text": report_data["location_text"],
        "latitude": report_data.get("latitude"),
        "longitude": report_data.get("longitude"),
        "source": "telegram",
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
    """
    Upload one photo to private Supabase Storage
    and register its storage path in report_photos.

    Returns the storage path.
    """

    unique_name = f"{uuid.uuid4().hex}.{extension}"

    storage_path = f"{report_id}/{unique_name}"

    try:

        # Upload image to private Storage bucket

        supabase.storage.from_(BUCKET_NAME).upload(
            storage_path,
            photo_bytes,
            {
                "content-type": mime_type,
                "upsert": "false",
            }
        )

        # Register uploaded image in database

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

        # Remove uploaded file if database registration fails

        try:
            supabase.storage.from_(BUCKET_NAME).remove(
                [storage_path]
            )
        except Exception:
            pass

        raise
