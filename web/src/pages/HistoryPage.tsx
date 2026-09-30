import { useState } from "react";
import { Link } from "react-router-dom";
import { CATEGORY_LABELS } from "@contract/api.ts";
import { todayKST } from "@contract/dates.ts";
import { useSession } from "../features/auth/session.tsx";
import { ApiError, callFunction, FUNCTION_NAMES } from "../shared/api/client.ts";
import { Banner, Button, StatusBadge } from "../shared/ui.tsx";

export function HistoryPage() {
  const { session, requests, reload } = useSession();
  const [error, setError] = useState<string | null>(null);
  const [pendingId, setPendingId] = useState<string | null>(null);
  const today = todayKST();

  return (
    <main className="rise space-y-3">
      <h1 className="font-display text-4xl">제출 내역</h1>
      {error ? <Banner tone="error">{error}</Banner> : null}
      {requests.length === 0 ? <p className="text-muted">아직 제출한 서류가 없습니다.</p> : null}
      <ul className="space-y-3">
        {requests.map((row) => {
          const canCancel = row.status === "submitted" && !row.printed;
          const canReport =
            row.docType === "type2" &&
            !row.reportSubmittedOn &&
            (row.status === "submitted" || row.status === "reviewed") &&
            row.endDate <= today;
          return (
            <li key={row.id} className="sheet rounded-3xl p-4">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="font-medium">{row.docType === "type1" ? CATEGORY_LABELS[row.category ?? 1] : "교외체험학습"}</p>
                  <p className="text-sm text-muted">
                    {row.startDate} ~ {row.endDate} · {row.periodDays}일
                  </p>
                </div>
                <StatusBadge status={row.status} printed={row.printed || row.reportPrinted} />
              </div>
              {row.rejectReason ? <p className="mt-2 text-sm text-seal">반려 사유: {row.rejectReason}</p> : null}
              {row.docType === "type2" && row.reportSubmittedOn ? (
                <p className="mt-2 text-sm text-pine">보고서 제출 {row.reportSubmittedOn}</p>
              ) : null}
              <div className="mt-3 flex gap-2">
                {canReport ? (
                  <Link className="inline-flex min-h-12 items-center rounded-full bg-ink px-4 text-sm text-paper" to={`/field-trip/${row.id}/report`}>
                    보고서 작성
                  </Link>
                ) : null}
                {canCancel ? (
                  <Button
                    type="button"
                    variant="line"
                    disabled={pendingId === row.id}
                    onClick={() => {
                      if (!session || !window.confirm("이 제출을 취소할까요?")) return;
                      setPendingId(row.id);
                      setError(null);
                      void callFunction(FUNCTION_NAMES.cancelRequest, { requestId: row.id }, session.token)
                        .then(() => reload())
                        .catch(async (err: unknown) => {
                          setError(err instanceof ApiError ? err.message : "취소하지 못했습니다");
                          if (err instanceof ApiError && err.code === "CONFLICT") await reload();
                        })
                        .finally(() => setPendingId(null));
                    }}
                  >
                    제출 취소
                  </Button>
                ) : null}
              </div>
            </li>
          );
        })}
      </ul>
    </main>
  );
}
