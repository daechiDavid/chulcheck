-- 학년도 종료 후 해당 학년도 자료 삭제.
-- school_year 값을 바꾼 뒤, 연결된 프로젝트에서 실행한다.
-- 예: supabase db query --linked -f supabase/scripts/purge-school-year.sql

begin;

delete from storage.objects
where bucket_id = 'signatures'
  and (storage.foldername(name))[1] in (
    select id::text from public.classrooms where school_year = 2026
  );

delete from public.requests
where classroom_id in (select id from public.classrooms where school_year = 2026);

delete from public.students
where classroom_id in (select id from public.classrooms where school_year = 2026);

delete from public.classrooms where school_year = 2026;

commit;
