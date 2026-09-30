export function normalizePhone(input: string): string | null {
  let digits = input.replace(/\D/g, "");
  if (digits.startsWith("82")) digits = `0${digits.slice(2)}`;
  if (digits.length === 10 && digits.startsWith("10")) digits = `0${digits}`;
  if (!/^01[016789]\d{7,8}$/.test(digits)) return null;
  return digits;
}

export async function phoneHmac(phone: string, pepper: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(pepper),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const signature = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(phone));
  return [...new Uint8Array(signature)].map((byte) => byte.toString(16).padStart(2, "0")).join("");
}
