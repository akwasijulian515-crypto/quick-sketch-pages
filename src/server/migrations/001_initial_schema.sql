-- Harrow Green Academy - Initial Database Schema
-- Multi-tenant schema with school_id isolation

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 1. Schools & Applications (Platform Level)
CREATE TABLE IF NOT EXISTS schools (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name          TEXT NOT NULL,
  subdomain     TEXT NOT NULL UNIQUE,
  status        TEXT NOT NULL DEFAULT 'trial' CHECK (status IN ('trial', 'active', 'suspended')),
  primary_color TEXT DEFAULT '#16a34a',
  crest_url     TEXT,
  created_at    TIMESTAMPTZ DEFAULT now(),
  updated_at    TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS school_applications (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  school_name    TEXT NOT NULL,
  subdomain      TEXT NOT NULL UNIQUE,
  applicant_name TEXT NOT NULL,
  email          TEXT NOT NULL,
  phone          TEXT,
  color          TEXT DEFAULT '#16a34a',
  crest_url      TEXT,
  status         TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
  created_at     TIMESTAMPTZ DEFAULT now()
);

-- 2. Users & Invites
CREATE TABLE IF NOT EXISTS users (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id     UUID REFERENCES schools(id) ON DELETE CASCADE,
  email         TEXT NOT NULL,
  password_hash TEXT NOT NULL,
  full_name     TEXT NOT NULL,
  phone         TEXT,
  role          TEXT NOT NULL CHECK (role IN ('super_admin', 'school_admin', 'teacher', 'finance', 'parent', 'student')),
  status        TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'invited', 'suspended')),
  created_at    TIMESTAMPTZ DEFAULT now(),
  UNIQUE (school_id, email)
);

CREATE TABLE IF NOT EXISTS invitation_links (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id  UUID NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
  role       TEXT NOT NULL,
  token      TEXT NOT NULL UNIQUE,
  expires_at TIMESTAMPTZ NOT NULL,
  created_by UUID REFERENCES users(id) ON DELETE SET NULL,
  used_at    TIMESTAMPTZ
);

CREATE TABLE IF NOT EXISTS sessions (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token      TEXT NOT NULL UNIQUE,
  expires_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- 3. Academic Calendar & Structure
CREATE TABLE IF NOT EXISTS academic_years (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id  UUID NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
  name       TEXT NOT NULL,
  start_date DATE NOT NULL,
  end_date   DATE NOT NULL,
  is_current BOOLEAN DEFAULT false,
  UNIQUE (school_id, name)
);

CREATE TABLE IF NOT EXISTS academic_terms (
  id                       UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  academic_year_id         UUID NOT NULL REFERENCES academic_years(id) ON DELETE CASCADE,
  name                     TEXT NOT NULL,
  start_date               DATE NOT NULL,
  end_date                 DATE NOT NULL,
  status                   TEXT NOT NULL DEFAULT 'upcoming' CHECK (status IN ('completed', 'current', 'upcoming')),
  is_promotion_window_open BOOLEAN DEFAULT false
);

CREATE TABLE IF NOT EXISTS calendar_holidays (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id        UUID NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
  academic_term_id UUID REFERENCES academic_terms(id) ON DELETE SET NULL,
  date             DATE NOT NULL,
  name             TEXT,
  UNIQUE (school_id, date)
);

-- 4. Classes, Subjects & Teaching Assignments
CREATE TABLE IF NOT EXISTS classes (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id        UUID NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
  name             TEXT NOT NULL,
  grade_level      TEXT,
  class_teacher_id UUID REFERENCES users(id) ON DELETE SET NULL,
  UNIQUE (school_id, name)
);

CREATE TABLE IF NOT EXISTS subjects (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id   UUID NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
  name        TEXT NOT NULL,
  code        TEXT NOT NULL,
  description TEXT,
  UNIQUE (school_id, code)
);

CREATE TABLE IF NOT EXISTS teacher_assignments (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id        UUID NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
  academic_year_id UUID NOT NULL REFERENCES academic_years(id) ON DELETE CASCADE,
  teacher_id      UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  class_id        UUID NOT NULL REFERENCES classes(id) ON DELETE CASCADE,
  subject_id      UUID NOT NULL REFERENCES subjects(id) ON DELETE CASCADE,
  UNIQUE (academic_year_id, class_id, subject_id)
);

-- 5. Students & Guardians
CREATE TABLE IF NOT EXISTS students (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id         UUID NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
  admission_number  TEXT NOT NULL,
  full_name         TEXT NOT NULL,
  date_of_birth     DATE,
  gender            TEXT,
  address           TEXT,
  medical_notes     TEXT,
  emergency_contact TEXT,
  status            TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'transferred', 'graduated', 'withdrawn')),
  enrolled_at       TIMESTAMPTZ DEFAULT now(),
  UNIQUE (school_id, admission_number)
);

