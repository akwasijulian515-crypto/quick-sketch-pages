alter table payments
  add column recorded_by_user_id uuid references users(id) on delete set null,
  add column reviewed_by_user_id uuid references users(id) on delete set null,
  add column reviewed_at timestamptz,
  add column rejection_reason text,
  add constraint payments_review_actor_timestamp_check
    check ((reviewed_by_user_id is null) = (reviewed_at is null)),
  add constraint payments_rejection_reason_length_check
    check (rejection_reason is null or char_length(rejection_reason) <= 500);

create table payment_review_events (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references schools(id) on delete cascade,
  payment_id uuid not null references payments(id) on delete restrict,
  action text not null check (action in ('approved', 'rejected')),
  performed_by_user_id uuid not null references users(id) on delete restrict,
  reason text,
  occurred_at timestamptz not null default now(),
  check (action <> 'rejected' or (reason is not null and char_length(trim(reason)) between 3 and 500))
);

create index payment_review_events_school_payment_idx
  on payment_review_events(school_id, payment_id, occurred_at);
create index payments_pending_review_idx
  on payments(school_id, paid_at desc)
  where status = 'pending' and category in ('examination_fee', 'other');

alter table payment_review_events enable row level security;
alter table payment_review_events force row level security;
create policy tenant_isolation on payment_review_events
  using (school_id = current_school_id())
  with check (school_id = current_school_id());

revoke update, delete, truncate on payment_review_events from klasora_runtime;
grant select, insert on payment_review_events to klasora_runtime;
