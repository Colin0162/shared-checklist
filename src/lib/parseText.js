// 자유롭게 쓴 글 → 체크리스트 항목으로 자동 분해 (앱 안에서 처리, 무료·즉시)
//
//   예)  음식: 수박 1개, 라면 5봉지
//        식기: 젓가락 5쌍, 숟가락 5개
//   →  대항목 [음식, 식기] + 항목 [{음식,수박,1개}, {음식,라면,5봉지}, ...]
//
//   규칙: '이름:' 은 대항목, 쉼표(,·/·줄바꿈)로 항목 구분, 끝의 '숫자+단위'는 수량으로 분리.

// 수량으로 볼 단위들 (숫자만 있어도 수량으로 봄)
const UNITS =
  '개|봉지|봉|팩|병|캔|컵|장|판|줄|쌍|켤레|벌|통|박스|상자|세트|묶음|다발|자루|권|대|명|인분|인|마리|포기|단|근|말|되|kg|g|L|l|ml|리터|그램'
// 문자열 끝의 '숫자(+단위)' → 수량. 앞에 공백이 있어야 함('A4용지' 같은 이름 보호)
const QTY_RE = new RegExp(`\\s+(\\d+(?:[.,]\\d+)?\\s*(?:${UNITS})?)$`)

// 한 덩어리 텍스트에서 이름과 수량 분리
function splitQuantity(raw) {
  const text = raw.replace(/\s+/g, ' ').trim()
  const m = text.match(QTY_RE)
  if (!m) return { label: text, quantity: '' }
  return {
    label: text.slice(0, m.index).trim(),
    quantity: m[1].replace(/\s+/g, ''),
  }
}

// 줄 앞의 글머리표(-, •, *, 1. 등) 제거
function stripBullet(line) {
  return line.replace(/^\s*(?:[-*•·○▪]|\d+[.)])\s*/, '').trim()
}

// 한 줄 안의 여러 항목을 쉼표류로 분리
function splitItems(text) {
  return text
    .split(/[,、/]|\s{2,}/)
    .map((s) => stripBullet(s))
    .filter(Boolean)
}

// 메인: 글 → { categories: [이름...], items: [{group_name,label,quantity}] }
export function parseChecklistText(input) {
  const categories = []
  const items = []
  let current = '' // 지금 적용 중인 대항목

  const addCategory = (name) => {
    const n = name.trim()
    if (n && !categories.includes(n)) categories.push(n)
    return n
  }

  for (const rawLine of String(input || '').split(/\r?\n/)) {
    const line = rawLine.trim()
    if (!line) continue

    // '음식:' 또는 '음식: 수박 1개, 라면 5봉지'
    const head = line.match(/^\s*(?:[-*•·○▪]\s*)?\[?([^:：\][]{1,20})\]?\s*[:：]\s*(.*)$/)
    if (head) {
      current = addCategory(head[1])
      const rest = head[2].trim()
      if (!rest) continue // 대항목만 있는 줄 → 다음 줄부터 이 분류
      for (const part of splitItems(rest)) {
        const { label, quantity } = splitQuantity(part)
        if (label) items.push({ group_name: current, label, quantity })
      }
      continue
    }

    // 일반 줄: 항목들
    for (const part of splitItems(line)) {
      const { label, quantity } = splitQuantity(part)
      if (label) items.push({ group_name: current, label, quantity })
    }
  }

  return { categories, items }
}
