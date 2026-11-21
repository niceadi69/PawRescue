
async def notify_ngo(report_data):
    """
    Sends a rescue report notification.
    Database and NGO notification integration will be added later.
    """

    print("\n🐾 NEW PAWRESCUE REPORT")
    print("-------------------------")
    print(f"Animal: {report_data['animal']}")
    print(f"Description: {report_data['description']}")
    print(f"Location: {report_data['location']}")
    print("-------------------------\n")
