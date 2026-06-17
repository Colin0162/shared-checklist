// 텍스트 안의 URL을 클릭 가능한 링크로
function withLinks(text) {
  return String(text || '')
    .split(/(https?:\/\/[^\s]+)/g)
    .map((p, i) =>
      /^https?:\/\//.test(p) ? (
        <a key={i} href={p} target="_blank" rel="noreferrer" className="todo-link">
          {p}
        </a>
      ) : (
        p
      ),
    )
}

// 일정표/표 보기 (관리자가 만든 표를 그대로 표시, 링크 클릭 가능).
// props: data = { columns: [열이름...], rows: [[셀...], ...] }
function TableView({ data }) {
  const columns = data?.columns || []
  const rows = data?.rows || []
  if (columns.length === 0) {
    return <p className="muted">표 내용이 없습니다.</p>
  }
  return (
    <div className="table-wrap">
      <table className="data-table responsive">
        <thead>
          <tr>
            {columns.map((c, i) => (
              <th key={i}>{c}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, ri) => (
            <tr key={ri}>
              {columns.map((_, ci) => (
                <td key={ci} data-label={columns[ci]}>{withLinks(row[ci])}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

export default TableView
