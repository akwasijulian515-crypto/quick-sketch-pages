alter table schools
  add column daily_fee_split_enabled boolean not null default false;

alter table class_fees
  drop constraint class_fees_fee_type_check,
  add constraint class_fees_fee_type_check
    check (fee_type in ('daily', 'daily_feeding', 'tuition', 'pta', 'exam', 'other'));

alter table payments
  add column daily_fee_studies_amount numeric(12,2),
  add column daily_fee_feeding_amount numeric(12,2),
  add constraint payments_daily_fee_components_check
    check (
      (daily_fee_studies_amount is null and daily_fee_feeding_amount is null)
      or (
        category = 'daily_fee'
        and daily_fee_studies_amount is not null
        and daily_fee_feeding_amount is not null
        and daily_fee_studies_amount >= 0
        and daily_fee_feeding_amount >= 0
        and daily_fee_studies_amount + daily_fee_feeding_amount = amount
      )
    );
