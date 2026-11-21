-- ==========================================
-- PawRescue: dashboard access (Row Level Security)
-- ==========================================
-- Run this once in Supabase -> SQL Editor. Safe to run again.
--
-- What it does:
--   * Turns on Row Level Security for every PawRescue table, so the public
--     anon key in the web app can't read anything by itself.
--   * Lets signed-in NGO staff, vets and admins (profiles.role) read reports
--     and photos, update report status and manage assignments.
--   * Keeps report_private_metadata (reporter phone numbers, Telegram IDs)
--     readable only by the bot, which uses the service-role key.
--
-- The bot uses the service-role key, which bypasses RLS, so it keeps working.
--
-- After running it, create the demo NGO login:
--   1. Authentication -> Users -> Add user -> Create new user
--      (tick "Auto Confirm User"), e.g. ngo@pawrescue.demo
--   2. Run the INSERT at the bottom of this file with that email.

-- 1. Helper: is the signed-in user rescue staff?
-- SECURITY DEFINER lets it read profiles without tripping profiles' own RLS.
create or replace function public.is_staff()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
    select exists (
        select 1
        from public.profiles
        where id = auth.uid()
          and role in ('ngo', 'veterinarian', 'admin')
    );
$$;

-- 2. Turn on RLS everywhere
alter table public.profiles                enable row level security;
alter table public.rescue_reports          enable row level security;
alter table public.report_photos           enable row level security;
alter table public.report_private_metadata enable row level security;
alter table public.rescue_assignments      enable row level security;
alter table public.ngos                    enable row level security;
alter table public.veterinarians           enable row level security;

-- 3. Policies for signed-in staff

drop policy if exists "Users read own profile, staff read all" on public.profiles;
create policy "Users read own profile, staff read all"
    on public.profiles for select to authenticated
    using (id = auth.uid() or public.is_staff());

drop policy if exists "Staff read reports" on public.rescue_reports;
create policy "Staff read reports"
    on public.rescue_reports for select to authenticated
    using (public.is_staff());

drop policy if exists "Staff update reports" on public.rescue_reports;
create policy "Staff update reports"
    on public.rescue_reports for update to authenticated
    using (public.is_staff())
    with check (public.is_staff());

drop policy if exists "Staff read report photos" on public.report_photos;
create policy "Staff read report photos"
    on public.report_photos for select to authenticated
    using (public.is_staff());

drop policy if exists "Staff manage assignments" on public.rescue_assignments;
create policy "Staff manage assignments"
    on public.rescue_assignments for all to authenticated
    using (public.is_staff())
    with check (public.is_staff());

drop policy if exists "Staff read NGOs" on public.ngos;
create policy "Staff read NGOs"
    on public.ngos for select to authenticated
    using (public.is_staff());

drop policy if exists "Staff read vets" on public.veterinarians;
create policy "Staff read vets"
    on public.veterinarians for select to authenticated
    using (public.is_staff());

-- report_private_metadata gets no policy on purpose:
-- only the bot (service-role key) can read reporters' contact details.

-- 4. Let staff view photos in the private "rescue-photos" bucket
drop policy if exists "Staff read rescue photos" on storage.objects;
create policy "Staff read rescue photos"
    on storage.objects for select to authenticated
    using (bucket_id = 'rescue-photos' and public.is_staff());

-- 5. Give the demo login its NGO role.
--    Replace the email with the user you created in step 1 above.
insert into public.profiles (id, full_name, role)
select id, 'PawRescue NGO', 'ngo'
from auth.users
where email = 'ngo@pawrescue.demo'
on conflict (id) do update set role = excluded.role;
