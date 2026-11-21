
import os
from pathlib import Path
from getpass import getpass

from dotenv import load_dotenv
from supabase import create_client

ROOT = Path(__file__).resolve().parent
load_dotenv(ROOT / ".env")

url = os.getenv("SUPABASE_URL")
key = os.getenv("SUPABASE_SERVICE_ROLE_KEY")

if not url or not key:
    raise RuntimeError("Supabase environment variables are missing.")

supabase = create_client(url, key)

admin_id = "7871fe6d-e1ad-49fe-ae82-bf8c5d021d65"

password = getpass("Enter your new admin password: ")
confirm = getpass("Confirm your new password: ")

if len(password) < 8:
    raise ValueError("Use at least 8 characters.")

if password != confirm:
    raise ValueError("Passwords do not match.")

result = supabase.auth.admin.update_user_by_id(
    admin_id,
    {"password": password}
)

print("Admin password updated successfully!")
