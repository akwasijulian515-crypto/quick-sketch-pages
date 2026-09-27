-- Public sign-ups are applications, not live tenants. A Super Admin reviews
-- and activates them before a school can receive a tenant workspace.
alter table schools
  add column primary_color text not null default '#1f5c3b' check (primary_color ~ '^#[0-9A-Fa-f]{6}$'),
  add column crest_url text,
  add column contact_email text,
  add column contact_phone text;

create type school_application_status as enum ('pending', 'approved', 'rejected', 'cancelled');

create table school_onboarding_applications (
  id uuid primary key default gen_random_uuid(),
  school_name text not null check (char_length(school_name) between 2 and 160),
  requested_subdomain text not null unique check (requested_subdomain ~ '^[a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?$'),
  contact_name text not null,
  contact_email text not null,
  contact_phone text,
  primary_color text not null check (primary_color ~ '^#[0-9A-Fa-f]{6}$'),
  crest_url text,
  status school_application_status not null default 'pending',
  reviewed_by_user_id uuid references users(id) on delete set null,
  reviewed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index school_onboarding_applications_status_created_idx on school_onboarding_applications(status, created_at desc);
create trigger school_onboarding_applications_updated_at before update on school_onboarding_applications for each row execute function set_updated_at();
