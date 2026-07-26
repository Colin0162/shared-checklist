// Vercel 서버리스 함수: 자유롭게 쓴 글 → 체크리스트 항목(JSON)으로 변환.
//   예) "음식: 수박 1개, 라면 5봉지 / 식기: 젓가락 5쌍" → 대항목·항목·수량으로 분해
//
//   ※ ANTHROPIC_API_KEY는 '서버에서만' 쓴다(브라우저에 절대 노출 금지).
//     Vercel 대시보드 → Settings → Environment Variables 에 넣을 것.
//   ※ 로그인한 사용자만 쓸 수 있게 토큰을 Supabase에 확인(비용 남용 방지).
import Anthropic from '@anthropic-ai/sdk'
import { createClient } from '@supabase/supabase-js'

// 응답을 이 모양으로 강제(structured outputs) → 항상 파싱 가능한 JSON
const SCHEMA = {
  type: 'object',
  properties: {
    categories: {
      type: 'array',
      description: '대항목(분류) 이름 목록. 글에 분류가 없으면 빈 배열.',
      items: { type: 'string' },
    },
    items: {
      type: 'array',
      description: '체크리스트 항목 목록',
      items: {
        type: 'object',
        properties: {
          group_name: { type: 'string', description: '속한 대항목 이름. 없으면 빈 문자열.' },
          label: { type: 'string', description: '항목 이름 (수량 제외)' },
          quantity: { type: 'string', description: "수량 표기(예: '1개', '5봉지'). 없으면 빈 문자열." },
        },
        required: ['group_name', 'label', 'quantity'],
        additionalProperties: false,
      },
    },
  },
  required: ['categories', 'items'],
  additionalProperties: false,
}

const SYSTEM = `너는 한국어로 쓴 준비물/할 일 메모를 체크리스트로 정리하는 도우미다.

규칙:
- 글에서 준비물·할 일을 하나씩 항목(label)으로 뽑는다.
- 수량이 적혀 있으면 quantity에 단위까지 그대로 넣는다(예: "1개", "5봉지", "5쌍"). 없으면 빈 문자열.
- 수량은 label에 넣지 말고 반드시 quantity로 분리한다. (label "수박", quantity "1개")
- "음식:", "식기:" 처럼 분류가 보이면 categories에 넣고 각 항목의 group_name으로 지정한다.
- 분류가 없으면 categories는 빈 배열, group_name은 모두 빈 문자열로 둔다.
- 글에 있는 것만 항목으로 만든다. 없는 준비물을 지어내지 않는다.
- 원래 표현을 최대한 살리고, 중복은 하나로 합친다.`

export const config = { maxDuration: 60 }

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'POST만 가능합니다.' })
  }
  try {
    const { token, text } = req.body || {}
    if (!text || !String(text).trim()) {
      return res.status(400).json({ error: '내용을 입력하세요.' })
    }
    if (!process.env.ANTHROPIC_API_KEY) {
      return res.status(500).json({ error: 'AI 기능이 아직 설정되지 않았습니다. (서버 API 키 없음)' })
    }

    // 로그인 확인 — 아무나 호출해 비용을 쓰지 못하게
    const supabase = createClient(
      process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL,
      process.env.VITE_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY,
    )
    const { data: name } = await supabase.rpc('whoami', { p_token: token })
    if (!name) return res.status(401).json({ error: '로그인이 필요합니다.' })

    const client = new Anthropic() // ANTHROPIC_API_KEY 를 환경변수에서 읽음
    const message = await client.messages.create({
      model: 'claude-opus-4-8',
      max_tokens: 16000,
      system: SYSTEM,
      thinking: { type: 'adaptive' },
      output_config: {
        effort: 'medium', // 간단한 추출 작업 — 품질/속도 균형
        format: { type: 'json_schema', schema: SCHEMA },
      },
      messages: [{ role: 'user', content: String(text).slice(0, 8000) }],
    })

    const out = message.content.find((b) => b.type === 'text')?.text || '{}'
    const parsed = JSON.parse(out)
    return res.status(200).json({
      categories: Array.isArray(parsed.categories) ? parsed.categories : [],
      items: Array.isArray(parsed.items) ? parsed.items : [],
    })
  } catch (e) {
    console.error('[parse-checklist]', e)
    return res.status(500).json({ error: e?.message || 'AI 변환에 실패했습니다.' })
  }
}
