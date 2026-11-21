# PawRescue — Backend Integration Guide

## 1. Project architecture

The React NGO dashboard connects to Supabase using the Supabase JavaScript client.

The Python backend handles:
- Telegram rescue report submissions
- Photo uploads
- AI report analysis using Gemini
- Duplicate report detection
- Database updates

The React frontend handles:
- NGO authentication
- Viewing authorized rescue reports
- Viewing AI analysis
- Viewing report photos
- Displaying report and assignment statuses

## 2. Frontend environment configuration

Create `web/.env`:

```env
VITE_SUPABASE_URL=your_supabase_project_url
VITE_SUPABASE_ANON_KEY=your_supabase_anon_key
```

Use the Supabase publishable/anon key only.

NEVER put the Supabase service-role key or Gemini API key in frontend code or frontend environment variables.

The frontend must rely on Supabase authentication and Row Level Security (RLS).

## 3. Supabase tables

### rescue_reports

| Column | Purpose |
|---|---|
| id | Unique report UUID |
| reporter_id | User who submitted the report |
| animal_type | Animal category |
| description | Report description |
| location_text | Human-readable location |
| latitude | GPS latitude |
| longitude | GPS longitude |
| status | Rescue workflow status |
| urgency | AI-assessed urgency |
| severity | AI-assessed severity |
| ai_analysis | Complete AI JSON response |
| ai_status | AI processing state |
| possible_duplicate_of | Possible matching report UUID |
| source | Report submission source |
| created_at | Report creation timestamp |
| updated_at | Last update timestamp |

### report_photos

| Column | Purpose |
|---|---|
| id | Photo record UUID |
| report_id | Associated rescue report |
| storage_path | Private Storage object path |
| mime_type | Image MIME type |
| created_at | Upload timestamp |

### rescue_assignments

| Column | Purpose |
|---|---|
| id | Assignment UUID |
| report_id | Assigned report |
| ngo_id | Assigned NGO profile |
| veterinarian_id | Assigned veterinarian profile |
| assigned_by | Profile that created assignment |
| assignment_status | Assignment workflow status |
| assigned_at | Assignment timestamp |

### Other tables

- `profiles`: User profiles and roles.
- `ngos`: NGO organisation details and verification status.
- `veterinarians`: Veterinarian details.
- `report_private_metadata`: Private reporter contact information.

## 4. AI analysis structure

The Python AI module returns structured JSON stored in `rescue_reports.ai_analysis`.

Example:

```json
{
  "animal_type": "Dog",
  "urgency": "high",
  "severity": "moderate",
  "visible_concerns": [],
  "confidence": 0.85,
  "recommended_action": "Professional veterinary assessment recommended.",
  "requires_human_review": true,
  "uncertainties": [],
  "ai_status": "completed"
}
```

These are illustrative values, not a real report.

Dashboard mappings:

- `urgency`: Rescue priority.
- `severity`: AI severity assessment.
- `visible_concerns`: Reported or observed concerns.
- `confidence`: AI confidence score.
- `recommended_action`: Suggested next action.
- `requires_human_review`: Human review indicator.
- `uncertainties`: Information requiring clarification.
- `ai_status`: AI processing state.

AI output is advisory, not a veterinary diagnosis. Human review is mandatory.

## 5. Status mappings

Database report statuses:

- pending
- reviewed
- assigned
- in_progress
- rescued
- closed
- cancelled
- duplicate

Suggested dashboard labels:

| Database value | Dashboard label |
|---|---|
| pending | New |
| reviewed | Reviewed |
| assigned | Assigned |
| in_progress | In Progress |
| rescued | Rescued |
| closed | Closed |
| cancelled | Cancelled |
| duplicate | Possible Duplicate |

Do not change database values just to match UI labels.

Assignment statuses:

- assigned
- accepted
- in_progress
- completed
- cancelled

AI statuses:

- pending
- completed
- failed

Urgency values:

- low
- medium
- high
- critical
- unknown

Severity values:

- low
- moderate
- high
- critical
- unknown

## 6. Photo access

The `rescue-photos` Storage bucket is PRIVATE.

Photo records are stored in `report_photos.storage_path`.

The dashboard must:
1. Fetch authorized photo records.
2. Use the authenticated Supabase client.
3. Request a short-lived signed URL for the stored object path.
4. Display the resulting URL.

Example:

```javascript
const { data, error } = await supabase.storage
  .from("rescue-photos")
  .createSignedUrl(storagePath, 300);
```

Handle errors and missing photos gracefully.

Do not make the bucket public.

## 7. Authentication and security

Supabase Auth is used for dashboard authentication.

The current profile roles are:
- user
- ngo
- veterinarian
- admin

NGO profiles must be approved before they can access assigned reports.

Existing RLS policies restrict report access to:
- Administrators
- Approved NGOs assigned to the report
- Assigned veterinarians

Private reporter metadata is currently admin-only.

Never fetch private reporter contact details into the ordinary NGO dashboard.

Never bypass RLS from the frontend.

## 8. Current backend limitations

Important implementation constraints:

- NGO and veterinarian profile registration workflows still need implementation.
- Assignment creation and management currently have admin-only write permissions.
- NGOs do not yet have individual volunteer records.
- The existing dashboard's hardcoded volunteer management is not connected to a database table.
- NGO status updates need an explicitly designed and authorized write policy before implementation.
- Do not assume that a frontend button successfully updates Supabase unless the database operation succeeds.

The existing schema uses NGO and veterinarian assignments, not individual volunteer assignments.

## 9. Integration priorities

Recommended implementation order:

1. Configure the Supabase frontend client.
2. Implement NGO login and session handling.
3. Fetch reports authorized by RLS.
4. Map database fields to existing dashboard components.
5. Display AI analysis.
6. Display report photos using signed URLs.
7. Display assignment information.
8. Implement authorized report status updates.
9. Add live refresh or realtime subscriptions.

## 10. Important security rule

The frontend must NEVER contain:
- SUPABASE_SERVICE_ROLE_KEY
- GEMINI_API_KEY
- TELEGRAM_BOT_TOKEN

All privileged backend operations must remain server-side.
