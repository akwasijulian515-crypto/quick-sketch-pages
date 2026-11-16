alter table schools
  add column if not exists report_customization_settings jsonb not null default '{}'::jsonb;
