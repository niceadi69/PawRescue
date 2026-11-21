-- ==========================================
-- PawRescue: automatic vet assignment
-- ==========================================
-- Run once in Supabase -> SQL Editor (after schema.sql and
-- member4_vet_adoption.sql). Safe to run again.
--
-- What it does
--   When a case gets an NGO (an NGO presses "Accept Case", or an admin
--   assigns one), the least busy approved vet is put on that same
--   assignment automatically. The vet sees the case in the vet desk and the
--   NGO sees the vet's treatment updates.
--
-- What it does NOT touch
--   NGO matching, offers and claim_rescue_offer work exactly as before.
--   The vet is added to the NGO's own assignment row (no extra row), so
--   nothing can make a case look "already claimed".
--
-- Least busy = fewest open assignments (not completed or cancelled); ties go
-- to whoever was assigned least recently, then at random.

-- ---------- Pick a vet ----------

create or replace function public.m4_pick_vet()
returns uuid
language plpgsql
volatile
security definer
set search_path = public
as $$
declare
    v_vet uuid;
begin
    -- one assignment at a time, so two cases at once can't both go to the
    -- same "least busy" vet
    perform pg_advisory_xact_lock(hashtext('pawrescue_vet_autoassign'));

    select v.id
      into v_vet
      from public.veterinarians v
      join public.profiles p
        on p.id = v.id
       and p.role = 'veterinarian'
      left join public.rescue_assignments a
        on a.veterinarian_id = v.id
    group by v.id
    order by
        count(a.id) filter (
            where a.assignment_status not in ('completed', 'cancelled')
        ) asc,
        coalesce(max(a.assigned_at), 'epoch'::timestamptz) asc,
        random()
    limit 1;

    return v_vet;  -- null when there are no approved vets yet
end;
$$;

-- ---------- Assign on every new NGO assignment ----------

create or replace function public.m4_auto_assign_vet()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
    if new.ngo_id is not null
       and new.veterinarian_id is null
       and new.assignment_status not in ('completed', 'cancelled') then
        new.veterinarian_id := public.m4_pick_vet();
    end if;

    return new;
end;
$$;

drop trigger if exists m4_auto_assign_vet on public.rescue_assignments;
create trigger m4_auto_assign_vet
    before insert on public.rescue_assignments
    for each row
    execute function public.m4_auto_assign_vet();

-- ---------- Catch up cases that are waiting for a vet ----------

create or replace function public.m4_assign_waiting_cases()
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
    r record;
    v_vet uuid;
    v_count integer := 0;
begin
    for r in
        select id
          from public.rescue_assignments
         where ngo_id is not null
           and veterinarian_id is null
           and assignment_status not in ('completed', 'cancelled')
         order by assigned_at
    loop
        v_vet := public.m4_pick_vet();
        exit when v_vet is null;

        update public.rescue_assignments
           set veterinarian_id = v_vet
         where id = r.id;

        v_count := v_count + 1;
    end loop;

    return v_count;
end;
$$;

-- When an account becomes a vet (admin approves a vet application), hand it
-- any cases that were waiting because no vet existed yet.
create or replace function public.m4_vet_joined()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
    if new.role = 'veterinarian'
       and old.role is distinct from 'veterinarian' then
        perform public.m4_assign_waiting_cases();
    end if;

    return new;
end;
$$;

drop trigger if exists m4_vet_joined on public.profiles;
create trigger m4_vet_joined
    after update of role on public.profiles
    for each row
    execute function public.m4_vet_joined();

-- Only the triggers call these.
revoke all on function public.m4_pick_vet() from public, anon, authenticated;
revoke all on function public.m4_assign_waiting_cases() from public, anon, authenticated;

-- Give a vet to every case an NGO has already taken.
select public.m4_assign_waiting_cases() as cases_given_a_vet;
