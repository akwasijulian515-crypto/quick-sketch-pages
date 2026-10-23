-- Harrow Green platform: consolidated initial schema (replaces old 001-007).

-- ===== from 001_multi_tenant.sql =====
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

-- ===== from 002_school_operations.sql =====
-- Core operational data. Every school-owned table has school_id so tenant
-- isolation is enforced in the database as well as in the application.

create type attendance_status as enum ('present', 'late', 'absent', 'excused');
create type invoice_status as enum ('draft', 'issued', 'part_paid', 'paid', 'overdue', 'void');
create type payment_method as enum ('cash', 'card', 'mobile_money', 'bank_transfer', 'other');
create type coupon_status as enum ('active', 'redeemed', 'expired', 'cancelled');

create or replace function current_school_id() returns uuid
language sql stable as $$
  select nullif(current_setting('app.school_id', true), '')::uuid
$$;

create or replace function set_updated_at() returns trigger
language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create table academic_years (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references schools(id) on delete cascade,
  name text not null,
  starts_on date not null,
  ends_on date not null,
  is_current boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (ends_on > starts_on),
  unique (school_id, name)
);
create unique index one_current_academic_year_per_school on academic_years(school_id) where is_current;

create table terms (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references schools(id) on delete cascade,
  academic_year_id uuid not null references academic_years(id) on delete cascade,
  name text not null,
  starts_on date not null,
  ends_on date not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (ends_on > starts_on),
  unique (academic_year_id, name)
);

create table staff_profiles (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references schools(id) on delete cascade,
  user_id uuid not null references users(id) on delete cascade,
  staff_number text,
  job_title text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (school_id, user_id),
  unique (school_id, staff_number)
);

create table students (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references schools(id) on delete cascade,
  admission_number text not null,
  first_name text not null,
  last_name text not null,
  date_of_birth date,
  gender text,
  joined_on date not null default current_date,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (school_id, admission_number)
);

create table guardians (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references schools(id) on delete cascade,
  user_id uuid references users(id) on delete set null,
  full_name text not null,
  phone text,
  email text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (school_id, email)
);

create table student_guardians (
  school_id uuid not null references schools(id) on delete cascade,
  student_id uuid not null references students(id) on delete cascade,
  guardian_id uuid not null references guardians(id) on delete cascade,
  relationship text,
  is_primary boolean not null default false,
  primary key (student_id, guardian_id)
);
create unique index one_primary_guardian_per_student on student_guardians(student_id) where is_primary;

create table subjects (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references schools(id) on delete cascade,
  code text not null,
  name text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (school_id, code)
);

create table classes (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references schools(id) on delete cascade,
  academic_year_id uuid not null references academic_years(id) on delete cascade,
  name text not null,
  form_level text not null,
  class_teacher_id uuid references staff_profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (academic_year_id, name)
);

create table class_enrollments (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references schools(id) on delete cascade,
  class_id uuid not null references classes(id) on delete cascade,
  student_id uuid not null references students(id) on delete cascade,
  starts_on date not null default current_date,
  ends_on date,
  created_at timestamptz not null default now(),
  check (ends_on is null or ends_on >= starts_on)
);
create unique index one_active_class_per_student on class_enrollments(student_id) where ends_on is null;

create table attendance_sessions (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references schools(id) on delete cascade,
  class_id uuid not null references classes(id) on delete cascade,
  attendance_date date not null,
  taken_by_staff_id uuid references staff_profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (class_id, attendance_date)
);

create table attendance_records (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references schools(id) on delete cascade,
  attendance_session_id uuid not null references attendance_sessions(id) on delete cascade,
  student_id uuid not null references students(id) on delete cascade,
  status attendance_status not null,
  marked_at timestamptz not null default now(),
  note text,
  unique (attendance_session_id, student_id)
);

