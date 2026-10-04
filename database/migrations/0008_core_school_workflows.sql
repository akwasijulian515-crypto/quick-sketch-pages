-- Persist class fee rules, component marks, terminal report details, and
-- reviewed end-of-year progression decisions for each school.

alter table classes
  add constraint classes_school_id_id_year_unique unique (school_id, id, academic_year_id);

alter table terms
  add constraint terms_school_id_id_year_unique unique (school_id, id, academic_year_id);

alter table class_subjects
  add constraint class_subjects_school_id_id_unique unique (school_id, id);

alter table subjects
  add constraint subjects_school_id_id_unique unique (school_id, id);

alter table terminal_reports
  add constraint terminal_reports_school_id_id_unique unique (school_id, id);

alter table terms
  add column is_closed boolean not null default false,
  add column closed_at timestamptz,
  add column closed_by_user_id uuid references users(id) on delete restrict,
  add constraint terms_closure_fields_check
    check ((is_closed and closed_at is not null and closed_by_user_id is not null)
        or (not is_closed and closed_at is null and closed_by_user_id is null));

create table class_fees (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references schools(id) on delete cascade,
  class_id uuid not null,
  academic_year_id uuid not null,
  term_id uuid,
  fee_type text not null check (fee_type in ('daily', 'tuition', 'pta', 'exam', 'other')),
  description text not null,
  amount numeric(10,2) not null check (amount >= 0),
  currency char(3) not null default 'GHS' check (currency ~ '^[A-Z]{3}$'),
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (fee_type <> 'daily' or term_id is null),
  unique nulls not distinct (school_id, class_id, academic_year_id, term_id, fee_type),
  foreign key (school_id, class_id, academic_year_id)
    references classes (school_id, id, academic_year_id) on delete cascade,
  foreign key (school_id, term_id, academic_year_id)
    references terms (school_id, id, academic_year_id) on delete cascade
);

create index class_fees_school_year_class_idx on class_fees(school_id, academic_year_id, class_id, is_active);
alter table class_fees enable row level security;
alter table class_fees force row level security;
create policy tenant_isolation on class_fees
  using (school_id = current_school_id())
  with check (school_id = current_school_id());
create policy platform_read_access on class_fees for select
  using (current_setting('app.platform_admin', true) = 'true');
create trigger class_fees_updated_at before update on class_fees
  for each row execute function set_updated_at();

create table subject_term_marks (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references schools(id) on delete cascade,
  student_id uuid not null,
  class_subject_id uuid not null,
  term_id uuid not null,
  class_test_score numeric(5,2) check (class_test_score between 0 and 10),
  project_score numeric(5,2) check (project_score between 0 and 20),
  homework_score numeric(5,2) check (homework_score between 0 and 10),
  group_work_score numeric(5,2) check (group_work_score between 0 and 10),
  exam_score numeric(5,2) check (exam_score between 0 and 100),
  total_score numeric(6,2) generated always as (
    case when class_test_score is not null
       and project_score is not null
       and homework_score is not null
       and group_work_score is not null
       and exam_score is not null
      then class_test_score + project_score + homework_score + group_work_score + exam_score / 2
      else null
    end
  ) stored,
  performance_level text generated always as (
    case
      when class_test_score is null or project_score is null or homework_score is null
        or group_work_score is null or exam_score is null then null
      when class_test_score + project_score + homework_score + group_work_score + exam_score / 2 >= 80 then 'HP'
      when class_test_score + project_score + homework_score + group_work_score + exam_score / 2 >= 68 then 'P'
      when class_test_score + project_score + homework_score + group_work_score + exam_score / 2 >= 54 then 'AP'
      when class_test_score + project_score + homework_score + group_work_score + exam_score / 2 >= 40 then 'D'
      else 'E'
    end
  ) stored,
  updated_by_user_id uuid references users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (student_id, class_subject_id, term_id),
  foreign key (school_id, student_id)
    references students (school_id, id) on delete cascade,
  foreign key (school_id, class_subject_id)
    references class_subjects (school_id, id) on delete cascade,
  foreign key (school_id, term_id)
    references terms (school_id, id) on delete cascade
);

create index subject_term_marks_school_term_student_idx
  on subject_term_marks(school_id, term_id, student_id);
