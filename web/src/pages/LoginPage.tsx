import { useState } from "react";
import { Navigate, useNavigate } from "react-router-dom";
import type { ParentLoginResponse } from "@contract/api.ts";
import { ApiError, callFunction, FUNCTION_NAMES } from "../shared/api/client.ts";
import { formatPhoneInput } from "../shared/format.ts";
import { BrandLogo } from "../shared/BrandLogo.tsx";
import { Banner, Button, Field, controlClass } from "../shared/ui.tsx";
import { useSession } from "../features/auth/session.tsx";

export function LoginPage() {
  const { session, login } = useSession();
  const navigate = useNavigate();
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [agreed, setAgreed] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  if (session) return <Navigate to="/" replace />;

  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-lg flex-col justify-center px-4 py-10">
      <section className="sheet rise rounded-[28px] p-6">
        <h1 className="mt-4"><BrandLogo size="lg" /></h1>
        <p className="mt-2 text-muted">결석계, 체험학습 서류를 간편하게 제출하세요.</p>
        <form
          className="mt-6 space-y-4"
          onSubmit={async (event) => {
            event.preventDefault();
            setError(null);
            if (!agreed) {
              setError("개인정보 수집·이용에 동의해 주세요");
              return;
            }
            setPending(true);
            try {
              const result = await callFunction<ParentLoginResponse>(
                FUNCTION_NAMES.parentLogin,
                { studentName: name.trim(), phone },
                null,
              );
              login(result);
              navigate("/");
            } catch (err) {
              setError(err instanceof ApiError ? err.message : "로그인에 실패했습니다");
            } finally {
              setPending(false);
            }
          }}
        >
          <Field label="학생 이름">
            <input
              className={controlClass}
              value={name}
              autoComplete="name"
              onChange={(event) => setName(event.target.value)}
              required
            />
          </Field>
          <Field label="보호자 휴대폰 번호">
            <input
              className={controlClass}
              inputMode="numeric"
              autoComplete="tel"
              value={phone}
              onChange={(event) => setPhone(formatPhoneInput(event.target.value))}
              placeholder="010-0000-0000"
              required
            />
          </Field>
          <label className="flex gap-3 rounded-2xl bg-paper p-3 text-sm leading-6">
            <input type="checkbox" className="mt-1" checked={agreed} onChange={(event) => setAgreed(event.target.checked)} />
            <span>
              질병명·감염병명 등 민감한 정보를 출결 서류 작성을 위해 수집합니다. 해당 학년도가 끝난 뒤 3개월 안에 삭제합니다.
              동의하지 않으면 서류를 제출할 수 없습니다.
            </span>
          </label>
          {error ? <Banner tone="error">{error}</Banner> : null}
          <Button type="submit" className="w-full" disabled={pending}>
            {pending ? "확인 중" : "로그인"}
          </Button>
        </form>
      </section>
    </main>
  );
}