CREATE TABLE IF NOT EXISTS class_enrollments (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id       UUID NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  class_id         UUID NOT NULL REFERENCES classes(id) ON DELETE CASCADE,
  academic_year_id UUID NOT NULL REFERENCES academic_years(id) ON DELETE CASCADE,
  status           TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'promoted', 'repeated', 'transferred', 'graduated')),
  UNIQUE (student_id, academic_year_id)
);

CREATE TABLE IF NOT EXISTS student_guardians (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id    UUID NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  user_id       UUID REFERENCES users(id) ON DELETE SET NULL,
  guardian_name TEXT NOT NULL,
  phone         TEXT,
  relationship  TEXT DEFAULT 'parent',
  is_primary    BOOLEAN DEFAULT true,
  is_emergency  BOOLEAN DEFAULT false
);

-- 6. Attendance
CREATE TABLE IF NOT EXISTS attendance_registers (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id           UUID NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
  class_id            UUID NOT NULL REFERENCES classes(id) ON DELETE CASCADE,
  academic_term_id    UUID NOT NULL REFERENCES academic_terms(id) ON DELETE CASCADE,
  date                DATE NOT NULL,
  taken_by_teacher_id UUID REFERENCES users(id) ON DELETE SET NULL,
  status              TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'completed')),
  submitted_at        TIMESTAMPTZ,
  UNIQUE (class_id, date)
);

CREATE TABLE IF NOT EXISTS attendance_records (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  register_id UUID NOT NULL REFERENCES attendance_registers(id) ON DELETE CASCADE,
  student_id  UUID NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  status      TEXT NOT NULL DEFAULT 'absent' CHECK (status IN ('present', 'late', 'absent', 'excused')),
  time_in     TIMESTAMPTZ,
  note        TEXT,
  UNIQUE (register_id, student_id)
);

-- 7. Assessment, Grades & Profiles
CREATE TABLE IF NOT EXISTS assessment_scores (
  id                     UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id             UUID NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  subject_id             UUID NOT NULL REFERENCES subjects(id) ON DELETE CASCADE,
  class_id               UUID NOT NULL REFERENCES classes(id) ON DELETE CASCADE,
  academic_term_id       UUID NOT NULL REFERENCES academic_terms(id) ON DELETE CASCADE,
  class_test             NUMERIC(5,2),
  project                NUMERIC(5,2),
  homework               NUMERIC(5,2),
  group_work             NUMERIC(5,2),
  exam                   NUMERIC(6,2),
  final_score            NUMERIC(6,2),
  recorded_by_teacher_id UUID REFERENCES users(id) ON DELETE SET NULL,
  UNIQUE (student_id, subject_id, academic_term_id)
);

CREATE TABLE IF NOT EXISTS learner_profiles (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id       UUID NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  academic_term_id UUID NOT NULL REFERENCES academic_terms(id) ON DELETE CASCADE,
  conduct          TEXT,
  attitude         TEXT,
  interest         TEXT,
  teacher_remark   TEXT,
  updated_by       UUID REFERENCES users(id) ON DELETE SET NULL,
  UNIQUE (student_id, academic_term_id)
);

CREATE TABLE IF NOT EXISTS promotion_decisions (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id            UUID NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  from_class_id         UUID NOT NULL REFERENCES classes(id) ON DELETE CASCADE,
  to_class_id           UUID REFERENCES classes(id) ON DELETE SET NULL,
  academic_year_id      UUID NOT NULL REFERENCES academic_years(id) ON DELETE CASCADE,
  decision              TEXT NOT NULL CHECK (decision IN ('Promote', 'Repeat', 'Transfer', 'Graduate')),
  decided_by_teacher_id UUID REFERENCES users(id) ON DELETE SET NULL,
  is_submitted          BOOLEAN DEFAULT false,
  admin_approved_at     TIMESTAMPTZ,
  UNIQUE (student_id, academic_year_id)
);

-- 8. Finance, Payments, Coupons & Receipts
CREATE TABLE IF NOT EXISTS fee_rules (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id      UUID NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
  class_id       UUID NOT NULL REFERENCES classes(id) ON DELETE CASCADE,
  fee_type       TEXT NOT NULL CHECK (fee_type IN ('Daily payment', 'School fees')),
  amount         NUMERIC(10,2) NOT NULL,
  frequency      TEXT NOT NULL CHECK (frequency IN ('Daily', 'Termly')),
  effective_from DATE NOT NULL,
  is_active      BOOLEAN DEFAULT true
);

