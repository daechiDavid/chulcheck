import type { Evidence, Gender } from "./enums.ts";
import { addDays, schoolYearOf } from "./dates.ts";
import { periodDays } from "./period.ts";
import type { Warning } from "./api.ts";

export type PriorRequest = {
  docType: "type1" | "type2";
  category: number | null;
  startDate: string;
  periodDays: number;
  status: string;
  submittedOn: string;
};

export type WarningInput = {
  docType: "type1" | "type2";
  category: number | null;
  startDate: string;
  endDate: string;
  periodDays: number;
  submittedOn: string;
  gender: Gender;
  fields: {
    reason?: string;
    evidence?: Evidence[];
    place?: string;
    content?: string;
    plan?: string;
    date4?: string;
  };
  offDays: Iterable<string>;
  prior: PriorRequest[];
};

const active = (status: string) => status !== "rejected" && status !== "cancelled";

export function computeWarnings(input: WarningInput): Warning[] {
  const warnings: Warning[] = [];
  const off = input.offDays instanceof Set ? input.offDays : new Set(input.offDays);

  if (input.docType === "type1" && input.category != null) {
    if (input.category === 1 && input.periodDays < 3) {
      warnings.push({
        code: "PERIOD_CATEGORY_MISMATCH",
        message: "질병결석 3일 이상(1번)인데 수업일수가 3일보다 적습니다.",
      });
    }
    if ((input.category === 2 || input.category === 3) && input.periodDays > 2) {
      warnings.push({
        code: "PERIOD_CATEGORY_MISMATCH",
        message: "질병결석 2일 이하(2·3번)인데 수업일수가 2일을 넘습니다.",
      });
    }
    if (input.category === 6) {
      const evidence = input.fields.evidence ?? [];
      const wedding = evidence.includes("r1");
      const death = evidence.includes("r2");
      if (death && input.periodDays > 5) {
        warnings.push({
          code: "CONDOLENCE_DAYS",
          message: "사망 경조사 인정 일수는 관계에 따라 최대 5일입니다. 일수를 확인해 주세요.",
        });
      } else if (wedding && !death && input.periodDays > 1) {
        warnings.push({
          code: "CONDOLENCE_DAYS",
          message: "결혼 경조사 인정 일수는 1일입니다.",
        });
      } else if (!wedding && !death && input.periodDays > 1) {
        warnings.push({
          code: "CONDOLENCE_DAYS",
          message: "기타 증빙의 인정 일수를 담임선생님과 확인해 주세요.",
        });
      }
    }
    if (input.category === 7 && input.gender === "남") {
      warnings.push({ code: "MENSTRUAL_GENDER", message: "생리결석은 여학생만 선택할 수 있습니다." });
    }
    if (input.category === 7 && input.gender === "여") {
      const month = input.startDate.slice(0, 7);
      const repeated = input.prior.some(
        (row) =>
          active(row.status) &&
          row.docType === "type1" &&
          row.category === 7 &&
          row.startDate.slice(0, 7) === month,
      );
      if (repeated) {
        warnings.push({
          code: "MENSTRUAL_REPEAT",
          message: "같은 달에 생리결석 제출 기록이 있습니다. 월 1회만 인정됩니다.",
        });
      }
    }
  }

  if (input.submittedOn > input.endDate) {
    const lateDays = periodDays(addDays(input.endDate, 1), input.submittedOn, off);
    if (lateDays > 5) {
      warnings.push({
        code: "LATE_SUBMISSION",
        message: "결석 종료 후 5수업일이 지나 제출되었습니다.",
      });
    }
  }

  if (input.docType === "type2") {
    if (input.submittedOn >= input.startDate) {
      warnings.push({
        code: "FIELD_TRIP_LATE",
        message: "체험학습 신청은 시작 전날까지 제출하는 것이 원칙입니다.",
      });
    }
    if (input.periodDays > 10) {
      warnings.push({
        code: "FIELD_TRIP_CONSECUTIVE",
        message: "체험학습은 연속 10일을 넘기면 인정되지 않을 수 있습니다.",
      });
    }
    const year = schoolYearOf(input.startDate);
    const used = input.prior
      .filter((row) => active(row.status) && row.docType === "type2" && schoolYearOf(row.startDate) === year)
      .reduce((sum, row) => sum + row.periodDays, 0);
    if (used + input.periodDays > 19) {
      warnings.push({
        code: "FIELD_TRIP_CUMULATIVE",
        message: `학년도 체험학습 누적 일수가 19일을 넘습니다. (기존 ${used}일 + 이번 ${input.periodDays}일)`,
      });
    }
  }

  return warnings;
}
