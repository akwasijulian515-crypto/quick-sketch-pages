alter table students
  add column user_id uuid references users(id) on delete set null;

create unique index students_school_user_unique
  on students(school_id, user_id)
  where user_id is not null;

create unique index guardians_school_user_unique
  on guardians(school_id, user_id)
  where user_id is not null;
