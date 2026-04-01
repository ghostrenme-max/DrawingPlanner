import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import './App.css'

/** `logo/worthwith.svg` W 곡선 (viewBox 0 0 500 500) */
const W_PATH =
  'M102.5,285.4c0,0,13,30,43,20s40-90,70-85s34,65,64,50c30-15,58-105,118-147'

/** with → worth 순서: 400ms 주황(i), 750ms 보라(o) — 좌표는 worthwith.svg */
const DOT_FIRST = { cx: 136.7, cy: 353.8, r: 22.8, fill: '#F97316' }
const DOT_SECOND = { cx: 271.2, cy: 320.7, r: 25.7, fill: '#7C3AED' }

const wordmarkShellStyle = {
  fontFamily: "'Inter', sans-serif",
  fontWeight: 800,
  fontSize: '28px',
  letterSpacing: '-0.5px',
  color: '#FFFFFF',
}

const wordmarkWhite = { color: '#FFFFFF' }

function Wordmark({ showI, showO }) {
  const oStyle = {
    opacity: showO ? 1 : 0,
    color: '#7C3AED',
    transition: 'opacity 300ms ease-out',
  }
  const iStyle = {
    opacity: showI ? 1 : 0,
    color: '#F97316',
    transition: 'opacity 300ms ease-out',
  }

  return (
    <div className="splash-wordmark" style={{ marginTop: 20, padding: 0, textAlign: 'center' }}>
      <span style={wordmarkShellStyle}>
        <span style={wordmarkWhite}>w</span>
        <span style={iStyle}>i</span>
        <span style={wordmarkWhite}>th w</span>
        <span style={oStyle}>o</span>
        <span style={wordmarkWhite}>rth</span>
      </span>
    </div>
  )
}

function SplashTagline({ showI, showO }) {
  const partStyle = (visible) => ({
    opacity: visible ? 1 : 0,
    transition: 'opacity 300ms ease-out',
    color: 'rgba(255, 255, 255, 0.3)',
  })

  return (
    <p
      className="splash-tagline"
      style={{
        margin: '10px 0 0',
        textAlign: 'center',
        width: '100%',
        color: 'rgba(255, 255, 255, 0.3)',
      }}
    >
      <span style={partStyle(showI)}>같이,</span>
      <span style={partStyle(showO)}> 가치있게</span>
    </p>
  )
}

function AnimatedSplashLogo() {
  const pathRef = useRef(null)

  useLayoutEffect(() => {
    const path = pathRef.current
    if (!path) return
    const len = path.getTotalLength()
    path.style.setProperty('--w-len', String(len))
  }, [])

  return (
    <svg
      className="splash-logo-svg"
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
        className="splash-logo-dot splash-logo-dot--orange"
        cx={DOT_FIRST.cx}
        cy={DOT_FIRST.cy}
        r={DOT_FIRST.r}
        fill={DOT_FIRST.fill}
      />
      <circle
        className="splash-logo-dot splash-logo-dot--purple"
        cx={DOT_SECOND.cx}
        cy={DOT_SECOND.cy}
        r={DOT_SECOND.r}
        fill={DOT_SECOND.fill}
      />
    </svg>
  )
}

function App() {
  const [showI, setShowI] = useState(false)
  const [showO, setShowO] = useState(false)

  useEffect(() => {
    const tI = window.setTimeout(() => setShowI(true), 400)
    const tO = window.setTimeout(() => setShowO(true), 750)
    return () => {
      window.clearTimeout(tI)
      window.clearTimeout(tO)
    }
  }, [])

  useEffect(() => {
    const t = window.setTimeout(() => {
      console.log('navigate')
    }, 2200)
    return () => window.clearTimeout(t)
  }, [])

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
          backgroundColor: '#1a1a2e',
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
            backgroundColor: '#1a1a2e',
            display: 'flex',
            flexDirection: 'column',
            boxSizing: 'border-box',
          }}
        >
          <div
            className="splash-center"
            style={{
              flex: 1,
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              minHeight: 0,
              boxSizing: 'border-box',
            }}
          >
            <div className="splash-logo-block">
              <AnimatedSplashLogo />
            </div>

            <div
              className="splash-fade--hug"
              style={{ display: 'flex', justifyContent: 'center', width: '100%' }}
            >
              <Wordmark showI={showI} showO={showO} />
            </div>

            <SplashTagline showI={showI} showO={showO} />
          </div>
        </div>
      </div>
    </div>
  )
}

export default App
