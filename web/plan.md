# 출결 서류 자동화 — 웹앱(학부모용) 개발 계획서

> 대상 폴더: `web/`
> 짝 문서: `admin/plan.md` (로컬 관리자 앱)
> 원본 요구사항: `idea.txt`, 양식: `docs/type1.hwpx`, `docs/type2-1.hwpx`, `docs/type2-2.hwpx`, `docs/type2-3.hwpx`

---

## 0. 공통 계약 — web·admin 동시 개발 기준 (두 plan.md에 동일한 내용)

> 이 장은 `web/plan.md`와 `admin/plan.md`에 **글자 그대로 똑같이** 들어 있다. 한쪽을 고치면 다른 쪽도 같이 고친다. 본문과 이 장이 다르면 **이 장이 우선**한다.

### 0.1 DB 서비스와 소유권
| 항목 | 결정 |
|---|---|
| 서비스 | **Supabase 프로젝트 1개**를 두 앱이 공유 (Postgres + Auth + Edge Functions + Storage + Realtime) |
| 백엔드 코드 위치 | 저장소 루트 `supabase/` (web·admin 어느 쪽 폴더에도 두지 않음) |
| 스키마 변경 | `supabase/migrations/`의 SQL 마이그레이션으로만. 대시보드에서 직접 변경 금지 |
| 개발 환경 | 각자 `supabase start`(로컬) + 같은 `seed.sql` 사용. 운영 반영은 `supabase db push` |
| 타입 | `supabase gen types typescript --local > supabase/functions/_shared/contract/database.types.ts` — 스키마가 바뀌면 다시 생성해 커밋 |

### 0.2 저장소 구조와 공통 코드
```
chulcheck/
  supabase/
    config.toml
    migrations/  seed.sql
    functions/
      deno.json                 # import map: "zod": "npm:zod@3.23.8", "date-fns": "npm:date-fns@4.1.0"
      _shared/contract/         # ★ 공통 계약 원본 (유일한 원본)
        database.types.ts       # 자동 생성
        enums.ts                # DocType, Category, Status, OffDayKind, Evidence
        schema.ts               # 입력 zod 스키마 (RequestInput, ReportInput, TeacherUpdateInput …)
        api.ts                  # 함수 이름·요청/응답 타입·에러 코드
        dates.ts                # todayKST(), 'YYYY-MM-DD' 파싱/포맷
        period.ts               # 수업일수 계산
        warnings.ts             # 경고 계산
        placeholders.ts         # DB 행 → 양식 플레이스홀더 값
        fixtures/               # 두 앱 공용 테스트 데이터(JSON)
      parent-login/ … (함수별 폴더)
  web/    # tsconfig paths: "@contract/*" → "../supabase/functions/_shared/contract/*"
  admin/  # 같은 alias
  docs/   # 원본 양식(수정 금지)
```
- 공통 코드 규칙: 의존성은 `zod`, `date-fns`만. 브라우저·Node·Deno 전용 API 사용 금지. 상대 import는 `.ts` 확장자까지 적는다(Deno 요구사항 → web/admin tsconfig에 `allowImportingTsExtensions: true`).
- web·admin의 `package.json`은 `zod`, `date-fns` 버전을 `deno.json`과 **똑같이 고정**한다.
- 복사해서 쓰지 않는다. 두 앱 모두 alias로 원본을 직접 import 한다.

### 0.3 인증 방식과 호출 규칙
| 호출자 | 인증 | 헤더 | 접근 경로 |
|---|---|---|---|
| 학부모(web) | 자체 세션 토큰(HS256 JWT, 2시간, claim `student_id`·`relation`) | `apikey: <publishable key>`, `x-session-token: <세션 토큰>` | **Edge Function만**. 테이블·Storage 직접 접근 불가 |
| 교사(admin) | Supabase Auth 이메일/비밀번호 | supabase-js가 자동 설정(`apikey` + `Authorization: Bearer <교사 JWT>`) | 테이블 직접(RLS) + 교사용 Edge Function |

- 학부모 세션 토큰은 `Authorization`에 넣지 않는다(Supabase 게이트웨이가 자체 JWT로 오인해 401). 학부모용 함수는 `config.toml`에서 `verify_jwt = false`로 두고 함수 안에서 `x-session-token`을 검증한다.
- 교사용 함수는 `verify_jwt = true`(기본값) + 함수 안에서 `auth.getUser()`로 교사 확인 → 요청한 `classroomId`의 `teacher_id`가 본인인지 검사.
- 교사 계정은 **초대 방식만**(Auth 설정에서 공개 회원가입 끔). 관리자가 Supabase 대시보드/CLI로 초대.
- CORS: 학부모용 함수만 `ALLOWED_ORIGINS`(Vercel 도메인, `http://localhost:5173`) 허용, 허용 헤더에 `apikey, content-type, x-session-token` 포함. admin은 Electron main(Node)에서 호출하므로 CORS와 무관.
- 모든 함수: JSON 입출력, 실패 시 `{ "error": { "code": "...", "message": "..." } }`.
  에러 코드: `INVALID_INPUT` `UNAUTHORIZED` `SESSION_EXPIRED` `LOCKED` `NOT_FOUND` `FORBIDDEN` `CONFLICT`(상태가 바뀌어 처리 불가) `AMBIGUOUS_STUDENT`

