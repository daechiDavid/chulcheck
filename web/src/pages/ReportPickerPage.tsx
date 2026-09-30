import { Link } from "react-router-dom";
import { STATUS_LABELS, type RequestSummary } from "@contract/api.ts";
import { todayKST } from "@contract/dates.ts";
import { useSession } from "../features/auth/session.tsx";
import { Banner } from "../shared/ui.tsx";

function reportAvailability(request: RequestSummary, today: string): string | null {
  if (request.reportSubmittedOn) return `보고서 제출 ${request.reportSubmittedOn}`;
  if (request.status === "rejected" || request.status === "cancelled") {
    return `신청 상태가 ${STATUS_LABELS[request.status]}이므로 보고서를 제출할 수 없습니다.`;
  }
  if (request.endDate > today) return `체험학습이 끝난 뒤 ${request.endDate}부터 작성할 수 있습니다.`;
  if (request.status !== "submitted" && request.status !== "reviewed") {
    return `현재 상태(${STATUS_LABELS[request.status]})에서는 작성할 수 없습니다.`;
  }
  return null;
}

export function ReportPickerPage() {
  const { requests } = useSession();
  const trips = requests.filter((request) => request.docType === "type2");
  const today = todayKST();

  return (
    <main className="rise space-y-4">
      <h1 className="font-display text-4xl">체험학습 보고서</h1>
      <p className="text-sm text-muted">보고서를 작성할 신청서를 선택해 주세요.</p>
      {trips.length === 0 ? (
        <Banner>체험학습 신청 내역이 없습니다. 신청서를 제출하면 이곳에서 보고서를 작성할 수 있습니다.</Banner>
      ) : (
        <ul className="space-y-3">
          {trips.map((request) => {
            const unavailableReason = reportAvailability(request, today);
            return (
              <li key={request.id} className="sheet rounded-3xl p-4">
                <p className="font-medium">교외체험학습</p>
                <p className="text-sm text-muted">
                  {request.startDate} ~ {request.endDate} · {request.periodDays}일
                </p>
                {unavailableReason ? (
                  <p className={`mt-3 text-sm ${request.reportSubmittedOn ? "text-pine" : "text-muted"}`}>
                    {unavailableReason}
                  </p>
                ) : (
                  <Link
                    className="mt-3 inline-flex min-h-12 items-center rounded-full bg-ink px-4 text-sm font-medium text-paper transition hover:bg-pine hover:shadow-sm"
                    to={`/field-trip/${request.id}/report`}
                  >
                    보고서 작성 →
                  </Link>
                )}
              </li>
            );
          })}
        </ul>
      )}
      <Link className="inline-flex min-h-11 items-center text-sm text-muted underline underline-offset-4" to="/history">
        제출 내역 보기
      </Link>
    </main>
  );
}
