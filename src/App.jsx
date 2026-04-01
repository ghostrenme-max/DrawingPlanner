import { useEffect, useLayoutEffect, useRef } from 'react'
import './App.css'

/** `logo/worthwith-icon.svg`와 동일한 W 곡선 (viewBox 0 0 500 500) */
const W_PATH =
  'M102.5,285.4c0,0,13,30,43,20s40-90,70-85s34,65,64,50c30-15,58-105,118-147'

const PURPLE_DOT = { cx: 136.7, cy: 353.8, r: 22.8 }
const ORANGE_DOT = { cx: 271.2, cy: 320.7, r: 25.7 }

const wordmarkOuterStyle = {
  fontFamily: "'Inter', sans-serif",
  fontWeight: 800,
  fontSize: '28px',
  color: 'white',
  letterSpacing: '-0.5px',
}

function closestLengthOnPath(pathEl, cx, cy, steps = 400) {
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

function Wordmark() {
  return (
    <div className="splash-wordmark">
      <span style={wordmarkOuterStyle}>
        w<span style={{ color: '#7C3AED' }}>o</span>rth w<span style={{ color: '#F97316' }}>i</span>th
      </span>
    </div>
  )
}

function AnimatedSplashLogo() {
  const svgRef = useRef(null)
  const pathRef = useRef(null)

  useLayoutEffect(() => {
    const svg = svgRef.current
    const path = pathRef.current
    if (!svg || !path) return

    const len = path.getTotalLength()
    path.style.setProperty('--w-len', String(len))

    const lPurple = closestLengthOnPath(path, PURPLE_DOT.cx, PURPLE_DOT.cy)
    const lOrange = closestLengthOnPath(path, ORANGE_DOT.cx, ORANGE_DOT.cy)

    /** 선이 그려지는 1000ms와 맞추기: path 위 비율 × 1000ms (ease-in-out과 근사 정렬) */
    const delayMs = (l) => Math.max(0, Math.round((l / len) * 1000))
    let msPurple = delayMs(lPurple)
    let msOrange = delayMs(lOrange)
    if (msOrange <= msPurple) msOrange = msPurple + 80

    svg.style.setProperty('--splash-dot-purple-delay', `${msPurple}ms`)
    svg.style.setProperty('--splash-dot-orange-delay', `${msOrange}ms`)
  }, [])

  return (
    <svg
      ref={svgRef}
      className="splash-logo-svg"
      viewBox="0 0 500 500"
      width={100}
      height={100}
      aria-hidden
    >
      <path
        ref={pathRef}
        className="splash-logo-w-path"
        d={W_PATH}
        fill="none"
      />
      <circle
        className="splash-logo-dot splash-logo-dot--purple"
        cx={PURPLE_DOT.cx}
        cy={PURPLE_DOT.cy}
        r={PURPLE_DOT.r}
        fill="#7C3AED"
      />
      <circle
        className="splash-logo-dot splash-logo-dot--orange"
        cx={ORANGE_DOT.cx}
        cy={ORANGE_DOT.cy}
        r={ORANGE_DOT.r}
        fill="#F97316"
      />
    </svg>
  )
}

function App() {
  useEffect(() => {
    const t = window.setTimeout(() => {
      console.log('navigate')
    }, 2200)
    return () => window.clearTimeout(t)
  }, [])

  return (
    <div className="device-stage">
      <div className="device-frame">
        <div className="splash">
          <div className="splash-center">
            <div className="splash-logo-block">
              <AnimatedSplashLogo />
            </div>

            <div className="splash-fade splash-fade--hug splash-fade--1200">
              <Wordmark />
            </div>

            <p className="splash-tagline splash-fade splash-fade--1350">
              같이, 가치있게
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}

export default App
