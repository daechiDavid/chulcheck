# 출결 서류 자동화 — 관리자 로컬 앱(교사용) 개발 계획서

> 대상 폴더: `admin/`
> 짝 문서: `web/plan.md` (학부모 웹앱 + Supabase 백엔드)
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
학부모가 웹에서 제출한 데이터를 교사 PC의 설치형 앱이 **실시간으로 받아 알림을 띄우고**, HWPX 양식(type1, type2-1, type2-2, type2-3)에 값을 채우고 **담임 서명을 자동 삽입**한 문서를 만든 뒤 **개별 출력 또는 정해진 순서로 일괄 출력**한다.

### 1.2 기능 범위
| # | 기능 | 비고 |
|---|---|---|
| A | 교사 로그인, 초기 설정(학급, 담임 서명, 프린터, 저장 폴더) | |
| B | 학생 명부 등록(엑셀/CSV 가져오기, 직접 편집) | 로그인에 쓰는 학년·반·번호·전화번호 원본 |
| C | 휴업일 관리(공휴일 불러오기, 재량휴업일 등록) | 결석일수 계산 기준 |
| D | 신규 제출 실시간 알림(OS 팝업 + 트레이 배지) | Supabase Realtime |
| E | 신청 목록·상세·확인/반려·교사 수정 | 내용 수정은 `teacher-update-request` |
| F | HWPX 문서 생성: type1 / type2-1 / type2-2 | 플레이스홀더 치환 + 서명 이미지 |
| G | 색인 목록표 type2-3 생성(누적 일수, 22행 단위 페이지 복제) | |
| H | 개별 출력 / 일괄 출력(정렬 규칙 준수) | |

### 1.3 운영 환경 전제
- **교사 PC: Windows 10/11 + 한컴오피스 한글 2020 이상** (학교 표준 환경). 출력·PDF 변환은 한글 자동화(COM)를 사용한다.
- 개발은 macOS에서도 가능하다. 문서 **생성**은 운영체제와 무관하게 동작하고, **출력**만 Windows 전용이다(macOS에서는 "한글에서 열기"로 대체).

---

## 2. 기술 스택

| 영역 | 선택 | 이유 |
|---|---|---|
| 앱 프레임워크 | Electron + electron-vite | Node에서 ZIP/XML 처리, PowerShell 호출(한글 COM), 트레이·OS 알림 기본 지원 |
| UI | React 18 + TypeScript + Tailwind CSS | 웹앱과 같은 스택, 공통 계약 코드 공유 |
| 데이터 | @supabase/supabase-js (**main 프로세스에 클라이언트 1개**) | 교사 인증, 조회, Realtime 구독. 세션은 `safeStorage`로 암호화해 electron-store에 저장 |
| HWPX 처리 | JSZip + @xmldom/xmldom | HWPX = ZIP + XML. 텍스트 치환은 문자열, 표 복제는 DOM 조작 |
| 엑셀 가져오기 | SheetJS(xlsx) | 학생 명부 |
| PDF 병합 | pdf-lib | 일괄 출력을 한 번의 인쇄 작업으로 묶어 순서 보장 |
| 인쇄 | pdf-to-printer (SumatraPDF 내장) | Windows 무대화 인쇄, 프린터 지정 |
| 로컬 설정 | electron-store | 서명 경로, 프린터, 폴더, 표시 옵션 |
| 테스트 | Vitest (엔진), Playwright-Electron (E2E 일부) | |
| 배포 | electron-builder (NSIS 설치파일) | 시작 프로그램 등록 옵션 |

---

## 3. 전체 구조

