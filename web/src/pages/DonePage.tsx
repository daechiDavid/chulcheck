import { Link, useLocation } from "react-router-dom";
import type { Warning } from "@contract/api.ts";
import { Banner } from "../shared/ui.tsx";

export function DonePage() {
  const location = useLocation();
  const state = (location.state ?? {}) as { kind?: string; warnings?: Warning[] };
  const title =
    state.kind === "report" ? "보고서가 전달되었습니다" : state.kind === "fieldtrip" ? "신청서가 전달되었습니다" : "담임선생님께 전달되었습니다";
  return (
    <main className="rise space-y-4">
      <h1 className="font-display text-4xl">{title}</h1>
      <p className="leading-7">진료확인서, 처방전, 경조사 증빙처럼 원본이 필요한 서류는 학교로 따로 제출해 주세요.</p>
      {(state.warnings ?? []).map((warning) => (
        <Banner key={warning.code}>{warning.message}</Banner>
      ))}
      <Link className="inline-flex min-h-12 items-center rounded-full bg-ink px-5 text-paper" to="/">
        처음으로
      </Link>
    </main>
  );
}