alter table subject_term_marks enable row level security;
alter table subject_term_marks force row level security;
create policy tenant_isolation on subject_term_marks
  using (school_id = current_school_id())
  with check (school_id = current_school_id());
create policy platform_read_access on subject_term_marks for select
  using (current_setting('app.platform_admin', true) = 'true');
create trigger subject_term_marks_updated_at before update on subject_term_marks
  for each row execute function set_updated_at();

alter table terminal_reports
  add column conduct text,
  add column attitude text,
  add column interest text,
  add column attendance_present integer check (attendance_present is null or attendance_present >= 0),
  add column attendance_total integer check (attendance_total is null or attendance_total >= 0),
  add column teacher_remark text,
  add column headteacher_remark text,
  add column promotion_status text check (promotion_status is null or promotion_status in ('promote', 'repeat', 'transfer', 'graduate')),
  add constraint terminal_reports_attendance_bounds_check
    check (attendance_present is null or attendance_total is null or attendance_present <= attendance_total);

create table terminal_report_items (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references schools(id) on delete cascade,
  report_id uuid not null,
  subject_id uuid not null,
  class_test_score numeric(5,2) check (class_test_score between 0 and 10),
  project_score numeric(5,2) check (project_score between 0 and 20),
  homework_score numeric(5,2) check (homework_score between 0 and 10),
  group_work_score numeric(5,2) check (group_work_score between 0 and 10),
  exam_score numeric(5,2) check (exam_score between 0 and 100),
  total_score numeric(6,2) not null check (total_score between 0 and 100),
  performance_level text not null check (performance_level in ('HP', 'P', 'AP', 'D', 'E')),
  remark text,
  created_at timestamptz not null default now(),
  unique (report_id, subject_id),
  foreign key (school_id, report_id)
    references terminal_reports (school_id, id) on delete cascade,
  foreign key (school_id, subject_id)
    references subjects (school_id, id) on delete restrict
);

create index terminal_report_items_school_report_idx on terminal_report_items(school_id, report_id);
alter table terminal_report_items enable row level security;
alter table terminal_report_items force row level security;
create policy tenant_isolation on terminal_report_items
  using (school_id = current_school_id())
  with check (school_id = current_school_id());
create policy platform_read_access on terminal_report_items for select
  using (current_setting('app.platform_admin', true) = 'true');

create table promotion_decisions (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references schools(id) on delete cascade,
  student_id uuid not null,
  from_class_id uuid not null,
  term_id uuid not null,
  decision text not null check (decision in ('promote', 'repeat', 'transfer', 'graduate')),
  target_class_id uuid,
  teacher_remark text,
  status text not null default 'pending' check (status in ('pending', 'approved', 'rejected')),
  submitted_by_user_id uuid not null references users(id) on delete restrict,
  submitted_at timestamptz not null default now(),
  reviewed_by_user_id uuid references users(id) on delete restrict,
  reviewed_at timestamptz,
  review_remark text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (student_id, term_id),
  check ((decision in ('promote', 'repeat') and target_class_id is not null) or (decision in ('transfer', 'graduate') and target_class_id is null)),
  check ((status = 'pending' and reviewed_at is null and reviewed_by_user_id is null)
      or (status in ('approved', 'rejected') and reviewed_at is not null and reviewed_by_user_id is not null)),
  foreign key (school_id, student_id)
    references students (school_id, id) on delete cascade,
  foreign key (school_id, from_class_id)
    references classes (school_id, id) on delete cascade,
  foreign key (school_id, term_id)
    references terms (school_id, id) on delete cascade,
  foreign key (school_id, target_class_id)
    references classes (school_id, id) on delete restrict
);

create index promotion_decisions_school_term_status_idx
  on promotion_decisions(school_id, term_id, status);
alter table promotion_decisions enable row level security;
alter table promotion_decisions force row level security;
create policy tenant_isolation on promotion_decisions
  using (school_id = current_school_id())
  with check (school_id = current_school_id());
create policy platform_read_access on promotion_decisions for select
  using (current_setting('app.platform_admin', true) = 'true');
create trigger promotion_decisions_updated_at before update on promotion_decisions
  for each row execute function set_updated_at();

grant select, insert, update, delete on class_fees, subject_term_marks,
  terminal_report_items, promotion_decisions to klasora_runtime;
