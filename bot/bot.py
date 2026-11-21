from notifier import notify_ngo
import os
import logging
from dotenv import load_dotenv
from telegram.request import HTTPXRequest

from telegram import Update
from telegram.ext import (
    Application,
    CommandHandler,
    MessageHandler,
    ConversationHandler,
    ContextTypes,
    filters,
)

load_dotenv()

TOKEN = os.getenv("TELEGRAM_BOT_TOKEN")

ANIMAL, DESCRIPTION, LOCATION = range(3)

logging.basicConfig(level=logging.INFO)


async def start(update: Update, context: ContextTypes.DEFAULT_TYPE):
    await update.message.reply_text(
        "🐾 Welcome to PawRescue!\n"
        "Helping animals, one rescue at a time.\n\n"
        "Use /report to report an animal in need."
    )


async def report(update: Update, context: ContextTypes.DEFAULT_TYPE):
    context.user_data["report"] = {}
    await update.message.reply_text(
        "🐾 Let's create a rescue report!\n\n"
        "What animal needs help?\n"
        "Example: Dog, Cat, Bird, Other"
    )
    return ANIMAL


async def get_animal(update: Update, context: ContextTypes.DEFAULT_TYPE):
    context.user_data["report"]["animal"] = update.message.text
    await update.message.reply_text("Describe what happened to the animal.")
    return DESCRIPTION


async def get_description(update: Update, context: ContextTypes.DEFAULT_TYPE):
    context.user_data["report"]["description"] = update.message.text
    await update.message.reply_text(
        "📍 Please share the animal's location.\n\n"
        "For now, type the area or address."
    )
    return LOCATION


async def get_location(update: Update, context: ContextTypes.DEFAULT_TYPE):
    context.user_data["report"]["location"] = update.message.text
    report_data = context.user_data["report"]
    await notify_ngo(report_data)

    await update.message.reply_text(
        "✅ Rescue report collected!\n\n"
        f"🐾 Animal: {report_data['animal']}\n"
        f"📝 Description: {report_data['description']}\n"
        f"📍 Location: {report_data['location']}\n\n"
        "Thank you for helping an animal in need!"
    )
    return ConversationHandler.END


async def cancel(update: Update, context: ContextTypes.DEFAULT_TYPE):
    context.user_data.pop("report", None)
    await update.message.reply_text(
        "Report cancelled. You can start again using /report."
    )
    return ConversationHandler.END


def main():
    if not TOKEN:
        raise ValueError("Telegram token missing from .env")

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
        entry_points=[CommandHandler("report", report)],
        states={
            ANIMAL: [
                MessageHandler(filters.TEXT & ~filters.COMMAND, get_animal)
            ],
            DESCRIPTION: [
                MessageHandler(filters.TEXT & ~filters.COMMAND, get_description)
            ],
            LOCATION: [
                MessageHandler(filters.TEXT & ~filters.COMMAND, get_location)
            ],
        },
        fallbacks=[CommandHandler("cancel", cancel)],
    )

    app.add_handler(CommandHandler("start", start))
    app.add_handler(report_handler)

    print("🐾 PawRescue bot is running!")
    app.run_polling()


if __name__ == "__main__":
    main()
