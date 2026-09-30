import { FUNCTION_NAMES, type FunctionName } from "@contract/api.ts";
import type { ErrorCode } from "@contract/enums.ts";

export class ApiError extends Error {
  constructor(
    readonly code: ErrorCode | "NETWORK",
    message: string,
  ) {
    super(message);
  }
}

function endpoint(name: FunctionName): string {
  const url = import.meta.env.VITE_SUPABASE_URL;
  const key = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;
  if (!url || !key) {
    throw new ApiError("NETWORK", "서버 주소가 설정되지 않았습니다");
  }
  return `${url.replace(/\/$/, "")}/functions/v1/${name}`;
}

export async function callFunction<T>(name: FunctionName, body: unknown, token: string | null): Promise<T> {
  const key = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;
  const headers: Record<string, string> = {
    apikey: key,
    "content-type": "application/json",
  };
  if (token) headers["x-session-token"] = token;
  let response: Response;
  try {
    response = await fetch(endpoint(name), {
      method: "POST",
      headers,
      body: JSON.stringify(body ?? {}),
    });
  } catch {
    throw new ApiError("NETWORK", "네트워크에 연결하지 못했습니다");
  }
  const payload: unknown = await response.json().catch(() => null);
  if (!response.ok) {
    const errorBody =
      payload && typeof payload === "object" && "error" in payload
        ? (payload as { error?: { code?: ErrorCode; message?: string } }).error
        : undefined;
    const code = errorBody?.code ?? "INVALID_INPUT";
    const message = errorBody?.message ?? "요청을 처리하지 못했습니다";
    if (token && (code === "SESSION_EXPIRED" || code === "UNAUTHORIZED")) {
      window.dispatchEvent(new Event("chulcheck-session-expired"));
    }
    throw new ApiError(code, message);
  }
  return payload as T;
}

export { FUNCTION_NAMES };
