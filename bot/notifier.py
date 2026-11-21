
async def notify_ngo(report_data):

    print("\n🐾 NEW PAWRESCUE REPORT")
    print("-----------------------------")

    print(f"Animal: {report_data['animal']}")

    print(f"Description: {report_data['description']}")

    print(f"Location: {report_data['location']}")

    print(f"Phone: {report_data['phone']}")

    photos = report_data.get("photos", [])

    print(f"Photos received: {len(photos)}")

    for index, photo_id in enumerate(photos, start=1):

        print(f"Photo {index}: {photo_id}")

    print("-----------------------------\n")
