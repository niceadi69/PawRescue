
import os
from pathlib import Path

from dotenv import load_dotenv
from supabase import create_client, Client

# Locate the project's root directory
PROJECT_ROOT = Path(__file__).resolve().parent.parent

# Load environment variables from the root .env file
load_dotenv(PROJECT_ROOT / ".env")

SUPABASE_URL = os.getenv("SUPABASE_URL")
SUPABASE_SERVICE_ROLE_KEY = os.getenv("SUPABASE_SERVICE_ROLE_KEY")

if not SUPABASE_URL or not SUPABASE_SERVICE_ROLE_KEY:
    raise ValueError(
        "Supabase credentials missing! Check your root .env file."
    )

# Backend-only Supabase connection
supabase: Client = create_client(
    SUPABASE_URL,
    SUPABASE_SERVICE_ROLE_KEY
)
