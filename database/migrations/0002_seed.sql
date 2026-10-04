-- Initial seed data for the Harrow Green platform.
-- This is intentionally idempotent so it can be retried safely.
select set_config('app.platform_admin', 'true', true);

alter table schools
  add column if not exists primary_color text not null default '#1f5c3b' check (primary_color ~ '^#[0-9A-Fa-f]{6}$'),
  add column if not exists crest_url text;

-- Platform super admin
with school as (
  insert into schools (id, name, subdomain, status, primary_color, crest_url)
  values (
    '11111111-1111-4111-8111-111111111111'::uuid,
    'Harrow Green Academy',
    'harrowgreen',
    'active',
    '#1f5c3b',
    null
  )
  on conflict (subdomain) do update set
    name = excluded.name,
    primary_color = excluded.primary_color,
    crest_url = coalesce(schools.crest_url, excluded.crest_url)
  returning id
),
platform_user as (
  insert into users (id, email, display_name)
  values (
    '22222222-2222-4222-8222-222222222222'::uuid,
    'platform.admin@harrowgreen.local',
    'Platform Super Admin'
  )
  on conflict (email) do update set display_name = excluded.display_name
  returning id
),
platform_membership as (
  insert into memberships (id, user_id, school_id, role)
  select
    '33333333-3333-4333-8333-333333333333'::uuid,
    u.id,
    null,
    'super_admin'
  from platform_user u
  where not exists (
    select 1 from memberships m
    where m.user_id = u.id and m.school_id is null and m.role = 'super_admin'
  )
  returning id
)
select 1;

-- School admin and teaching staff
with school as (
  select id from schools where subdomain = 'harrowgreen' limit 1
),
admin_user as (
  insert into users (id, email, display_name)
  values (
    '44444444-4444-4444-8444-444444444444'::uuid,
    'school.admin@harrowgreen.local',
    'School Admin'
  )
  on conflict (email) do update set display_name = excluded.display_name
  returning id
),
admin_membership as (
  insert into memberships (id, user_id, school_id, role)
  select
    '55555555-5555-4555-8555-555555555555'::uuid,
    au.id,
    s.id,
    'school_admin'
  from admin_user au
  cross join school s
  where not exists (
    select 1 from memberships m
    where m.user_id = au.id and m.school_id = s.id and m.role = 'school_admin'
  )
  returning id
)
select 1;

with school as (
  select id from schools where subdomain = 'harrowgreen' limit 1
),
teacher_user as (
  insert into users (id, email, display_name)
  values (
    '66666666-6666-4666-8666-666666666666'::uuid,
    'teacher.form2b@harrowgreen.local',
    'Irene Owusu'
  )
  on conflict (email) do update set display_name = excluded.display_name
  returning id
),
teacher_membership as (
  insert into memberships (id, user_id, school_id, role)
  select
    '77777777-7777-4777-8777-777777777777'::uuid,
    tu.id,
    s.id,
    'teacher'
  from teacher_user tu
  cross join school s
  where not exists (
    select 1 from memberships m
    where m.user_id = tu.id and m.school_id = s.id and m.role = 'teacher'
  )
  returning id
)
select 1;

-- Academic year, class, and sample student data
with school as (
  select id from schools where subdomain = 'harrowgreen' limit 1
),
academic_year as (
  insert into academic_years (id, school_id, name, starts_on, ends_on, is_current)
  select
    '88888888-8888-4888-8888-888888888888'::uuid,
    s.id,
    '2025/2026',
    '2025-09-01'::date,
    '2026-07-31'::date,
    true
  from school s
  where not exists (
    select 1 from academic_years ay where ay.school_id = s.id and ay.name = '2025/2026'
  )
  returning id, school_id
),
teacher_profile as (
  insert into staff_profiles (id, school_id, user_id, staff_number, job_title)
  select
    '99999999-9999-4999-8999-999999999999'::uuid,
    s.id,
    u.id,
    'HG-002',
    'Form Teacher'
  from school s
  join users u on u.email = 'teacher.form2b@harrowgreen.local'
  where not exists (
    select 1 from staff_profiles sp where sp.school_id = s.id and sp.user_id = u.id
  )
  returning id, school_id
),
class_row as (
  insert into classes (id, school_id, academic_year_id, name, form_level, class_teacher_id)
  select
    'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'::uuid,
    s.id,
    ay.id,
    'Form 2B',
    'Form 2',
    tp.id
  from school s
  join academic_years ay on ay.school_id = s.id and ay.name = '2025/2026'
  join teacher_profile tp on tp.school_id = s.id
  where not exists (
    select 1 from classes c where c.school_id = s.id and c.name = 'Form 2B'
  )
  returning id
)
select 1;