### 0.4 환경 변수
| 위치 | 이름 |
|---|---|
| web (Vite) | `VITE_SUPABASE_URL`, `VITE_SUPABASE_PUBLISHABLE_KEY` |
| admin (electron-vite, main 전용) | `MAIN_VITE_SUPABASE_URL`, `MAIN_VITE_SUPABASE_PUBLISHABLE_KEY` |
| Edge Function 비밀값 | `PHONE_PEPPER`, `SESSION_SECRET`, `DATA_GO_KR_KEY`(공휴일 API), `ALLOWED_ORIGINS` |
- 두 앱 어디에도 secret(service_role) 키를 넣지 않는다.

### 0.5 스키마 (마이그레이션 기준)
```sql
teachers   (id uuid pk references auth.users, name text not null, school_name text not null)

classrooms (id uuid pk default gen_random_uuid(), teacher_id uuid not null references teachers,
            school_year int not null, grade int not null, class_no int not null,
            unique (school_year, grade, class_no))

students   (id uuid pk default gen_random_uuid(), classroom_id uuid not null references classrooms,
            number int not null, name text not null, gender text not null check (gender in ('남','여')),
            father_name text, mother_name text,
            father_phone_hmac text, mother_phone_hmac text,     -- 원문 저장 금지
            father_phone_last4 text, mother_phone_last4 text,
            active boolean not null default true,
            unique (classroom_id, number))

off_days   (date date pk, kind text not null check (kind in ('holiday','school_off')), label text not null)
            -- 단일 학교 전제. 학교가 여러 개가 되면 school_id 추가

requests   (id uuid pk default gen_random_uuid(),
            student_id uuid not null references students, classroom_id uuid not null references classrooms,
            doc_type text not null check (doc_type in ('type1','type2')),
            category smallint check ((doc_type='type1' and category between 1 and 7) or (doc_type='type2' and category is null)),
            start_date date not null, end_date date not null check (end_date >= start_date),
            period_days int not null check (period_days > 0),       -- 서버가 계산
            submitted_on date not null,                              -- 서버가 todayKST()로 기록
            guardian_name text not null, guardian_relation text not null check (guardian_relation in ('father','mother')),
            fields jsonb not null,                                   -- 0.7 참고
            signature_path text not null,
            report_submitted_on date, report_signature_path text,    -- type2 보고서
            status text not null default 'submitted'
                   check (status in ('submitted','reviewed','rejected','cancelled')),
            reject_reason text, reviewed_at timestamptz,
            printed_at timestamptz,          -- 결석신고서 또는 신청서 출력 시각
            report_printed_at timestamptz,   -- 보고서 출력 시각
            created_at timestamptz not null default now(),
            updated_at timestamptz not null default now())           -- 트리거로 매 UPDATE 갱신

login_attempts (id bigserial pk, key text not null, success boolean not null, attempted_at timestamptz not null default now())
```
- 인덱스: `requests(classroom_id, updated_at)`, `requests(student_id, start_date)`.
- Realtime publication: `requests`만.

### 0.6 상태 모델
- `status`는 **검토 흐름만** 표현한다. "출력됨"은 상태가 아니라 `printed_at`/`report_printed_at` 유무로 판단한다(신청서만 출력된 뒤 보고서가 나중에 들어오는 경우 때문).

| 전이 | 누가 | 조건 |
|---|---|---|
| (신규) → `submitted` | 학부모 `submit-request` | |
| `submitted` → `cancelled` | 학부모 `cancel-request` | `printed_at is null` (조건부 UPDATE, 실패 시 `CONFLICT`) |
| `submitted` → `reviewed` / `rejected` | 교사(직접 UPDATE) | 반려 시 `reject_reason` 필수 |
| `rejected` → `submitted` | 없음 | 학부모는 새로 제출 |
| 보고서 제출 | 학부모 `submit-report` | `doc_type='type2'`, `status in ('submitted','reviewed')`, `end_date <= todayKST()` |

- DB 트리거 `requests_guard`가 위 표 밖의 전이를 거부한다.
- 표시 이름(두 앱 동일): `submitted`=제출됨, `reviewed`=확인됨, `rejected`=반려됨, `cancelled`=취소됨, `printed_at` 있음=출력됨.

### 0.7 `fields` JSON 모양 (`schema.ts`의 zod가 원본)
| doc_type / category | fields |
|---|---|
| type1 / 1, 2, 5 | `{ "reason": "질병명·감염병명" }` |
| type1 / 3, 7 | `{ "reason": "학부모 의견" }` |
| type1 / 4 | `{ "reason": "결석사유", "date4": "YYYY-MM-DD" }` |
| type1 / 6 | `{ "reason": "결석사유", "evidence": ["r1","r2","r3"] }` (1개 이상) |
| type2 | `{ "place": "...", "content": "학습 내용", "plan": "학습 계획" }` |
- 날짜는 전부 KST 기준 `'YYYY-MM-DD'` 문자열. 시간대 변환 금지(Edge Function은 UTC로 돌기 때문에 `new Date()`로 오늘을 구하지 말고 `todayKST()`만 사용).
- 길이 제한: `reason` 100자, `place` 50자, `content`·`plan` 1,000자. 제어문자 제거. XML 이스케이프는 하지 않고 원문 저장(이스케이프는 admin이 HWPX에 넣을 때).

