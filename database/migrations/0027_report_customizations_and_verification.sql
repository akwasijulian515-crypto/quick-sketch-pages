alter table schools
  add column if not exists report_grading_system varchar(32) not null default 'nacca_50_50'
    check (report_grading_system in ('nacca_50_50', 'ges_traditional')),
  add column if not exists report_show_position boolean not null default true,
  add column if not exists report_show_class_benchmarks boolean not null default false,
  add column if not exists report_bill_mode varchar(32) not null default 'embedded_footer'
    check (report_bill_mode in ('embedded_footer', 'separate_sheet', 'none')),
  add column if not exists report_vacation_date date,
  add column if not exists report_reopening_date date,
  add column if not exists report_institutional_notice text,
  add column if not exists report_enable_qr boolean not null default true,
  add column if not exists report_enable_serial boolean not null default true,
  add column if not exists report_headteacher_signature_url text,
  add column if not exists report_rubber_stamp_url text,
  add column if not exists report_conditional_delivery boolean not null default false;

create table if not exists terminal_report_verifications (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references schools(id) on delete cascade,
  student_id uuid not null references students(id) on delete cascade,
  academic_year_id uuid not null references academic_years(id) on delete cascade,
  term_id uuid not null references terms(id) on delete cascade,
  class_id uuid not null references classes(id) on delete cascade,
  token varchar(64) not null unique,
  serial_number varchar(64) not null unique,
  verified_summary jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (school_id, student_id, term_id)
);

create index if not exists idx_report_verifications_token on terminal_report_verifications(token);
create index if not exists idx_report_verifications_serial on terminal_report_verifications(serial_number);

alter table terminal_report_verifications enable row level security;
alter table terminal_report_verifications force row level security;
create policy tenant_isolation on terminal_report_verifications
  using (school_id = nullif(current_setting('app.school_id', true), '')::uuid)
  with check (school_id = nullif(current_setting('app.school_id', true), '')::uuid);

create policy terminal_report_verifications_public_select
  on terminal_report_verifications for select
  to public
  using (token = nullif(current_setting('app.public_report_token', true), ''));

create trigger terminal_report_verifications_updated_at
  before update on terminal_report_verifications
  for each row execute function set_updated_at();
