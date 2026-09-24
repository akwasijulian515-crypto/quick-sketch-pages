-- A gateway transaction is authoritative. One provider reference can credit
-- exactly one school payment, and one webhook event can be processed once.
create type gateway_payment_status as enum ('initiated', 'pending', 'verified', 'failed', 'refunded', 'voided');

alter table payments
  add column provider text,
  add column provider_reference text,
  add column status gateway_payment_status not null default 'initiated',
  add column verified_at timestamptz,
  add column receipt_issued_at timestamptz;

-- Existing legacy payment rows may remain without a provider reference. New
-- gateway payments must populate both provider and provider_reference.
create unique index payments_school_provider_reference_unique
  on payments(school_id, provider, provider_reference)
  where provider is not null and provider_reference is not null;

create table payment_gateway_events (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references schools(id) on delete cascade,
  provider text not null,
  provider_event_id text not null,
  provider_reference text not null,
  event_type text not null,
  payload jsonb not null,
  received_at timestamptz not null default now(),
  processed_at timestamptz,
  unique (provider, provider_event_id)
);

create index payment_gateway_events_school_reference_idx on payment_gateway_events(school_id, provider_reference);
alter table payment_gateway_events enable row level security;
alter table payment_gateway_events force row level security;
create policy tenant_isolation on payment_gateway_events using (school_id = current_school_id()) with check (school_id = current_school_id());

-- A payment receipt may be issued only after verification. Enforce that link
-- in the database, even if a future UI accidentally sends the wrong request.
create or replace function enforce_verified_receipt() returns trigger
language plpgsql as $$
begin
  if new.receipt_issued_at is not null and new.status <> 'verified' then
    raise exception 'A receipt can only be issued for a verified gateway payment';
  end if;
  return new;
end;
$$;

create trigger payments_verified_receipt_guard
  before insert or update on payments
  for each row execute function enforce_verified_receipt();
