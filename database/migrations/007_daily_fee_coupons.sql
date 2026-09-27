-- A daily-fee coupon is a teacher-facing clearance token. It is not a
-- discount and it is not an official payment receipt.
create type payment_category as enum ('daily_fee', 'school_fee', 'examination_fee', 'other');

alter table payments
  alter column receipt_number drop not null,
  add column category payment_category not null default 'other',
  add column daily_fee_date date;

-- One student can have only one recorded daily-fee collection for a school day.
create unique index payments_daily_fee_once_per_day
  on payments(school_id, student_id, daily_fee_date)
  where category = 'daily_fee';

alter table coupons
  add column payment_id uuid references payments(id) on delete restrict,
  add column valid_on date;

create unique index coupons_daily_fee_payment_once
  on coupons(payment_id)
  where payment_id is not null;

-- Daily-fee clearances deliberately cannot carry a receipt number. School-fee
-- receipts remain governed by the verified-receipt guard from migration 004.
create or replace function enforce_daily_fee_coupon_rules() returns trigger
language plpgsql as $$
begin
  if new.category = 'daily_fee' and (new.receipt_number is not null or new.receipt_issued_at is not null) then
    raise exception 'Daily-fee payments do not issue official receipts';
  end if;
  if new.category = 'daily_fee' and new.daily_fee_date is null then
    raise exception 'Daily-fee payments require a collection date';
  end if;
  return new;
end;
$$;

create trigger payments_daily_fee_coupon_guard
  before insert or update on payments
  for each row execute function enforce_daily_fee_coupon_rules();

comment on table coupons is 'Teacher-visible daily-fee clearance tokens; not discount vouchers or payment receipts.';
