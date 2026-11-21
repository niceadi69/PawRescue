
import os
import logging

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


# -----------------------------
# CONFIGURATION
# -----------------------------

load_dotenv()

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

    if update.message.location:

        latitude = update.message.location.latitude
        longitude = update.message.location.longitude

        context.user_data["report"]["location"] = (
            f"Latitude: {latitude}, Longitude: {longitude}"
        )

    else:

        context.user_data["report"]["location"] = update.message.text

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

    # FINISH PHOTO UPLOAD

    if update.message.text and update.message.text.lower() == "/done":

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

    # SKIP PHOTOS

    if update.message.text and update.message.text.lower() == "/skip":

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

    report_data["phone"] = update.message.text

    report_data["photos"] = context.user_data.get("photos", [])

    report_data["telegram_user_id"] = str(update.effective_user.id)

    photo_count = len(report_data["photos"])

    # SEND REPORT TO NGO NOTIFIER

    try:

        await notify_ngo(report_data)

    except Exception:

        logger.exception("Failed to notify NGO")

        await update.message.reply_text(
            "⚠️ Your report was collected, but notification failed. "
            "Please contact the rescue team."
        )

        return ConversationHandler.END

    # CONFIRMATION MESSAGE

    await update.message.reply_text(
        "✅ Rescue report collected successfully!\n\n"

        f"🐾 Animal: {report_data['animal']}\n"

        f"📝 Description: {report_data['description']}\n"

        f"📍 Location: {report_data['location']}\n"

        f"📸 Photos: {photo_count}/5 received\n"

        f"📞 Contact: {report_data['phone']}\n\n"

        "Thank you for helping an animal in need! ❤️",

        reply_markup=ReplyKeyboardRemove(),
    )

    # CLEAR REPORT DATA

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
            "Telegram token missing from .env file!"
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
                    filters.TEXT | filters.LOCATION,
                    get_location
                )
            ],

            PHOTO: [
                MessageHandler(
                    filters.PHOTO | filters.TEXT,
                    get_photo
                )
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
