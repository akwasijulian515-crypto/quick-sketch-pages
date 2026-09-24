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