### 0.8 권한 표 (RLS·Storage)
| 대상 | 학부모 | 교사 |
|---|---|---|
| `teachers` | 없음 | 본인 행 SELECT/INSERT/UPDATE |
| `classrooms` | 없음 | 본인 학급 SELECT/INSERT/UPDATE |
| `students` | 없음 | 본인 학급 SELECT. **쓰기는 `teacher-upsert-students`만**(전화번호 HMAC 때문) |
| `off_days` | 없음(`parent-me`로 받음) | 전체 SELECT, `kind='school_off'` INSERT/DELETE. `holiday`는 `sync-holidays`만 |
| `requests` | 없음 | 본인 학급 SELECT. 직접 UPDATE는 **`status, reject_reason, reviewed_at, printed_at, report_printed_at` 컬럼만**(컬럼 GRANT). 날짜·내용 수정은 `teacher-update-request` |
| `login_attempts` | 없음 | 없음 |
| Storage `signatures` (비공개) | `upload-signature`로만 업로드 | 본인 학급 학생 경로 SELECT(다운로드) |
- Storage 경로: `signatures/{classroom_id}/{student_id}/{uuid}.png` — 정책이 `classroom_id` 폴더명으로 교사 소유를 확인한다.

### 0.9 Edge Function 목록 (`api.ts`가 원본)
| 함수 | 호출자 | verify_jwt | 입력 | 출력 |
|---|---|---|---|---|
| `parent-login` | 학부모 | false | `{studentName, phone}` | `{token, expiresAt, student:{grade,classNo,number,name,gender}, guardianNameDefault, relation}` |
| `parent-me` | 학부모 | false | — | `{student, offDays:[{date,kind,label}]}` (해당 학년도) |
| `upload-signature` | 학부모 | false | `{pngBase64}` (200KB 이하) | `{path}` |
| `submit-request` | 학부모 | false | `RequestInput` (`submitted_on`·`period_days`는 받지 않음) | `{id, periodDays, warnings}` |
| `submit-report` | 학부모 | false | `{requestId, signaturePath}` (기간은 바꿀 수 없음) | `{id, reportSubmittedOn}` |
| `list-my-requests` | 학부모 | false | — | `RequestSummary[]` (상태, `rejectReason`, 출력 여부) |
| `cancel-request` | 학부모 | false | `{requestId}` | `{id}` 또는 `CONFLICT` |
| `teacher-upsert-students` | 교사 | true | `{classroomId, students:[{number,name,gender,fatherName,motherName,fatherPhone,motherPhone}]}` | `{inserted, updated, deactivated}` |
| `teacher-update-request` | 교사 | true | `{requestId, startDate?, endDate?, category?, fields?, guardianName?}` | `{id, periodDays, warnings}` (기간 재계산) |
| `sync-holidays` | 교사 | true | `{schoolYear}` | `{upserted}` |

- 교사의 단순 조회·상태 변경은 supabase-js로 테이블에 직접 한다(함수 불필요).
- `period_days`는 **서버(`submit-request`, `teacher-update-request`)만 저장**한다. 두 앱의 화면 계산은 미리보기용이며 같은 `period.ts`를 쓴다.
- `warnings`는 DB에 저장하지 않는다. web은 함수 응답으로, admin은 같은 `warnings.ts`를 직접 호출해 표시한다.
- 학년도: 3월 1일 ~ 다음 해 2월 말. `schoolYearOf(date)`를 `dates.ts`에 둔다.

### 0.10 알림(Realtime) 계약
- admin은 `requests`를 `classroom_id=eq.{id}` 필터로 INSERT·UPDATE 구독한다.
- 알림 종류 판별: INSERT = 새 제출, UPDATE에서 `report_submitted_on`이 null→값 = 보고서 제출, `status`가 `cancelled`로 바뀜 = 취소.
- 재접속·재시작 시 `updated_at > 마지막 확인 시각`으로 다시 조회해 누락을 채운다(마지막 확인 시각은 admin 로컬 저장).
- admin은 출력 직전에 대상 행을 다시 조회해 `cancelled`/`rejected`인 건은 건너뛴다.

### 0.11 양식 플레이스홀더 (보정 후 최종본, `placeholders.ts`가 원본)
원본 `docs/`의 연도 하드코딩·키 불일치를 admin의 `admin/templates/`에서 아래처럼 보정한다(4장 참고).

| 양식 | 키 |
|---|---|
| type1 | `grade` `class` `번호` `학생명` `sY` `sM` `sd` `eY` `eM` `eD` `period` `1`~`7` `1-reason` `2-reason` `3-reason` `4-date` `4-reason` `5-reason` `6-reason` `6-r1` `6-r2` `6-r3` `7-reason` `yyyy` `M` `d` `name` |
| type2-1 | `grade` `class` `sName` `gender` `sY` `sM` `sd` `eY` `eM` `ed` `period` `place` `reason` `plan` `yyyy` `M` `d` `aName` |
| type2-2 | `grade` `class` `sName` `gender` `sY` `sM` `sd` `eY` `eM` `ed` `period` `yyyy` `M` `d` `aName` |
| type2-3 (머리) | `schoolYear` `grade` `class` |
| type2-3 (행) | `no` `sName` `range` `place` `rptMark` `neisMark` `addpr` |
| 이미지 슬롯 | `SIG_PARENT`(학부모 서명), `SIG_TEACHER`(담임 서명) — 텍스트 키 아님, 그림 개체 설명(shapeComment) |

값 규칙: `1`~`7` = 선택 `■` / 나머지 `□` · `6-r*` = 선택 `○` / 나머지 빈칸 · 선택 안 한 사유 칸은 빈칸 · `4-date` = `yyyy.M.d.` · `period` = 숫자만 · `range` = `yy.MM.dd. ~ MM.dd(N일)`(해를 넘기면 `~ yy.MM.dd`) · `type2-1`의 `reason` = `fields.content` · `M`/`d`/`yyyy` = 결석신고서·신청서는 `submitted_on`, 보고서는 `report_submitted_on`.

