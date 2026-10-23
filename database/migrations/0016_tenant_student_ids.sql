create table student_id_sequences (
  school_id uuid primary key references schools(id) on delete cascade,
  last_number bigint not null default 0 check (last_number >= 0)
);

create or replace function student_id_prefix_for_school(school_name text)
returns text
language sql
immutable
as $$
  select left(
    coalesce(
      nullif(string_agg(left(word, 1), '' order by ord) filter (where word <> ''), ''),
      'SCH'
    ),
    12
  )
  from (
    select regexp_replace(part, '[^A-Z0-9]', '', 'g') as word, ord
    from regexp_split_to_table(upper(school_name), '[[:space:]]+')
      with ordinality as words(part, ord)
  ) cleaned
$$;

insert into student_id_sequences (school_id, last_number)
select s.id,
       coalesce(max(
         case
           when st.admission_number ~ ('^' || prefix.prefix || '-[0-9]+$')
             then substring(st.admission_number from length(prefix.prefix) + 2)::bigint
         end
       ), 0)
from schools s
cross join lateral (
  select student_id_prefix_for_school(s.name) as prefix
) prefix
left join students st on st.school_id = s.id
group by s.id, prefix.prefix;

alter table student_id_sequences enable row level security;
alter table student_id_sequences force row level security;
create policy tenant_isolation on student_id_sequences
  using (school_id = current_school_id())
  with check (school_id = current_school_id());
grant select, insert, update, delete on student_id_sequences to klasora_runtime;

create or replace function assign_student_admission_number()
returns trigger
language plpgsql
set search_path = pg_catalog, public
as $$
declare
  school_name text;
  prefix text;
  next_number bigint;
begin
  select s.name into school_name
  from public.schools s
  where s.id = new.school_id;

  if not found then
    raise exception 'Cannot generate a student ID for an unknown school';
  end if;

  prefix := public.student_id_prefix_for_school(school_name);

  insert into public.student_id_sequences (school_id, last_number)
  values (new.school_id, 1)
  on conflict (school_id) do update
    set last_number = public.student_id_sequences.last_number + 1
  returning last_number into next_number;

  new.admission_number := prefix || '-' || lpad(next_number::text, 4, '0');
  return new;
end;
$$;

create trigger students_assign_admission_number
before insert on students
for each row execute function assign_student_admission_number();
