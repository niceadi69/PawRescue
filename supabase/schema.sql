
-- PawRescue Database
-- Stage 1: Core user and rescue report tables

CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- 1. User profiles
CREATE TABLE public.profiles (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    full_name TEXT,
    role TEXT NOT NULL DEFAULT 'user'
        CHECK (role IN ('user', 'ngo', 'veterinarian', 'admin')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 2. Rescue reports
CREATE TABLE public.rescue_reports (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    -- NULL allows anonymous Telegram submissions
    reporter_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,

    animal_type TEXT NOT NULL,
    description TEXT NOT NULL,

    location_text TEXT,
    latitude DOUBLE PRECISION,
    longitude DOUBLE PRECISION,

    status TEXT NOT NULL DEFAULT 'pending'
        CHECK (status IN (
            'pending',
            'reviewed',
            'assigned',
            'in_progress',
            'rescued',
            'closed',
            'cancelled',
            'duplicate'
        )),

    urgency TEXT NOT NULL DEFAULT 'unknown'
        CHECK (urgency IN ('low', 'medium', 'high', 'critical', 'unknown')),

    severity TEXT NOT NULL DEFAULT 'unknown'
        CHECK (severity IN ('low', 'moderate', 'high', 'critical', 'unknown')),

    ai_analysis JSONB,
    ai_status TEXT NOT NULL DEFAULT 'pending'
        CHECK (ai_status IN ('pending', 'completed', 'failed')),

    possible_duplicate_of UUID
        REFERENCES public.rescue_reports(id) ON DELETE SET NULL,

    source TEXT NOT NULL DEFAULT 'telegram'
        CHECK (source IN ('telegram')),

    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    -- Coordinates must be supplied together and within valid ranges
    CONSTRAINT valid_coordinates CHECK (
        (latitude IS NULL AND longitude IS NULL)
        OR
        (
            latitude IS NOT NULL
            AND longitude IS NOT NULL
            AND latitude BETWEEN -90 AND 90
            AND longitude BETWEEN -180 AND 180
        )
    ),

    -- A report needs at least one form of location information
    CONSTRAINT location_required CHECK (
        NULLIF(TRIM(location_text), '') IS NOT NULL
        OR (latitude IS NOT NULL AND longitude IS NOT NULL)
    )
);

-- 3. Useful indexes
CREATE INDEX idx_reports_created_at
    ON public.rescue_reports(created_at DESC);

CREATE INDEX idx_reports_status
    ON public.rescue_reports(status);

CREATE INDEX idx_reports_animal_type
    ON public.rescue_reports(animal_type);

CREATE INDEX idx_reports_possible_duplicate
    ON public.rescue_reports(possible_duplicate_of);


-- ==========================================
-- PawRescue Stage 2: Supporting tables
-- ==========================================

-- 1. NGOs
CREATE TABLE IF NOT EXISTS public.ngos (
    id UUID PRIMARY KEY REFERENCES public.profiles(id) ON DELETE CASCADE,
    organisation_name TEXT NOT NULL,
    description TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 2. Veterinarians
CREATE TABLE IF NOT EXISTS public.veterinarians (
    id UUID PRIMARY KEY REFERENCES public.profiles(id) ON DELETE CASCADE,
    qualification TEXT,
    clinic_name TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 3. Multiple photos per rescue report
CREATE TABLE IF NOT EXISTS public.report_photos (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    report_id UUID NOT NULL
        REFERENCES public.rescue_reports(id) ON DELETE CASCADE,
    storage_path TEXT NOT NULL,
    mime_type TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    UNIQUE (report_id, storage_path)
);

-- 4. Private report metadata
CREATE TABLE IF NOT EXISTS public.report_private_metadata (
    report_id UUID PRIMARY KEY
        REFERENCES public.rescue_reports(id) ON DELETE CASCADE,
    telegram_user_id TEXT,
    contact_number TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 5. Rescue assignments
CREATE TABLE IF NOT EXISTS public.rescue_assignments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    report_id UUID NOT NULL
        REFERENCES public.rescue_reports(id) ON DELETE CASCADE,

    ngo_id UUID REFERENCES public.ngos(id) ON DELETE SET NULL,

    veterinarian_id UUID
        REFERENCES public.veterinarians(id) ON DELETE SET NULL,

    assigned_by UUID
        REFERENCES public.profiles(id) ON DELETE SET NULL,

    assignment_status TEXT NOT NULL DEFAULT 'assigned'
        CHECK (assignment_status IN (
            'assigned',
            'accepted',
            'in_progress',
            'completed',
            'cancelled'
        )),

    assigned_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    CHECK (ngo_id IS NOT NULL OR veterinarian_id IS NOT NULL)
);

-- 6. Indexes for faster lookups
CREATE INDEX IF NOT EXISTS idx_report_photos_report
    ON public.report_photos(report_id);

CREATE INDEX IF NOT EXISTS idx_assignments_report
    ON public.rescue_assignments(report_id);

CREATE INDEX IF NOT EXISTS idx_assignments_ngo
    ON public.rescue_assignments(ngo_id);

CREATE INDEX IF NOT EXISTS idx_assignments_vet
    ON public.rescue_assignments(veterinarian_id);
