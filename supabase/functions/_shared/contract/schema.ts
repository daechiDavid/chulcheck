import { z } from "zod";
import { DOC_TYPES, EVIDENCE, RELATIONS } from "./enums.ts";
import { isIsoDate } from "./dates.ts";

export function stripControls(value: string): string {
  return value.replace(/[\u0000-\u001F\u007F]/g, "").trim();
}

const isoDate = z
  .string()
  .refine(isIsoDate, "날짜는 YYYY-MM-DD 형식이어야 합니다");

const boundedText = (max: number, label: string) =>
  z
    .string()
    .transform(stripControls)
    .pipe(z.string().min(1, `${label}을 입력해 주세요`).max(max, `${label}은 ${max}자까지입니다`));

const reasonFields = z.object({
  reason: boundedText(100, "내용"),
});

const reasonDateFields = z.object({
  reason: boundedText(100, "결석사유"),
  date4: isoDate,
});

const reasonEvidenceFields = z.object({
  reason: boundedText(100, "결석사유"),
  evidence: z.array(z.enum(EVIDENCE)).min(1, "증빙을 하나 이상 선택해 주세요"),
});

export const type2FieldsSchema = z.object({
  place: boundedText(50, "장소"),
  content: boundedText(1000, "학습 내용"),
  plan: boundedText(1000, "학습 계획"),
});

export type Type1ReasonFields = z.infer<typeof reasonFields>;
export type Type1DateFields = z.infer<typeof reasonDateFields>;
export type Type1EvidenceFields = z.infer<typeof reasonEvidenceFields>;
export type Type2Fields = z.infer<typeof type2FieldsSchema>;
export type RequestFields = Type1ReasonFields | Type1DateFields | Type1EvidenceFields | Type2Fields;

export function fieldsSchemaForCategory(category: number) {
  if (category === 4) return reasonDateFields;
  if (category === 6) return reasonEvidenceFields;
  return reasonFields;
}

const requestShape = z.object({
  docType: z.enum(DOC_TYPES),
  category: z.number().int().min(1).max(7).nullable(),
  startDate: isoDate,
  endDate: isoDate,
  guardianName: boundedText(30, "보호자 이름"),
  guardianRelation: z.enum(RELATIONS),
  signaturePath: z.string().trim().min(1, "서명이 필요합니다").max(300),
  fields: z.unknown(),
});

export const requestInputSchema = requestShape
  .superRefine((value, ctx) => {
    if (value.endDate < value.startDate) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: "종료일은 시작일 이후여야 합니다", path: ["endDate"] });
    }
    if (value.docType === "type1") {
      if (value.category == null) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, message: "사유를 선택해 주세요", path: ["category"] });
        return;
      }
      const parsed = fieldsSchemaForCategory(value.category).safeParse(value.fields);
      if (!parsed.success) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: parsed.error.issues[0]?.message ?? "사유 입력을 확인해 주세요",
          path: ["fields"],
        });
      }
      return;
    }
    if (value.category != null) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: "체험학습에는 사유 번호가 없습니다", path: ["category"] });
    }
    const parsed = type2FieldsSchema.safeParse(value.fields);
    if (!parsed.success) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: parsed.error.issues[0]?.message ?? "체험학습 내용을 확인해 주세요",
        path: ["fields"],
      });
    }
  })
  .transform((value) => {
    if (value.docType === "type1") {
      const fields = fieldsSchemaForCategory(value.category!).parse(value.fields);
      return { ...value, category: value.category as 1 | 2 | 3 | 4 | 5 | 6 | 7, fields };
    }
    return { ...value, category: null, fields: type2FieldsSchema.parse(value.fields) };
  });

export type RequestInput = z.infer<typeof requestInputSchema>;

const reportText = z.string()
  .transform((value) => value.replace(/\r\n?/g, "\n").replace(/[\u0000-\u0008\u000B-\u001F\u007F]/g, "").trim())
  .pipe(z.string().min(10, "실제 체험 내용을 10자 이상 작성해 주세요").max(3000, "실제 체험 내용은 3,000자까지입니다"));

export const reportInputSchema = z.object({
  requestId: z.string().uuid("신청서를 찾을 수 없습니다"),
  signaturePath: z.string().trim().min(1, "서명이 필요합니다").max(300),
  experienceSummary: reportText,
  evidencePhotos: z.array(z.string().max(500_000).regex(/^data:image\/jpeg;base64,/, "JPEG 사진만 첨부할 수 있습니다")).max(4, "증빙 사진은 최대 4장까지 첨부할 수 있습니다").default([]),
});
export type ReportInput = z.infer<typeof reportInputSchema>;

export const loginInputSchema = z.object({
  studentName: z.string().transform(stripControls).pipe(z.string().min(1, "학생 이름을 입력해 주세요").max(30)),
  phone: z.string().min(8, "전화번호를 입력해 주세요").max(20),
});
export type LoginInput = z.infer<typeof loginInputSchema>;

export const cancelInputSchema = z.object({
  requestId: z.string().uuid(),
});

export const uploadInputSchema = z.object({
  pngBase64: z.string().min(1, "서명 이미지가 없습니다"),
});

const studentRowSchema = z.object({
  number: z.number().int().positive(),
  name: z.string().transform(stripControls).pipe(z.string().min(1).max(30)),
  gender: z.enum(["남", "여"]),
  fatherName: z.string().transform(stripControls).pipe(z.string().max(30)).nullable().optional(),
  motherName: z.string().transform(stripControls).pipe(z.string().max(30)).nullable().optional(),
  fatherPhone: z.string().max(20).nullable().optional(),
  motherPhone: z.string().max(20).nullable().optional(),
});

export const teacherUpsertStudentsSchema = z.object({
  classroomId: z.string().uuid(),
  students: z.array(studentRowSchema).min(1, "학생이 없습니다").max(40, "한 번에 40명까지 저장합니다"),
});
export type TeacherUpsertStudentsInput = z.infer<typeof teacherUpsertStudentsSchema>;

export const teacherUpdateInputSchema = z.object({
  requestId: z.string().uuid(),
  startDate: isoDate.optional(),
  endDate: isoDate.optional(),
  category: z.number().int().min(1).max(7).nullable().optional(),
  fields: z.unknown().optional(),
  guardianName: boundedText(30, "보호자 이름").optional(),
});
export type TeacherUpdateInput = z.infer<typeof teacherUpdateInputSchema>;

export const syncHolidaysInputSchema = z.object({
  schoolYear: z.number().int().min(2000).max(2100),
});
export type SyncHolidaysInput = z.infer<typeof syncHolidaysInputSchema>;
