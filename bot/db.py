
import os
from pathlib import Path

from dotenv import load_dotenv
from supabase import create_client, Client

# Project root
PROJECT_ROOT = Path(__file__).resolve().parent.parent

# Load environment variables
load_dotenv(PROJECT_ROOT / ".env")

SUPABASE_URL = os.getenv("SUPABASE_URL")
SUPABASE_SERVICE_ROLE_KEY = os.getenv("SUPABASE_SERVICE_ROLE_KEY")

# Validate credentials
if not SUPABASE_URL or not SUPABASE_SERVICE_ROLE_KEY:
    raise ValueError("Supabase credentials missing. Check your .env file.")

# Initialize Supabase client
supabase: Client = create_client(
    SUPABASE_URL,
    SUPABASE_SERVICE_ROLE_KEY
)

print("🐾 PawRescue Supabase connection initialized!")


def save_report(report_data):
    """
    Save a rescue report and its private contact details.
    Returns the new report ID.
    """

    report_record = {
        "animal_type": report_data["animal"],
        "description": report_data["description"],
        "location_text": report_data["location"],
        "source": "telegram",
    }

    # Insert the main rescue report
    response = (
        supabase.table("rescue_reports")
        .insert(report_record)
        .execute()
    )

    report_id = response.data[0]["id"]

    try:
        # Store private contact details separately
        private_data = {
            "report_id": report_id,
            "contact_number": report_data["phone"],
            "telegram_user_id": str(report_data["telegram_user_id"]),
        }

        supabase.table("report_private_metadata").insert(
            private_data
        ).execute()

    except Exception:
        # Roll back the report if private metadata fails
        supabase.table("rescue_reports").delete().eq(
            "id", report_id
        ).execute()
        raise

    return report_id
