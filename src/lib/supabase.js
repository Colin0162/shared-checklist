import { createClient } from '@supabase/supabase-js'

// .env.local 에서 연결 정보를 읽는다 (Vite는 VITE_ 접두사만 노출).
const url = import.meta.env.VITE_SUPABASE_URL
const anon = import.meta.env.VITE_SUPABASE_ANON_KEY

if (!url || !anon) {
  // 아직 키를 안 넣었으면 경고만. (앱은 일단 정적 데이터로 동작)
  console.warn(
    '[supabase] .env.local 에 VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY 가 필요합니다.',
  )
}

// 키가 둘 다 있을 때만 실제 클라이언트 생성. 없으면 null.
export const supabase = url && anon ? createClient(url, anon) : null
