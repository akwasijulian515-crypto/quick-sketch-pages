alter table school_workflow_settings
  alter column attendance_print_format set default 'ges_term_to_date',
  drop constraint school_workflow_settings_attendance_print_format_check;

update school_workflow_settings
set attendance_print_format = 'ges_term_to_date'
where attendance_print_format = 'ges_weekly';

alter table school_workflow_settings
  add constraint school_workflow_settings_attendance_print_format_check
    check (attendance_print_format in ('daily_register', 'ges_term_to_date'));
