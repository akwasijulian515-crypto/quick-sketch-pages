create table school_holidays (
  school_id uuid not null references schools(id) on delete cascade,
  holiday_date date not null,
  name text not null check (char_length(btrim(name)) between 2 and 120),
  created_by_user_id uuid references users(id) on delete set null,
  created_at timestamptz not null default now(),
  primary key (school_id, holiday_date)
);

alter table school_holidays enable row level security;
alter table school_holidays force row level security;
create policy tenant_isolation on school_holidays
  using (school_id = current_school_id())
  with check (school_id = current_school_id());
create policy platform_read_access on school_holidays for select
  using (current_setting('app.platform_admin', true) = 'true');