```
admin/
  electron/
    main/
      index.ts            # 창, 트레이, 자동 시작
      supabase.ts         # 유일한 supabase-js 클라이언트(교사 세션)
      repo.ts             # 테이블 조회·상태 변경, 교사용 함수 호출, 서명 다운로드
      realtime.ts         # Supabase Realtime 구독 → Notification (0.10)
      ipc.ts              # renderer ↔ main 브리지 (contextIsolation)
      hwpx/
        package.ts        # ZIP 열기/쓰기 (mimetype 무압축·첫 항목 유지)
        fill.ts           # {{key}} 치환, XML 이스케이프, 줄바꿈
        imageSlot.ts      # 서명 이미지 슬롯 교체
        indexTable.ts     # type2-3 행 채우기 + 22행 단위 페이지 복제
        validate.ts       # 미치환 플레이스홀더 검사
      print/
        hwpCom.ps1        # 한글 COM: HWPX → PDF 일괄 변환
        hwpCom.ts         # PowerShell 실행 래퍼
        printQueue.ts     # 정렬 → PDF 병합 → 인쇄
    preload/
  src/                    # renderer (React)
    pages/  Login, Setup, Dashboard, RequestDetail, Students, Calendar, IndexList, PrintQueue, Settings
  templates/              # 앱에 번들되는 수정본 양식 (docs/ 원본을 4.4에 따라 보정)
  tests/fixtures/
```

- 백엔드는 루트 `supabase/`(0.1)를 web과 함께 쓴다. 관리자 앱은 **교사 계정 JWT + RLS**로만 접근하며 secret 키를 절대 포함하지 않는다.
- 공통 계약은 `@contract/*` alias로 `supabase/functions/_shared/contract/`를 직접 import 한다(main·renderer 모두). 복사본을 두지 않는다.
- Supabase 호출, HWPX 처리, 파일 접근, 인쇄는 모두 **main 프로세스**에서 하고 renderer는 IPC로 요청만 한다. 클라이언트가 하나뿐이라 세션·Realtime 연결이 중복되지 않는다.

---

## 4. 양식 분석과 템플릿 보정

### 4.1 분석 결과
`Contents/section0.xml`에서 확인한 **원본** 플레이스홀더(모두 한 `<hp:t>` 안에 온전히 존재 → 문자열 치환 가능). 보정 후 최종 키는 0.11이 기준이다.

| 양식 | 플레이스홀더 |
|---|---|
| type1 결석신고서 | `grade` `class` `번호` `학생명` `sM` `sd` `eM` `eD` `period` `1`~`7` `1-reason`~`7-reason` `4-date` `6-r1` `6-r2` `6-r3` `M` `d` `name` |
| type2-1 체험학습 신청서 | `tSig` `grade` `class` `sName`(2회) `gender` `sM` `sd` `eM` `ed` `period` `place` `reason` `plan` `M` `d` `aName` |
| type2-2 체험학습 보고서 | `grade` `class` `sName`(2회) `gender` `yyyy`(3회) `sM` `sd` `eM` `ed` `period` `M` `d` `aName` |
| type2-3 색인 목록표 | `grade` `class` `sName` `yy.MM.dd. ~ MM.dd(period)` `place` `addpr` (1행에만 존재, 표는 22행) |

- 모든 양식은 A4 세로 1쪽, 섹션 1개.
- 학부모 서명 위치: type1은 `보호자 : {{name}}  (인)`, type2-1/2-2는 `학부모  {{aName}}   인`.
- 담임 서명 위치: 각 양식 우상단 결재란 `담 임(전결)` 아래 칸. type2-1에만 `{{tSig}}`가 있다.
- type1에는 `Scripts/`(체크박스 매크로 흔적)가 있으나 내용이 비어 있어 그대로 둔다.

### 4.2 발견된 문제
1. 연도 하드코딩: type1 `2026년`, type2-1 기간은 `2025년`인데 제출일은 `2026.` → 연도가 서로 다름.
2. 종료일 키 대소문자 불일치: type1 `eD`, type2 `ed`.
3. type1·type2-2에 담임 서명 자리 표시가 없음.
4. 학부모 서명 자리가 텍스트(`인`)뿐이라, 프로그램이 좌표를 계산해 이미지를 겹치기 어렵다.

### 4.3 서명 삽입 방식 — "이미지 슬롯" 방식 (채택)
좌표 계산 대신 **양식에 미리 이미지 자리를 만들어 두고, 생성할 때 그 이미지 파일만 바꿔치기**한다. 위치·크기·겹침 설정을 한글 편집기에서 사람이 눈으로 맞출 수 있어 가장 안정적이다.

