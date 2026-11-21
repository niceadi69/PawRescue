
import os
import logging
from pathlib import Path

from dotenv import load_dotenv

from telegram import (
    Update,
    KeyboardButton,
    ReplyKeyboardMarkup,
    ReplyKeyboardRemove,
)

from telegram.request import HTTPXRequest

from telegram.ext import (
    Application,
    CommandHandler,
    MessageHandler,
    ConversationHandler,
    ContextTypes,
    filters,
)

from notifier import notify_ngo
from db import save_report, upload_report_photo


# -----------------------------
# CONFIGURATION
# -----------------------------

PROJECT_ROOT = Path(__file__).resolve().parent.parent
load_dotenv(PROJECT_ROOT / ".env")

TOKEN = os.getenv("TELEGRAM_BOT_TOKEN")

ANIMAL, DESCRIPTION, LOCATION, PHOTO, PHONE = range(5)

MAX_PHOTOS = 5

logging.basicConfig(
    format="%(asctime)s - %(name)s - %(levelname)s - %(message)s",
    level=logging.INFO,
)

logger = logging.getLogger(__name__)


# -----------------------------
# START COMMAND
# -----------------------------

async def start(update: Update, context: ContextTypes.DEFAULT_TYPE):

    await update.message.reply_text(
        "🐾 Welcome to PawRescue!\n"
        "Helping animals, one rescue at a time.\n\n"
        "Use /report to report an animal in need."
    )


# -----------------------------
# START RESCUE REPORT
# -----------------------------

async def report(update: Update, context: ContextTypes.DEFAULT_TYPE):

    context.user_data["report"] = {}
    context.user_data["photos"] = []

    await update.message.reply_text(
        "🐾 Let's create a rescue report!\n\n"
        "What animal needs help?\n"
        "Example: Dog, Cat, Bird, Other"
    )

    return ANIMAL


# -----------------------------
# GET ANIMAL
# -----------------------------

async def get_animal(update: Update, context: ContextTypes.DEFAULT_TYPE):

    context.user_data["report"]["animal"] = update.message.text

    await update.message.reply_text(
        "📝 Describe what happened to the animal."
    )

    return DESCRIPTION


# -----------------------------
# GET DESCRIPTION
# -----------------------------

async def get_description(update: Update, context: ContextTypes.DEFAULT_TYPE):

    context.user_data["report"]["description"] = update.message.text

    location_keyboard = [
        [
            KeyboardButton(
                "📍 Share My Location",
                request_location=True
            )
        ]
    ]

    reply_markup = ReplyKeyboardMarkup(
        location_keyboard,
        one_time_keyboard=True,
        resize_keyboard=True,
    )

    await update.message.reply_text(
        "📍 Please share the animal's location.\n\n"
        "Tap the button to share your current location, "
        "or type the animal's area/address.",
        reply_markup=reply_markup,
    )

    return LOCATION


# -----------------------------
# GET LOCATION
# -----------------------------


async def get_location(update: Update, context: ContextTypes.DEFAULT_TYPE):

    report_data = context.user_data["report"]

    if update.message.location:

        latitude = update.message.location.latitude
        longitude = update.message.location.longitude

        report_data["latitude"] = latitude
        report_data["longitude"] = longitude

        report_data["location_text"] = "GPS location shared via Telegram"

        report_data["location"] = (
            f"GPS coordinates: {latitude}, {longitude}"
        )

    else:

        location = update.message.text.strip()

        report_data["location"] = location
        report_data["location_text"] = location

        report_data["latitude"] = None
        report_data["longitude"] = None

    await update.message.reply_text(
        "📸 Please send photos of the animal.\n\n"
        "You can send up to 5 photos.\n"
        "Send /done when finished or /skip if you have no photos.",
        reply_markup=ReplyKeyboardRemove(),
    )

    return PHOTO



# -----------------------------
# GET MULTIPLE PHOTOS
# -----------------------------

async def get_photo(update: Update, context: ContextTypes.DEFAULT_TYPE):

    photos = context.user_data.setdefault("photos", [])

    # FINISH PHOTO COLLECTION

    if update.message.text:

        command = update.message.text.lower().strip()

        if command == "/done":

            if not photos:

                await update.message.reply_text(
                    "You haven't sent any photos yet.\n"
                    "Send a photo or type /skip."
                )

                return PHOTO

            await update.message.reply_text(
                f"✅ {len(photos)} photo(s) received!\n\n"
                "📞 Please enter your phone number."
            )

            return PHONE

        if command == "/skip":

            await update.message.reply_text(
                "No problem!\n"
                "📞 Please enter your phone number."
            )

            return PHONE

    # RECEIVE PHOTO

    if update.message.photo:

        if len(photos) >= MAX_PHOTOS:

            await update.message.reply_text(
                "⚠️ You've reached the 5-photo limit.\n"
                "Type /done to continue."
            )

            return PHOTO

        photo_file_id = update.message.photo[-1].file_id

        photos.append(photo_file_id)

        await update.message.reply_text(
            f"🐾 Photo {len(photos)}/{MAX_PHOTOS} received!\n\n"
            "Send another photo or type /done when finished."
        )

        if len(photos) == MAX_PHOTOS:

            await update.message.reply_text(
                "You've reached the photo limit.\n"
                "Type /done to continue."
            )

        return PHOTO

    await update.message.reply_text(
        "Please send a photo, type /skip, or type /done."
    )

    return PHOTO



