alter table guardians
  add column active boolean not null default true;

alter table memberships
  add column active boolean not null default true;

create index guardians_school_user_active_idx
  on guardians (school_id, user_id, active)
  where user_id is not null;

create index memberships_school_role_active_idx
  on memberships (school_id, role, active, user_id);
