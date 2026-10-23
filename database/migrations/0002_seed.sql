-- Keep only the global platform administrator; tenant records are created through onboarding.
select set_config('app.platform_admin', 'true', true);

with platform_user as (
  insert into users (id, email, display_name)
  values (
    '22222222-2222-4222-8222-222222222222'::uuid,
    'platform.admin@platform.local',
    'Platform Super Admin'
  )
  on conflict (email) do update set display_name = excluded.display_name
  returning id
)
insert into memberships (user_id, school_id, role)
select id, null, 'super_admin'
from platform_user
on conflict (user_id, school_id, role) do nothing;
