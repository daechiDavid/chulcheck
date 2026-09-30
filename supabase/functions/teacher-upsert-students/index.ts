import { teacherUpsertStudentsSchema } from "../_shared/contract/schema.ts";
import { parseInput, requirePepper } from "../_shared/db.ts";
import { ApiException, jsonResponse, readJson } from "../_shared/http.ts";
import { normalizePhone, phoneHmac } from "../_shared/phone.ts";
import { assertClassroomOwner, serveTeacher, serviceDb } from "../_shared/teacher.ts";

type PhoneColumns = { hmac: string; last4: string };

serveTeacher(async (req, teacherId) => {
  const input = parseInput(teacherUpsertStudentsSchema, await readJson(req));
  const seen = new Set<number>();
  for (const row of input.students) {
    if (seen.has(row.number)) {
      throw new ApiException("INVALID_INPUT", `${row.number}번이 중복되었습니다`, 400);
    }
    seen.add(row.number);
  }

  const supabase = serviceDb();
  await assertClassroomOwner(supabase, input.classroomId, teacherId);
  const pepper = requirePepper();

  const { data: existing, error: loadError } = await supabase
    .from("students")
    .select("id, number, active")
    .eq("classroom_id", input.classroomId);
  if (loadError) {
    console.error(loadError);
    throw new ApiException("INVALID_INPUT", "명부를 불러오지 못했습니다", 500);
  }
  const byNumber = new Map((existing ?? []).map((row) => [row.number, row]));

  let inserted = 0;
  let updated = 0;
  for (const row of input.students) {
    const father = await phoneColumns(row.fatherPhone, pepper);
    const mother = await phoneColumns(row.motherPhone, pepper);
    const current = byNumber.get(row.number);
    const names = {
      name: row.name,
      gender: row.gender,
      father_name: blankToNull(row.fatherName),
      mother_name: blankToNull(row.motherName),
      active: true,
    };
    if (current) {
      const patch: Record<string, unknown> = { ...names };
      if (father) {
        patch.father_phone_hmac = father.hmac;
        patch.father_phone_last4 = father.last4;
      }
      if (mother) {
        patch.mother_phone_hmac = mother.hmac;
        patch.mother_phone_last4 = mother.last4;
      }
      const { error } = await supabase.from("students").update(patch).eq("id", current.id);
      if (error) {
        console.error(error);
        throw new ApiException("INVALID_INPUT", `${row.number}번 학생을 저장하지 못했습니다`, 500);
      }
      updated += 1;
    } else {
      const { error } = await supabase.from("students").insert({
        classroom_id: input.classroomId,
        number: row.number,
        ...names,
        father_phone_hmac: father?.hmac ?? null,
        mother_phone_hmac: mother?.hmac ?? null,
        father_phone_last4: father?.last4 ?? null,
        mother_phone_last4: mother?.last4 ?? null,
      });
      if (error) {
        console.error(error);
        throw new ApiException("INVALID_INPUT", `${row.number}번 학생을 저장하지 못했습니다`, 500);
      }
      inserted += 1;
    }
  }

  const incoming = new Set(input.students.map((row) => row.number));
  const deactivateIds = (existing ?? [])
    .filter((row) => row.active && !incoming.has(row.number))
    .map((row) => row.id);
  if (deactivateIds.length) {
    const { error } = await supabase.from("students").update({ active: false }).in("id", deactivateIds);
    if (error) {
      console.error(error);
      throw new ApiException("INVALID_INPUT", "빠진 학생을 비활성화하지 못했습니다", 500);
    }
  }

  return jsonResponse(req, { inserted, updated, deactivated: deactivateIds.length });
});

function blankToNull(value: string | null | undefined): string | null {
  const trimmed = value?.trim() ?? "";
  return trimmed ? trimmed : null;
}

async function phoneColumns(phone: string | null | undefined, pepper: string): Promise<PhoneColumns | null> {
  if (phone == null || phone.trim() === "") return null;
  const normalized = normalizePhone(phone);
  if (!normalized) throw new ApiException("INVALID_INPUT", "전화번호 형식을 확인해 주세요", 400);
  return { hmac: await phoneHmac(normalized, pepper), last4: normalized.slice(-4) };
}
