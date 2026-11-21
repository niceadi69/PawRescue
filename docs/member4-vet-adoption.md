# Member 4 (Rhythm): Vet desk and adoption

Three pages that sit beside the NGO dashboard. They use the shared
`web/src/supabaseClient.js` and the same `web/.env` (Supabase URL + anon key),
and live in `web/src/member4/`, so they don't touch the NGO dashboard's files.

| Page | URL (dev) | Who | What it does |
| --- | --- | --- | --- |
| Vet desk | `http://localhost:5173/vet.html` | Vets (and admins) | Assigned cases, AI triage, photos, add medical records, medical history |
| Adoption desk | `http://localhost:5173/adoption-desk.html` | NGO staff and admins | List vet-cleared animals for adoption, approve or reject applications |
| Adoption portal | `http://localhost:5173/adopt.html` | Anyone | Browse adoptable animals, read their rescue story, apply |

Run it like the dashboard: `cd web`, `npm install`, `npm run dev`.

## One-time setup in Supabase

1. **SQL Editor:** run `supabase/member4_vet_adoption.sql`. It adds
   `medical_records`, `adoption_animals`, `adoption_requests`, the public
   `adoption-photos` bucket and their access rules. Safe to run again.
2. **Vet demo account:** Authentication → Users → Add user, e.g.
   `vet@pawrescue.demo` (tick Auto Confirm). Then run:

   ```sql
   insert into public.profiles (id, full_name, role)
   select id, 'Dr. Demo Vet', 'veterinarian'
   from auth.users where email = 'vet@pawrescue.demo'
   on conflict (id) do update set role = 'veterinarian', full_name = excluded.full_name;

   insert into public.veterinarians (id, qualification, clinic_name)
   select id, 'BVSc', 'PawRescue Partner Clinic'
   from auth.users where email = 'vet@pawrescue.demo'
   on conflict (id) do nothing;
   ```

   If vets need approval in your setup (like NGOs), mark this one approved too.
3. **Assign the report to an NGO and the vet** (admin-only). Easiest: sign in
   to `/vet.html` with an **admin** account (the main dashboard links there).
   Admins see every report; open one and use **Assignments** to pick an
   approved NGO (it then shows on that NGO's dashboard) and the vet. Or do it
   in SQL with a report's
   `id` from the `rescue_reports` table:

   ```sql
   insert into public.rescue_assignments (report_id, veterinarian_id, assignment_status)
   select 'PASTE-REPORT-ID', id, 'assigned'
   from auth.users where email = 'vet@pawrescue.demo';
   ```

4. **Adoption desk login:** any admin account works. NGO accounts see the
   reports assigned to them.

## Demo flow

1. Admin signs in on the main dashboard, clicks **Open the vet desk**, opens
   the new Telegram report and assigns it to an NGO and the vet.
2. Vet signs in at `/vet.html` (another browser or an incognito window),
   opens the case, sees the photo and AI triage, and saves an exam record.
   The NGO can read the history.
3. Vet saves a later record with status **Cleared for adoption**.
4. Admin/NGO opens `/adoption-desk.html`: the animal appears under
   **Ready to list**. Fill in a name and publish (the rescue photo is copied to
   the public bucket; nothing private is published).
5. Anyone opens `/adopt.html`, meets the animal and applies.
6. The application appears on the adoption desk. Approve it and the animal is
   marked **Adopted**.

## Notes for the team

- The public can apply but can never read applications; reporters' contact
  details are never shown on these pages.
- Adoption listings carry their own public rescue story and health summary,
  written by staff when listing, so no private report data reaches the public.
- To link these pages from the NGO dashboard, plain links work:
  `<a href="/vet.html">Vet desk</a>`, `/adoption-desk.html`, `/adopt.html`.
- `web/vite.config.js` lists all four pages so `npm run build` includes them.

## Donation page (demo only)

`/donate.html` is a demo donation page: a UPI block with amount picks and three
crypto wallets (BTC, ETH, USDT). Every QR code is a drawn pattern that can't be
scanned, and every UPI ID and wallet address is a deliberately invalid
placeholder, so the page can't receive money. It needs no database setup. The
login page and the adoption portal link to it.
