-- Subjects can be taught in multiple classes, and a teacher may have more
-- than one assignment. All records remain isolated to one school tenant.
create table class_subjects (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references schools(id) on delete cascade,
  class_id uuid not null references classes(id) on delete cascade,
  subject_id uuid not null references subjects(id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (class_id, subject_id)
);

create table teaching_assignments (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references schools(id) on delete cascade,
  staff_profile_id uuid not null references staff_profiles(id) on delete cascade,
  class_subject_id uuid not null references class_subjects(id) on delete cascade,
  academic_year_id uuid not null references academic_years(id) on delete cascade,
  is_primary_teacher boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (staff_profile_id, class_subject_id, academic_year_id)
);

create index class_subjects_school_class_idx on class_subjects(school_id, class_id);
create index teaching_assignments_school_staff_idx on teaching_assignments(school_id, staff_profile_id);
create index teaching_assignments_school_year_idx on teaching_assignments(school_id, academic_year_id);

alter table class_subjects enable row level security;
alter table class_subjects force row level security;
create policy tenant_isolation on class_subjects using (school_id = current_school_id()) with check (school_id = current_school_id());

alter table teaching_assignments enable row level security;
alter table teaching_assignments force row level security;
create policy tenant_isolation on teaching_assignments using (school_id = current_school_id()) with check (school_id = current_school_id());

create trigger teaching_assignments_updated_at before update on teaching_assignments for each row execute function set_updated_at();
