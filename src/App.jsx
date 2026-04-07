import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react'
import { useLang } from './contexts/LanguageContext.js'
import { DEFAULT_APP_FEATURES } from './appFeatures.js'
import { createEmptyGoalTexts } from './goalConfig.js'
import { applyThemeToDocument, DEFAULT_THEME_INDEX } from './appTheme.js'
import GalleryScreen from './GalleryScreen.jsx'
import GoalScreen from './GoalScreen.jsx'
import MainTracker from './MainTracker.jsx'
import ReferenceFolderScreen from './ReferenceFolderScreen.jsx'
import SettingScreen from './SettingScreen.jsx'
import OnboardingScreen from './OnboardingScreen.jsx'
import HowToUseScreen, { readHowToUseTutorialDone } from './HowToUseScreen.jsx'
import { createDefaultTrackerCards } from './trackerCardsDefaults.js'
import {
  FEEDBACK_CARDS_LS,
  loadFeedbackCardsFromStorage,
  loadMonthlyGoalsFromStorage,
  loadTrackerCardsFromStorage,
  MONTHLY_GOALS_LS,
  TRACKER_CARDS_LS,
  TRACKER_STAGE_DONE_LS,
  TRACKER_CARRY_YM_LS,
} from './trackerPersistence.js'
import './App.css'
import { useAdMob } from './hooks/useAdMob.js'

/**
 * 트래커 1년 목표 UI: `tip` = 카드+입력+확정·닫기. 확정 시 유지·접기(비면 sample·있으면 hidden).
 * 닫기: 입력 비우고 sample. 새로고침 시 `tip`부터(localStorage 없음).
 */
/** v2: 예전 키만 있으면 팝업이 영원히 안 떠서 키 분리 */
const GOAL_1Y_WELCOME_DONE_KEY = 'worthwith_goal_1y_welcome_done_v2'
const LEGACY_GOAL_WELCOME_DONE_KEY = 'worthwith_goal_1y_welcome_done'

/**
 * 임시 테스트: `true`면 localStorage 무시·main 진입 시 LS 동기화 안 함 → 새로고침·프리뷰(Cursor) 재실행마다
 * 1years goals 팝업이 뜸.
 * 되돌리기: `false`로 바꾸면 앱 첫 실행(또는 LS 완료 플래그 없음)에만 뜨는 기존 동작. 예전에 테스트 중 LS에
 * `worthwith_goal_1y_welcome_done_v2`가 남아 있으면 팝업이 안 뜰 수 있음 → 설정 전체 초기화 또는 해당 키 삭제.
 */
const GOAL_WELCOME_TEST_ALWAYS_ON_RELOAD = true

/**
 * 테스트: `true`면 새로고침·재실행마다 1년 목표 온보딩 직후 How to use가 항상 열림(LS 무시).
 * 완료·건너뛰기 시 `withworth_tutorial`을 저장하지 않아 다음에도 다시 뜸.
 * 배포 전 `false`로 두면 `withworth_tutorial`로 1회 완료 후 생략.
 */
const HOW_TO_USE_TEST_ALWAYS_ON_RELOAD = true

const LEGACY_GOAL_STRIP_KEYS = [
  'worthwith_goal_1y_main_strip_v2',
  'worthwith_goal_1y_main_strip',
  'worthwith_goal_1y_tip_dismissed',
]

function clearLegacyGoalStripKeys() {
  try {
    for (const k of LEGACY_GOAL_STRIP_KEYS) {
      window.localStorage.removeItem(k)
    }
  } catch {
    /* ignore */
  }
}

function readGoalWelcomeShouldShow() {
  try {
    return window.localStorage.getItem(GOAL_1Y_WELCOME_DONE_KEY) !== '1'
  } catch {
    return true
  }
}

function galleryEntryUrl(entry) {
  if (typeof entry === 'string') return entry
  if (entry && typeof entry.url === 'string') return entry.url
  return ''
}

function revokeGalleryBlobUrls(items) {
  for (const it of items) {
    for (const ent of it.images ?? []) {
      const url = galleryEntryUrl(ent)
      if (url.startsWith('blob:')) {
        try {
          URL.revokeObjectURL(url)
        } catch {
          /* ignore */
        }
      }
    }
  }
}