-- Students and guardians for guest lookup and teacher portals
with school as (
  select id from schools where subdomain = 'harrowgreen' limit 1
),
student_rows as (
  insert into students (id, school_id, admission_number, first_name, last_name, date_of_birth, gender, joined_on, active)
  values
    ('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb'::uuid, (select id from school), 'HG-2025-001', 'Kwame', 'Asante', '2011-02-14'::date, 'male', '2025-09-01'::date, true),
    ('cccccccc-cccc-4ccc-8ccc-cccccccccccc'::uuid, (select id from school), 'HG-2025-002', 'Ama', 'Boateng', '2010-11-03'::date, 'female', '2025-09-01'::date, true),
    ('dddddddd-dddd-4ddd-8ddd-dddddddddddd'::uuid, (select id from school), 'HG-2025-003', 'Yaw', 'Mensah', '2011-07-21'::date, 'male', '2025-09-01'::date, true)
  on conflict (school_id, admission_number) do nothing
  returning id, admission_number
),
parent_guardian as (
  insert into guardians (id, school_id, full_name, phone, email)
  values
    ('eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee'::uuid, (select id from school), 'Akosua Asante', '+233201234567', 'akosua.asante@harrowgreen.local')
  on conflict (school_id, email) do nothing
  returning id, full_name
)
select 1;

with school as (
  select id from schools where subdomain = 'harrowgreen' limit 1
),
ward_links as (
  select id as student_id, (select id from guardians where school_id = (select id from school) and email = 'akosua.asante@harrowgreen.local' limit 1) as guardian_id
  from students
  where school_id = (select id from school)
  limit 3
)
insert into student_guardians (school_id, student_id, guardian_id, relationship, is_primary)
select
  (select id from school),
  w.student_id,
  w.guardian_id,
  'parent',
  true
from ward_links w
where w.guardian_id is not null
on conflict do nothing;

with school as (
  select id from schools where subdomain = 'harrowgreen' limit 1
),
class_map as (
  select c.id as class_id, s.id as student_id
  from classes c
  cross join students s
  where c.school_id = (select id from school)
    and c.name = 'Form 2B'
    and s.school_id = (select id from school)
    and s.admission_number in ('HG-2025-001', 'HG-2025-002', 'HG-2025-003')
)
insert into class_enrollments (id, school_id, class_id, student_id, starts_on, ends_on)
select
  gen_random_uuid(),
  (select id from school),
  cm.class_id,
  cm.student_id,
  current_date,
  null
from class_map cm
on conflict do nothing;

-- A minimal class subject and term for operations screens.
with school as (
  select id from schools where subdomain = 'harrowgreen' limit 1
),
class_row as (
  select id from classes where school_id = (select id from school) and name = 'Form 2B' limit 1
),
subject_insert as (
  insert into subjects (id, school_id, code, name)
  values
    ('fefefefe-fefe-4fef-8fef-fefefefefefe'::uuid, (select id from school), 'MATH', 'Mathematics')
  on conflict (school_id, code) do nothing
  returning id
)
select 1;

with school as (
  select id from schools where subdomain = 'harrowgreen' limit 1
),
academic_year as (
  select id from academic_years where school_id = (select id from school) and name = '2025/2026' limit 1
)
insert into terms (id, school_id, academic_year_id, name, starts_on, ends_on)
values (
  '12121212-1212-4121-8121-121212121212'::uuid,
  (select id from school),
  (select id from academic_year),
  'Term 1',
  '2025-09-01'::date,
  '2025-12-19'::date
)
on conflict do nothing;
