-- The Neon owner connection bypasses RLS. Application transactions must assume this role.
do $$
begin
  if not exists (select 1 from pg_roles where rolname = 'klasora_runtime') then
    execute 'create role klasora_runtime nologin nobypassrls';
  else
    execute 'alter role klasora_runtime nologin nobypassrls';
  end if;
end $$;

grant klasora_runtime to current_user;
grant usage on schema public to klasora_runtime;
grant select, insert, update, delete on all tables in schema public to klasora_runtime;
grant usage, select, update on all sequences in schema public to klasora_runtime;
alter default privileges in schema public
  grant select, insert, update, delete on tables to klasora_runtime;
alter default privileges in schema public
  grant usage, select, update on sequences to klasora_runtime;

do $$
declare
  table_name text;
begin
  foreach table_name in array array[
    'audit_log', 'academic_years', 'terms', 'staff_profiles', 'students', 'guardians',
    'student_guardians', 'subjects', 'classes', 'class_enrollments', 'attendance_sessions',
    'attendance_records', 'assessments', 'grade_entries', 'invoices', 'payments', 'coupons',
    'terminal_reports', 'class_subjects', 'teaching_assignments', 'payment_gateway_events',
    'reconciliation_exceptions'
  ]
  loop
    execute format(
      'create policy platform_read_access on %I for select using (current_setting(''app.platform_admin'', true) = ''true'')',
      table_name
    );
  end loop;
end $$;
