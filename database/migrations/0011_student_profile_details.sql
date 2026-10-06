alter table students
  add column address text,
  add column emergency_contact text,
  add column medical_notes text,
  add constraint students_address_length_check
    check (address is null or char_length(address) <= 1000),
  add constraint students_emergency_contact_length_check
    check (emergency_contact is null or char_length(emergency_contact) <= 40),
  add constraint students_medical_notes_length_check
    check (medical_notes is null or char_length(medical_notes) <= 2000);
