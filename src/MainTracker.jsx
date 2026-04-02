import './MainTracker.css'

const STAGE_LABELS = ['레퍼런스', '스케치', '채색', '이펙트', '후보정']

/** @typedef {'done' | 'active' | 'pending'} StageState */

const SAMPLE_CARDS = [
  {
    id: '1',
    tag: '일러스트',
    title: '메인 일러스트',
    percent: 80,
    /** 레퍼런스·스케치·채색 완료, 이펙트 진행, 후보정 대기 */
    stages: ['done', 'done', 'done', 'active', 'pending'],
  },
  {
    id: '2',
    tag: '캐릭터',
    title: '전신/반신',
    percent: 40,
    stages: ['done', 'done', 'active', 'pending', 'pending'],
  },
  {
    id: '3',
    tag: 'UI',
    title: 'UI 디자인',
    percent: 20,
    stages: ['done', 'active', 'pending', 'pending', 'pending'],
  },
]

/** 헤더 하단 6세그먼트: 완료 / 진행중 / 미완료 샘플 */
const HEADER_SEGMENTS = ['done', 'done', 'done', 'active', 'pending', 'pending']

function StageChips({ stages }) {
  return (
    <div className="mt-chips">
      {STAGE_LABELS.map((label, i) => {
        const s = stages[i]
        const cls =
          s === 'done' ? 'mt-chip mt-chip--done' : s === 'active' ? 'mt-chip mt-chip--active' : 'mt-chip'
        return (
          <span key={label} className={cls}>
            {label}
          </span>
        )
      })}
    </div>
  )
}

/** 진행중 칩: 스펙에 명시 없음 — 틸 배경으로 구분 */
function MainTracker() {
  return (
    <div className="main-tracker">
      <header className="mt-header">
        <div className="mt-header-top">
          <div className="mt-wordmark">
            <span className="mt-wordmark-w">w</span>
            <span className="mt-wordmark-i">i</span>
            <span className="mt-wordmark-w">thw</span>
            <span className="mt-wordmark-o">o</span>
            <span className="mt-wordmark-w">rth</span>
          </div>
          <div className="mt-progress-block">
            <div className="mt-progress-pct">64%</div>
            <div className="mt-progress-today">TODAY</div>
          </div>
        </div>
        <div className="mt-bar-track">
          <div className="mt-bar-fill" style={{ width: '64%' }} />
        </div>
        <div className="mt-segments" role="presentation">
          {HEADER_SEGMENTS.map((kind, i) => (
            <span
              key={i}
              className={
                kind === 'done'
                  ? 'mt-segment mt-segment--done'
                  : kind === 'active'
                    ? 'mt-segment mt-segment--active'
                    : 'mt-segment'
              }
            />
          ))}
        </div>
      </header>

      <div className="mt-scroll">
        <div className="mt-cards">
          {SAMPLE_CARDS.map((card) => (
            <article key={card.id} className="mt-card">
              <div className="mt-card-row">
                <span className="mt-tag">{card.tag}</span>
                <span className="mt-card-pct">{card.percent}%</span>
              </div>
              <div className="mt-card-title">{card.title}</div>
              <div className="mt-card-bar">
                <div className="mt-card-bar-fill" style={{ width: `${card.percent}%` }} />
              </div>
              <StageChips stages={card.stages} />
            </article>
          ))}
          <button type="button" className="mt-card mt-card-add">
            <span className="mt-card-add-text">+ 작업 추가</span>
          </button>
        </div>
      </div>

      <nav className="mt-nav" aria-label="하단 메뉴">
        <button type="button" className="mt-nav-item mt-nav-item--active">
          <span className="mt-nav-icon" aria-hidden />
          트래커
        </button>
        <button type="button" className="mt-nav-item">
          <span className="mt-nav-icon" aria-hidden />
          목표
        </button>
        <button type="button" className="mt-nav-item">
          <span className="mt-nav-icon" aria-hidden />
          갤러리
        </button>
        <button type="button" className="mt-nav-item">
          <span className="mt-nav-icon" aria-hidden />
          설정
        </button>
      </nav>
    </div>
  )
}

export default MainTracker
