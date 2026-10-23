-- Move the global Super Admin to a real, deliverable email so it can sign in with Neon Auth.
update users u
set email = 'superadmin@klasora.com'
where lower(u.email) = 'platform.admin@platform.local'
  and exists (
    select 1 from memberships m
    where m.user_id = u.id and m.role = 'super_admin' and m.school_id is null
  )
  and not exists (
    select 1 from users other
    where lower(other.email) = 'superadmin@klasora.com' and other.id <> u.id
  );
