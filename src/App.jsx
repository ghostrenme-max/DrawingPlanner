import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react'
import './App.css'

/** `logo/worthwith.svg` W 곡선 (viewBox 0 0 500 500) */
const W_PATH =
  'M102.5,285.4c0,0,13,30,43,20s40-90,70-85s34,65,64,50c30-15,58-105,118-147'

const DOT_FIRST = { cx: 136.7, cy: 353.8, r: 22.8, fill: '#FB923C' }
const DOT_SECOND = { cx: 271.2, cy: 320.7, r: 25.7, fill: '#2DD4BF' }

/** 곡선 그리기 시간과 동일해야 거리 비율 = 시간 비율 (linear) */
const DRAW_MS = 1000

/** 흰 곡선·점·워드마크 전체 시퀀스를 이 만큼 늦게 시작 */
const SPLASH_SEQUENCE_START_MS = 500

/** 원 pop 애니메이션과 i·같이 / o·가치있게 opacity 전환을 동일 길이로 맞춤 */
const SPLASH_POP_MS = 300

/** 태그라인 자간 애니메이션 길이(같이·가치있게 동일, ease-in-out) */
const SPLASH_TAGLINE_SPREAD_MS = 680

/** 같이 자간 끝난 뒤 → 가치있게 자간 시작까지 최소 여유(ms). o 타이밍보다 앞당기지 않도록 max 처리 */
const SPLASH_TAGLINE_AFTER_GATI_MS = 160

const wordmarkShellStyle = {
  fontFamily: "'Inter', sans-serif",
  fontWeight: 800,
  fontSize: '28px',
  letterSpacing: '-0.5px',
  color: '#FFFFFF',
}

const wordmarkWhite = { color: '#FFFFFF' }

function closestLengthOnPath(pathEl, cx, cy, steps = 800) {
  const len = pathEl.getTotalLength()
  if (len <= 0) return 0
  let bestL = 0
  let bestD = Infinity
  for (let i = 0; i <= steps; i++) {
    const l = (i / steps) * len
    const p = pathEl.getPointAtLength(l)
    const d = (p.x - cx) ** 2 + (p.y - cy) ** 2
    if (d < bestD) {
      bestD = d
      bestL = l
    }
  }
  return bestL
}

function measurePathDelays(pathEl) {
  const len = pathEl.getTotalLength()
  if (len <= 0) {
    return { len: 0, iMs: 400, oMs: 750 }
  }
  const lI = closestLengthOnPath(pathEl, DOT_FIRST.cx, DOT_FIRST.cy)
  const lO = closestLengthOnPath(pathEl, DOT_SECOND.cx, DOT_SECOND.cy)
  const ms = (l) => Math.max(0, Math.round((l / len) * DRAW_MS))
  let iMs = ms(lI)
  let oMs = ms(lO)
  /*
   * 첫 곡선 근처 원은 path 시작점과의 최단 거리 샘플이 너무 앞쪽(0% 부근)으로 잡히기 쉬움
   * → iMs가 거의 0이 되어 주황이 처음부터 고정된 것처럼 보임.
   * 흰 선이 눈에 띄게 진행된 뒤(최소 8%) + 계산값 중 큰 쪽을 씀.
   */
  const minAfterStroke = Math.round(DRAW_MS * 0.08)
  iMs = Math.max(iMs, minAfterStroke)
  oMs = Math.max(ms(lO), iMs + 80)
  if (oMs <= iMs) oMs = iMs + 120
  return { len, iMs, oMs }
}

function Wordmark() {
  return (
    <div className="splash-wordmark" style={{ marginTop: 20, padding: 0, textAlign: 'center' }}>
      <span style={wordmarkShellStyle}>
        <span style={wordmarkWhite}>w</span>
        <span className="splash-sync-i" style={{ color: DOT_FIRST.fill }}>
          i
        </span>
        <span style={wordmarkWhite}>th w</span>
        <span className="splash-sync-o" style={{ color: DOT_SECOND.fill }}>
          o
        </span>
        <span style={wordmarkWhite}>rth</span>
      </span>
    </div>
  )
}

function SplashTagline() {
  return (
    <p
      className="splash-tagline"
      style={{
        margin: '10px 0 0',
        textAlign: 'center',
        width: '100%',
      }}
    >
      <span className="splash-sync-i" style={{ color: DOT_FIRST.fill }}>
        <span className="splash-tagline-gati">
          <span className="splash-tagline-gati-tighten">같이</span>
          {','}
        </span>
      </span>
      <span className="splash-sync-o" style={{ color: DOT_SECOND.fill }}>
        <span className="splash-tagline-worth-lead"> </span>
        <span className="splash-tagline-worth-spread">가치있게</span>
      </span>
    </p>
  )
}

