alter table class_fees
  add constraint class_fees_school_id_id_unique unique (school_id, id);

alter table invoices
  add column class_fee_id uuid;

alter table invoices
  add constraint invoices_school_class_fee_fk
    foreign key (school_id, class_fee_id)
    references class_fees (school_id, id)
    on delete restrict;

create unique index invoices_school_student_class_fee_unique
  on invoices (school_id, student_id, class_fee_id)
  where class_fee_id is not null;
