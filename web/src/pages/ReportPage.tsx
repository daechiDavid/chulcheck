import { useRef, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import type { SubmitReportResponse } from "@contract/api.ts";
import { todayKST } from "@contract/dates.ts";
import { useSession } from "../features/auth/session.tsx";
import { Type2Preview } from "../features/preview/Previews.tsx";
import { SignatureModal } from "../features/signature/SignatureModal.tsx";
import { ApiError, callFunction, FUNCTION_NAMES } from "../shared/api/client.ts";
import { Banner, Button, Field, controlClass } from "../shared/ui.tsx";

const MAX_PHOTOS = 4;
const MAX_PHOTO_BYTES = 350 * 1024;

type EvidencePhoto = { name: string; dataUrl: string };

async function compressPhoto(file: File): Promise<string> {
  const bitmap = await createImageBitmap(file);
  try {
    const scale = Math.min(1, 1600 / Math.max(bitmap.width, bitmap.height));
    const canvas = document.createElement("canvas");
    canvas.width = Math.max(1, Math.round(bitmap.width * scale));
    canvas.height = Math.max(1, Math.round(bitmap.height * scale));
    const context = canvas.getContext("2d");
    if (!context) throw new Error("사진을 처리하지 못했습니다");
    context.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    for (const quality of [0.84, 0.76, 0.68, 0.60, 0.52, 0.44]) {
      const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/jpeg", quality));
      if (!blob) continue;
      if (blob.size <= MAX_PHOTO_BYTES) {
        return await new Promise<string>((resolve, reject) => {
          const reader = new FileReader();
          reader.onload = () => typeof reader.result === "string" ? resolve(reader.result) : reject(new Error("사진을 읽지 못했습니다"));
          reader.onerror = () => reject(new Error("사진을 읽지 못했습니다"));
          reader.readAsDataURL(blob);
        });
      }
    }
    throw new Error("사진 한 장은 350KB 이하로 줄여 주세요");
  } finally {
    bitmap.close();
  }
}

export function ReportPage() {
  const { id } = useParams();
  const { session, requests, reload } = useSession();
  const navigate = useNavigate();
  const request = requests.find((row) => row.id === id);
  const [signature, setSignature] = useState<string | null>(null);
  const [signaturePath, setSignaturePath] = useState<string | null>(null);
  const [signOpen, setSignOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [experienceSummary, setExperienceSummary] = useState("");
  const [evidencePhotos, setEvidencePhotos] = useState<EvidencePhoto[]>([]);
  const [processingPhotos, setProcessingPhotos] = useState(false);
  const fileInput = useRef<HTMLInputElement>(null);
  const today = todayKST();

  if (!request || request.docType !== "type2") {
    return (
      <main className="space-y-3">
        <Banner tone="error">보고서를 쓸 신청서를 찾지 못했습니다.</Banner>
        <Link to="/history">제출 내역으로</Link>
      </main>
    );
  }
  if (request.reportSubmittedOn) return <Banner>이미 보고서가 제출되었습니다.</Banner>;
  if (request.endDate > today) {
    return <Banner>체험학습이 끝난 뒤({request.endDate} 이후)에 보고서를 제출할 수 있습니다. 기간이 달라졌다면 담임선생님께 알려 주세요.</Banner>;
  }
  if (request.status !== "submitted" && request.status !== "reviewed") {
    return <Banner tone="error">이 신청서는 보고서를 제출할 수 없습니다.</Banner>;
  }

  const fields = request.fields as { place?: string; content?: string; plan?: string };
  return (
    <main className="rise space-y-4">
      <h1 className="font-display text-4xl">체험학습 보고서</h1>
      <Banner>기간과 장소는 신청서 그대로입니다. 바꿀 수 없으니, 다르면 담임선생님께 알려 주세요.</Banner>
      <Type2Preview
        report
        student={session!.student}
        signature={signature}
        reportContent={experienceSummary}
        request={{
          category: null,
          start_date: request.startDate,
          end_date: request.endDate,
          period_days: request.periodDays,
          submitted_on: request.submittedOn,
          report_submitted_on: today,
          guardian_name: request.guardianName,
          fields,
        }}
      />
      <p className="text-sm text-muted">체험 장소: {fields.place}</p>
      <Field label="실제 체험 내용" hint="계획이 아닌, 실제로 한 활동과 알게 된 점을 구체적으로 정리해 주세요. 10자 이상 작성해야 합니다.">
        <textarea
          className={`${controlClass} min-h-36 py-3`}
          value={experienceSummary}
          onChange={(event) => setExperienceSummary(event.target.value)}
          maxLength={3000}
          minLength={10}
          required
          placeholder="예: 전시관에서 조선 시대 생활 도구를 관찰하고, 해설을 들으며 당시 사람들의 생활 모습을 정리했습니다."
        />
        <span className="mt-1 block text-right text-xs text-muted">{experienceSummary.length} / 3,000</span>
      </Field>
      <section className="space-y-2">
        <div>
          <h2 className="font-display text-lg">증빙 사진 <span className="font-normal text-muted">(선택)</span></h2>
          <p className="text-sm text-muted">실제 체험을 확인할 수 있는 사진을 최대 4장 첨부할 수 있습니다.</p>
        </div>
        <input
          ref={fileInput}
          className="sr-only"
          type="file"
          accept="image/jpeg,image/png,image/webp"
          multiple
          onChange={(event) => {
            const selected = Array.from(event.target.files ?? []);
            event.target.value = "";
            if (!selected.length) return;
            if (selected.length + evidencePhotos.length > MAX_PHOTOS) {
              setError("증빙 사진은 최대 4장까지 첨부할 수 있습니다");
              return;
            }
            setError(null);
            setProcessingPhotos(true);
            void Promise.all(selected.map(async (file) => ({ name: file.name, dataUrl: await compressPhoto(file) })))
              .then((photos) => setEvidencePhotos((current) => [...current, ...photos]))
              .catch((err: unknown) => setError(err instanceof Error ? err.message : "사진을 처리하지 못했습니다"))
              .finally(() => setProcessingPhotos(false));
          }}
        />
        <Button type="button" variant="line" disabled={processingPhotos || evidencePhotos.length >= MAX_PHOTOS} onClick={() => fileInput.current?.click()}>
          {processingPhotos ? "사진 처리 중" : `사진 첨부 ${evidencePhotos.length}/${MAX_PHOTOS}`}
        </Button>
        {evidencePhotos.length ? (
          <ul className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            {evidencePhotos.map((photo, index) => (
              <li key={`${photo.name}-${index}`} className="relative overflow-hidden rounded-xl border border-line bg-surface-subtle">
                <img src={photo.dataUrl} alt={`증빙 사진 ${index + 1}`} className="aspect-square w-full object-cover" />
                <p className="truncate px-2 py-1 text-xs text-muted">{photo.name}</p>
                <button type="button" className="absolute right-1 top-1 rounded-full bg-white px-2 py-1 text-xs shadow" aria-label={`${photo.name} 삭제`} onClick={() => setEvidencePhotos((current) => current.filter((_, item) => item !== index))}>삭제</button>
              </li>
            ))}
          </ul>
        ) : null}
      </section>
      <Button type="button" variant="line" onClick={() => setSignOpen(true)}>{signature ? "서명 다시 하기" : "서명하기"}</Button>
      {error ? <Banner tone="error">{error}</Banner> : null}
      <Button
        type="button"
        className="w-full"
        disabled={!signaturePath || pending || processingPhotos || experienceSummary.trim().length < 10}
        onClick={() => {
          if (!session || !signaturePath) return;
          setPending(true);
          void callFunction<SubmitReportResponse>(
            FUNCTION_NAMES.submitReport,
            { requestId: request.id, signaturePath, experienceSummary, evidencePhotos: evidencePhotos.map((photo) => photo.dataUrl) },
            session.token,
          )
            .then(async () => {
              await reload();
              navigate("/done", { state: { kind: "report" } });
            })
            .catch((err: unknown) => {
              setError(err instanceof ApiError ? err.message : "제출하지 못했습니다");
              if (err instanceof ApiError && err.code === "CONFLICT") void reload();
            })
            .finally(() => setPending(false));
        }}
      >
        {pending ? "제출 중" : "보고서 제출"}
      </Button>
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
