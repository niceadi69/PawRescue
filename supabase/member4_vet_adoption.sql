-- ==========================================
-- PawRescue Member 4 (Rhythm): vet medical records + adoption
-- ==========================================
-- Run once in Supabase -> SQL Editor. Safe to run again.
--
-- Adds:
--   medical_records    vets record exams/treatment for reports assigned to them
--   adoption_animals   recovered animals listed for adoption (public can browse)
--   adoption_requests  public adoption applications (only staff can read them)
--   adoption-photos    public Storage bucket for adoption listing photos
--
-- Access follows the existing rules: admins see everything; vets and NGOs
-- see reports through rescue_assignments. Helper functions are prefixed m4_
-- so they don't clash with existing ones.

-- ---------- Helpers ----------

create or replace function public.m4_current_role()
returns text
language sql
stable
security definer
set search_path = public
as $$
    select role from public.profiles where id = auth.uid();
$$;

create or replace function public.m4_is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
    select coalesce(public.m4_current_role() = 'admin', false);
$$;

create or replace function public.m4_is_assigned_vet(p_report_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
    select exists (
        select 1
        from public.rescue_assignments a
        where a.report_id = p_report_id
          and a.veterinarian_id = auth.uid()
          and a.assignment_status <> 'cancelled'
    );
$$;

create or replace function public.m4_is_assigned_ngo(p_report_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
    select exists (
        select 1
        from public.rescue_assignments a
        where a.report_id = p_report_id
          and a.ngo_id = auth.uid()
          and a.assignment_status <> 'cancelled'
    );
$$;

grant execute on function public.m4_current_role() to anon, authenticated;
grant execute on function public.m4_is_admin() to anon, authenticated;
grant execute on function public.m4_is_assigned_vet(uuid) to anon, authenticated;
grant execute on function public.m4_is_assigned_ngo(uuid) to anon, authenticated;

-- ---------- Medical records ----------

create table if not exists public.medical_records (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    report_id UUID NOT NULL
        REFERENCES public.rescue_reports(id) ON DELETE CASCADE,
    vet_id UUID NOT NULL DEFAULT auth.uid()
        REFERENCES public.profiles(id),
    observations TEXT NOT NULL CHECK (char_length(trim(observations)) > 0),
    diagnosis TEXT,
    treatment TEXT,
    medication TEXT,
    follow_up TEXT,
    medical_status TEXT NOT NULL DEFAULT 'under_treatment'
        CHECK (medical_status IN (
            'under_observation',
            'under_treatment',
            'recovering',
            'recovered',
            'cleared_for_adoption'
        )),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

create index if not exists idx_medical_records_report
    on public.medical_records(report_id, created_at desc);

alter table public.medical_records enable row level security;
grant select, insert, update on public.medical_records to authenticated;

drop policy if exists "m4 read medical records" on public.medical_records;
create policy "m4 read medical records"
    on public.medical_records for select to authenticated
    using (
        public.m4_is_admin()
        or public.m4_is_assigned_vet(report_id)
        or public.m4_is_assigned_ngo(report_id)
    );

drop policy if exists "m4 vets add medical records" on public.medical_records;
create policy "m4 vets add medical records"
    on public.medical_records for insert to authenticated
    with check (
        vet_id = auth.uid()
        and (public.m4_is_assigned_vet(report_id) or public.m4_is_admin())
    );

drop policy if exists "m4 vets edit own medical records" on public.medical_records;
create policy "m4 vets edit own medical records"
    on public.medical_records for update to authenticated
    using (vet_id = auth.uid() or public.m4_is_admin())
    with check (vet_id = auth.uid() or public.m4_is_admin());

-- ---------- Adoption listings ----------

create table if not exists public.adoption_animals (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    -- one listing per rescued animal
    report_id UUID UNIQUE
        REFERENCES public.rescue_reports(id) ON DELETE SET NULL,
    name TEXT NOT NULL CHECK (char_length(trim(name)) > 0),
    species TEXT NOT NULL,
    age_text TEXT,
    sex TEXT NOT NULL DEFAULT 'unknown'
        CHECK (sex IN ('male', 'female', 'unknown')),
    description TEXT,
    health_summary TEXT,
    rescue_story TEXT,
    photo_url TEXT,
    adoption_status TEXT NOT NULL DEFAULT 'available'
        CHECK (adoption_status IN (
            'available',
            'application_pending',
            'adopted',
            'withdrawn'
        )),
    listed_by UUID DEFAULT auth.uid() REFERENCES public.profiles(id),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

alter table public.adoption_animals enable row level security;
grant select on public.adoption_animals to anon, authenticated;
grant insert, update on public.adoption_animals to authenticated;

-- Anyone can browse animals that are up for adoption; staff also see their
-- adopted and withdrawn listings.
drop policy if exists "m4 browse adoptable animals" on public.adoption_animals;
create policy "m4 browse adoptable animals"
    on public.adoption_animals for select to anon, authenticated
    using (
        adoption_status in ('available', 'application_pending')
        or listed_by = auth.uid()
        or public.m4_is_admin()
    );

drop policy if exists "m4 staff list animals" on public.adoption_animals;
create policy "m4 staff list animals"
    on public.adoption_animals for insert to authenticated
    with check (
        public.m4_current_role() in ('ngo', 'admin')
        and listed_by = auth.uid()
        and (
            report_id is null
            or public.m4_is_admin()
            or public.m4_is_assigned_ngo(report_id)
        )
    );

drop policy if exists "m4 staff update listings" on public.adoption_animals;
create policy "m4 staff update listings"
    on public.adoption_animals for update to authenticated
    using (listed_by = auth.uid() or public.m4_is_admin())
    with check (listed_by = auth.uid() or public.m4_is_admin());

-- ---------- Adoption applications ----------

create table if not exists public.adoption_requests (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    animal_id UUID NOT NULL
        REFERENCES public.adoption_animals(id) ON DELETE CASCADE,
    applicant_name TEXT NOT NULL
        CHECK (char_length(trim(applicant_name)) BETWEEN 1 AND 120),
    contact TEXT NOT NULL
        CHECK (char_length(trim(contact)) BETWEEN 3 AND 200),
    locality TEXT CHECK (char_length(locality) <= 200),
    living_situation TEXT CHECK (char_length(living_situation) <= 200),
    experience TEXT CHECK (char_length(experience) <= 1000),
    reason TEXT CHECK (char_length(reason) <= 1000),
    status TEXT NOT NULL DEFAULT 'pending'
        CHECK (status IN ('pending', 'approved', 'rejected')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

create index if not exists idx_adoption_requests_animal
    on public.adoption_requests(animal_id);

alter table public.adoption_requests enable row level security;
grant insert on public.adoption_requests to anon, authenticated;
grant select, update on public.adoption_requests to authenticated;

-- The public can apply, but never read anyone's application.
drop policy if exists "m4 public applies" on public.adoption_requests;
create policy "m4 public applies"
    on public.adoption_requests for insert to anon, authenticated
    with check (
        status = 'pending'
        and exists (
            select 1
            from public.adoption_animals a
            where a.id = animal_id
              and a.adoption_status in ('available', 'application_pending')
        )
    );

drop policy if exists "m4 staff read applications" on public.adoption_requests;
create policy "m4 staff read applications"
    on public.adoption_requests for select to authenticated
    using (
        exists (
            select 1
            from public.adoption_animals a
            where a.id = animal_id
              and (a.listed_by = auth.uid() or public.m4_is_admin())
        )
    );

drop policy if exists "m4 staff decide applications" on public.adoption_requests;
create policy "m4 staff decide applications"
    on public.adoption_requests for update to authenticated
    using (
        exists (
            select 1
            from public.adoption_animals a
            where a.id = animal_id
              and (a.listed_by = auth.uid() or public.m4_is_admin())
        )
    );

-- ---------- Public bucket for adoption photos ----------

insert into storage.buckets (id, name, public)
values ('adoption-photos', 'adoption-photos', true)
on conflict (id) do update set public = true;

drop policy if exists "m4 staff upload adoption photos" on storage.objects;
create policy "m4 staff upload adoption photos"
    on storage.objects for insert to authenticated
    with check (
        bucket_id = 'adoption-photos'
        and public.m4_current_role() in ('ngo', 'admin')
    );

-- =============================================================
-- 5. Cruelty reports from the public web form (/report.html)
--    Anyone can file one; only admins can read or update them.
-- =============================================================
create table if not exists public.cruelty_reports (
    id uuid primary key default gen_random_uuid(),
    created_at timestamptz not null default now(),
    reference text not null unique,
    incident_type text not null check (incident_type in (
        'beating', 'poisoning', 'neglect', 'abandonment', 'transport',
        'slaughter', 'dog_removal', 'fights_shows', 'wildlife', 'other'
    )),
    animal_type text not null,
    animal_count integer not null default 1 check (animal_count between 1 and 500),
    happening_now boolean not null default false,
    incident_date date,
    incident_time text,
    description text not null check (char_length(description) between 20 and 4000),
    people_involved text,
    vehicle_number text,
    state text not null,
    city text not null,
    locality text not null,
    landmark text,
    pincode text check (pincode is null or pincode ~ '^[1-9][0-9]{5}$'),
    latitude double precision,
    longitude double precision,
    evidence_paths text[] not null default '{}',
    is_anonymous boolean not null default false,
    reporter_name text,
    reporter_phone text check (reporter_phone is null or reporter_phone ~ '^[6-9][0-9]{9}$'),
    reporter_email text,
    contact_ok boolean not null default false,
    wants_fir_help boolean not null default false,
    status text not null default 'received'
        check (status in ('received', 'under_review', 'referred', 'closed')),
    staff_notes text
);

alter table public.cruelty_reports enable row level security;

drop policy if exists "m4 anyone can file a cruelty report" on public.cruelty_reports;
create policy "m4 anyone can file a cruelty report"
    on public.cruelty_reports for insert to anon, authenticated
    with check (
        status = 'received'
        and staff_notes is null
        and (
            not is_anonymous
            or (reporter_name is null and reporter_phone is null and reporter_email is null)
        )
    );

drop policy if exists "m4 admins read cruelty reports" on public.cruelty_reports;
create policy "m4 admins read cruelty reports"
    on public.cruelty_reports for select to authenticated
    using (public.m4_is_admin());

drop policy if exists "m4 admins update cruelty reports" on public.cruelty_reports;
create policy "m4 admins update cruelty reports"
    on public.cruelty_reports for update to authenticated
    using (public.m4_is_admin())
    with check (public.m4_is_admin());

grant insert on public.cruelty_reports to anon, authenticated;
grant select, update on public.cruelty_reports to authenticated;

-- Private bucket for evidence photos: the public can upload, only admins can view
insert into storage.buckets (id, name, public)
values ('cruelty-evidence', 'cruelty-evidence', false)
on conflict (id) do nothing;

drop policy if exists "m4 anyone can upload cruelty evidence" on storage.objects;
create policy "m4 anyone can upload cruelty evidence"
    on storage.objects for insert to anon, authenticated
    with check (bucket_id = 'cruelty-evidence');

drop policy if exists "m4 admins view cruelty evidence" on storage.objects;
create policy "m4 admins view cruelty evidence"
    on storage.objects for select to authenticated
    using (bucket_id = 'cruelty-evidence' and public.m4_is_admin());