### 0.12 동시 개발 순서
| 단계 | 담당 | 산출물 | 이후 가능해지는 일 |
|---|---|---|---|
| C0 (1일) | 공동 | 이 장 확정, `supabase/` 초기화, 마이그레이션·RLS·`seed.sql`, `enums.ts`·`schema.ts`·`api.ts`·`dates.ts`, `fixtures/` | 두 앱이 백엔드 없이 fixture로 병렬 개발 |
| C1 (1일) | web 담당 | 학부모 함수 7개 + `period.ts`·`warnings.ts`·테스트 | web 실제 연동 |
| C1 (1일, 병행) | admin 담당 | 교사 함수 3개 + `placeholders.ts`·테스트 | admin 실제 연동 |
- `supabase/` 변경은 PR 단위로 하고, 마이그레이션 파일은 타임스탬프 이름으로만 추가(기존 파일 수정 금지) → 두 사람이 동시에 만들어도 충돌하지 않는다.
- 계약(`_shared/contract/`) 변경 시 두 앱의 타입 검사·테스트가 모두 통과해야 병합.

---

## 1. 목표와 범위

### 1.1 목표
학부모가 휴대폰/PC 웹에서 결석 관련 내용을 입력하고 서명하면, 그 데이터가 **HWPX 양식의 플레이스홀더에 1:1로 대응되는 구조화 데이터**로 DB에 저장된다. 담임교사는 로컬 관리자 앱(`admin/`)에서 이 데이터를 받아 문서를 자동 생성·출력한다.

### 1.2 웹앱이 하는 일 / 하지 않는 일
| 구분 | 내용 |
|---|---|
| 한다 | 학부모 인증(학생명+전화번호), 서류 종류/사유 선택, 사유별 입력폼, 날짜 선택, 결석일수 자동 계산, 전자서명, 제출 전 미리보기, 제출 내역 조회 |
| 한다 | 루트 `supabase/`의 학부모용 Edge Function 7개 구현(0.9). 스키마·교사용 함수는 0.12 순서대로 공동/관리자 담당 |
| 하지 않는다 | HWPX 파일 생성·출력 (관리자 앱 담당), 학생 명부 등록 (관리자 앱 담당) |

---

## 2. 기술 스택

| 영역 | 선택 | 이유 |
|---|---|---|
| 프론트엔드 | React 18 + TypeScript + Vite | 가볍고 빠른 SPA, 모바일 중심 |
| 스타일 | Tailwind CSS | 모바일 반응형 폼을 빠르게 구성 |
| 폼/검증 | react-hook-form + zod | 사유별 동적 필드 + 스키마 검증을 관리자 앱과 공유 가능 |
| 날짜 | react-day-picker + date-fns (ko 로케일) | 범위 선택(시작~종료) 지원, 휴업일 비활성 표시 |
| 서명 | signature_pad | 터치/마우스 서명 → 투명 배경 PNG |
| 백엔드 | Supabase (Postgres, Edge Functions, Storage, Realtime) | 관리자 앱의 실시간 알림(Realtime) 요구와 맞음, RLS로 권한 분리 |
| 배포 | Vercel (정적 SPA) | HTTPS 기본 제공, 프리뷰 배포 |

---

## 3. 전체 구조

```
[학부모 브라우저] ──HTTPS──> [Supabase Edge Functions] ──> [Postgres]
      │                           │                         │
      │ (서명 PNG 업로드)          └──> [Storage: signatures] │
      │                                                     │ Realtime(INSERT/UPDATE)
      └───────── 학부모는 테이블에 직접 접근 불가 ──────────┘
                                                            ▼
                                              [관리자 로컬 앱 (admin/)]
```

- 학부모는 Supabase Auth 계정이 없다. 따라서 **학부모의 모든 읽기/쓰기는 Edge Function을 통해서만** 한다. 테이블·Storage에 대한 익명 접근은 RLS로 전부 막는다(0.3, 0.8).
- 교사는 Supabase Auth 계정으로 관리자 앱에 로그인하고, RLS로 자기 학급 데이터만 접근한다.

### 3.1 폴더 구조 (예정)
```
web/
  src/
    app/            # 라우터, 레이아웃
    pages/          # Login, Home, NewAbsence, NewFieldTrip, FieldTripReport, Review, Done, History
    features/
      auth/         # 세션 토큰 저장/만료 처리
      absence/      # type1 폼 (사유 7종)
      fieldtrip/    # type2 신청서/보고서 폼
      signature/    # 서명 패드 컴포넌트
      calendar/     # 휴업일 조회, 결석일수 계산
    shared/
      api/          # Edge Function 호출 래퍼 (apikey + x-session-token 헤더, 에러 코드 처리)
```

> 공통 계약은 `@contract/*` alias로 `supabase/functions/_shared/contract/`를 직접 import 한다(0.2). web 폴더 안에 복사본을 두지 않는다.

---

## 4. 양식 분석 결과 (플레이스홀더 목록)

`docs/*.hwpx`의 `Contents/section0.xml`을 직접 분석한 결과다. 플레이스홀더는 XML 런(run) 단위로 끊기지 않고 온전히 들어 있어 문자열 치환이 가능하다.
아래 표는 **원본 양식 기준**이다. 보정 후 최종 키(`sY`/`eY`/`yyyy` 추가, `tSig` 제거 등)는 0.11이 기준이다.

