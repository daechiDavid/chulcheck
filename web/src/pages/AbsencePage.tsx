import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { CATEGORY_LABELS, type SubmitRequestResponse } from "@contract/api.ts";
import { todayKST } from "@contract/dates.ts";
import type { Evidence, Relation } from "@contract/enums.ts";
import { computeWarnings, type PriorRequest } from "@contract/warnings.ts";
import { useSession } from "../features/auth/session.tsx";
import { DateRangeField, usePeriod } from "../features/calendar/DateRangeField.tsx";
import { Type1Preview } from "../features/preview/Previews.tsx";
import { SignatureModal } from "../features/signature/SignatureModal.tsx";
import { ApiError, callFunction, FUNCTION_NAMES } from "../shared/api/client.ts";
import { Banner, Button, Field, controlClass } from "../shared/ui.tsx";

const HINTS: Record<number, string> = {
  1: "진료확인서 또는 의사소견서를 학교에 제출해 주세요.",
  2: "처방전 또는 약봉투를 학교에 제출해 주세요.",
  3: "가정에서 치료한 경우의 학부모 의견입니다.",
  4: "미인정 결석 시작일과 사유를 적습니다.",
  5: "격리 기간이 적힌 증빙서류를 학교에 제출해 주세요.",
  6: "증빙을 하나 이상 선택해 주세요.",
  7: "여학생, 월 1회.",
};

const EVIDENCE_OPTIONS: { id: Evidence; label: string }[] = [
  { id: "r1", label: "청첩장" },
  { id: "r2", label: "부고장" },
  { id: "r3", label: "기타" },
];