1. 한글에서 각 양식을 열고 `인` 글자 위에 투명 PNG(예: 200×100px)를 삽입한다.
   - 배치: **글 앞으로**, 크기: 가로 18mm × 세로 9mm 내외(양식에 맞게 조정), 글자 중심에 맞춤.
   - 개체 속성 → 설명(shapeComment)에 `SIG_PARENT` 입력.
2. 결재란 `담 임(전결)` 아래 칸에도 같은 방식으로 이미지를 넣고 설명에 `SIG_TEACHER` 입력. type2-1의 `{{tSig}}` 텍스트는 지운다.
3. 저장한 수정본을 `admin/templates/`에 둔다. 원본 `docs/`는 보존.
4. 생성 시 `imageSlot.ts`가:
   - `<hp:pic>` 중 `<hp:shapeComment>`가 `SIG_PARENT`/`SIG_TEACHER`인 것을 찾고,
   - 그 안의 `<hc:img binaryItemIDRef="imageN">` → `Contents/content.hpf`의 해당 항목 → `BinData/imageN.png` 경로를 알아내어,
   - 서명 PNG를 **슬롯 비율에 맞게 여백을 더해(aspect-fit, 가운데 정렬)** 같은 크기로 만든 뒤 그 파일을 덮어쓴다.
   - 서명이 없으면 1×1 투명 PNG로 바꾼다.
5. 한 양식에서 두 슬롯이 같은 이미지를 공유하지 않도록 슬롯마다 다른 PNG를 사용한다.

> 대안(비상용): 슬롯이 없는 양식이면 `인` 글자가 있는 런 앞에 `<hp:pic>`을 직접 끼워 넣는다. 한글에서 "글 앞으로" 이미지를 하나 넣고 저장한 XML을 스니펫으로 떠서 쓰는 방식이며, M0 스파이크에서 가능 여부만 확인한다.

### 4.4 템플릿 보정 체크리스트 (`admin/templates/`)
- [ ] type1: 기간의 `2026년` 2곳 → `{{sY}}년`/`{{eY}}년`, 제출일 `2026년` → `{{yyyy}}년`, `SIG_PARENT`·`SIG_TEACHER` 슬롯 추가
- [ ] type2-1: 기간 `2025년` → `{{sY}}년`/`{{eY}}년`, 제출일 `2026.` → `{{yyyy}}.`, `{{tSig}}` 제거 후 슬롯 2개 추가
- [ ] type2-2: `{{yyyy}}` 3곳 → 시작 `{{sY}}`, 종료 `{{eY}}`, 제출 `{{yyyy}}`, 슬롯 2개 추가
- [ ] type2-3: `2026학년도` → `{{schoolYear}}학년도`, 1행 번호 `1` → `{{no}}`, `{{yy.MM.dd. ~ MM.dd(period)}}` → `{{range}}`, `확인 후 ○표시`의 고정 `○` 2개 → `{{rptMark}}`·`{{neisMark}}`
- [ ] 보정 후 `validate.ts`로 플레이스홀더 목록을 다시 추출해 **0.11 표와 정확히 일치**하는지 테스트로 고정

---

## 5. 플레이스홀더 매핑 규칙

키 목록과 값 규칙은 0.11, 구현은 공통 계약 `placeholders.ts`(web 미리보기와 같은 함수)다. 관리자 앱은 type2-3 행 값(`indexRows()`)도 같은 파일에 추가한다. 아래는 요약이다.

