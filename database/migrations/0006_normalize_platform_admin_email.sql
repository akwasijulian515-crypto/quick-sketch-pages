-- Keep the retained global administrator independent from the deleted demo tenant.
update users u
set email = 'platform.admin@platform.local',
    display_name = 'Platform Super Admin'
where u.email ilike '%harrowgreen%'
  and exists (
    select 1 from memberships m
    where m.user_id = u.id and m.role = 'super_admin' and m.school_id is null
  )
  and not exists (
    select 1 from users other
    where lower(other.email) = lower('platform.admin@platform.local')
      and other.id <> u.id
  );
