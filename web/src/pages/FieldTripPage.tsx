import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import type { SubmitRequestResponse } from "@contract/api.ts";
import { earliestFieldTripStartDate, todayKST } from "@contract/dates.ts";
import type { Relation } from "@contract/enums.ts";
import { computeWarnings } from "@contract/warnings.ts";
import { useSession } from "../features/auth/session.tsx";
import { DateRangeField, usePeriod } from "../features/calendar/DateRangeField.tsx";
import { Type2Preview } from "../features/preview/Previews.tsx";
import { SignatureModal } from "../features/signature/SignatureModal.tsx";
import { ApiError, callFunction, FUNCTION_NAMES } from "../shared/api/client.ts";
import { Banner, Button, Field, controlClass } from "../shared/ui.tsx";

export function FieldTripPage() {
  const { session, offDays, requests, reload } = useSession();
  const navigate = useNavigate();
  const student = session!.student;
  const [step, setStep] = useState(0);
  const [start, setStart] = useState<string | null>(null);
  const [end, setEnd] = useState<string | null>(null);
  const [place, setPlace] = useState("");
  const [content, setContent] = useState("");
  const [plan, setPlan] = useState("");
  const [guardianName, setGuardianName] = useState(session?.guardianNameDefault ?? "");
  const [relation, setRelation] = useState<Relation>(session?.relation ?? "mother");
  const [signature, setSignature] = useState<string | null>(null);
  const [signaturePath, setSignaturePath] = useState<string | null>(null);
  const [signOpen, setSignOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [clock, setClock] = useState(() => new Date());
  useEffect(() => {
    const refreshClock = () => setClock(new Date());
    const timer = window.setInterval(refreshClock, 30_000);
    window.addEventListener("focus", refreshClock);
    document.addEventListener("visibilitychange", refreshClock);
    return () => {
      window.clearInterval(timer);
      window.removeEventListener("focus", refreshClock);
      document.removeEventListener("visibilitychange", refreshClock);
    };
  }, []);
  const minStartDate = earliestFieldTripStartDate(clock);
  const days = usePeriod(start, end, offDays);

  const warnings = useMemo(() => {
    if (!start || !end || days == null) return [];
    return computeWarnings({
      docType: "type2",
      category: null,
      startDate: start,
      endDate: end,
      periodDays: days,
      submittedOn: todayKST(),
      gender: student.gender,
      fields: { place, content, plan },
      offDays: offDays.map((day) => day.date),
      prior: requests,
    });
  }, [start, end, days, student.gender, place, content, plan, offDays, requests]);

  function canNext() {
    const dateIsOpen = Boolean(start && start >= minStartDate);
    if (step === 0) return Boolean(dateIsOpen && end && days && days > 0);
    if (step === 1) return dateIsOpen && place.trim().length > 0 && content.trim().length > 0 && plan.trim().length > 0;
    if (step === 2) return dateIsOpen && guardianName.trim().length > 0 && Boolean(signaturePath);
    return dateIsOpen;
  }

  return (
    <main className="rise space-y-4">
      <p className="text-sm text-muted">{step + 1} / 4</p>
      <h1 className="font-display text-4xl">체험학습 신청서</h1>
      {step === 0 ? (
        <div className="sheet rounded-3xl p-3">
          <DateRangeField offDays={offDays} start={start} end={end} minStartDate={minStartDate} onChange={(nextStart, nextEnd) => { setStart(nextStart); setEnd(nextEnd); }} />
        </div>
      ) : null}
      {start && start < minStartDate ? (
        <Banner tone="error">선택한 시작일은 전일 16:00 제출 기한이 지났습니다. 날짜를 다시 선택해 주세요.</Banner>
      ) : null}
      {step === 1 ? (
        <div className="space-y-4">
          <Field label="장소">
            <input className={controlClass} maxLength={50} value={place} onChange={(event) => setPlace(event.target.value)} />
          </Field>
          <Field label="학습 내용" hint="예: 박물관에서 역사 유물을 관찰하고 기록한다.">
            <textarea className={`${controlClass} min-h-28 py-3`} maxLength={1000} value={content} onChange={(event) => setContent(event.target.value)} />
          </Field>
          <Field label="학습 계획">
            <textarea className={`${controlClass} min-h-28 py-3`} maxLength={1000} value={plan} onChange={(event) => setPlan(event.target.value)} />
          </Field>
        </div>
      ) : null}
      {step === 2 ? (
        <div className="space-y-4">
          <Field label="보호자 이름">
            <input className={controlClass} maxLength={30} value={guardianName} onChange={(event) => setGuardianName(event.target.value)} />
          </Field>
          <div className="flex gap-2">
            {(["father", "mother"] as const).map((item) => (
              <button key={item} type="button" className={`sheet rounded-full px-4 py-2 ${relation === item ? "border-seal" : ""}`} onClick={() => setRelation(item)}>
                {item === "father" ? "부" : "모"}
              </button>
            ))}
          </div>
          <Button type="button" variant="line" onClick={() => setSignOpen(true)}>{signature ? "서명 다시 하기" : "서명하기"}</Button>
          {signature ? <img src={signature} alt="서명 미리보기" className="h-16 bg-white object-contain" /> : null}
        </div>
      ) : null}
      {step === 3 && start && end ? (
        <div className="space-y-3">
          {warnings.map((warning) => <Banner key={warning.code}>{warning.message}</Banner>)}
          <Type2Preview
            student={student}
            signature={signature}
            request={{
              category: null,
              start_date: start,
              end_date: end,
              period_days: days ?? 0,
              submitted_on: todayKST(),
              guardian_name: guardianName,
              fields: { place, content, plan },
            }}
          />
        </div>
      ) : null}
      {error ? <Banner tone="error">{error}</Banner> : null}
      <div className="flex gap-2">
        {step > 0 ? <Button type="button" variant="line" onClick={() => setStep((value) => value - 1)}>이전</Button> : null}
        {step < 3 ? (
          <Button type="button" className="flex-1" disabled={!canNext()} onClick={() => setStep((value) => value + 1)}>다음</Button>
        ) : (
          <Button
            type="button"
            className="flex-1"
            disabled={pending || !canNext()}
            onClick={() => {
              if (!session || !start || !end || !signaturePath) return;
              setPending(true);
              setError(null);
              void callFunction<SubmitRequestResponse>(
                FUNCTION_NAMES.submitRequest,
                {
                  docType: "type2",
                  category: null,
                  startDate: start,
                  endDate: end,
                  guardianName: guardianName.trim(),
                  guardianRelation: relation,
                  signaturePath,
                  fields: { place: place.trim(), content: content.trim(), plan: plan.trim() },
                },
                session.token,
              )
                .then(async (result) => {
                  await reload();
                  navigate("/done", { state: { kind: "fieldtrip", warnings: result.warnings } });
                })
                .catch((err: unknown) => setError(err instanceof ApiError ? err.message : "제출하지 못했습니다"))
                .finally(() => setPending(false));
            }}
          >
            {pending ? "제출 중" : "제출"}
          </Button>
        )}
      </div>
      <SignatureModal
        open={signOpen}
        onClose={() => setSignOpen(false)}
        onDone={(dataUrl) => {
          setSignOpen(false);
          setSignature(dataUrl);
          setPending(true);
          void callFunction<{ path: string }>(FUNCTION_NAMES.uploadSignature, { pngBase64: dataUrl }, session!.token)
            .then((result) => setSignaturePath(result.path))
            .catch((err: unknown) => setError(err instanceof ApiError ? err.message : "서명을 올리지 못했습니다"))
            .finally(() => setPending(false));
        }}
      />
    </main>
  );
}