| 키 | 값 |
|---|---|
| `1`~`7` | 선택 번호 `■`, 나머지 `□` |
| 선택 안 된 사유의 `*-reason`, `4-date`, `6-r*` | 빈 문자열 |
| `4-date` | `yyyy.M.d.` (예: `2026.9.29.`) |
| `6-r1`/`6-r2`/`6-r3` | 선택된 증빙 `○`, 나머지 빈 문자열 |
| `period` (type1, 2-1, 2-2) | 숫자만 (예: `3`) |
| `yy.MM.dd. ~ MM.dd(period)` (type2-3) | `26.10.05. ~ 10.07(3일)` — 해를 넘기면 종료도 `yy.MM.dd`로 표기 |
| `addpr` (type2-3) | 해당 학생의 학년도 누적 체험학습 일수(숫자) |
| `yyyy` `sY` `eY` | 4자리 연도 |
| `gender` | `남` / `여` |
| `M` `d` `yyyy` | 신청서·결석신고서는 `submitted_on`, 보고서는 `report_submitted_on` |
| `reason` (type2-1) | `fields.content` |

치환 구현 규칙(`fill.ts`):
- 값은 반드시 XML 이스케이프(`& < > " '`)한 뒤 넣는다.
- 여러 줄 입력(`reason`, `plan`)의 줄바꿈은 `</hp:t><hp:lineBreak/><hp:t>`로 바꾼다.
- 값이 바뀐 문단의 `<hp:linesegarray>`(줄 배치 캐시)는 제거한다. 한글이 열 때 다시 계산하므로 글자 겹침을 막는다.
- 치환 후 `\{\{[^}]+\}\}`가 하나라도 남으면 **생성 실패**로 처리하고 어떤 키가 남았는지 보여준다.
- ZIP 저장 시 `mimetype`을 첫 항목, 무압축(STORE)으로 둔다(HWPX 규격).

---

## 6. 색인 목록표(type2-3) 생성

### 6.1 대상과 정렬
- 대상: 해당 학급·학년도의 type2 요청 중 상태가 `rejected`/`cancelled`가 아닌 것.
- 정렬: 체험학습 시작일 → 학생 번호 → 생성 시각.
- 순서 번호는 1부터 연속.

### 6.2 누적 일수(`addpr`)
```
각 학생별로 시작일 순서대로 period를 더한다.
예) 홍길동: 1차 3일 → 3, 2차 5일 → 8
```
- 목록표에는 행마다 **그 시점까지의 누적값**을 쓴다.
- 누적이 19일을 넘으면 앱 화면에서 해당 행을 빨간색으로 경고(출력물에는 표시하지 않음).

### 6.3 행 채우기
- 1행(플레이스홀더가 있는 행)을 **행 틀**로 쓴다.
- 각 항목마다 행 틀을 복제해 값을 넣고, 번호 칸은 순서 번호로 바꾸고, `<hp:cellAddr rowAddr>`를 실제 행 위치로 맞춘다.
- 쓰지 않는 행은 번호만 있는 빈 행으로 둔다(원본과 같은 모양).
- `확인 후 ○표시` 열: `{{rptMark}}`는 보고서 제출(`report_submitted_on` 있음) 시 `○`, `{{neisMark}}`는 기본 공란(교사 수기 확인). 설정에서 "둘 다 자동 ○"로 바꿀 수 있다.

### 6.4 22행 단위 페이지 복제
- 한 쪽에 22행. 23번째 항목부터는 **쪽 전체(제목 문단 + 표 + 하단 안내 문단)를 복제**해 다음 쪽에 붙인다.
- 복제 규칙:
  - 섹션 첫 문단의 `<hp:secPr>`(쪽 설정)는 복제하지 않는다.
  - 복제한 첫 문단에 `pageBreak="1"`을 준다.
  - 표 `id`, 개체 `instid`는 새 값으로 바꾼다.
  - 번호 칸: 2쪽은 23~44, 3쪽은 45~66 … (`22 × (쪽 - 1) + 행 번호`)
- 테스트: 0건, 1건, 22건, 23건, 45건.

---

## 7. 알림 (신규 제출)

구독·판별·누락 보완 규칙은 0.10이 기준이다.

1. 로그인 후 `requests` 테이블을 `classroom_id` 필터로 Realtime 구독(INSERT, UPDATE).
2. 새 제출·보고서 제출·취소 시:
   - Windows 알림: "3학년 2반 5번 홍길동 — 결석신고서(질병결석 2일 이하) 제출"
   - 알림 클릭 → 앱 창이 앞으로 오고 해당 요청 상세 화면을 연다.
   - 트레이 아이콘에 미확인 개수 배지.
