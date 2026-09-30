import { Navigate, Outlet, Route, Routes, useNavigate } from "react-router-dom";
import { useSession } from "../features/auth/session.tsx";
import { AbsencePage } from "../pages/AbsencePage.tsx";
import { DonePage } from "../pages/DonePage.tsx";
import { FieldTripPage } from "../pages/FieldTripPage.tsx";
import { HistoryPage } from "../pages/HistoryPage.tsx";
import { HomePage } from "../pages/HomePage.tsx";
import { LoginPage } from "../pages/LoginPage.tsx";
import { ReportPage } from "../pages/ReportPage.tsx";
import { ReportPickerPage } from "../pages/ReportPickerPage.tsx";
import { BrandLogo } from "../shared/BrandLogo.tsx";

function RequireAuth() {
  const { session, ready } = useSession();
  if (!ready) return <p className="px-6 py-16 text-center text-muted">불러오는 중</p>;
  if (!session) return <Navigate to="/login" replace />;
  return <Outlet />;
}

function Shell() {
  const { session, logout } = useSession();
  const navigate = useNavigate();
  const student = session?.student;
  return (
    <div className="mx-auto min-h-dvh w-full max-w-lg px-4 pb-16">
      <header className="flex items-center justify-between py-4">
        <button type="button" className="flex items-center gap-3 text-left" onClick={() => navigate("/")}>
          <span className="flex flex-col items-start gap-1">
            <BrandLogo size="sm" />
          </span>
        </button>
        <nav className="flex items-center gap-3 text-sm">
          <button type="button" onClick={() => navigate("/history")}>
            제출 내역
          </button>
          <button type="button" onClick={logout}>
            로그아웃
          </button>
        </nav>
      </header>
      {student ? (
        <p className="mb-4 text-sm text-muted">
          {student.grade}학년 {student.classNo}반 {student.number}번 {student.name}
        </p>
      ) : null}
      <Outlet />
    </div>
  );
}

export function App() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route element={<RequireAuth />}>
        <Route element={<Shell />}>
          <Route path="/" element={<HomePage />} />
          <Route path="/absence/new" element={<AbsencePage />} />
          <Route path="/field-trip/new" element={<FieldTripPage />} />
          <Route path="/field-trip/reports" element={<ReportPickerPage />} />
          <Route path="/field-trip/:id/report" element={<ReportPage />} />
          <Route path="/history" element={<HistoryPage />} />
          <Route path="/done" element={<DonePage />} />
        </Route>
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
