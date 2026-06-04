import { useState, useEffect } from 'react'

// 로그인 후 헤더에 오늘 날짜·시간 표시 (1초마다 갱신)
function Clock() {
  const [now, setNow] = useState(new Date())
  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 1000)
    return () => clearInterval(t)
  }, [])
  const text = now.toLocaleString('ko-KR', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    weekday: 'long',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  })
  return <p className="clock">{text}</p>
}

export default Clock