function revokeReferenceBlobUrls(items) {
  for (const it of items) {
    const u = it.url
    if (typeof u === 'string' && u.startsWith('blob:')) {
      try {
        URL.revokeObjectURL(u)
      } catch {
        /* ignore */
      }
    }
  }
}

/** `logo/worthwith.svg` W 곡선 (viewBox 0 0 500 500) */
const W_PATH =
  'M102.5,285.4c0,0,13,30,43,20s40-90,70-85s34,65,64,50c30-15,58-105,118-147'

const DOT_FIRST = { cx: 136.7, cy: 353.8, r: 22.8 }
const DOT_SECOND = { cx: 271.2, cy: 320.7, r: 25.7 }

/** 곡선 그리기 시간과 동일해야 거리 비율 = 시간 비율 (linear) */
const DRAW_MS = 1000

/** 흰 곡선·점·워드마크 전체 시퀀스를 이 만큼 늦게 시작 */
const SPLASH_SEQUENCE_START_MS = 500

/** 원 pop 애니메이션과 i·같이 / o·가치있게 opacity 전환을 동일 길이로 맞춤 */
const SPLASH_POP_MS = 300

/** 「같이」 자간이 모이는 구간 길이(충분히 보이게) */
const SPLASH_GATI_SPREAD_MS = 850

/** i·같이 페이드 완료 후, 벌어진 자간(18px)을 유지한 뒤 모이기 시작까지 추가 대기 */
const SPLASH_GATI_HOLD_MS = 480

/** 「가치있게」 자간 펼침 길이 */
const SPLASH_WORTH_SPREAD_MS = 680

/** 같이 자간 끝난 뒤 → 가치있게 자간 시작까지 최소 여유(ms). o 타이밍보다 앞당기지 않도록 max 처리 */
const SPLASH_TAGLINE_AFTER_GATI_MS = 160

const wordmarkShellStyle = {
  fontFamily: "'Inter', sans-serif",
  fontWeight: 800,
  fontSize: 'clamp(17px, 4.6vw, 24px)',
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
        <span style={wordmarkWhite}>Dr</span>
        <span className="splash-sync-i splash-color-main">a</span>
        <span style={wordmarkWhite}>wing </span>
        <span style={wordmarkWhite}>Pl</span>
        <span className="splash-sync-o splash-color-sub">a</span>
        <span style={wordmarkWhite}>nner</span>
      </span>
    </div>
  )
}

function splitTaglineForSplash(s) {
  if (!s) return { first: '', second: '', sep: ',' }
  const iComma = s.indexOf(',')
  const iFull = s.indexOf('，')
  const iJp = s.indexOf('、')
  const i = [iComma, iFull, iJp].filter((x) => x >= 0).sort((a, b) => a - b)[0] ?? -1
  if (i < 0) return { first: s.trim(), second: '', sep: '' }
  return {
    first: s.slice(0, i).trim(),
    second: s.slice(i + 1).trim(),
    sep: s[i],
  }
}

function SplashTagline({ tagline }) {
  if (!tagline?.trim()) return null
  const { first, second, sep } = splitTaglineForSplash(tagline)
  return (
    <p
      className="splash-tagline"
      style={{
        margin: '10px 0 0',
        textAlign: 'center',
        width: '100%',
      }}
    >
      <span className="splash-sync-i splash-color-main">
        <span className="splash-tagline-gati">
          <span className="splash-tagline-gati-tighten">{first}</span>
          {sep ? sep : null}
        </span>
      </span>
      {second ? (
        <span className="splash-sync-o splash-color-sub">
          <span className="splash-tagline-worth-lead"> </span>
          <span className="splash-tagline-worth-spread">{second}</span>
        </span>
      ) : null}
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
      />
      <circle
        className="splash-logo-dot splash-logo-dot--second"
        cx={DOT_SECOND.cx}
        cy={DOT_SECOND.cy}
        r={DOT_SECOND.r}
      />
    </svg>
  )
}

