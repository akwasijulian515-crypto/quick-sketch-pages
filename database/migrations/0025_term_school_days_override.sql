alter table terms
  add column school_days_override integer,
  add constraint terms_school_days_override_check
    check (school_days_override is null or school_days_override between 1 and 366);
