-- Point the global Super Admin at an inbox that can receive Neon Auth verification codes.
update users u
set email = 'narteyisaac686@gmail.com'
where lower(u.email) = 'superadmin@klasora.com'
  and exists (
    select 1 from memberships m
    where m.user_id = u.id and m.role = 'super_admin' and m.school_id is null
  )
  and not exists (
    select 1 from users other
    where lower(other.email) = 'narteyisaac686@gmail.com' and other.id <> u.id
  );
