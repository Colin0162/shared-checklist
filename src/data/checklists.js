// 체크리스트 정적 샘플 데이터 (2단계: DB 없이 화면만 만든다)
//
// 구조 — "데이터 한 벌, 화면만 모드로 분기":
//   체크리스트 = { id, title, mode, groups }
//     · mode 'check' : 체크박스 목록(준비물).  항목 상태 = true / false
//     · mode 'rate'  : 상·중·하 평가(장소 답사). 항목 상태 = '상' | '중' | '하'
//   그룹 = { name, items }
//   항목 = { id, label, note }
//
// ※ 항목 id는 두 목록 전체에서 유일해야 한다 (s=준비물, p=장소).
//   3단계에서 DB의 기본키(PK)로 이어질 값이라 미리 안 겹치게 잡아둔다.

// 장소 평가에서 쓸 등급 3종 (Item.jsx에서 버튼으로 그린다)
export const RATINGS = ['상', '중', '하']

export const checklists = [
  {
    id: 'supplies',
    title: 'MT 준비물',
    mode: 'check',
    groups: [
      {
        name: '전체 필수품목 (음식 외)',
        items: [
          { id: 's1', label: '성당 엠프 (마이크/블루투스)', note: '엠프 전원, AUX 포함' },
          { id: 's2', label: '작업등 2개', note: '' },
          { id: 's3', label: '의자 22개', note: '' },
          { id: 's4', label: '테이블 6개', note: '' },
          { id: 's5', label: '멀티탭 2개', note: '담당: 준영' },
          { id: 's6', label: '부탄가스 8개', note: '' },
          { id: 's7', label: '응급키트', note: '소화제·버물리·기피제 / 8.21 확인' },
        ],
      },
      {
        name: '전체 필수품목 (음식)',
        items: [
          { id: 's8', label: '김치 5kg', note: '' },
          { id: 's9', label: '물 2L × 30개', note: '' },
          { id: 's10', label: '쌀 4kg', note: '' },
          { id: 's11', label: '소주 20병 (1박스)', note: '첫날 보고 둘째날 사기' },
        ],
      },
      {
        name: '2일차 점심 (카레)',
        items: [
          { id: 's12', label: '카레 (큰 거)', note: '' },
          { id: 's13', label: '감자·당근·양파·햄', note: '' },
          { id: 's14', label: '계란', note: '' },
        ],
      },
    ],
  },
  {
    id: 'place',
    title: '장소 답사',
    mode: 'rate',
    groups: [
      {
        name: '가격',
        items: [{ id: 'p1', label: '객실 가격 (2박 3일)', note: '8월 말 기준' }],
      },
      {
        name: '거리 · 접근성',
        items: [
          { id: 'p2', label: '소재지 및 거리', note: '성당에서 이동 시간' },
          { id: 'p3', label: '근처 마트 존재 여부', note: '도보/차량 거리, 장보기 편의성' },
        ],
      },
      {
        name: '건물 및 시설',
        items: [
          { id: 'p4', label: '단체 적절성', note: '최대 수용인원 / 집합장소' },
          { id: 'p5', label: '독립성', note: '단독 사용 / 마당 여부' },
          { id: 'p6', label: '객실 내부시설', note: '침구류 / 방 개수(남녀)' },
          { id: 'p7', label: '주차장', note: '주차 가능 대수' },
          { id: 'p8', label: '화장실·샤워실', note: '세면도구/수건 구비' },
        ],
      },
      {
        name: '물놀이',
        items: [{ id: 'p9', label: '물놀이 장소', note: '계곡 도보/차량 거리' }],
      },
      {
        name: '위생',
        items: [{ id: 'p10', label: '위생 상태', note: '방·화장실 청결' }],
      },
      {
        name: '종합',
        items: [{ id: 'p11', label: '종합 의견', note: '' }],
      },
    ],
  },
]
