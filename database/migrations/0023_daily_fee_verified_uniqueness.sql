drop index if exists payments_daily_fee_once_per_day;

create unique index payments_daily_fee_once_per_day
  on payments(school_id, student_id, daily_fee_date)
  where category = 'daily_fee' and status = 'verified';