### 4.1 type1 — 결석신고서 (`type1.hwpx`)
| 플레이스홀더 | 의미 | 웹 입력/생성 규칙 |
|---|---|---|
| `{{grade}}` `{{class}}` `{{번호}}` `{{학생명}}` | 학년/반/번호/학생명 | 로그인 시 교사가 등록한 값 자동 입력(수정 불가) |
| `{{sM}}` `{{sd}}` `{{eM}}` `{{eD}}` | 결석 시작 월·일 / 종료 월·일 | 날짜 범위 선택. **type1은 `eD`(대문자 D)** |
| `{{period}}` | 결석일수(숫자만) | 자동 계산(6장) |
| `{{1}}`~`{{7}}` | 사유 체크 칸 | 선택한 번호만 `■`, 나머지 `□` |
| `{{1-reason}}` | 3일 이상 질병결석 — 질병명 | 텍스트 |
| `{{2-reason}}` | 2일 이하 질병결석(병·약국 내원) — 질병명 | 텍스트 |
| `{{3-reason}}` | 2일 이하 질병결석(가정 치료) — 학부모 의견 | 텍스트 |
| `{{4-date}}` `{{4-reason}}` | 미인정결석 시작일(`yyyy.M.d.`) / 결석사유 | 시작일은 결석 시작일로 기본값, 사유 텍스트 |
| `{{5-reason}}` | 법정감염병 — 감염병명 | 텍스트 |
| `{{6-reason}}` `{{6-r1}}` `{{6-r2}}` `{{6-r3}}` | 경조사 사유 / 증빙: 청첩장·부고장·기타 | 사유 텍스트 + 증빙 체크(선택 시 `○`) |
| `{{7-reason}}` | 생리결석 — 학부모 의견 | 텍스트 |
| `{{M}}` `{{d}}` | 제출 월·일 | 제출일(오늘) 자동 |
| `{{name}}` | 보호자 이름 | 텍스트, 뒤의 `(인)` 위에 서명 이미지 겹침 |

- 선택하지 않은 사유의 `*-reason`, `6-r*`, `4-date`는 빈 문자열로 치환한다.
- 질병결석 1~3번은 기간에 따라 자동 추천: 결석일수 3일 이상이면 1번, 2일 이하면 2번/3번 중 선택. 사용자가 고른 번호와 결석일수가 맞지 않으면 경고를 띄운다.

### 4.2 type2-1 — 교외체험학습 신청서 (`type2-1.hwpx`)
| 플레이스홀더 | 의미 | 규칙 |
|---|---|---|
| `{{grade}}` `{{class}}` `{{sName}}` `{{gender}}` | 인적사항 | 자동(성별 `남`/`여`) |
| `{{sM}}` `{{sd}}` `{{eM}}` `{{ed}}` `{{period}}` | 체험학습 기간 / 일수 | 날짜 범위 + 자동 계산 |
| `{{place}}` | 장소 | 텍스트 |
| `{{reason}}` | 학습 내용 (DB에는 `fields.content`로 저장) | 여러 줄 텍스트(예시 문구 안내) |
| `{{plan}}` | 학습 계획 | 여러 줄 텍스트 |
| `{{M}}` `{{d}}` | 신청일 | 자동(오늘) |
| `{{aName}}` | 학부모 이름 | 텍스트, 뒤의 `인` 위에 서명 이미지 |
| `{{tSig}}` | 담임 서명 | 웹에서 다루지 않음. 보정 양식에서는 이미지 슬롯 `SIG_TEACHER`로 대체 |

### 4.3 type2-2 — 교외체험학습 보고서 (`type2-2.hwpx`)
- `{{grade}}` `{{class}}` `{{sName}}` `{{gender}}` `{{sM}}` `{{sd}}` `{{eM}}` `{{ed}}` `{{period}}` `{{M}}` `{{d}}` `{{aName}}` `{{yyyy}}`(3회 → 보정 후 `sY`·`eY`·`yyyy`)
- 보고서는 **이미 제출된 신청서에 연결**해서 작성한다. 기간·장소는 신청서 값을 그대로 쓰고, 학부모는 서명만 한다. 제출일은 서버가 기록한다.
- 기간이 실제와 달라졌으면 학부모는 수정할 수 없고 담임에게 알린다(담임이 `teacher-update-request`로 수정). 이미 출력된 신청서와 보고서의 기간이 어긋나는 것을 막기 위해서다.

### 4.4 type2-3 — 색인 목록표 (`type2-3.hwpx`)
웹에서 입력하지 않는다. 관리자 앱이 누적 데이터로 생성한다. 웹은 `place`, 기간, `period`를 정확히 저장하기만 하면 된다.

### 4.5 양식 파일 수정 권고 (관리자 앱 개발 전 반영)
| 문제 | 권고 |
|---|---|
| type1의 연도 `2026년`이 하드코딩됨 | 기간은 `{{sY}}`/`{{eY}}`, 제출일은 `{{yyyy}}`로 교체 |
| type2-1 기간은 `2025년`, 제출일은 `2026.`으로 **연도가 서로 다름** | 같은 방식으로 `{{sY}}`/`{{eY}}`/`{{yyyy}}` 교체 |
| type1(`eD`)과 type2(`ed`)의 대소문자 불일치 | 양식은 그대로 두고 `placeholders.ts`에서 양식별로 따로 처리 |
| 담임 서명 자리: type2-1만 `{{tSig}}`, type1·type2-2는 없음 | 세 양식 모두 이미지 슬롯 `SIG_TEACHER`로 통일 |
| 학부모 서명 위치가 텍스트 `(인)`/`인`뿐 | 이미지 슬롯 `SIG_PARENT`를 글자 위에 배치 |

보정 작업과 최종 키 목록은 관리자 앱 담당이며(`admin/plan.md` 4장), 기준은 0.11이다.

---

## 5. 데이터 모델 (Supabase / Postgres)

스키마·권한·상태 모델은 0.5~0.8이 기준이다. 웹 담당자가 추가로 지킬 점만 적는다.