3. 앱이 꺼져 있었거나 연결이 끊겼다 다시 붙으면 `updated_at > 마지막 확인 시각`인 행을 조회해 한 번에 알린다(누락 방지). 보고서 제출은 INSERT가 아니라 UPDATE이므로 생성 시각이 아닌 `updated_at`을 기준으로 한다.
4. 창을 닫으면 트레이로 최소화. 설정에서 "Windows 시작 시 자동 실행" 선택.

---

## 8. 화면 설계

| 화면 | 주요 기능 |
|---|---|
| 로그인 | 교사 이메일/비밀번호(Supabase Auth), 자동 로그인 |
| 초기 설정 | 학년도·학년·반 등록, 담임 서명 이미지 등록(배경 흰색 → 투명 변환, 미리보기), 기본 프린터, 저장 폴더 |
| 대시보드 | 요청 목록(탭: 제출됨/확인됨/출력됨/반려됨 — 0.6 표시 이름), 유형·기간 필터, 경고 아이콘, 체크박스 다중 선택, `선택 출력`, `미출력 전체 출력` |
| 요청 상세 | 입력값, 학부모 서명 이미지(Storage 직접 다운로드), 경고(`warnings.ts`), `확인`·`반려(사유 입력)`(테이블 직접 UPDATE), `값 수정`(`teacher-update-request`, 일수 재계산), `문서 생성`, `한글에서 열기`, `개별 출력` |
| 학생 명부 | 엑셀/CSV 가져오기(양식 파일 제공), 표 편집, 전화번호는 저장 후 뒷자리 4개만 표시 |
| 휴업일 | 달력, 공휴일 불러오기(`sync-holidays`), 재량휴업일 추가·삭제(`off_days`에 `kind='school_off'`로 직접). 휴업일을 바꾸면 영향받는 요청 목록을 보여주고 `teacher-update-request`로 일수 재계산 |
| 색인 목록표 | 학년도 전체 미리보기(누적 일수·19일 초과 경고), 생성·출력 |
| 출력 대기열 | 정렬된 출력 순서 미리보기, 진행 상황, 실패 항목 재시도 |
| 설정 | 프린터, 폴더, ○ 표시 옵션, 자동 실행, 로그아웃 |

### 8.1 학생 명부 가져오기 형식
| 번호 | 이름 | 성별 | 부 이름 | 부 전화 | 모 이름 | 모 전화 |
|---|---|---|---|---|---|---|
- 학년·반은 설정한 학급으로 고정.
- 저장은 `teacher-upsert-students` Edge Function으로 보내 **서버에서 전화번호를 HMAC 처리**한다(관리자 앱은 HMAC 비밀값을 모름).
- 원본 엑셀 파일은 앱에 저장하지 않는다.

---

## 9. 출력

### 9.1 정렬 규칙 (일괄 출력)
문서 단위로 목록을 만든 뒤 정렬한다.

```
문서 목록:
  type1 요청      → [결석신고서]
  type2 요청      → [신청서(type2-1)] + (보고서 제출됨이면) [보고서(type2-2)]
  '미출력 전체 출력'은 printed_at이 null인 문서, report_printed_at이 null인 보고서만 대상

정렬 키:
  1) 시작일 오름차순
  2) 학생 번호 오름차순
  3) 문서 순서: 결석신고서/신청서 = 0, 보고서 = 1
  4) 생성 시각
```
- 같은 체험학습의 신청서와 보고서는 시작일·번호가 같으므로 항상 **신청서 → 보고서** 순서로 붙어서 나온다.
- 색인 목록표는 선택 시 맨 뒤에 붙인다.
- 출력 전 "출력 순서 미리보기" 목록을 보여주고 확인을 받는다.

