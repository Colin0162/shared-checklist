// 장소(rate) 모드에서 쓰는 등급 3종
export const RATINGS = ['상', '중', '하']

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
