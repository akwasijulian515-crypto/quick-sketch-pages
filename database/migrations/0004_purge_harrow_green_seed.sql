-- Remove only the Harrow Green demo tenant and its tenant-owned sample records.
-- Other schools and any accounts still associated with them are preserved.
select set_config('app.platform_admin', 'true', true);

do $$
declare
  target record;
begin
  for target in
    select id
    from schools
    where subdomain = 'harrowgreen' or name ilike '%Harrow Green%'
  loop
    perform set_config('app.school_id', target.id::text, true);

    delete from payment_gateway_events where school_id = target.id;
    delete from reconciliation_exceptions where school_id = target.id;
    delete from coupons where school_id = target.id;
    delete from payments where school_id = target.id;
    delete from invoices where school_id = target.id;
    delete from grade_entries where school_id = target.id;
    delete from assessments where school_id = target.id;
    delete from attendance_records where school_id = target.id;
    delete from attendance_sessions where school_id = target.id;
    delete from terminal_reports where school_id = target.id;
    delete from class_enrollments where school_id = target.id;
    delete from student_guardians where school_id = target.id;
    delete from teaching_assignments where school_id = target.id;
    delete from class_subjects where school_id = target.id;
    delete from classes where school_id = target.id;
    delete from subjects where school_id = target.id;
    delete from staff_profiles where school_id = target.id;
    delete from guardians where school_id = target.id;
    delete from students where school_id = target.id;
    delete from terms where school_id = target.id;
    delete from academic_years where school_id = target.id;
    delete from audit_log where school_id = target.id;
    delete from memberships where school_id = target.id;

    if to_regclass('public.continuous_assessments') is not null then
      execute 'delete from public.continuous_assessments where school_id = $1' using target.id;
    end if;
    if to_regclass('public.fee_coupons') is not null then
      execute 'delete from public.fee_coupons where school_id = $1' using target.id;
    end if;
    if to_regclass('public.user_passwords') is not null then
      if exists (
        select 1 from information_schema.columns
        where table_schema = 'public' and table_name = 'user_passwords' and column_name = 'user_id'
      ) then
        execute $query$
          delete from public.user_passwords
          where user_id in (
            select id from public.users
            where email ilike '%harrowgreen%'
              and not exists (
                select 1 from public.memberships m
                where m.user_id = public.users.id
                  and m.role = 'super_admin' and m.school_id is null
              )
          )
        $query$;
      elsif exists (
        select 1 from information_schema.columns
        where table_schema = 'public' and table_name = 'user_passwords' and column_name = 'email'
      ) then
        execute 'delete from public.user_passwords where email ilike $1' using '%harrowgreen%';
      end if;
    end if;

    delete from schools where id = target.id;
  end loop;

  delete from users u
  where u.email ilike '%harrowgreen%'
    and not exists (
      select 1 from memberships m
      where m.user_id = u.id
        and m.role = 'super_admin' and m.school_id is null
    )
    and not exists (select 1 from memberships m where m.user_id = u.id)
    and not exists (select 1 from guardians g where g.user_id = u.id)
    and not exists (select 1 from staff_profiles sp where sp.user_id = u.id)
    and not exists (select 1 from school_onboarding_applications a where a.reviewed_by_user_id = u.id);
end $$;
