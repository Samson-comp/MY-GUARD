CREATE TABLE IF NOT EXISTS admins (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email TEXT NOT NULL UNIQUE,
    password_hash TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS professionals (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    display_name VARCHAR(80) NOT NULL,
    role VARCHAR(40) NOT NULL,
    experience_years SMALLINT NOT NULL CHECK (experience_years BETWEEN 0 AND 60),
    description VARCHAR(1200) NOT NULL,
    private_data BYTEA NOT NULL,
    photo_data BYTEA,
    photo_mime VARCHAR(40),
    status VARCHAR(16) NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'published', 'hidden')),
    consented_at TIMESTAMPTZ NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CHECK ((photo_data IS NULL) = (photo_mime IS NULL))
);
CREATE INDEX IF NOT EXISTS professionals_public_idx ON professionals (status, created_at DESC);

CREATE TABLE IF NOT EXISTS hire_requests (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    professional_id UUID REFERENCES professionals(id) ON DELETE SET NULL,
    professional_name VARCHAR(80) NOT NULL,
    private_data BYTEA NOT NULL,
    status VARCHAR(32) NOT NULL DEFAULT 'new' CHECK (status IN ('new', 'contacted', 'meeting_arranged', 'agreement_signed', 'closed', 'rejected')),
    admin_notes BYTEA NOT NULL,
    agreement_date DATE,
    consented_at TIMESTAMPTZ NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS hire_requests_created_idx ON hire_requests (created_at DESC);

CREATE TABLE IF NOT EXISTS jobs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    title VARCHAR(120) NOT NULL,
    category VARCHAR(80) NOT NULL,
    description VARCHAR(2500) NOT NULL,
    county VARCHAR(80),
    pay_min_kes INTEGER CHECK (pay_min_kes IS NULL OR pay_min_kes >= 0),
    pay_max_kes INTEGER CHECK (pay_max_kes IS NULL OR pay_max_kes >= 0),
    deadline DATE,
    status VARCHAR(8) NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'closed')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CHECK (pay_min_kes IS NULL OR pay_max_kes IS NULL OR pay_min_kes <= pay_max_kes)
);
CREATE INDEX IF NOT EXISTS jobs_public_idx ON jobs (status, created_at DESC);

CREATE TABLE IF NOT EXISTS job_applications (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    job_id UUID REFERENCES jobs(id) ON DELETE SET NULL,
    job_title VARCHAR(120) NOT NULL,
    private_data BYTEA NOT NULL,
    status VARCHAR(32) NOT NULL DEFAULT 'new' CHECK (status IN ('new', 'contacted', 'meeting_arranged', 'accepted', 'rejected', 'closed')),
    admin_notes BYTEA NOT NULL,
    consented_at TIMESTAMPTZ NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS job_applications_created_idx ON job_applications (created_at DESC);