/** timing.iMs / oMs 는 이미 SPLASH_SEQUENCE_START_MS 반영된 값(원·글자 공통) */
function AnimatedSplashLogo({ timing, onMeasured }) {
  const pathRef = useRef(null)

  useLayoutEffect(() => {
    const path = pathRef.current
    if (!path) return
    onMeasured?.(measurePathDelays(path))
  }, [onMeasured])

  const readyClass = timing ? ' splash-logo-svg--ready' : ''
  const svgStyle =
    timing == null
      ? undefined
      : {
          ['--w-len']: String(timing.len),
          ['--splash-draw-delay']: `${SPLASH_SEQUENCE_START_MS}ms`,
          ['--splash-dot-pop-duration']: `${SPLASH_POP_MS}ms`,
          ['--splash-dot-i-delay']: `${timing.iMs}ms`,
          ['--splash-dot-o-delay']: `${timing.oMs}ms`,
        }

  return (
    <svg
      className={`splash-logo-svg${readyClass}`}
      style={svgStyle}
      viewBox="0 0 500 500"
      width={100}
      height={100}
      preserveAspectRatio="xMidYMid meet"
      aria-hidden
    >
      <path
        ref={pathRef}
        className="splash-logo-w-path"
        d={W_PATH}
        fill="none"
        stroke="#FFFFFF"
        strokeWidth={28}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <circle
        className="splash-logo-dot splash-logo-dot--first"
        cx={DOT_FIRST.cx}
        cy={DOT_FIRST.cy}
        r={DOT_FIRST.r}
        fill={DOT_FIRST.fill}
      />
      <circle
        className="splash-logo-dot splash-logo-dot--second"
        cx={DOT_SECOND.cx}
        cy={DOT_SECOND.cy}
        r={DOT_SECOND.r}
        fill={DOT_SECOND.fill}
      />
    </svg>
  )
}

function App() {
  const [splashTiming, setSplashTiming] = useState(null)

  const onSplashMeasured = useCallback((raw) => {
    const s = SPLASH_SEQUENCE_START_MS
    setSplashTiming({
      len: raw.len,
      iMs: raw.iMs + s,
      oMs: raw.oMs + s,
    })
  }, [])

  useEffect(() => {
    if (splashTiming === null) return
    const afterO = splashTiming.oMs + 800
    const t = window.setTimeout(() => {
      console.log('navigate')
    }, Math.max(2200, afterO))
    return () => window.clearTimeout(t)
  }, [splashTiming])

  return (
    <div
      className="device-stage"
      style={{
        minHeight: '100dvh',
        width: '100%',
        margin: 0,
        backgroundColor: '#0d0d0d',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        boxSizing: 'border-box',
      }}
    >
      <div
        className="device-frame"
        style={{
          width: 390,
          height: 844,
          backgroundColor: '#17161a',
          borderRadius: 48,
          overflow: 'hidden',
          position: 'relative',
          flexShrink: 0,
        }}
      >
        <div
          className="splash"
          style={{
            position: 'relative',
            width: '100%',
            height: '100%',
            margin: 0,
            backgroundColor: '#17161a',
            display: 'flex',
            flexDirection: 'column',
            boxSizing: 'border-box',
          }}
        >
          <div
            className={`splash-center${splashTiming ? ' splash-center--sync' : ''}`}
            style={{
              flex: 1,
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              minHeight: 0,
              boxSizing: 'border-box',
              ...(splashTiming
                ? {
                    ['--splash-sync-i-delay']: `${splashTiming.iMs}ms`,
                    ['--splash-sync-o-delay']: `${splashTiming.oMs}ms`,
                    ['--splash-sync-pop']: `${SPLASH_POP_MS}ms`,
                    ['--splash-tagline-spread-ms']: `${SPLASH_TAGLINE_SPREAD_MS}ms`,
                    ['--splash-worth-spread-delay']: `${Math.max(
                      splashTiming.oMs,
                      splashTiming.iMs + SPLASH_TAGLINE_SPREAD_MS + SPLASH_TAGLINE_AFTER_GATI_MS,
                    )}ms`,
                  }
                : {}),
            }}
          >
            <div className="splash-logo-block">
              <AnimatedSplashLogo timing={splashTiming} onMeasured={onSplashMeasured} />
            </div>

            <div
              className="splash-fade--hug"
              style={{ display: 'flex', justifyContent: 'center', width: '100%' }}
            >
              <Wordmark />
            </div>

            <SplashTagline />
          </div>
        </div>
      </div>
    </div>
  )
}

export default App
