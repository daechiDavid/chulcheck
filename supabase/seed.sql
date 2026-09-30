-- 개발·시연용 시드.
-- 전화번호 HMAC 은 PHONE_PEPPER = chulcheck-phone-pepper-v1 과 같아야 한다.
-- 교사 로그인(관리자 앱): teacher@hanbit.school / Hb-2026-chulcheck-demo
-- 학부모 로그인 예: 김하늘 / 010-2000-0001 (어머니)

insert into auth.users (
  instance_id,
  id,
  aud,
  role,
  email,
  encrypted_password,
  email_confirmed_at,
  raw_app_meta_data,
  raw_user_meta_data,
  created_at,
  updated_at,
  confirmation_token,
  recovery_token,
  email_change_token_new,
  email_change
) values (
  '00000000-0000-0000-0000-000000000000',
  'a1111111-1111-4111-8111-111111111111',
  'authenticated',
  'authenticated',
  'teacher@hanbit.school',
  extensions.crypt('Hb-2026-chulcheck-demo', extensions.gen_salt('bf')),
  now(),
  '{"provider":"email","providers":["email"]}',
  '{"name":"한지민"}',
  now(),
  now(),
  '',
  '',
  '',
  ''
) on conflict (id) do nothing;

insert into auth.identities (
  id,
  user_id,
  identity_data,
  provider,
  provider_id,
  last_sign_in_at,
  created_at,
  updated_at
) values (
  'a1111111-1111-4111-8111-111111111112',
  'a1111111-1111-4111-8111-111111111111',
  '{"sub":"a1111111-1111-4111-8111-111111111111","email":"teacher@hanbit.school"}',
  'email',
  'a1111111-1111-4111-8111-111111111111',
  now(),
  now(),
  now()
) on conflict (id) do nothing;

insert into public.teachers (id, name, school_name)
values ('a1111111-1111-4111-8111-111111111111', '한지민', '한빛초등학교')
on conflict (id) do nothing;

insert into public.classrooms (id, teacher_id, school_year, grade, class_no)
values (
  'b2222222-2222-4222-8222-222222222222',
  'a1111111-1111-4111-8111-111111111111',
  2026, 3, 2
) on conflict (id) do nothing;

insert into public.students (
  id, classroom_id, number, name, gender,
  father_name, mother_name,
  father_phone_hmac, mother_phone_hmac,
  father_phone_last4, mother_phone_last4
) values
  (
    'c3333333-3333-4333-8333-333333333301',
    'b2222222-2222-4222-8222-222222222222',
    1, '김하늘', '여', '김민준', '김서연',
    encode(extensions.hmac('01010000001', 'chulcheck-phone-pepper-v1', 'sha256'), 'hex'),
    encode(extensions.hmac('01020000001', 'chulcheck-phone-pepper-v1', 'sha256'), 'hex'),
    '0001', '0001'
  ),
  (
    'c3333333-3333-4333-8333-333333333302',
    'b2222222-2222-4222-8222-222222222222',
    2, '박지호', '남', '박성민', '박유진',
    encode(extensions.hmac('01010000002', 'chulcheck-phone-pepper-v1', 'sha256'), 'hex'),
    encode(extensions.hmac('01020000002', 'chulcheck-phone-pepper-v1', 'sha256'), 'hex'),
    '0002', '0002'
  ),
  (
    'c3333333-3333-4333-8333-333333333303',
    'b2222222-2222-4222-8222-222222222222',
    3, '이하은', '여', '이준호', '이수정',
    encode(extensions.hmac('01010000003', 'chulcheck-phone-pepper-v1', 'sha256'), 'hex'),
    encode(extensions.hmac('01020000003', 'chulcheck-phone-pepper-v1', 'sha256'), 'hex'),
    '0003', '0003'
  ),
  (
    'c3333333-3333-4333-8333-333333333304',
    'b2222222-2222-4222-8222-222222222222',
    4, '최민재', '남', '최동혁', '최은지',
    encode(extensions.hmac('01010000004', 'chulcheck-phone-pepper-v1', 'sha256'), 'hex'),
    encode(extensions.hmac('01020000004', 'chulcheck-phone-pepper-v1', 'sha256'), 'hex'),
    '0004', '0004'
  ),
  (
    'c3333333-3333-4333-8333-333333333305',
    'b2222222-2222-4222-8222-222222222222',
    5, '정다은', '여', '정우성', '정미래',
    encode(extensions.hmac('01010000005', 'chulcheck-phone-pepper-v1', 'sha256'), 'hex'),
    encode(extensions.hmac('01020000005', 'chulcheck-phone-pepper-v1', 'sha256'), 'hex'),
    '0005', '0005'
  )
on conflict (id) do nothing;

-- 2026학년도(2026-03-01 ~ 2027-02-28) 공휴일 + 재량휴업일 1건
insert into public.off_days (date, kind, label) values
  ('2026-03-01', 'holiday', '삼일절'),
  ('2026-03-02', 'holiday', '삼일절 대체공휴일'),
  ('2026-05-05', 'holiday', '어린이날'),
  ('2026-05-24', 'holiday', '부처님오신날'),
  ('2026-05-25', 'holiday', '부처님오신날 대체공휴일'),
  ('2026-06-03', 'holiday', '전국동시지방선거'),
  ('2026-06-06', 'holiday', '현충일'),
  ('2026-08-15', 'holiday', '광복절'),
  ('2026-09-24', 'holiday', '추석 연휴'),
  ('2026-09-25', 'holiday', '추석'),
  ('2026-09-26', 'holiday', '추석 연휴'),
  ('2026-10-03', 'holiday', '개천절'),
  ('2026-10-09', 'holiday', '한글날'),
  ('2026-12-25', 'holiday', '성탄절'),
  ('2027-01-01', 'holiday', '신정'),
  ('2027-02-06', 'holiday', '설날 연휴'),
  ('2027-02-07', 'holiday', '설날'),
  ('2027-02-08', 'holiday', '설날 연휴'),
  ('2027-02-09', 'holiday', '설날 대체공휴일'),
  ('2026-05-15', 'school_off', '개교기념일')
on conflict (date) do nothing;
