-- 출결 서류 자동화 초기 스키마. RLS·Storage·상태 전이는 web/plan.md 0.5~0.8 기준.

create extension if not exists pgcrypto with schema extensions;

-- ---------------------------------------------------------------------------
-- tables
-- ---------------------------------------------------------------------------

create table public.teachers (
  id uuid primary key references auth.users (id) on delete cascade,
  name text not null,
  school_name text not null
);

create table public.classrooms (
  id uuid primary key default gen_random_uuid(),
  teacher_id uuid not null references public.teachers (id) on delete cascade,
  school_year int not null,
  grade int not null,
  class_no int not null,
  unique (school_year, grade, class_no)
);

create table public.students (
  id uuid primary key default gen_random_uuid(),
  classroom_id uuid not null references public.classrooms (id) on delete cascade,
  number int not null,
  name text not null,
  gender text not null check (gender in ('남', '여')),
  father_name text,
  mother_name text,
  father_phone_hmac text,
  mother_phone_hmac text,
  father_phone_last4 text,
  mother_phone_last4 text,
  active boolean not null default true,
  unique (classroom_id, number)
);

create table public.off_days (
  date date primary key,
  kind text not null check (kind in ('holiday', 'school_off')),
  label text not null
);

create table public.requests (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references public.students (id) on delete cascade,
  classroom_id uuid not null references public.classrooms (id) on delete cascade,
  doc_type text not null check (doc_type in ('type1', 'type2')),
  category smallint check (
    (doc_type = 'type1' and category between 1 and 7)
    or (doc_type = 'type2' and category is null)
  ),
  start_date date not null,
  end_date date not null check (end_date >= start_date),
  period_days int not null check (period_days > 0),
  submitted_on date not null,
  guardian_name text not null,
  guardian_relation text not null check (guardian_relation in ('father', 'mother')),
  fields jsonb not null,
  signature_path text not null,
  report_submitted_on date,
  report_signature_path text,
  status text not null default 'submitted' check (status in ('submitted', 'reviewed', 'rejected', 'cancelled')),
  reject_reason text,
  reviewed_at timestamptz,
  printed_at timestamptz,
  report_printed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.login_attempts (
  id bigserial primary key,
  key text not null,
  success boolean not null,
  attempted_at timestamptz not null default now()
);

create index requests_classroom_updated_idx on public.requests (classroom_id, updated_at);
create index requests_student_start_idx on public.requests (student_id, start_date);
create index login_attempts_key_attempted_idx on public.login_attempts (key, attempted_at);

-- ---------------------------------------------------------------------------
-- triggers
-- ---------------------------------------------------------------------------

create or replace function public.touch_updated_at()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger requests_touch_updated_at
before update on public.requests
for each row execute function public.touch_updated_at();

create or replace function public.requests_guard()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if tg_op = 'INSERT' then
    if new.status is distinct from 'submitted' then
      raise exception 'invalid status transition' using errcode = '23514';
    end if;
    return new;
  end if;

  if new.status is distinct from old.status then
    if old.status = 'submitted' and new.status = 'cancelled' then
      if old.printed_at is not null or new.printed_at is not null then
        raise exception 'cannot cancel printed request' using errcode = '23514';
      end if;
    elsif old.status = 'submitted' and new.status = 'reviewed' then
      null;
    elsif old.status = 'submitted' and new.status = 'rejected' then
      if new.reject_reason is null or length(btrim(new.reject_reason)) = 0 then
        raise exception 'reject_reason required' using errcode = '23514';
      end if;
    else
      raise exception 'invalid status transition' using errcode = '23514';
    end if;
  end if;

  if old.report_submitted_on is not null
     and new.report_submitted_on is distinct from old.report_submitted_on then
    raise exception 'report already submitted' using errcode = '23514';
  end if;

  return new;
end;
$$;

create trigger requests_guard
before insert or update on public.requests
for each row execute function public.requests_guard();

revoke all on function public.touch_updated_at() from public;
revoke all on function public.requests_guard() from public;

-- ---------------------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------------------

alter table public.teachers enable row level security;
alter table public.classrooms enable row level security;
alter table public.students enable row level security;
alter table public.off_days enable row level security;
alter table public.requests enable row level security;
alter table public.login_attempts enable row level security;

grant usage on schema public to anon, authenticated;

grant select on public.teachers, public.classrooms, public.students, public.off_days, public.requests
  to anon, authenticated;

grant insert, update on public.teachers to authenticated;
grant insert, update on public.classrooms to authenticated;
grant insert, delete on public.off_days to authenticated;
grant update (status, reject_reason, reviewed_at, printed_at, report_printed_at)
  on public.requests to authenticated;

create policy teachers_select on public.teachers
  for select to authenticated using (id = auth.uid());
create policy teachers_insert on public.teachers
  for insert to authenticated with check (id = auth.uid());
create policy teachers_update on public.teachers
  for update to authenticated using (id = auth.uid()) with check (id = auth.uid());

create policy classrooms_select on public.classrooms
  for select to authenticated using (teacher_id = auth.uid());
create policy classrooms_insert on public.classrooms
  for insert to authenticated with check (teacher_id = auth.uid());
create policy classrooms_update on public.classrooms
  for update to authenticated using (teacher_id = auth.uid()) with check (teacher_id = auth.uid());

create policy students_select on public.students
  for select to authenticated using (
    exists (
      select 1 from public.classrooms c
      where c.id = students.classroom_id and c.teacher_id = auth.uid()
    )
  );

create policy off_days_select on public.off_days
  for select to authenticated using (true);
create policy off_days_insert on public.off_days
  for insert to authenticated with check (kind = 'school_off');
create policy off_days_delete on public.off_days
  for delete to authenticated using (kind = 'school_off');

create policy requests_select on public.requests
  for select to authenticated using (
    exists (
      select 1 from public.classrooms c
      where c.id = requests.classroom_id and c.teacher_id = auth.uid()
    )
  );
create policy requests_update on public.requests
  for update to authenticated
  using (
    exists (
      select 1 from public.classrooms c
      where c.id = requests.classroom_id and c.teacher_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1 from public.classrooms c
      where c.id = requests.classroom_id and c.teacher_id = auth.uid()
    )
  );

-- login_attempts: 정책 없음 + grant 없음. service role만 접근.

-- ---------------------------------------------------------------------------
-- realtime
-- ---------------------------------------------------------------------------

alter table public.requests replica identity full;

do $$
begin
  alter publication supabase_realtime add table public.requests;
exception
  when duplicate_object then null;
end $$;

-- ---------------------------------------------------------------------------
-- storage
-- ---------------------------------------------------------------------------

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('signatures', 'signatures', false, 204800, array['image/png'])
on conflict (id) do update
set public = false,
    file_size_limit = excluded.file_size_limit,
    allowed_mime_types = excluded.allowed_mime_types;

create policy teacher_read_class_signatures on storage.objects
  for select to authenticated
  using (
    bucket_id = 'signatures'
    and (storage.foldername(name))[1] in (
      select c.id::text from public.classrooms c where c.teacher_id = auth.uid()
    )
  );
