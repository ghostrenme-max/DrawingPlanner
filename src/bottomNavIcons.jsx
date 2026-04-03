const s = {
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 1.65,
  strokeLinecap: 'round',
  strokeLinejoin: 'round',
}

/** 트래커 — 진행 막대(작업 누적 느낌) */
export function NavIconTracker({ className = '' }) {
  return (
    <svg className={className} viewBox="0 0 24 24" width={24} height={24} aria-hidden>
      <path d="M6 17V11M10 17V8M14 17V13M18 17V6" {...s} />
    </svg>
  )
}

/** 목표 — 과녁 */
export function NavIconGoal({ className = '' }) {
  return (
    <svg className={className} viewBox="0 0 24 24" width={24} height={24} aria-hidden>
      <circle cx={12} cy={12} r={8} {...s} />
      <circle cx={12} cy={12} r={4.5} {...s} />
      <circle cx={12} cy={12} r={1.75} fill="currentColor" stroke="none" />
    </svg>
  )
}

/** 갤러리 — 앞쪽 카드에 풍경선 */
export function NavIconGallery({ className = '' }) {
  return (
    <svg className={className} viewBox="0 0 24 24" width={24} height={24} aria-hidden>
      <rect x={4} y={6} width={13} height={10} rx={2} {...s} opacity={0.45} />
      <rect x={7} y={8} width={14} height={11} rx={2} {...s} />
      <path d="M10 17.5l2.2-2.8 2.1 1.6 2.7-3.3" {...s} />
    </svg>
  )
}

/** 설정 — 슬라이더 */
export function NavIconSettings({ className = '' }) {
  return (
    <svg className={className} viewBox="0 0 24 24" width={24} height={24} aria-hidden>
      <path d="M3 7.5h5.5M12.5 7.5H21" {...s} />
      <circle cx={9.5} cy={7.5} r={2.2} {...s} />
      <path d="M3 12h8.5M15.5 12H21" {...s} />
      <circle cx={12.5} cy={12} r={2.2} {...s} />
      <path d="M3 16.5h11M17.5 16.5H21" {...s} />
      <circle cx={14.5} cy={16.5} r={2.2} {...s} />
    </svg>
  )
}
