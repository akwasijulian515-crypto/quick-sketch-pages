create table school_workflow_settings (
  school_id uuid primary key references schools(id) on delete cascade,
  class_teachers_can_record_daily_fees boolean not null default false,
  attendance_print_format text not null default 'ges_weekly'
    check (attendance_print_format in ('daily_register', 'ges_weekly')),
  updated_by_user_id uuid references users(id) on delete set null,
  updated_at timestamptz not null default now()
);

alter table school_workflow_settings enable row level security;
alter table school_workflow_settings force row level security;

create policy school_workflow_settings_tenant_isolation
  on school_workflow_settings
  using (school_id = current_school_id())
  with check (school_id = current_school_id());
