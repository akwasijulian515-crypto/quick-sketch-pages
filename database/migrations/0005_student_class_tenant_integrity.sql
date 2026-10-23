-- Keep class, student, and period references within the owning school.
alter table academic_years
  add constraint academic_years_school_id_id_unique unique (school_id, id);

alter table terms
  add constraint terms_school_id_id_unique unique (school_id, id),
  add constraint terms_academic_year_same_school_fk
    foreign key (school_id, academic_year_id)
    references academic_years (school_id, id)
    on delete cascade;

alter table students
  add constraint students_school_id_id_unique unique (school_id, id);

alter table classes
  add column term_id uuid,
  add constraint classes_school_id_id_unique unique (school_id, id),
  add constraint classes_academic_year_same_school_fk
    foreign key (school_id, academic_year_id)
    references academic_years (school_id, id)
    on delete cascade,
  add constraint classes_term_same_school_fk
    foreign key (school_id, term_id)
    references terms (school_id, id)
    on delete set null (term_id);

alter table class_enrollments
  add constraint class_enrollments_class_same_school_fk
    foreign key (school_id, class_id)
    references classes (school_id, id)
    on delete cascade,
  add constraint class_enrollments_student_same_school_fk
    foreign key (school_id, student_id)
    references students (school_id, id)
    on delete cascade;
