alter table school_workflow_settings
  add column daily_fee_arrears_mode text not null default 'isolated'
    check (daily_fee_arrears_mode in ('isolated', 'consolidated')),
  add column append_bill_to_report boolean not null default false;

alter table class_fees
  add column include_in_bill boolean not null default true,
  add column billing_target text not null default 'all'
    check (billing_target in ('all', 'returning_only', 'new_admissions_only'));

create table term_bill_snapshots (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references schools(id) on delete cascade,
  student_id uuid not null,
  source_term_id uuid,
  target_term_id uuid not null,
  target_class_id uuid not null,
  bill_type text not null default 'standard'
    check (bill_type in ('standard', 'admission')),
  arrears_amount numeric(12,2) not null default 0 check (arrears_amount >= 0),
  daily_arrears_amount numeric(12,2) not null default 0 check (daily_arrears_amount >= 0),
  base_bill_amount numeric(12,2) not null check (base_bill_amount >= 0),
  adjustment_amount numeric(12,2) not null default 0,
  total_amount_due numeric(12,2) not null
    check (total_amount_due >= 0 and total_amount_due = base_bill_amount + arrears_amount + adjustment_amount),
  line_items jsonb not null default '[]'::jsonb,
  generated_by_user_id uuid not null references users(id) on delete restrict,
  created_at timestamptz not null default now(),
  foreign key (school_id, student_id) references students(school_id, id) on delete cascade,
  foreign key (school_id, source_term_id) references terms(school_id, id) on delete restrict,
  foreign key (school_id, target_term_id) references terms(school_id, id) on delete restrict,
  foreign key (school_id, target_class_id) references classes(school_id, id) on delete restrict,
  unique (school_id, id),
  unique (school_id, student_id, target_term_id, bill_type)
);

create index term_bill_snapshots_lookup_idx
  on term_bill_snapshots(school_id, target_term_id, target_class_id);

alter table term_bill_snapshots enable row level security;
alter table term_bill_snapshots force row level security;
create policy tenant_isolation on term_bill_snapshots
  using (school_id = current_school_id())
  with check (school_id = current_school_id());

alter table invoices
  add column term_bill_snapshot_id uuid,
  add constraint invoices_school_term_bill_snapshot_fk
    foreign key (school_id, term_bill_snapshot_id)
    references term_bill_snapshots(school_id, id) on delete restrict;

create index invoices_term_bill_snapshot_idx
  on invoices(school_id, term_bill_snapshot_id)
  where term_bill_snapshot_id is not null;

grant select, insert, update on term_bill_snapshots to klasora_runtime;
