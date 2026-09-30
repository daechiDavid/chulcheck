import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import type { OffDay, ParentMeResponse, RequestSummary, StudentCard } from "@contract/api.ts";
import type { Relation } from "@contract/enums.ts";
import { ApiError, callFunction, FUNCTION_NAMES } from "../../shared/api/client.ts";

const STORAGE_KEY = "chulcheck.session";

export type Session = {
  token: string;
  expiresAt: string;
  student: StudentCard;
  guardianNameDefault: string;
  relation: Relation;
};

type SessionContextValue = {
  session: Session | null;
  offDays: OffDay[];
  requests: RequestSummary[];
  ready: boolean;
  error: string | null;
  login: (session: Session) => void;
  logout: () => void;
  reload: () => Promise<void>;
};

const SessionContext = createContext<SessionContextValue | null>(null);

function readSession(): Session | null {
  const raw = sessionStorage.getItem(STORAGE_KEY);
  if (!raw) return null;
  try {
    const session = JSON.parse(raw) as Session;
    if (new Date(session.expiresAt).getTime() <= Date.now()) {
      sessionStorage.removeItem(STORAGE_KEY);
      return null;
    }
    return session;
  } catch {
    sessionStorage.removeItem(STORAGE_KEY);
    return null;
  }
}

export function SessionProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(() => readSession());
  const [offDays, setOffDays] = useState<OffDay[]>([]);
  const [requests, setRequests] = useState<RequestSummary[]>([]);
  const [ready, setReady] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const logout = useCallback(() => {
    sessionStorage.removeItem(STORAGE_KEY);
    setSession(null);
    setOffDays([]);
    setRequests([]);
    setError(null);
  }, []);

  const reload = useCallback(async () => {
    const current = readSession();
    if (!current) {
      setReady(true);
      return;
    }
    try {
      const [me, list] = await Promise.all([
        callFunction<ParentMeResponse>(FUNCTION_NAMES.parentMe, {}, current.token),
        callFunction<RequestSummary[]>(FUNCTION_NAMES.listMyRequests, {}, current.token),
      ]);
      setOffDays(me.offDays);
      setRequests(list);
      setError(null);
    } catch (err) {
      if (err instanceof ApiError && (err.code === "SESSION_EXPIRED" || err.code === "UNAUTHORIZED")) logout();
      else setError(err instanceof Error ? err.message : "연결을 확인한 뒤 다시 시도해 주세요");
    } finally {
      setReady(true);
    }
  }, [logout]);

  useEffect(() => {
    void reload();
  }, [reload, session?.token]);

  useEffect(() => {
    const onExpire = () => logout();
    window.addEventListener("chulcheck-session-expired", onExpire);
    return () => window.removeEventListener("chulcheck-session-expired", onExpire);
  }, [logout]);

  const login = useCallback((next: Session) => {
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify(next));
    setSession(next);
    setReady(false);
  }, []);

  const value = useMemo(
    () => ({ session, offDays, requests, ready, error, login, logout, reload }),
    [session, offDays, requests, ready, error, login, logout, reload],
  );

  return <SessionContext.Provider value={value}>{children}</SessionContext.Provider>;
}

export function useSession() {
  const value = useContext(SessionContext);
  if (!value) throw new Error("SessionProvider가 없습니다");
  return value;
}
