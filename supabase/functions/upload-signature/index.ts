import { uploadInputSchema } from "../_shared/contract/schema.ts";
import { adminClient, parseInput } from "../_shared/db.ts";
import { ApiException, jsonResponse, readJson } from "../_shared/http.ts";
import { serveParent } from "../_shared/serve.ts";
import { requireSession } from "../_shared/session.ts";
import { loadActiveStudent } from "../_shared/students.ts";

const PNG = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];
const MAX_BYTES = 200 * 1024;

serveParent(async (req) => {
  const session = await requireSession(req);
  const input = parseInput(uploadInputSchema, await readJson(req));
  const bytes = decodePng(input.pngBase64);
  const supabase = adminClient();
  const student = await loadActiveStudent(supabase, session.student_id);
  const path = `${student.classroomId}/${student.id}/${crypto.randomUUID()}.png`;
  const { error } = await supabase.storage.from("signatures").upload(path, bytes, {
    contentType: "image/png",
    upsert: false,
  });
  if (error) {
    console.error(error);
    throw new ApiException("INVALID_INPUT", "서명을 저장하지 못했습니다", 500);
  }
  return jsonResponse(req, { path });
});

function decodePng(input: string): Uint8Array {
  const raw = input.replace(/^data:image\/png;base64,/, "").replace(/\s/g, "");
  let binary: string;
  try {
    binary = atob(raw);
  } catch {
    throw new ApiException("INVALID_INPUT", "서명 이미지를 읽지 못했습니다", 400);
  }
  if (binary.length > MAX_BYTES) {
    throw new ApiException("INVALID_INPUT", "서명은 200KB 이하여야 합니다", 400);
  }
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) bytes[index] = binary.charCodeAt(index);
  if (bytes.length < PNG.length || PNG.some((byte, index) => bytes[index] !== byte)) {
    throw new ApiException("INVALID_INPUT", "PNG 파일만 올릴 수 있습니다", 400);
  }
  return bytes;
}
