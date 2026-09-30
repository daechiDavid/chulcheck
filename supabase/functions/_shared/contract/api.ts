import type { DocType, ErrorCode, Gender, OffDayKind, Relation, Status } from "./enums.ts";
import type { RequestFields } from "./schema.ts";

export const FUNCTION_NAMES = {
  parentLogin: "parent-login",
  parentMe: "parent-me",
  uploadSignature: "upload-signature",
  submitRequest: "submit-request",
  submitReport: "submit-report",
  listMyRequests: "list-my-requests",
  cancelRequest: "cancel-request",
  teacherUpsertStudents: "teacher-upsert-students",
  teacherUpdateRequest: "teacher-update-request",
  syncHolidays: "sync-holidays",
} as const;

export type FunctionName = (typeof FUNCTION_NAMES)[keyof typeof FUNCTION_NAMES];

export type ApiFailure = { error: { code: ErrorCode; message: string } };

export type StudentCard = {
  grade: number;
  classNo: number;
  number: number;
  name: string;
  gender: Gender;
};

export type ParentLoginResponse = {
  token: string;
  expiresAt: string;
  student: StudentCard;
  guardianNameDefault: string;
  relation: Relation;
};

export type OffDay = { date: string; kind: OffDayKind; label: string };

export type ParentMeResponse = {
  student: StudentCard;
  offDays: OffDay[];
};

export type UploadSignatureResponse = { path: string };

export type Warning = { code: string; message: string };

export type SubmitRequestResponse = {
  id: string;
  periodDays: number;
  warnings: Warning[];
};

export type SubmitReportResponse = { id: string; reportSubmittedOn: string };

export type RequestSummary = {
  id: string;
  docType: DocType;
  category: number | null;
  startDate: string;
  endDate: string;
  periodDays: number;
  submittedOn: string;
  status: Status;
  rejectReason: string | null;
  printed: boolean;
  reportPrinted: boolean;
  reportSubmittedOn: string | null;
  reportContent: string;
  reportEvidencePaths: string[];
  guardianName: string;
  guardianRelation: Relation;
  fields: RequestFields;
};

export type CancelRequestResponse = { id: string };

export const STATUS_LABELS: Record<Status, string> = {
  submitted: "제출됨",
  reviewed: "확인됨",
  rejected: "반려됨",
  cancelled: "취소됨",
};

export const CATEGORY_LABELS: Record<number, string> = {
  1: "질병결석 3일 이상",
  2: "질병결석 2일 이하 (병·약국 내원)",
  3: "질병결석 2일 이하 (가정 치료)",
  4: "미인정결석",
  5: "법정감염병",
  6: "경조사",
  7: "생리결석",
};
