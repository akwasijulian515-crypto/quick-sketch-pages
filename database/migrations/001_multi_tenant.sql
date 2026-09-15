-- Run this migration against a PostgreSQL 15+ database before enabling the API.
create extension if not exists pgcrypto;

create type school_status as enum ('trial', 'active', 'suspended');
create type membership_role as enum ('super_admin', 'school_admin', 'teacher', 'finance', 'parent', 'student');

create table schools (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(name) between 2 and 160),
  subdomain text not null unique check (subdomain ~ '^[a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?$'),
  status school_status not null default 'trial',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table users (
  id uuid primary key default gen_random_uuid(),
  email text not null unique,
  display_name text not null,
  created_at timestamptz not null default now()
);

create table memberships (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references users(id) on delete cascade,
  school_id uuid references schools(id) on delete cascade,
  role membership_role not null,
  created_at timestamptz not null default now(),
  -- Platform-wide super admins never belong to just one school.
  check ((role = 'super_admin' and school_id is null) or (role <> 'super_admin' and school_id is not null)),
  unique nulls not distinct (user_id, school_id, role)
);

-- Every operational table added later (students, classes, invoices, attendance)
-- must contain school_id and use the same policy pattern below.
create table audit_log (
  id uuid primary key default gen_random_uuid(),
  school_id uuid references schools(id) on delete cascade,
  actor_user_id uuid references users(id) on delete set null,
  action text not null,
  entity_type text not null,
  entity_id uuid,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index memberships_school_id_idx on memberships(school_id);
create index audit_log_school_created_at_idx on audit_log(school_id, created_at desc);

alter table memberships enable row level security;
alter table audit_log enable row level security;
alter table memberships force row level security;
alter table audit_log force row level security;

-- The API sets app.school_id for a school-scoped request. Platform queries use
-- a separate, authenticated super-admin path and never rely on this policy.
create policy school_memberships_isolation on memberships
  using (school_id = nullif(current_setting('app.school_id', true), '')::uuid);
create policy school_audit_log_isolation on audit_log
  using (school_id = nullif(current_setting('app.school_id', true), '')::uuid);