function App() {
  const { t } = useLang()
  const [screen, setScreen] = useState(
    /** @type {'splash' | 'main' | 'goal' | 'gallery' | 'setting' | 'reference' | 'howToUse'} */ ('splash'),
  )
  const { showInterstitialAfterGallerySend, maybeShowInterstitialAfterBottomNavMove } = useAdMob({
    adsEnabled: screen !== 'splash' && screen !== 'howToUse',
  })
  /** 트래커 탭(재)진입마다 증가 → 상단 진행 바·% 애니 재생 */
  const [trackerBarReplayKey, setTrackerBarReplayKey] = useState(0)
  const [galleryItems, setGalleryItems] = useState(
    /** @type {Array<{ id: string; images: { url: string; date: string }[]; grouped: boolean; finalImageIndex: number; month: string; createdAt: number }>} */ ([]),
  )
  /** 갤러리 이미지 고정: `itemId::imageIndex` (최대 3개) */
  const [galleryPinnedKeys, setGalleryPinnedKeys] = useState(/** @type {string[]} */ ([]))
  const [referenceImages, setReferenceImages] = useState(
    /** @type {Array<{ id: string; url: string; tag: string; memo: string; savedAt: string }>} */ ([]),
  )

  const [goalTexts, setGoalTexts] = useState(() => createEmptyGoalTexts())
  const [monthlyGoals, setMonthlyGoals] = useState(() => loadMonthlyGoalsFromStorage())
  const [trackerCards, setTrackerCards] = useState(() => loadTrackerCardsFromStorage())
  const [feedbackCards, setFeedbackCards] = useState(() => loadFeedbackCardsFromStorage())
  const [goal1yMainStrip, setGoal1yMainStrip] = useState(
    /** @type {'tip' | 'sample' | 'hidden'} */ ('tip'),
  )
  const [goalWelcomeVisible, setGoalWelcomeVisible] = useState(() =>
    GOAL_WELCOME_TEST_ALWAYS_ON_RELOAD ? true : readGoalWelcomeShouldShow(),
  )
  const hadGoal1yTextRef = useRef(!!(goalTexts['1y'] ?? '').trim())
  const screenRef = useRef(screen)

  useEffect(() => {
    screenRef.current = screen
  }, [screen])

  const toggleGalleryPin = useCallback((pinKey) => {
    setGalleryPinnedKeys((prev) => {
      if (prev.includes(pinKey)) return prev.filter((k) => k !== pinKey)
      /* 상한은 GalleryScreen.jsx MAX_GALLERY_PINS 과 동일 */
      if (prev.length >= 3) return prev
      return [...prev, pinKey]
    })
  }, [])

  const pruneGalleryPinsForItemIds = useCallback((itemIds) => {
    const remove = new Set(itemIds)
    setGalleryPinnedKeys((prev) => prev.filter((k) => !remove.has(k.split('::')[0])))
  }, [])

  const [appFeatures, setAppFeatures] = useState(() => ({ ...DEFAULT_APP_FEATURES }))
  const [themeIndex, setThemeIndex] = useState(DEFAULT_THEME_INDEX)

  useLayoutEffect(() => {
    applyThemeToDocument(themeIndex)
  }, [themeIndex])

  const handleAppNav = useCallback(
    /** @param {'tracker' | 'goal' | 'gallery' | 'settings'} tab */
    (tab) => {
      /** @type {Record<string, typeof screen>} */
      const tabToScreen = {
        tracker: 'main',
        goal: 'goal',
        gallery: 'gallery',
        settings: 'setting',
      }
      const next = tabToScreen[tab]
      if (next == null) return
      const prev = screenRef.current

      if (tab === 'tracker') {
        setScreen('main')
        setTrackerBarReplayKey((k) => k + 1)
      } else if (tab === 'goal') {
        setScreen('goal')
      } else if (tab === 'gallery') {
        setScreen('gallery')
      } else if (tab === 'settings') {
        setScreen('setting')
      }

      if (prev !== next) {
        maybeShowInterstitialAfterBottomNavMove()
      }
    },
    [maybeShowInterstitialAfterBottomNavMove],
  )

  const onAddGalleryItem = useCallback(
    (item) => {
      setGalleryItems((prev) => [...prev, item])
    },
    [],
  )

  const appendFeedbackCard = useCallback(
    /** @param {{ id: number; text: string; workTitle: string; date: string; type: 'orange' | 'teal'; month: string; previewImageUrl?: string; confirmed?: boolean }} entry */
    (entry) => {
      setFeedbackCards((prev) => [...prev, { ...entry, confirmed: entry.confirmed ?? false }])
    },
    [],
  )

  const removeFeedbackCard = useCallback((id) => {
    setFeedbackCards((prev) => prev.filter((f) => f.id !== id))
  }, [])

  const toggleFeedbackCardConfirmed = useCallback((id) => {
    setFeedbackCards((prev) =>
      prev.map((f) => (f.id === id ? { ...f, confirmed: !f.confirmed } : f)),
    )
  }, [])

  const handleClearGallery = useCallback(() => {
    setGalleryItems((prev) => {
      revokeGalleryBlobUrls(prev)
      return []
    })
    setGalleryPinnedKeys([])
  }, [])

  useEffect(() => {
    clearLegacyGoalStripKeys()
  }, [])

  useEffect(() => {
    try {
      window.localStorage.setItem(TRACKER_CARDS_LS, JSON.stringify(trackerCards))
    } catch {
      /* ignore */
    }
  }, [trackerCards])

  useEffect(() => {
    try {
      window.localStorage.setItem(FEEDBACK_CARDS_LS, JSON.stringify(feedbackCards))
    } catch {
      /* ignore */
    }
  }, [feedbackCards])

  useEffect(() => {
    try {
      window.localStorage.setItem(MONTHLY_GOALS_LS, JSON.stringify(monthlyGoals))
    } catch {
      /* ignore */
    }
  }, [monthlyGoals])

  /** 스플래시 후 main 진입 시마다 LS 기준으로 팝업 표시 동기화(초기 state·Strict Mode 꼬임 방지). 테스트 모드에선 비활성. */
  useLayoutEffect(() => {
    if (GOAL_WELCOME_TEST_ALWAYS_ON_RELOAD) return
    if (screen !== 'main') return
    setGoalWelcomeVisible(readGoalWelcomeShouldShow())
  }, [screen])

  /** 1년 목표를 지웠을 때는 다시 ‘초기’ 안내 카드(설정·닫기)부터 보이게 */
  useEffect(() => {
    const has = !!(goalTexts['1y'] ?? '').trim()
    const prev = hadGoal1yTextRef.current
    hadGoal1yTextRef.current = has
    if (!prev || has) return
    setGoal1yMainStrip('tip')
  }, [goalTexts])

  const onGoal1yQuickChange = useCallback((value) => {
    setGoalTexts((prev) => ({ ...prev, '1y': value }))
  }, [])

  const dismissGoalWelcome = useCallback(() => {
    if (!GOAL_WELCOME_TEST_ALWAYS_ON_RELOAD) {
      try {
        window.localStorage.setItem(GOAL_1Y_WELCOME_DONE_KEY, '1')
      } catch {
        /* ignore */
      }
    }
    setGoalWelcomeVisible(false)
  }, [])

  const completeHowToUse = useCallback(() => {
    if (!HOW_TO_USE_TEST_ALWAYS_ON_RELOAD) {
      try {
        window.localStorage.setItem('withworth_tutorial', 'true')
      } catch {
        /* ignore */
      }
    }
    setScreen('main')
  }, [])

  const goToHowToUseAfterOnboarding = useCallback(() => {
    if (HOW_TO_USE_TEST_ALWAYS_ON_RELOAD || !readHowToUseTutorialDone()) {
      setScreen('howToUse')
    }
  }, [])

  const dismissGoalWelcomeAndMaybeHowToUse = useCallback(() => {
    dismissGoalWelcome()
    goToHowToUseAfterOnboarding()
  }, [dismissGoalWelcome, goToHowToUseAfterOnboarding])

  /** 확정: 입력한 1년 목표 유지·카드 접음(비었으면 예시 단계) — 설정에서 바꾸기 전까지 그대로 */
  const confirmGoal1yTip = useCallback(() => {
    const empty = !(goalTexts['1y'] ?? '').trim()
    setGoal1yMainStrip((prev) => {
      if (prev !== 'tip') return prev
      return empty ? 'sample' : 'hidden'
    })
  }, [goalTexts])

  /** 닫기: 트래커 입력만 비우고 예시 단계로 */
  const dismissGoal1yTipToSample = useCallback(() => {
    setGoalTexts((prev) => ({ ...prev, '1y': '' }))
    setGoal1yMainStrip((prev) => (prev === 'tip' ? 'sample' : prev))
  }, [])

  const handleResetApp = useCallback(() => {
    setReferenceImages((prev) => {
      revokeReferenceBlobUrls(prev)
      return []
    })
    setGalleryItems((prev) => {
      revokeGalleryBlobUrls(prev)
      return []
    })
    setAppFeatures({ ...DEFAULT_APP_FEATURES })
    setThemeIndex(DEFAULT_THEME_INDEX)
    setGoalTexts(createEmptyGoalTexts())
    setMonthlyGoals(Array.from({ length: 12 }, () => ''))
    setTrackerCards(createDefaultTrackerCards(t))
    setFeedbackCards([])
    try {
      window.localStorage.removeItem(TRACKER_CARDS_LS)
      window.localStorage.removeItem(TRACKER_STAGE_DONE_LS)
      window.localStorage.removeItem(TRACKER_CARRY_YM_LS)
      window.localStorage.removeItem(MONTHLY_GOALS_LS)
      window.localStorage.removeItem(FEEDBACK_CARDS_LS)
    } catch {
      /* ignore */
    }
    clearLegacyGoalStripKeys()
    try {
      window.localStorage.removeItem('withworth_tutorial')
    } catch {
      /* ignore */
    }
    if (!GOAL_WELCOME_TEST_ALWAYS_ON_RELOAD) {
      try {
        window.localStorage.removeItem(GOAL_1Y_WELCOME_DONE_KEY)
        window.localStorage.removeItem(LEGACY_GOAL_WELCOME_DONE_KEY)
      } catch {
        /* ignore */
      }
    }
    setGoalWelcomeVisible(true)
    setGoal1yMainStrip('tip')
    hadGoal1yTextRef.current = false
    setGalleryPinnedKeys([])
  }, [t])

  /** 갤러리 테스트용: 이미지 한 장 삭제(blob URL 정리 포함) */
  const onRemoveGalleryImage = useCallback((itemId, imageIndex) => {
    setGalleryItems((prev) =>
      prev
        .map((it) => {
          if (it.id !== itemId) return it
          const ent = it.images[imageIndex]
          const url = galleryEntryUrl(ent)
          if (url.startsWith('blob:')) {
            try {
              URL.revokeObjectURL(url)
            } catch {
              /* ignore */
            }
          }
          const nextImages = it.images.filter((_, idx) => idx !== imageIndex)
          if (nextImages.length === 0) return null
          let fi = it.finalImageIndex ?? 0
          if (imageIndex < fi) fi = Math.max(0, fi - 1)
          else if (imageIndex === fi) fi = Math.min(fi, nextImages.length - 1)
          const grouped = it.grouped === true && nextImages.length > 1
          return {
            ...it,
            images: nextImages,
            finalImageIndex: fi,
            grouped,
          }
        })
        .filter((x) => x != null),
    )
  }, [])
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
    const t = window.setTimeout(() => setScreen('main'), 4500)
    return () => window.clearTimeout(t)
  }, [])

  const goal1yEmpty = !(goalTexts['1y'] ?? '').trim()
  const onMain = screen === 'main'
  /** tip: 입력 중에도 카드 유지. sample/hidden 은 비어 있을 때만 예시 등 */
  const showGoal1yTipCard = onMain && goal1yMainStrip === 'tip'
  const showGoal1ySampleFixed = onMain && goal1yEmpty && goal1yMainStrip === 'sample'
  /** 확정 후: 입력 카드 대신 상단에 확정한 1년 목표 문구 고정 표시 */
  const showGoal1yPinned = onMain && !goal1yEmpty && goal1yMainStrip === 'hidden'

  return (
    <div className="device-stage">
      {screen === 'splash' ? (
        <div className="splash splash--fullscreen">
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
                ? (() => {
                    const gatiTightenStart =
                      splashTiming.iMs + SPLASH_POP_MS + SPLASH_GATI_HOLD_MS
                    const gatiTightenEnd = gatiTightenStart + SPLASH_GATI_SPREAD_MS
                    return {
                      ['--splash-sync-i-delay']: `${splashTiming.iMs}ms`,
                      ['--splash-sync-o-delay']: `${splashTiming.oMs}ms`,
                      ['--splash-sync-pop']: `${SPLASH_POP_MS}ms`,
                      ['--splash-gati-spread-ms']: `${SPLASH_GATI_SPREAD_MS}ms`,
                      ['--splash-gati-tighten-delay']: `${gatiTightenStart}ms`,
                      ['--splash-worth-spread-ms']: `${SPLASH_WORTH_SPREAD_MS}ms`,
                      ['--splash-worth-spread-delay']: `${Math.max(
                        splashTiming.oMs,
                        gatiTightenEnd + SPLASH_TAGLINE_AFTER_GATI_MS,
                      )}ms`,
                    }
                  })()
                : {}),
            }}
          >
            <div className="splash-logo-block">
              <AnimatedSplashLogo timing={splashTiming} onMeasured={onSplashMeasured} />
            </div>

            <div className="splash-fade--hug" style={{ display: 'flex', justifyContent: 'center', width: '100%' }}>
              <Wordmark />
            </div>

            <SplashTagline tagline={t.tagline} />
          </div>
        </div>
      ) : (
        <div className="device-frame">
          <div className="device-shell">
        {screen === 'howToUse' ? (
          <HowToUseScreen onComplete={completeHowToUse} />
        ) : screen === 'goal' ? (
          <GoalScreen
            onTabChange={handleAppNav}
            features={appFeatures}
            goalTexts={goalTexts}
            monthlyGoals={monthlyGoals}
            onMonthlyGoalsChange={setMonthlyGoals}
            trackerCards={trackerCards}
          />
        ) : screen === 'reference' ? (
          <ReferenceFolderScreen
            referenceImages={referenceImages}
            onReferenceImagesChange={setReferenceImages}
            onBack={() => setScreen('gallery')}
            onTabChange={handleAppNav}
            features={appFeatures}
          />
        ) : screen === 'gallery' ? (
          <GalleryScreen
            galleryItems={galleryItems}
            onGalleryItemsChange={setGalleryItems}
            onTabChange={handleAppNav}
            onRemoveGalleryImage={onRemoveGalleryImage}
            features={appFeatures}
            galleryPinnedKeys={galleryPinnedKeys}
            onToggleGalleryPin={toggleGalleryPin}
            onPruneGalleryPinsForItemIds={pruneGalleryPinsForItemIds}
            trackerCards={trackerCards}
            onAppendFeedbackCard={appendFeedbackCard}
            onOpenReferenceFolder={() => setScreen('reference')}
          />
        ) : screen === 'setting' ? (
          <SettingScreen
            onTabChange={handleAppNav}
            features={appFeatures}
            onFeaturesChange={setAppFeatures}
            onResetApp={handleResetApp}
            onClearGallery={handleClearGallery}
            themeIndex={themeIndex}
            onThemeIndexChange={setThemeIndex}
            goalTexts={goalTexts}
            onGoalTextsChange={setGoalTexts}
            monthlyGoals={monthlyGoals}
            onMonthlyGoalsChange={setMonthlyGoals}
          />
        ) : (
          <MainTracker
            onTabChange={handleAppNav}
            onAddGalleryItem={appFeatures.gallery ? onAddGalleryItem : undefined}
            onGallerySendComplete={appFeatures.gallery ? showInterstitialAfterGallerySend : undefined}
            trackerBarReplayKey={trackerBarReplayKey}
            features={appFeatures}
            showGoal1yTipCard={showGoal1yTipCard}
            showGoal1ySampleFixed={showGoal1ySampleFixed}
            showGoal1yPinned={showGoal1yPinned}
            onConfirmGoal1yTip={confirmGoal1yTip}
            onDismissGoal1yTip={dismissGoal1yTipToSample}
            goal1yValue={goalTexts['1y'] ?? ''}
            onGoal1yChange={onGoal1yQuickChange}
            monthlyGoals={monthlyGoals}
            trackerCards={trackerCards}
            onTrackerCardsChange={setTrackerCards}
            feedbackCards={feedbackCards}
            onRemoveFeedbackCard={removeFeedbackCard}
            onToggleFeedbackCardConfirmed={toggleFeedbackCardConfirmed}
          />
        )}
          </div>
          {screen === 'main' && goalWelcomeVisible ? (
            <OnboardingScreen
              initialText={goalTexts['1y'] ?? ''}
              onDismiss={dismissGoalWelcomeAndMaybeHowToUse}
              onFinishWithMonthly={(text, months) => {
                setGoalTexts((prev) => ({ ...prev, '1y': text }))
                setMonthlyGoals(months)
                dismissGoalWelcome()
                goToHowToUseAfterOnboarding()
              }}
              onFinishGoalOnly={(text) => {
                setGoalTexts((prev) => ({ ...prev, '1y': text }))
                dismissGoalWelcome()
                goToHowToUseAfterOnboarding()
              }}
            />
          ) : null}
        </div>
      )}
    </div>
  )
}

export default App
