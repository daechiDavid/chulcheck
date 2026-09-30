/** Electron 메인 프로세스가 읽는 공개 키. service_role 은 넣지 않는다. */
export function readSupabaseEnv(): { url: string; key: string } | null {
  const env = import.meta.env as { MAIN_VITE_SUPABASE_URL?: string; MAIN_VITE_SUPABASE_PUBLISHABLE_KEY?: string }
  const url = env.MAIN_VITE_SUPABASE_URL || process.env.MAIN_VITE_SUPABASE_URL || ''
  const key = env.MAIN_VITE_SUPABASE_PUBLISHABLE_KEY || process.env.MAIN_VITE_SUPABASE_PUBLISHABLE_KEY || ''
  if (!url || !key) return null
  return { url, key }
}
