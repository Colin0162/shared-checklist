import { useState } from 'react'
import './App.css'
import { checklists } from './data/checklists'
import Checklist from './components/Checklist'

function App() {
  // ① 어떤 탭이 켜져 있는지: 활성 체크리스트의 id를 기억한다.
  const [activeId, setActiveId] = useState(checklists[0].id)

  // ② 모든 항목의 "상태"를 여기(App) 한 곳에서 관리한다 = lifting state up.
  //    형태: { [항목id]: 상태 }  (check 모드는 true, rate 모드는 '상'|'중'|'하')
  //    상태를 위로 올려두면 → 탭을 바꿔도 풀리지 않고,
  //    3단계에서 이 useState 부분만 DB 호출로 갈아끼우면 된다.
  const [statuses, setStatuses] = useState({})

  // 활성 체크리스트 객체 찾기 (id로 검색)
  const active = checklists.find((c) => c.id === activeId)

  // 항목 하나의 상태를 바꾸는 함수. 자식(Item)이 호출하면 여기서 state 갱신.
  // prev를 받아 새 객체로 만드는 이유: React state는 "직접 수정 금지, 새로 만들기".
  function setItemStatus(itemId, value) {
    setStatuses((prev) => ({ ...prev, [itemId]: value }))
  }

  return (
    <div className="app">
      <header className="app-header">
        <h1>MT 체크리스트</h1>

        {/* 탭 버튼: 체크리스트 개수만큼 자동 생성 */}
        <nav className="tabs">
          {checklists.map((c) => (
            <button
              key={c.id}
              className={c.id === activeId ? 'tab active' : 'tab'}
              onClick={() => setActiveId(c.id)}
            >
              {c.title}
            </button>
          ))}
        </nav>
      </header>

      {/* 활성 체크리스트 하나만 그린다. 상태와 변경함수를 props로 내려준다. */}
      <Checklist
        checklist={active}
        statuses={statuses}
        onSetItemStatus={setItemStatus}
      />
    </div>
  )
}

export default App
