-- Membership reads are limited to the verified account or a validated platform request.
create policy user_memberships_isolation on memberships
  for select
  using (
    user_id = (
      select id
      from users
      where lower(email) = lower(nullif(current_setting('app.user_email', true), ''))
      limit 1
    )
  );

create policy platform_memberships_access on memberships
  for all
  using (current_setting('app.platform_admin', true) = 'true')
  with check (current_setting('app.platform_admin', true) = 'true');
