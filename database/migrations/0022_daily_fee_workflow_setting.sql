alter table school_workflow_settings
  add column daily_fee_split_enabled boolean not null default false;

update school_workflow_settings workflow
set daily_fee_split_enabled = school.daily_fee_split_enabled
from schools school
where school.id = workflow.school_id;

insert into school_workflow_settings (school_id, daily_fee_split_enabled)
select id, daily_fee_split_enabled
from schools
where daily_fee_split_enabled
on conflict (school_id) do update
set daily_fee_split_enabled = excluded.daily_fee_split_enabled;
