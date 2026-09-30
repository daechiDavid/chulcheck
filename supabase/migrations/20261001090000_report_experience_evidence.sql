alter table public.requests
  add column report_content text not null default '',
  add column report_evidence_paths text[] not null default '{}';

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('report-evidence', 'report-evidence', false, 358400, array['image/jpeg'])
on conflict (id) do update
set public = false,
    file_size_limit = excluded.file_size_limit,
    allowed_mime_types = excluded.allowed_mime_types;

create policy teacher_read_class_report_evidence on storage.objects
  for select to authenticated
  using (
    bucket_id = 'report-evidence'
    and (storage.foldername(name))[1] in (
      select c.id::text from public.classrooms c where c.teacher_id = auth.uid()
    )
  );
