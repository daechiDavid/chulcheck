import { Link } from "react-router-dom";
import { CATEGORY_LABELS } from "@contract/api.ts";
import { todayKST } from "@contract/dates.ts";
import { useSession } from "../features/auth/session.tsx";
import { Banner, StatusBadge } from "../shared/ui.tsx";

const actionCardClass =
  "sheet group flex cursor-pointer items-center justify-between gap-4 rounded-3xl p-5 transition-all duration-200 ease-out hover:-translate-y-0.5 hover:border-primary/40 hover:bg-primary-soft hover:shadow-md focus-visible:border-primary/40 focus-visible:bg-primary-soft focus-visible:shadow-md active:translate-y-0 active:shadow-sm motion-reduce:transition-none motion-reduce:hover:translate-y-0";
const actionArrowClass =
  "shrink-0 text-xl text-muted transition-transform duration-200 group-hover:translate-x-1 group-hover:text-primary motion-reduce:transition-none motion-reduce:group-hover:translate-x-0";

export function HomePage() {
  const { session, requests, error } = useSession();
  const student = session?.student;
  const today = todayKST();
  const reportDue = requests.filter(
    (row) =>
      row.docType === "type2" &&
      !row.reportSubmittedOn &&
      (row.status === "submitted" || row.status === "reviewed") &&
      row.endDate <= today,
  );
  if (!student) return null;

  return (
    <main className="rise space-y-4">
      {error ? <Banner tone="error">{error}</Banner> : null}
      {/* <section className="sheet rounded-[28px] p-5">
        <p className="text-sm text-muted">
          {student.grade}학년 {student.classNo}반 {student.number}번
        </p>
        <h1 className="mt-1 font-display text-4xl">{student.name}</h1>
        <p className="mt-2 text-sm text-muted">작성한 내용은 담임선생님 컴퓨터로 전달됩니다.</p>
      </section> */}
      {reportDue.length > 0 ? (
        <Banner tone="warn">
          체험학습이 끝난 신청서가 {reportDue.length}건 있습니다. 보고서를 작성해 주세요.
        </Banner>
      ) : null}
      <div className="grid gap-3">
        <Link className={actionCardClass} to="/absence/new">
          <span>
            <span className="mt-1 block font-display text-3xl">결석계 제출</span>
            <span className="text-sm text-muted">질병결석, 미인정결석, 경조사, 생리결석</span>
          </span>
          <span aria-hidden="true" className={actionArrowClass}>→</span>
        </Link>
        <Link className={actionCardClass} to="/field-trip/new">
          <span>
            <span className="mt-1 block font-display text-3xl">체험학습 신청서 작성</span>
            <span className="text-sm text-muted">체험학습 실시 1일 전 16:00까지 제출</span>
          </span>
          <span aria-hidden="true" className={actionArrowClass}>→</span>
        </Link>
        <Link className={actionCardClass} to={reportDue[0] ? `/field-trip/${reportDue[0].id}/report` : "/field-trip/reports"}>
          <span>
            <span className="mt-1 block font-display text-3xl">체험학습 보고서 작성</span>
            <span className="text-sm text-muted">체험학습 실시 후 7일 이내 제출</span>
          </span>
          <span aria-hidden="true" className={actionArrowClass}>→</span>
        </Link>
      </div>
      <section>
        <h2 className="mb-2 text-sm font-medium text-muted">최근 제출</h2>
        <ul className="space-y-2">
          {requests.slice(0, 3).map((row) => (
            <li key={row.id} className="sheet rounded-2xl px-4 py-3">
              <div className="flex items-center justify-between gap-3">
                <p>{row.docType === "type1" ? CATEGORY_LABELS[row.category ?? 1] : "체험학습"}</p>
                <StatusBadge status={row.status} printed={row.printed} />
              </div>
              <p className="text-sm text-muted">
                {row.startDate} ~ {row.endDate} · {row.periodDays}일
              </p>
            </li>
          ))}
          {requests.length === 0 ? <li className="text-sm text-muted">아직 제출한 서류가 없습니다.</li> : null}
        </ul>
      </section>
    </main>
  );
}