# -----------------------------
# GET PHONE AND SUBMIT REPORT
# -----------------------------

async def get_phone(update: Update, context: ContextTypes.DEFAULT_TYPE):

    report_data = context.user_data["report"]

    report_data["phone"] = update.message.text.strip()
    report_data["photos"] = context.user_data.get("photos", [])
    report_data["telegram_user_id"] = str(update.effective_user.id)

    photo_count = len(report_data["photos"])
    uploaded_photos = []
    failed_photos = []

    # STEP 1: SAVE REPORT TO SUPABASE

    try:

        report_id = save_report(report_data)

        logger.info("Report saved successfully: %s", report_id)

    except Exception:

        logger.exception("Failed to save report to Supabase")

        await update.message.reply_text(
            "⚠️ We couldn't save your report. Please try again later."
        )

        return ConversationHandler.END

    # STEP 2: DOWNLOAD AND UPLOAD PHOTOS

    for index, photo_id in enumerate(report_data["photos"], start=1):

        try:

            # Download photo from Telegram

            telegram_file = await context.bot.get_file(photo_id)

            photo_bytes = await telegram_file.download_as_bytearray()

            # Upload photo to Supabase Storage

            storage_path = upload_report_photo(
                report_id=report_id,
                photo_bytes=bytes(photo_bytes),
                mime_type="image/jpeg",
                extension="jpg",
            )

            uploaded_photos.append(storage_path)

            logger.info(
                "Photo %s uploaded successfully: %s",
                index,
                storage_path
            )

        except Exception:

            failed_photos.append(index)

            logger.exception(
                "Failed to upload photo %s for report %s",
                index,
                report_id
            )

    # STEP 3: NOTIFY NGO

    notification_success = True

    try:

        report_data["uploaded_photos"] = uploaded_photos

        await notify_ngo(report_data)

    except Exception:

        notification_success = False

        logger.exception("NGO notification failed")

    # STEP 4: BUILD CONFIRMATION

    confirmation = (
        "✅ Rescue report saved successfully!\n\n"
        f"🆔 Report ID: {report_id}\n"
        f"🐾 Animal: {report_data['animal']}\n"
        f"📝 Description: {report_data['description']}\n"
        f"📍 Location: {report_data['location']}\n"
        f"📸 Photos uploaded: {len(uploaded_photos)}/{photo_count}\n"
        "Thank you for helping an animal in need! ❤️"
    )

    if failed_photos:

        confirmation += (
            "\n\n⚠️ Some photos could not be uploaded. "
            "Your rescue report was still saved."
        )

    if not notification_success:

        confirmation += (
            "\n\n⚠️ NGO notification failed, "
            "but your report was safely saved."
        )

    # STEP 5: SEND CONFIRMATION

    await update.message.reply_text(
        confirmation,
        reply_markup=ReplyKeyboardRemove(),
    )

    # STEP 6: CLEAR REPORT DATA

    context.user_data.pop("report", None)
    context.user_data.pop("photos", None)

    return ConversationHandler.END


# -----------------------------
# CANCEL REPORT
# -----------------------------

async def cancel(update: Update, context: ContextTypes.DEFAULT_TYPE):

    context.user_data.pop("report", None)
    context.user_data.pop("photos", None)

    await update.message.reply_text(
        "❌ Report cancelled.\n"
        "You can start again using /report.",
        reply_markup=ReplyKeyboardRemove(),
    )

    return ConversationHandler.END


# -----------------------------
# MAIN FUNCTION
# -----------------------------

def main():

    if not TOKEN:

        raise ValueError(
            "Telegram bot token missing from .env file!"
        )

    request = HTTPXRequest(
        connect_timeout=30,
        read_timeout=30,
        write_timeout=30,
        pool_timeout=30,
    )

    app = (
        Application.builder()
        .token(TOKEN)
        .request(request)
        .build()
    )

    report_handler = ConversationHandler(

        entry_points=[
            CommandHandler("report", report)
        ],

        states={

            ANIMAL: [
                MessageHandler(
                    filters.TEXT & ~filters.COMMAND,
                    get_animal
                )
            ],

            DESCRIPTION: [
                MessageHandler(
                    filters.TEXT & ~filters.COMMAND,
                    get_description
                )
            ],

            LOCATION: [
                MessageHandler(
                    filters.LOCATION |
                    (filters.TEXT & ~filters.COMMAND),
                    get_location
                )
            ],

            PHOTO: [
                MessageHandler(
                    filters.PHOTO,
                    get_photo
                ),
                MessageHandler(
                    filters.Regex(r"^/(done|skip)$"),
                    get_photo
                ),
            ],

            PHONE: [
                MessageHandler(
                    filters.TEXT & ~filters.COMMAND,
                    get_phone
                )
            ],

        },

        fallbacks=[
            CommandHandler("cancel", cancel)
        ],

    )

    app.add_handler(CommandHandler("start", start))
    app.add_handler(report_handler)

    print("🐾 PawRescue bot is running!")

    app.run_polling()


# -----------------------------
# RUN BOT
# -----------------------------

if __name__ == "__main__":

    main()
