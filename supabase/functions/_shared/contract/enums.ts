export const DOC_TYPES = ["type1", "type2"] as const;
export type DocType = (typeof DOC_TYPES)[number];

export const CATEGORIES = [1, 2, 3, 4, 5, 6, 7] as const;
export type Category = (typeof CATEGORIES)[number];

export const STATUSES = ["submitted", "reviewed", "rejected", "cancelled"] as const;
export type Status = (typeof STATUSES)[number];

export const OFF_DAY_KINDS = ["holiday", "school_off"] as const;
export type OffDayKind = (typeof OFF_DAY_KINDS)[number];

export const EVIDENCE = ["r1", "r2", "r3"] as const;
export type Evidence = (typeof EVIDENCE)[number];

export const RELATIONS = ["father", "mother"] as const;
export type Relation = (typeof RELATIONS)[number];

export const GENDERS = ["남", "여"] as const;
export type Gender = (typeof GENDERS)[number];

export const ERROR_CODES = [
  "INVALID_INPUT",
  "UNAUTHORIZED",
  "SESSION_EXPIRED",
  "LOCKED",
  "NOT_FOUND",
  "FORBIDDEN",
  "CONFLICT",
  "AMBIGUOUS_STUDENT",
] as const;
export type ErrorCode = (typeof ERROR_CODES)[number];
