-- Record the admin who closed the term attendance register.
alter table terms
  add column attendance_register_closed_at timestamptz,
  add column attendance_register_closed_by_user_id uuid references users(id) on delete restrict,
  add constraint terms_attendance_register_closure_fields_check
    check (
      (attendance_register_closed_at is null and attendance_register_closed_by_user_id is null)
      or (attendance_register_closed_at is not null and attendance_register_closed_by_user_id is not null)
    );
