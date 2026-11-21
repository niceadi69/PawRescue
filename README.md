# PawRescue
Animal Rescue &amp; Adoption Platform — SatHack 2026

## Pages

| Page | File | Who uses it |
|---|---|---|
| Landing + staff sign-in | `web/index.html` | Everyone; NGOs, admins, vets and volunteers sign in here |
| Vet desk | `web/vet.html` | Vets and admins |
| Adoption desk | `web/adoption-desk.html` | NGOs and admins |
| Adopt a rescued animal | `web/adopt.html` | Public |
| Donate (demo, no real payments) | `web/donate.html` | Public |
| Report animal cruelty | `web/report.html` | Public |

Injured animals are reported through the Telegram bot in `bot/`.

## Deploying the website

The site is a static Vite build in `web/`.

1. Set these environment variables on the host (they are baked in at build time):
   - `VITE_SUPABASE_URL`
   - `VITE_SUPABASE_ANON_KEY` (the public anon key, never the service-role key)
   - `VITE_TELEGRAM_BOT_URL` (optional, e.g. `https://t.me/<bot name>`; powers the
     landing page's "Report an Injured Animal" button)
2. **Vercel:** import the repo, set **Root Directory** to `web`. `web/vercel.json`
   sets the rest (build `npm run build`, output `dist`, `/vet` works as well as `/vet.html`).
   **Netlify:** set **Base directory** to `web`; `web/netlify.toml` sets the rest.
3. In Supabase → Authentication → URL Configuration, add the deployed URL as the
   Site URL so sign-up confirmation emails link back to it.
4. Run the SQL in `supabase/` once (SQL Editor) if it hasn't been run on this project,
   in this order: `schema.sql`, `member4_vet_adoption.sql`, `auto_assign_vet.sql`.

## How cases flow

1. Someone reports an injured animal to the Telegram bot; the AI triages it.
2. NGOs whose service areas match get the case offered and one presses **Accept Case**.
3. **A vet is assigned automatically** to that case: the approved vet with the fewest
   open cases (`supabase/auto_assign_vet.sql`). NGO matching is unchanged.
4. The vet records treatment in the vet desk; the NGO sees the progress on its dashboard.
5. Once the vet clears the animal for adoption, staff list it from the adoption desk and it
   appears on the public adoption page.

Local check: `cd web && npm install && npm run build && npm run preview`.

## Running the bot

`pip install -r requirements.txt`, then create `.env` in the repo root with
`TELEGRAM_BOT_TOKEN`, `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY` and
`GROQ_API_KEY` (optionally `GROQ_MODEL`), and run `python bot/bot.py`. It must
stay running for reports to come in. Keep this `.env` out of git.
