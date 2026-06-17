// 장소(rate) 모드에서 쓰는 등급 3종
export const RATINGS = ['상', '중', '하']

// 사이트 관리자 예약 계정 — 로그인 ID는 그대로 두고 화면에만 '서버 관리자'로 표시
export const SITE_ADMIN_ACCOUNT = 'anrhks456'
export function displayName(name) {
  return name === SITE_ADMIN_ACCOUNT ? '서버 관리자' : name
}

// 행사일(YYYY-MM-DD)로 D-day 문자열 만들기. 없으면 ''
export function ddayLabel(dateStr) {
  if (!dateStr) return ''
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const target = new Date(dateStr + 'T00:00:00')
  const diff = Math.round((target - today) / 86400000)
  if (Number.isNaN(diff)) return ''
  if (diff === 0) return 'D-DAY'
  return diff > 0 ? `D-${diff}` : `D+${-diff}`
}
