import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { todayKST, schoolYearOf } from "@contract/dates.ts";
import { periodDays } from "@contract/period.ts";
import { TYPE1_KEYS, TYPE2_1_KEYS, toType1Placeholders, toType21Placeholders } from "@contract/placeholders.ts";
import { requestInputSchema } from "@contract/schema.ts";
import { computeWarnings } from "@contract/warnings.ts";
import { normalizePhone } from "../../supabase/functions/_shared/phone.ts";

const fixture = JSON.parse(
  readFileSync(new URL("../../supabase/functions/_shared/contract/fixtures/type1.json", import.meta.url), "utf8"),
);

describe("periodDays", () => {
  it("평일 3일 연속은 3일이다", () => {
    expect(periodDays("2026-03-09", "2026-03-11", [])).toBe(3);
  });

  it("금요일부터 월요일은 2일이다", () => {
    expect(periodDays("2026-03-13", "2026-03-16", [])).toBe(2);
  });

  it("공휴일은 제외한다", () => {
    expect(periodDays("2026-03-02", "2026-03-06", ["2026-03-02"])).toBe(4);
  });

  it("재량휴업일은 제외한다", () => {
    expect(periodDays("2026-05-11", "2026-05-15", ["2026-05-15"])).toBe(4);
  });

  it("연도를 넘는 기간을 계산한다", () => {
    expect(periodDays("2026-12-30", "2027-01-02", ["2027-01-01"])).toBe(2);
  });
});

describe("dates", () => {
  it("UTC 자정 전후에도 KST 날짜를 쓴다", () => {
    expect(todayKST(new Date("2026-09-28T14:30:00Z"))).toBe("2026-09-28");
    expect(todayKST(new Date("2026-09-28T15:30:00Z"))).toBe("2026-09-29");
  });

  it("학년도는 3월에 바뀐다", () => {
    expect(schoolYearOf("2026-02-28")).toBe(2025);
    expect(schoolYearOf("2026-03-01")).toBe(2026);
  });
});

describe("phone", () => {
  it("하이픈과 국가번호를 010 형식으로 맞춘다", () => {
    expect(normalizePhone("010-2000-0001")).toBe("01020000001");
    expect(normalizePhone("+82 10-2000-0001")).toBe("01020000001");
    expect(normalizePhone("1234")).toBeNull();
  });
});

describe("schema", () => {
  it("결석 사유 입력을 검사한다", () => {
    const parsed = requestInputSchema.parse({
      docType: "type1",
      category: 1,
      startDate: "2026-09-14",
      endDate: "2026-09-16",
      guardianName: " 김서연\u0000 ",
      guardianRelation: "mother",
      signaturePath: "class/student/a.png",
      fields: { reason: "장염" },
    });
    expect(parsed.guardianName).toBe("김서연");
    expect(requestInputSchema.safeParse({ ...parsed, fields: { reason: "" }, docType: "type1", category: 6 }).success).toBe(false);
  });
});

describe("placeholders", () => {
  it("type1 키를 빠짐없이 채운다", () => {
    const values = toType1Placeholders(fixture.request, fixture.student, fixture.classroom);
    for (const key of TYPE1_KEYS) expect(values).toHaveProperty(key);
    expect(values["1"]).toBe("■");
    expect(values["2"]).toBe("□");
    expect(values["1-reason"]).toBe("급성 장염");
    expect(values["2-reason"]).toBe("");
  });

  it("체험학습 학습 내용은 reason 칸에 들어간다", () => {
    const values = toType21Placeholders(
      {
        category: null,
        start_date: "2026-10-05",
        end_date: "2026-10-07",
        period_days: 3,
        submitted_on: "2026-10-01",
        guardian_name: "김서연",
        fields: { place: "박물관", content: "유물 관찰", plan: "기록하기" },
      },
      fixture.student,
      fixture.classroom,
    );
    for (const key of TYPE2_1_KEYS) expect(values).toHaveProperty(key);
    expect(values.reason).toBe("유물 관찰");
    expect(values.ed).toBe("7");
  });
});

describe("warnings", () => {
  it("사유와 일수가 맞지 않으면 경고한다", () => {
    const warnings = computeWarnings({
      docType: "type1",
      category: 1,
      startDate: "2026-03-09",
      endDate: "2026-03-10",
      periodDays: 2,
      submittedOn: "2026-03-10",
      gender: "여",
      fields: { reason: "감기" },
      offDays: [],
      prior: [],
    });
    expect(warnings.some((warning) => warning.code === "PERIOD_CATEGORY_MISMATCH")).toBe(true);
  });
});