CREATE TABLE IF NOT EXISTS payment_transactions (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id           UUID NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
  student_id          UUID NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  fee_rule_id         UUID REFERENCES fee_rules(id) ON DELETE SET NULL,
  reference           TEXT NOT NULL UNIQUE,
  amount              NUMERIC(10,2) NOT NULL,
  channel             TEXT NOT NULL CHECK (channel IN ('Cash', 'Mobile money', 'Card', 'Bank transfer')),
  payment_type        TEXT NOT NULL CHECK (payment_type IN ('daily_cash', 'school_fee_gateway')),
  status              TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('recorded', 'pending', 'verified', 'failed')),
  recorded_by_user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  payment_date        DATE NOT NULL DEFAULT CURRENT_DATE
);

CREATE TABLE IF NOT EXISTS clearance_coupons (
  id                     UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id              UUID NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
  student_id             UUID NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  payment_transaction_id UUID NOT NULL REFERENCES payment_transactions(id) ON DELETE CASCADE,
  code                   TEXT NOT NULL UNIQUE,
  valid_date             DATE NOT NULL,
  status                 TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'used', 'expired'))
);

CREATE TABLE IF NOT EXISTS official_receipts (
  id                     UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id              UUID NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
  payment_transaction_id UUID NOT NULL REFERENCES payment_transactions(id) ON DELETE CASCADE,
  receipt_number         TEXT NOT NULL UNIQUE,
  issued_at              TIMESTAMPTZ DEFAULT now()
);

-- 9. Daily Reconciliation & Exceptions
CREATE TABLE IF NOT EXISTS reconciliation_days (
  id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id          UUID NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
  date               DATE NOT NULL,
  expected_amount    NUMERIC(10,2),
  received_amount    NUMERIC(10,2),
  variance_amount    NUMERIC(10,2),
  is_closed          BOOLEAN DEFAULT false,
  closed_by_admin_id UUID REFERENCES users(id) ON DELETE SET NULL,
  closed_at          TIMESTAMPTZ,
  UNIQUE (school_id, date)
);

CREATE TABLE IF NOT EXISTS reconciliation_exceptions (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  reconciliation_day_id UUID NOT NULL REFERENCES reconciliation_days(id) ON DELETE CASCADE,
  student_id            UUID REFERENCES students(id) ON DELETE CASCADE,
  issue                 TEXT NOT NULL,
  owner                 TEXT DEFAULT 'Finance' CHECK (owner IN ('Finance', 'School Admin', 'Gateway')),
  severity              TEXT DEFAULT 'Review' CHECK (severity IN ('Review', 'Pending', 'Info')),
  status                TEXT DEFAULT 'Open' CHECK (status IN ('Open', 'Investigating', 'Resolved')),
  due_at                TIMESTAMPTZ,
  resolution_note       TEXT,
  resolved_by_user_id   UUID REFERENCES users(id) ON DELETE SET NULL,
  resolved_at           TIMESTAMPTZ
);

-- 10. Notices & School Communications
CREATE TABLE IF NOT EXISTS notices (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id    UUID NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
  class_id     UUID REFERENCES classes(id) ON DELETE CASCADE,
  title        TEXT NOT NULL,
  content      TEXT,
  author_id    UUID REFERENCES users(id) ON DELETE SET NULL,
  published_at TIMESTAMPTZ DEFAULT now()
);

-- 11. Terminal Reports Metadata
CREATE TABLE IF NOT EXISTS terminal_reports (
  id                       UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id                UUID NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
  student_id               UUID NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  academic_term_id         UUID NOT NULL REFERENCES academic_terms(id) ON DELETE CASCADE,
  class_id                 UUID NOT NULL REFERENCES classes(id) ON DELETE CASCADE,
  report_reference         TEXT NOT NULL UNIQUE,
  attendance_percentage    NUMERIC(5,2),
  overall_average          NUMERIC(5,2),
  overall_nacca_level      TEXT,
  promotion_recommendation TEXT,
  teacher_signature_date   DATE,
  admin_signature_date     DATE,
  published_at             TIMESTAMPTZ,
  UNIQUE (student_id, academic_term_id)
);

-- Indexes for performance & multitenancy lookups
CREATE INDEX IF NOT EXISTS idx_users_school ON users(school_id);
CREATE INDEX IF NOT EXISTS idx_students_school ON students(school_id);
CREATE INDEX IF NOT EXISTS idx_classes_school ON classes(school_id);
CREATE INDEX IF NOT EXISTS idx_attendance_reg_date ON attendance_registers(school_id, date);
CREATE INDEX IF NOT EXISTS idx_payments_school_date ON payment_transactions(school_id, payment_date);
CREATE INDEX IF NOT EXISTS idx_coupons_valid ON clearance_coupons(school_id, valid_date);