- 학부모용 함수는 서버 쪽 secret 키로 DB에 접근하므로 RLS를 거치지 않는다. **모든 쿼리에 세션 토큰의 `student_id` 조건을 직접 건다**(`requests.student_id = claims.student_id`). 함수마다 이 조건을 빠뜨리지 않았는지 테스트로 확인한다.
- 서명 업로드 경로는 `signatures/{classroom_id}/{student_id}/{uuid}.png`(0.8). `classroom_id`는 토큰이 아니라 DB의 학생 행에서 읽는다.
- `submit-request`는 `period_days`, `submitted_on`을 클라이언트에서 받지 않고 서버가 채운다.

---

## 6. 결석일수(`period`) 계산 규칙

```
period = 시작일~종료일(양 끝 포함) 중
         토·일 제외
         AND off_days(공휴일 + 재량휴업일) 제외
```
- 계산 함수는 공통 계약의 `period.ts` 하나뿐이다. 웹은 `parent-me`로 받은 `offDays`로 미리보기만 계산하고, 저장값은 `submit-request`가 같은 함수로 다시 계산한다.
- 공휴일은 교사가 관리자 앱에서 `sync-holidays`로 불러오고, 재량휴업일은 교사가 `off_days`에 직접 등록한다. 개발용 공휴일은 `seed.sql`에 넣는다.
- 달력에서 휴업일은 회색 + 툴팁(예: "개교기념일")으로 표시한다.
- 계산 결과가 0이면 제출을 막는다.

단위 테스트 케이스(필수):
1. 평일 3일 연속 → 3
2. 금~월 → 2
3. 공휴일 포함 주 → 공휴일 제외
4. 재량휴업일 포함 → 제외
5. 연도를 넘는 기간(12/30~1/2)

---

## 7. 인증 설계 (학생명 + 학부모 전화번호)

### 7.1 흐름
1. 로그인 화면: `학생 이름`, `보호자 휴대폰 번호` 입력(개인정보 수집·이용 동의 체크 포함).
2. `POST /functions/v1/parent-login`
   - 전화번호 정규화: 숫자만 남기고 `010` 형식으로 통일.
   - `HMAC-SHA256(phone, PHONE_PEPPER)` 계산 → `students`에서 `name = 입력값 AND active AND (father_phone_hmac = h OR mother_phone_hmac = h)` 조회.
   - 결과가 정확히 1명일 때만 성공. 0명이면 실패, 2명 이상(동명이인 + 같은 번호)이면 "담임선생님께 문의" 안내.
3. 성공 시 Edge Function이 **자체 서명한 세션 토큰**(JWT, HS256, `SESSION_SECRET`, 유효기간 2시간, claim: `student_id`, `relation`)을 발급. 이후 요청은 `x-session-token` 헤더로 보낸다(0.3).
4. 응답에 학생 기본 정보(학년·반·번호·이름·성별)와 보호자 이름 기본값(로그인한 번호가 부/모 중 어느 쪽인지로 선택)을 함께 준다 → 폼에 자동 입력.
5. 토큰은 `sessionStorage`에 저장(탭 종료 시 삭제). 만료 시 로그인 화면으로 이동.

### 7.2 무차별 대입 방어
- 같은 IP 또는 같은 학생명 기준 10분에 5회 실패 시 10분 잠금(`login_attempts`).
- 실패 메시지는 "학생 이름 또는 전화번호가 일치하지 않습니다"로 통일(어느 쪽이 틀렸는지 알려주지 않음).

---

## 8. 화면 설계

모바일 우선(최소 폭 360px). 한 화면에 하나의 결정만 하도록 단계형으로 구성한다.

| 경로 | 화면 | 핵심 요소 |
|---|---|---|
| `/login` | 로그인 | 학생명, 전화번호(숫자 키패드), 동의 체크, 로그인 버튼 |
| `/` | 홈 | 학생 정보 카드(학년 반 번호 이름), `결석신고서 작성`, `체험학습 신청서 작성`, `체험학습 보고서 작성`(보고서 미제출 신청건이 있을 때 강조), 최근 제출 내역 |
| `/absence/new` | 결석신고서 | ① 사유 선택 → ② 사유별 입력 → ③ 기간 → ④ 보호자·서명 → ⑤ 미리보기 |
| `/field-trip/new` | 체험학습 신청서 | 기간, 장소, 학습 내용, 학습 계획, 보호자·서명, 미리보기 |
| `/field-trip/:id/report` | 체험학습 보고서 | 신청서 정보 불러오기(수정 불가), 서명, 미리보기. 종료일이 지난 신청건만 표시 |
| `/history` | 제출 내역 | 상태 배지(0.6 표시 이름), 반려 사유, 제출 취소(`submitted`이고 출력 전만) |
| `/done` | 제출 완료 | "담임선생님께 전달되었습니다", 증빙서류 원본은 학교로 제출하라는 안내 |

### 8.1 결석신고서 사유 선택 UI
- 7개 사유를 카드(라디오) 형태로 나열. **하나만 선택 가능**.
  1. 질병결석 3일 이상 · 2. 질병결석 2일 이하(병·약국 내원) · 3. 질병결석 2일 이하(가정 치료) · 4. 미인정결석 · 5. 법정감염병 · 6. 경조사 · 7. 생리결석
- 선택 즉시 미리보기의 체크 칸이 `■`(선택) / `□`(나머지)로 바뀐다.
- 사유별 입력창:

| 번호 | 입력 필드 | 안내 문구 |
|---|---|---|
| 1 | 질병명(필수) | 진료확인서 또는 의사소견서 제출 필요 |
| 2 | 질병명(필수) | 처방전 또는 약봉투 제출 필요 |
| 3 | 학부모 의견(필수) | — |
| 4 | 미인정결석 시작일(datepicker, 기본=결석 시작일), 결석사유(필수) | — |
| 5 | 감염병명(필수) | 격리기간이 기록된 증빙서류 첨부 필수 |
| 6 | 결석사유(필수), 증빙 체크박스: 청첩장/부고장/기타(1개 이상) | 경조사 인정 일수 표 표시 |
| 7 | 학부모 의견(필수) | 여학생만 선택 가능, 월 1회 |

### 8.2 경고(제출은 막지 않음, 관리자 앱에도 표시)
- 1번인데 결석일수 < 3, 2·3번인데 결석일수 > 2
- 6번 경조사: 인정 가능 일수(결혼 1일, 사망 5일/3일) 초과
- 7번: 남학생이면 선택지 숨김, 같은 달에 이미 제출 기록이 있으면 경고
- 결석일 기준 제출이 5일(휴업일 제외) 초과
- type2: 신청일이 체험학습 시작 전날보다 늦음 / 연속 10일 초과 / 학년도 누적 19일 초과(누적은 서버 계산)

### 8.3 서명
- 전체 화면 모달 서명 패드(가로 모드 권장 안내), `지우기`, `완료`.
- 저장: 여백을 잘라낸(trim) **투명 배경 PNG**, 최대 600×300px.
- 업로드: `upload-signature` Edge Function → Storage `signatures/{classroom_id}/{student_id}/{uuid}.png`, 받은 경로를 제출 시 함께 보낸다.
- 서명이 없으면 제출 불가.

### 8.4 미리보기
- 실제 양식과 같은 배치의 HTML 요약(표 레이아웃)으로 보여준다. 이름 옆 `(인)` 자리에 서명 이미지를 겹쳐서 실제 출력 모습과 비슷하게 표시.
- HWPX 렌더링은 하지 않는다(관리자 앱 역할).

---

## 9. Edge Function API

함수 목록·입출력·헤더 규칙은 0.3, 0.9가 기준이다. 웹 담당 함수는 학부모용 7개다.

- 호출 래퍼(`shared/api/`)는 모든 요청에 `apikey`와 `x-session-token`을 붙이고, `SESSION_EXPIRED`·`UNAUTHORIZED`를 받으면 로그인 화면으로 보낸다. `CONFLICT`는 "선생님이 이미 처리한 서류입니다" 안내 후 목록을 새로 고친다.
- `submit-request` 처리 순서: 토큰 검증 → zod 검증(`schema.ts`) → 학생 조회(`active`) → `period.ts`로 일수 계산(0이면 `INVALID_INPUT`) → `submitted_on = todayKST()` → INSERT → `warnings.ts` 결과와 함께 응답.
- `submit-report` 조건은 0.6 표를 따른다.
- 입력 길이 제한·제어문자 제거는 0.7. XML 이스케이프는 하지 않는다(관리자 앱이 HWPX에 넣을 때 처리).

---

## 10. 공통 데이터 계약

0.2의 `supabase/functions/_shared/contract/`를 쓴다. 웹에서 주로 쓰는 파일:
- `schema.ts`: 폼 검증(react-hook-form `zodResolver`)과 서버 검증에 같은 스키마 사용
- `period.ts`, `warnings.ts`: 입력 중 실시간 미리보기
- `placeholders.ts`: HTML 미리보기에 실제 출력과 같은 값(■/□, 날짜 형식)을 쓰기 위해 사용

```ts
// placeholders.ts 예시 (type1) — 키 목록은 0.11
export function toType1Placeholders(r: RequestRow, s: StudentRow, c: ClassroomRow): Record<string, string> {
  const box = (n: number) => (r.category === n ? '■' : '□');
  const on = (n: number) => r.category === n;
  const f = r.fields as Type1Fields;
  return {
    grade: String(c.grade), class: String(c.class_no), '번호': String(s.number), '학생명': s.name,
    sY: fmt(r.start_date, 'yyyy'), sM: fmt(r.start_date, 'M'), sd: fmt(r.start_date, 'd'),
    eY: fmt(r.end_date, 'yyyy'), eM: fmt(r.end_date, 'M'), eD: fmt(r.end_date, 'd'),
    period: String(r.period_days),
    ...Object.fromEntries([1, 2, 3, 4, 5, 6, 7].map(n => [String(n), box(n)])),
    '1-reason': on(1) ? f.reason : '', '2-reason': on(2) ? f.reason : '', '3-reason': on(3) ? f.reason : '',
    '4-date': on(4) ? fmt(f.date4!, 'yyyy.M.d.') : '', '4-reason': on(4) ? f.reason : '',
    '5-reason': on(5) ? f.reason : '', '6-reason': on(6) ? f.reason : '',
    '6-r1': on(6) && f.evidence!.includes('r1') ? '○' : '',
    '6-r2': on(6) && f.evidence!.includes('r2') ? '○' : '',
    '6-r3': on(6) && f.evidence!.includes('r3') ? '○' : '',
    '7-reason': on(7) ? f.reason : '',
    yyyy: fmt(r.submitted_on, 'yyyy'), M: fmt(r.submitted_on, 'M'), d: fmt(r.submitted_on, 'd'),
    name: r.guardian_name,
  };
}
```

---

## 11. 개인정보·보안

