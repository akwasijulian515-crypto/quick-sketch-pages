alter table terms
  add column arrears_processed_at timestamptz;

alter table invoices
  add column base_amount_due numeric(12,2),
  add column arrears_amount numeric(12,2) not null default 0 check (arrears_amount >= 0),
  add column rolled_forward_at timestamptz;

update invoices set base_amount_due = amount_due where base_amount_due is null;

alter table invoices
  alter column base_amount_due set not null,
  add constraint invoices_school_id_id_unique unique (school_id, id),
  add constraint invoices_base_amount_due_nonnegative check (base_amount_due >= 0);

create table invoice_arrears (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references schools(id) on delete cascade,
  source_invoice_id uuid not null,
  destination_invoice_id uuid not null,
  source_term_id uuid not null,
  destination_term_id uuid not null,
  amount numeric(12,2) not null check (amount > 0),
  created_at timestamptz not null default now(),
  unique (source_invoice_id, destination_invoice_id),
  check (source_invoice_id <> destination_invoice_id),
  foreign key (school_id, source_invoice_id)
    references invoices(school_id, id) on delete cascade,
  foreign key (school_id, destination_invoice_id)
    references invoices(school_id, id) on delete cascade,
  foreign key (school_id, source_term_id)
    references terms(school_id, id) on delete restrict,
  foreign key (school_id, destination_term_id)
    references terms(school_id, id) on delete restrict
);

create index invoice_arrears_destination_idx
  on invoice_arrears(school_id, destination_invoice_id);

alter table invoice_arrears enable row level security;
alter table invoice_arrears force row level security;
create policy tenant_isolation on invoice_arrears
  using (school_id = current_school_id())
  with check (school_id = current_school_id());
create policy platform_read_access on invoice_arrears for select
  using (current_setting('app.platform_admin', true) = 'true');
