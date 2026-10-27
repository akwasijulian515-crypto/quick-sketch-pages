create table if not exists school_workflow_settings (
  school_id uuid primary key references schools(id) on delete cascade,
  class_teachers_can_record_daily_fees boolean not null default false,
  attendance_print_format text not null default 'ges_term_to_date'
    check (attendance_print_format in ('daily_register', 'ges_weekly', 'ges_term_to_date')),
  updated_by_user_id uuid references users(id) on delete set null,
  updated_at timestamptz not null default now()
);

alter table school_workflow_settings enable row level security;
alter table school_workflow_settings force row level security;

do $$
begin
  if not exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'school_workflow_settings'
      and policyname = 'school_workflow_settings_tenant_isolation'
  ) then
    create policy school_workflow_settings_tenant_isolation
      on school_workflow_settings
      using (school_id = current_school_id())
      with check (school_id = current_school_id());
  end if;
end
$$;

grant select, insert, update, delete on school_workflow_settings to klasora_runtime;