create table assessments (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references schools(id) on delete cascade,
  term_id uuid not null references terms(id) on delete cascade,
  class_id uuid not null references classes(id) on delete cascade,
  subject_id uuid not null references subjects(id) on delete restrict,
  title text not null,
  maximum_score numeric(7,2) not null check (maximum_score > 0),
  created_by_staff_id uuid references staff_profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table grade_entries (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references schools(id) on delete cascade,
  assessment_id uuid not null references assessments(id) on delete cascade,
  student_id uuid not null references students(id) on delete cascade,
  score numeric(7,2) not null check (score >= 0),
  remark text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (assessment_id, student_id)
);

create table invoices (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references schools(id) on delete cascade,
  student_id uuid not null references students(id) on delete restrict,
  invoice_number text not null,
  description text not null,
  amount_due numeric(12,2) not null check (amount_due >= 0),
  currency char(3) not null default 'GHS',
  due_on date,
  status invoice_status not null default 'draft',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (school_id, invoice_number)
);

create table payments (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references schools(id) on delete cascade,
  invoice_id uuid references invoices(id) on delete set null,
  student_id uuid not null references students(id) on delete restrict,
  receipt_number text not null,
  amount numeric(12,2) not null check (amount > 0),
  currency char(3) not null default 'GHS',
  method payment_method not null,
  paid_at timestamptz not null default now(),
  recorded_by_staff_id uuid references staff_profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  unique (school_id, receipt_number)
);

create table coupons (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references schools(id) on delete cascade,
  student_id uuid references students(id) on delete set null,
  code text not null,
  status coupon_status not null default 'active',
  expires_at timestamptz,
  issued_by_staff_id uuid references staff_profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  unique (school_id, code)
);

create table terminal_reports (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references schools(id) on delete cascade,
  student_id uuid not null references students(id) on delete cascade,
  term_id uuid not null references terms(id) on delete cascade,
  generated_by_staff_id uuid references staff_profiles(id) on delete set null,
  published_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (student_id, term_id)
);

-- Tenant isolation policy for every operational table. The API must set
-- app.school_id after it has resolved the request subdomain and membership.
do $$
declare table_name text;
begin
  foreach table_name in array array['academic_years','terms','staff_profiles','students','guardians','student_guardians','subjects','classes','class_enrollments','attendance_sessions','attendance_records','assessments','grade_entries','invoices','payments','coupons','terminal_reports']
  loop
    execute format('alter table %I enable row level security', table_name);
    execute format('alter table %I force row level security', table_name);
    execute format('create policy tenant_isolation on %I using (school_id = current_school_id()) with check (school_id = current_school_id())', table_name);
  end loop;
end $$;

-- Hot-path tenant indexes.
create index students_school_active_idx on students(school_id, active, last_name, first_name);
create index attendance_records_school_student_idx on attendance_records(school_id, student_id);
create index grade_entries_school_student_idx on grade_entries(school_id, student_id);
create index invoices_school_student_status_idx on invoices(school_id, student_id, status);
create index payments_school_student_paid_at_idx on payments(school_id, student_id, paid_at desc);

create trigger academic_years_updated_at before update on academic_years for each row execute function set_updated_at();
create trigger terms_updated_at before update on terms for each row execute function set_updated_at();
create trigger staff_profiles_updated_at before update on staff_profiles for each row execute function set_updated_at();
create trigger students_updated_at before update on students for each row execute function set_updated_at();
create trigger guardians_updated_at before update on guardians for each row execute function set_updated_at();
create trigger subjects_updated_at before update on subjects for each row execute function set_updated_at();
create trigger classes_updated_at before update on classes for each row execute function set_updated_at();
create trigger attendance_sessions_updated_at before update on attendance_sessions for each row execute function set_updated_at();
create trigger assessments_updated_at before update on assessments for each row execute function set_updated_at();
create trigger grade_entries_updated_at before update on grade_entries for each row execute function set_updated_at();
create trigger invoices_updated_at before update on invoices for each row execute function set_updated_at();
create trigger terminal_reports_updated_at before update on terminal_reports for each row execute function set_updated_at();

-- ===== from 003_teaching_assignments.sql =====
-- Subjects can be taught in multiple classes, and a teacher may have more
-- than one assignment. All records remain isolated to one school tenant.
create table class_subjects (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references schools(id) on delete cascade,
  class_id uuid not null references classes(id) on delete cascade,
  subject_id uuid not null references subjects(id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (class_id, subject_id)
);

create table teaching_assignments (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references schools(id) on delete cascade,
  staff_profile_id uuid not null references staff_profiles(id) on delete cascade,
  class_subject_id uuid not null references class_subjects(id) on delete cascade,
  academic_year_id uuid not null references academic_years(id) on delete cascade,
  is_primary_teacher boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (staff_profile_id, class_subject_id, academic_year_id)
);

create index class_subjects_school_class_idx on class_subjects(school_id, class_id);
create index teaching_assignments_school_staff_idx on teaching_assignments(school_id, staff_profile_id);
create index teaching_assignments_school_year_idx on teaching_assignments(school_id, academic_year_id);

alter table class_subjects enable row level security;
alter table class_subjects force row level security;
create policy tenant_isolation on class_subjects using (school_id = current_school_id()) with check (school_id = current_school_id());

alter table teaching_assignments enable row level security;
alter table teaching_assignments force row level security;
create policy tenant_isolation on teaching_assignments using (school_id = current_school_id()) with check (school_id = current_school_id());

create trigger teaching_assignments_updated_at before update on teaching_assignments for each row execute function set_updated_at();

-- ===== from 004_gateway_payment_integrity.sql =====
-- A gateway transaction is authoritative. One provider reference can credit
-- exactly one school payment, and one webhook event can be processed once.
create type gateway_payment_status as enum ('initiated', 'pending', 'verified', 'failed', 'refunded', 'voided');

alter table payments
  add column provider text,
  add column provider_reference text,
  add column status gateway_payment_status not null default 'initiated',
  add column verified_at timestamptz,
  add column receipt_issued_at timestamptz;

-- Existing legacy payment rows may remain without a provider reference. New
-- gateway payments must populate both provider and provider_reference.
create unique index payments_school_provider_reference_unique
  on payments(school_id, provider, provider_reference)
  where provider is not null and provider_reference is not null;

create table payment_gateway_events (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references schools(id) on delete cascade,
  provider text not null,
  provider_event_id text not null,
  provider_reference text not null,
  event_type text not null,
  payload jsonb not null,
  received_at timestamptz not null default now(),
  processed_at timestamptz,
  unique (provider, provider_event_id)
);

create index payment_gateway_events_school_reference_idx on payment_gateway_events(school_id, provider_reference);
alter table payment_gateway_events enable row level security;
alter table payment_gateway_events force row level security;
create policy tenant_isolation on payment_gateway_events using (school_id = current_school_id()) with check (school_id = current_school_id());

-- A payment receipt may be issued only after verification. Enforce that link
-- in the database, even if a future UI accidentally sends the wrong request.
create or replace function enforce_verified_receipt() returns trigger
language plpgsql as $$
begin
  if new.receipt_issued_at is not null and new.status <> 'verified' then
    raise exception 'A receipt can only be issued for a verified gateway payment';
  end if;
  return new;
end;
$$;

create trigger payments_verified_receipt_guard
  before insert or update on payments
  for each row execute function enforce_verified_receipt();

-- ===== from 005_reconciliation_exceptions.sql =====
create type reconciliation_exception_status as enum ('open', 'investigating', 'resolved', 'dismissed');
create type reconciliation_exception_severity as enum ('info', 'review', 'critical');

create table reconciliation_exceptions (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references schools(id) on delete cascade,
  reconciliation_date date not null,
  student_id uuid references students(id) on delete set null,
  payment_id uuid references payments(id) on delete set null,
  exception_type text not null,
  severity reconciliation_exception_severity not null default 'review',
  description text not null,
  status reconciliation_exception_status not null default 'open',
  assigned_to_staff_id uuid references staff_profiles(id) on delete set null,
  due_at timestamptz,
  resolution_note text,
  resolved_by_staff_id uuid references staff_profiles(id) on delete set null,
  resolved_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check ((status not in ('resolved', 'dismissed')) or (resolution_note is not null and resolved_at is not null))
);

create index reconciliation_exceptions_school_date_status_idx on reconciliation_exceptions(school_id, reconciliation_date, status);
alter table reconciliation_exceptions enable row level security;
alter table reconciliation_exceptions force row level security;
create policy tenant_isolation on reconciliation_exceptions using (school_id = current_school_id()) with check (school_id = current_school_id());
create trigger reconciliation_exceptions_updated_at before update on reconciliation_exceptions for each row execute function set_updated_at();

-- ===== from 006_school_onboarding.sql =====
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

-- ===== from 007_daily_fee_coupons.sql =====
-- A daily-fee coupon is a teacher-facing clearance token. It is not a
-- discount and it is not an official payment receipt.
create type payment_category as enum ('daily_fee', 'school_fee', 'examination_fee', 'other');

alter table payments
  alter column receipt_number drop not null,
  add column category payment_category not null default 'other',
  add column daily_fee_date date;

-- One student can have only one recorded daily-fee collection for a school day.
create unique index payments_daily_fee_once_per_day
  on payments(school_id, student_id, daily_fee_date)
  where category = 'daily_fee';

alter table coupons
  add column payment_id uuid references payments(id) on delete restrict,
  add column valid_on date;

create unique index coupons_daily_fee_payment_once
  on coupons(payment_id)
  where payment_id is not null;

-- Daily-fee clearances deliberately cannot carry a receipt number. School-fee
-- receipts remain governed by the verified-receipt guard from migration 004.
create or replace function enforce_daily_fee_coupon_rules() returns trigger
language plpgsql as $$
begin
  if new.category = 'daily_fee' and (new.receipt_number is not null or new.receipt_issued_at is not null) then
    raise exception 'Daily-fee payments do not issue official receipts';
  end if;
  if new.category = 'daily_fee' and new.daily_fee_date is null then
    raise exception 'Daily-fee payments require a collection date';
  end if;
  return new;
end;
$$;

create trigger payments_daily_fee_coupon_guard
  before insert or update on payments
  for each row execute function enforce_daily_fee_coupon_rules();

comment on table coupons is 'Teacher-visible daily-fee clearance tokens; not discount vouchers or payment receipts.';