export function AbsencePage() {
  const { session, offDays, requests, reload } = useSession();
  const navigate = useNavigate();
  const student = session!.student;
  const [step, setStep] = useState(0);
  const [category, setCategory] = useState<number | null>(null);
  const [reason, setReason] = useState("");
  const [date4, setDate4] = useState("");
  const [date4Touched, setDate4Touched] = useState(false);
  const [evidence, setEvidence] = useState<Evidence[]>([]);
  const [start, setStart] = useState<string | null>(null);
  const [end, setEnd] = useState<string | null>(null);
  const [guardianName, setGuardianName] = useState(session?.guardianNameDefault ?? "");
  const [relation, setRelation] = useState<Relation>(session?.relation ?? "mother");
  const [signature, setSignature] = useState<string | null>(null);
  const [signaturePath, setSignaturePath] = useState<string | null>(null);
  const [signOpen, setSignOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const days = usePeriod(start, end, offDays);
  const visibleCategories = [1, 2, 3, 4, 5, 6, 7].filter((id) => !(id === 7 && student.gender === "남"));

  const warnings = useMemo(() => {
    if (!category || !start || !end || days == null) return [];
    return computeWarnings({
      docType: "type1",
      category,
      startDate: start,
      endDate: end,
      periodDays: days,
      submittedOn: todayKST(),
      gender: student.gender,
      fields: { reason, date4, evidence },
      offDays: offDays.map((day) => day.date),
      prior: requests.map(toPrior),
    });
  }, [category, start, end, days, student.gender, reason, date4, evidence, offDays, requests]);

  const requestRow = {
    category,
    start_date: start ?? todayKST(),
    end_date: end ?? todayKST(),
    period_days: days ?? 0,
    submitted_on: todayKST(),
    guardian_name: guardianName,
    fields: { reason, date4, evidence },
  };

  function canNext() {
    if (step === 0) return category != null;
    if (step === 1) {
      if (!reason.trim()) return false;
      if (category === 6 && evidence.length === 0) return false;
      return true;
    }
    if (step === 2) return Boolean(start && end && days && days > 0 && (category !== 4 || date4));
    if (step === 3) return guardianName.trim().length > 0 && Boolean(signaturePath);
    return true;
  }

  async function submit() {
    if (!session || !category || !start || !end || !signaturePath) return;
    setPending(true);
    setError(null);
    try {
      const result = await callFunction<SubmitRequestResponse>(
        FUNCTION_NAMES.submitRequest,
        {
          docType: "type1",
          category,
          startDate: start,
          endDate: end,
          guardianName: guardianName.trim(),
          guardianRelation: relation,
          signaturePath,
          fields: category === 4 ? { reason: reason.trim(), date4 } : category === 6 ? { reason: reason.trim(), evidence } : { reason: reason.trim() },
        },
        session.token,
      );
      await reload();
      navigate("/done", { state: { kind: "absence", warnings: result.warnings } });
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "제출하지 못했습니다");
    } finally {
      setPending(false);
    }
  }

  return (
    <main className="rise space-y-4">
      <p className="text-sm text-muted">{step + 1} / 5</p>
      <h1 className="font-display text-4xl">결석신고서</h1>
      {step === 0 ? (
        <div className="grid gap-2">
          {days != null && days > 0 ? (
            <Banner>{days >= 3 ? "수업일수가 3일 이상입니다. 1번이 맞는지 확인해 주세요." : "수업일수가 2일 이하입니다. 2번 또는 3번이 맞는지 확인해 주세요."}</Banner>
          ) : null}
          {visibleCategories.map((id) => (
            <button
              key={id}
              type="button"
              onClick={() => {
                setCategory(id);
                setReason("");
                setEvidence([]);
                setDate4Touched(false);
              }}
              className={`sheet rounded-2xl px-4 py-3 text-left ${category === id ? "border-seal" : ""}`}
            >
              <span className="mr-2 font-display text-xl">{category === id ? "■" : "□"}</span>
              {CATEGORY_LABELS[id]}
            </button>
          ))}
        </div>
      ) : null}
      {step === 1 && category ? (
        <div className="space-y-4">
          <Banner>{HINTS[category]}</Banner>
          <Field label={category === 3 || category === 7 ? "학부모 의견" : category === 5 ? "감염병명" : category === 1 || category === 2 ? "질병명" : "결석사유"}>
            <textarea className={`${controlClass} min-h-28 py-3`} maxLength={100} value={reason} onChange={(event) => setReason(event.target.value)} />
          </Field>
          {category === 4 ? (
            <Field label="미인정결석 시작일" hint="기간을 정하면 시작일로 맞춰 두고, 다르게 적을 수 있습니다.">
              <input
                type="date"
                className={controlClass}
                value={date4}
                onChange={(event) => {
                  setDate4Touched(true);
                  setDate4(event.target.value);
                }}
              />
            </Field>
          ) : null}
          {category === 6 ? (
            <fieldset>
              <legend className="mb-2 text-sm font-medium">증빙</legend>
              <div className="grid gap-2">
                {EVIDENCE_OPTIONS.map((item) => (
                  <label key={item.id} className="sheet flex items-center gap-3 rounded-2xl px-4 py-3">
                    <input
                      type="checkbox"
                      checked={evidence.includes(item.id)}
                      onChange={(event) =>
                        setEvidence((current) =>
                          event.target.checked ? [...current, item.id] : current.filter((id) => id !== item.id),
                        )
                      }
                    />
                    {item.label}
                  </label>
                ))}
              </div>
              <table className="mt-3 w-full text-left text-sm">
                <caption className="mb-1 text-left text-muted">경조사 인정 일수</caption>
                <tbody>
                  <tr><th className="py-1 font-medium">결혼</th><td>1일</td></tr>
                  <tr><th className="py-1 font-medium">사망</th><td>관계에 따라 5일 또는 3일</td></tr>
                </tbody>
              </table>
            </fieldset>
          ) : null}
        </div>
      ) : null}
      {step === 2 ? (
        <div className="sheet rounded-3xl p-3">
          <DateRangeField
            offDays={offDays}
            start={start}
            end={end}
            onChange={(nextStart, nextEnd) => {
              setStart(nextStart);
              setEnd(nextEnd);
              if (category === 4 && nextStart && !date4Touched) setDate4(nextStart);
            }}
          />
          {category === 4 ? (
            <Field label="미인정결석 시작일">
              <input
                type="date"
                className={controlClass}
                value={date4}
                onChange={(event) => {
                  setDate4Touched(true);
                  setDate4(event.target.value);
                }}
              />
            </Field>
          ) : null}
        </div>
      ) : null}
      {step === 3 ? (
        <div className="space-y-4">
          <Field label="보호자 이름">
            <input className={controlClass} value={guardianName} maxLength={30} onChange={(event) => setGuardianName(event.target.value)} />
          </Field>
          <fieldset>
            <legend className="mb-2 text-sm font-medium">관계</legend>
            <div className="flex gap-2">
              {(["father", "mother"] as const).map((item) => (
                <button key={item} type="button" className={`sheet rounded-full px-4 py-2 ${relation === item ? "border-seal" : ""}`} onClick={() => setRelation(item)}>
                  {item === "father" ? "부" : "모"}
                </button>
              ))}
            </div>
          </fieldset>
          <Button type="button" variant="line" onClick={() => setSignOpen(true)}>
            {signature ? "서명 다시 하기" : "서명하기"}
          </Button>
          {signature ? <img src={signature} alt="서명 미리보기" className="h-16 bg-white object-contain" /> : null}
        </div>
      ) : null}
      {step === 4 ? (
        <div className="space-y-3">
          {warnings.map((warning) => (
            <Banner key={warning.code}>{warning.message}</Banner>
          ))}
          <Type1Preview request={requestRow} student={student} signature={signature} />
        </div>
      ) : null}
      {error ? <Banner tone="error">{error}</Banner> : null}
      <div className="flex gap-2">
        {step > 0 ? (
          <Button type="button" variant="line" onClick={() => setStep((value) => value - 1)}>
            이전
          </Button>
        ) : null}
        {step < 4 ? (
          <Button type="button" className="flex-1" disabled={!canNext()} onClick={() => setStep((value) => value + 1)}>
            다음
          </Button>
        ) : (
          <Button type="button" className="flex-1" disabled={pending || !canNext()} onClick={() => void submit()}>
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
            .then((result) => {
              setSignaturePath(result.path);
              setError(null);
            })
            .catch((err: unknown) => {
              setSignaturePath(null);
              setError(err instanceof ApiError ? err.message : "서명을 올리지 못했습니다");
            })
            .finally(() => setPending(false));
        }}
      />
    </main>
  );
}

function toPrior(row: { docType: "type1" | "type2"; category: number | null; startDate: string; periodDays: number; status: string; submittedOn: string }): PriorRequest {
  return row;
}
