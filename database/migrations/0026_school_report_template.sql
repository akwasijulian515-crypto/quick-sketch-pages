alter table schools
  add column if not exists report_template text not null default 'bento'
  check (report_template in ('bento', 'gazette', 'ledger'));