### 9.2 출력 파이프라인 (Windows)
```
① HWPX 생성 (출력물/{학년도}/{yyyyMMdd}_{번호:02}_{이름}_{서류}.hwpx)
② 한글 COM으로 PDF 일괄 변환 (PowerShell 한 세션에서 연속 처리)
③ pdf-lib로 정렬 순서대로 하나의 PDF로 병합
④ pdf-to-printer로 지정 프린터에 인쇄 (한 번의 인쇄 작업 → 순서 뒤섞임 없음)
⑤ 성공한 문서별로 printed_at(결석신고서·신청서) 또는 report_printed_at(보고서) 기록 — status는 바꾸지 않음(0.6)
```
- ① 직전에 대상 행을 다시 조회해 `cancelled`/`rejected`인 건은 제외하고 알린다(0.10).
- 개별 출력도 같은 경로(문서 1개)로 처리한다.
- `hwpCom.ps1` 핵심:
  ```powershell
  $hwp = New-Object -ComObject HWPFrame.HwpObject
  $hwp.RegisterModule("FilePathCheckDLL", "FilePathCheckerModule")  # 보안 승인 팝업 억제
  foreach ($f in $files) {
    $hwp.Open($f.src, "HWPX", "forceopen:true") | Out-Null
    $hwp.SaveAs($f.pdf, "PDF", "") | Out-Null
  }
  $hwp.Quit()
  ```
  - 보안 모듈(FilePathCheckerModule DLL)은 한컴 개발자 사이트에서 받아 설치 시 레지스트리에 등록한다. 미등록이면 파일마다 "접근 허용" 팝업이 뜨므로, 설치 프로그램이 등록하고 실패 시 안내한다.
- 대체 경로: 한글 COM을 쓸 수 없으면(미설치·오류) 생성된 HWPX를 정렬 순서대로 번호를 붙인 폴더에 저장하고 폴더를 열어준다.
- macOS(개발용): ①까지만 하고 "한글에서 열기"로 대체.

---

## 10. 담임 서명 처리
- 설정에서 PNG/JPG 등록 → renderer의 canvas로 흰 배경을 투명으로 바꾸고(임계값 조절 슬라이더) 여백을 잘라 `userData/teacher-signature.png`에 저장.
- 문서 생성 시 `SIG_TEACHER` 슬롯에 자동 삽입. 서명과 도장 중 선택해 등록할 수 있게 두 개까지 저장하고 기본값을 지정한다.
- 서명 파일은 로컬에만 저장(서버에 올리지 않음).

---

## 11. 개발 단계 (마일스톤)

### M0. 기술 검증 스파이크 (2일) — 가장 먼저, 위험 요소 제거
- [ ] Node로 type1.hwpx의 플레이스홀더 치환 → 한글에서 정상 열림, 글자 겹침 없음
- [ ] 이미지 슬롯 교체: 한글에서 슬롯 넣은 양식 → PNG 바꿔치기 → 위치·크기 유지 확인
- [ ] type2-3 행 복제 + 쪽 복제 → 23번 이후가 2쪽에 정상 표시
- [ ] Windows에서 한글 COM PDF 변환, 보안 모듈 등록 확인
- **완료 기준**: 네 항목 모두 실제 한글에서 눈으로 확인. 실패 항목은 4.3 대안 또는 설계 변경 후 진행

### C0·C1. 공통 계약·교사용 함수 (2일, 0.12)
- [ ] C0: web 담당자와 공동으로 루트 `supabase/` 마이그레이션·RLS·`seed.sql`, 계약 파일(`enums`·`schema`·`api`·`dates`·`fixtures`)
- [ ] C1: `teacher-upsert-students`, `teacher-update-request`, `sync-holidays`, `placeholders.ts`(+`indexRows()`) 및 테스트
- **완료 기준**: 교사 JWT로 다른 학급 `classroomId` 호출 시 `FORBIDDEN`, 전화번호 원문이 DB 어디에도 없음

### M1. 앱 뼈대 (1일)
- [ ] electron-vite + React + TS + Tailwind, contextIsolation IPC 구조, electron-store
- [ ] `@contract/*` alias(main·renderer), `zod`·`date-fns` 버전 고정, `MAIN_VITE_SUPABASE_URL`·`MAIN_VITE_SUPABASE_PUBLISHABLE_KEY`
- [ ] 트레이, 단일 인스턴스 잠금, 창 닫기 → 트레이