- 질병명·감염병명은 **민감정보**다. 로그인 화면에 수집 항목·목적·보유기간(해당 학년도 종료 후 3개월 내 삭제) 고지 + 동의 체크.
- 전화번호 원문은 DB에 저장하지 않는다(HMAC + 뒷자리 4개만).
- HTTPS만 사용, secret 키와 `PHONE_PEPPER`, `SESSION_SECRET`은 Edge Function 비밀값으로만 둔다. 프론트엔드 번들에는 publishable 키만 들어간다.
- Storage 버킷 비공개. 학부모는 업로드만, 교사는 Storage 정책(0.8)으로 자기 학급 서명만 내려받는다.
- 학년도 종료 시 데이터 삭제 스크립트(`purge-school-year`) 제공.

---

## 12. 개발 단계 (마일스톤)

### M0. 준비 (0.5일)
- [ ] Vite + React + TS + Tailwind 초기화, ESLint/Prettier, Vitest
- [ ] tsconfig `@contract/*` alias, `allowImportingTsExtensions`, `zod`·`date-fns` 버전 고정(0.2)
- [ ] Vercel 프로젝트 연결, 환경변수(`VITE_SUPABASE_URL`, `VITE_SUPABASE_PUBLISHABLE_KEY`)

### M1. 공통 계약·백엔드 기반 — 0.12의 C0 (1일, admin 담당자와 공동)
- [ ] 루트 `supabase/` 초기화, 마이그레이션(0.5 스키마 + 0.8 RLS·Storage 정책 + `requests_guard`·`updated_at` 트리거 + Realtime)
- [ ] `seed.sql`: 교사 1명, 학급 1개, 학생 5명, 2026학년도 공휴일
- [ ] `enums.ts`, `schema.ts`, `api.ts`, `dates.ts`, `fixtures/`
- **완료 기준**: 두 앱에서 `@contract/*` import 후 타입 검사 통과, publishable 키만으로 테이블 직접 조회 시 0건

### M2. 학부모용 함수 — 0.12의 C1 (1.5일)
- [ ] `period.ts`, `warnings.ts` + 6장의 단위 테스트 5종
- [ ] `parent-login`(시도 제한), `parent-me`, `upload-signature`, `submit-request`, `submit-report`, `list-my-requests`, `cancel-request`
- [ ] `config.toml`에 7개 함수 `verify_jwt = false`, CORS 공통 모듈
- **완료 기준**: 부/모 번호 각각 로그인 성공, 틀린 번호 실패, 6회째 잠금, 다른 학생 `requestId`로 호출 시 `NOT_FOUND`, 출력된 건 취소 시 `CONFLICT`

### M3. 로그인·홈 화면 (1일)
- [ ] 로그인 폼(전화번호 자동 하이픈), 세션 보관/만료 처리, 홈 화면

### M4. 결석신고서 폼 (2일)
- [ ] 사유 카드 7종, 사유별 동적 필드, 기간 선택(휴업일 표시), 일수 자동 표시
- [ ] 경고 표시(8.2)
- **완료 기준**: 7개 사유 모두 제출 가능, 사유 전환 시 이전 사유 값이 섞이지 않음

### M5. 서명·미리보기·제출 (1.5일)
- [ ] 서명 패드(trim, 투명 PNG), 업로드
- [ ] HTML 미리보기(■/□, 서명 겹침)
- [ ] `submit-request`, 완료 화면

### M6. 체험학습 신청서·보고서 (1.5일)
- [ ] 신청서 폼, 보고서(신청건 선택 → 서명)
- [ ] `submit-report`, 홈의 "보고서 미제출" 알림

### M7. 제출 내역·취소 (0.5일)
- [ ] `list-my-requests`, `cancel-request`, 상태 배지

### M8. 마감 (1일)
- [ ] 접근성(라벨, 포커스, 글자 크기 16px 이상), iOS Safari/안드로이드 크롬 실기기 확인
- [ ] 개인정보 고지 문구, 에러 화면
- [ ] Vercel 운영 배포, Supabase 운영 프로젝트 마이그레이션

**예상 총 기간: 약 11일(1인 기준, 공통 C0 1일 포함)**

---

## 13. 테스트 계획

| 종류 | 대상 |
|---|---|
| 단위(Vitest) | 일수 계산, 전화번호 정규화, zod 스키마, 플레이스홀더 매핑(누락 키 0개) |
| Edge Function(Deno test) | 로그인 성공/실패/잠금, 타 학생 요청 접근 차단, 일수 재계산, `submitted_on`이 KST 날짜인지(UTC 자정 전후) |
| E2E(Playwright, 모바일 뷰포트) | 로그인 → 7개 사유별 제출, 체험학습 신청 → 보고서 제출 |
| 보안 점검 | publishable 키로 REST·Storage 직접 호출 시 차단, 토큰 위조/만료 거부 |
| 계약 테스트 | `fixtures/`로 `placeholders.ts` 결과가 0.11 키를 빠짐없이 채움(admin과 같은 테스트) |

---

## 14. 결정이 필요한 사항 (기본값으로 진행)

| 항목 | 기본값 |
|---|---|
| 경조사 증빙 표시 기호 | `○` (필요 시 `✓`로 변경) |
| 서류 양식 연도 하드코딩 | 4.5 권고대로 `{{sY}}`/`{{eY}}`/`{{yyyy}}`로 교체 (0.11) |
| 보고서도 학부모 서명 필요 여부 | 필요(양식에 `인` 자리가 있음) |
| 제출 후 수정 | 학부모는 `submitted`이고 출력 전일 때만 취소 후 재작성. 그 외 수정은 교사가 `teacher-update-request`로 |
| 학부모 파일 첨부(진료확인서 사진 등) | 1차 범위 제외, 원본은 학교로 제출 안내. 2차에 선택 기능으로 검토 |
