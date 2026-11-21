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

## Cruelty report page

`/report.html` lets anyone report animal cruelty: the type of cruelty, the
animal, whether it's happening now (with a prompt to call 112), date and time,
what they saw, people or vehicle involved, the place (state or UT, city,
locality, landmark, PIN code, optional GPS), up to 3 photos, and their contact
details, or nothing if they choose to stay anonymous. They get a reference
number like `PR-CR-7K2M9Q`. A sidebar cites the PCA Act 1960 s.11, BNS 2023
s.325, the ABC Rules 2023, the Wild Life (Protection) Act 1972 and Article
51A(g).

Reports go to `public.cruelty_reports` and photos to the private
`cruelty-evidence` bucket (section 5 of `supabase/member4_vet_adoption.sql`).
Anyone can file a report; only admins can read or update reports and photos.
For now, admins review them in the Supabase table editor.

## Automatic vet assignment

Run `supabase/auto_assign_vet.sql` once in the Supabase SQL Editor (after
`member4_vet_adoption.sql`). From then on:

- When an NGO accepts a case (or an admin assigns an NGO), the approved vet with
  the fewest open cases is added to that same assignment. Ties go to the vet who
  was assigned least recently.
- The vet is added to the NGO's own assignment row, so NGO offers and
  `claim_rescue_offer` behave exactly as before.
- If there are no approved vets yet, the case waits; it is handed out as soon as
  an admin approves a vet. Running the file also hands out any waiting cases.
- Admins can still add a vet or NGO by hand from the vet desk.