### M2. 인증·초기 설정·명부 (2일)
- [ ] Supabase 교사 로그인(세션 유지)
- [ ] 학급 등록, 담임 서명 등록(투명 처리)
- [ ] 학생 명부 엑셀 가져오기 → `teacher-upsert-students`
- [ ] 휴업일 화면 + `sync-holidays`

### M3. 템플릿 보정 + HWPX 엔진 (3일)
- [ ] 4.4 체크리스트대로 `admin/templates/` 작성
- [ ] `package.ts`, `fill.ts`, `imageSlot.ts`, `validate.ts`
- [ ] type1(7개 사유), type2-1, type2-2 생성 테스트(fixture 데이터 → 미치환 키 0개, XML 파싱 가능)

### M4. 대시보드·알림 (2일)
- [ ] 요청 목록/상세, 확인·반려·값 수정
- [ ] Realtime 구독, Windows 알림, 알림 클릭 → 상세 이동, 재접속 시 누락 알림

### M5. 색인 목록표 (1.5일)
- [ ] `indexTable.ts`(누적 일수, 행 채우기, 22행 쪽 복제)
- [ ] 목록표 화면(19일 초과 경고)

### M6. 출력 (2일)
- [ ] `hwpCom.ps1` + 래퍼, PDF 병합, pdf-to-printer
- [ ] 정렬 규칙 구현 + 출력 순서 미리보기, 진행률, 실패 재시도
- [ ] `printed_at`/`report_printed_at` 반영, 출력 직전 상태 재확인

### M7. 패키징·배포 (1일)
- [ ] electron-builder NSIS 설치파일, 보안 모듈 레지스트리 등록, 시작 프로그램 옵션
- [ ] 학교 PC(실제 한글 버전)에서 설치·출력 리허설

**예상 총 기간: 약 16.5일(1인 기준, C0·C1 포함)** — C0가 끝나면 web과 병렬 진행. M0·M3·M5는 `fixtures/`만으로 백엔드 없이 진행할 수 있다.

---

## 12. 테스트 계획

| 종류 | 대상 | 완료 기준 |
|---|---|---|
| 단위 | `fill.ts` 이스케이프·줄바꿈, 매핑 누락 키 | 특수문자(`&<>`) 포함 입력이 깨지지 않음 |
| 계약 | `fixtures/` → `placeholders.ts` → 보정 템플릿 | 0.11 키와 템플릿 키가 정확히 일치(web과 같은 테스트) |
| 단위 | 정렬 규칙 | 같은 날짜 번호순, 신청서→보고서 순서 |
| 단위 | 누적 일수, 쪽 복제 | 0/1/22/23/45건 fixture 통과 |
| 스냅샷 | 생성된 `section0.xml` | 템플릿 변경 시 차이 확인 |
| 수동(필수) | 한글에서 열어 보기 | 7개 사유 + 신청서 + 보고서 + 목록표 2쪽, 서명 위치 |
| 통합 | 웹 제출 → 알림 → 생성 → 출력 | 5초 이내 알림, 출력 순서 일치 |

---

## 13. 결정이 필요한 사항 (기본값으로 진행)

| 항목 | 기본값 |
|---|---|
| 운영 OS/한글 버전 | Windows 10/11 + 한글 2020 이상 |
| 색인 목록표 `출결 나이스` ○ | 공란(수기 확인), 설정으로 자동 ○ 가능 |
| 반려된 요청 | 출력 대상에서 제외, 학부모 웹에 반려 사유 표시 |
| 보고서 미제출 체험학습 | 일괄 출력 시 신청서만 출력, 대시보드에 "보고서 미제출" 표시 |
| 결재란 서명 vs 도장 | 둘 다 등록 가능, 기본값 하나 선택 |
| 한 학급 = 한 교사 | 기본. 교과전담·부담임 공유는 2차 범위 |
