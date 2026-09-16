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
