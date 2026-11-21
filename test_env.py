import os
from dotenv import load_dotenv

load_dotenv()

token = os.getenv("TELEGRAM_BOT_TOKEN")

if token:
    print("Telegram token loaded successfully!")
else:
    print("Token not found. Check your .env file.")