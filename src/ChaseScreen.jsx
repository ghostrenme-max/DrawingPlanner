import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Capacitor } from '@capacitor/core'
import {
  NavIconChase,
  NavIconGallery,
  NavIconGoal,
  NavIconSettings,
  NavIconTracker,
} from './bottomNavIcons.jsx'
import {
  CHASE_CONCEPT_OPTIONS,
  CHASE_INSIGHT_KIND_OPTIONS,
  CHASE_STEP_LABELS,
  chaseInsightToneClass,
  normalizeInsightEntries,
} from './chase/constants.js'
import { useLang } from './contexts/LanguageContext.js'
import { useAppStore, isUserChaseReferenceImage } from './stores/appStore.js'
import { pickChaseImageNative } from './utils/chaseImagePicker.js'
import './ChaseScreen.css'

/** @typedef {import('./stores/appStore.js').ChaseProjectStored} ChaseProjectStored */
/** @typedef {import('./stores/appStore.js').ChaseRound} ChaseRound */
/** @typedef {import('./stores/appStore.js').ZoneAnalysis} ZoneAnalysis */
/** @typedef {import('./stores/appStore.js').ApplyPlan} ApplyPlan */

/**
 * 레퍼런스: 빈 URL·로드 실패 시
 * - thumb: 홈 카드만 "no image" (초기 따라잡기 목록)
 * - upload / stage: 박스 안 + (플로우 안에서는 텍스트 대신)
 * @param {{ src: string; alt?: string; imgClassName?: string; fallbackVariant?: 'thumb' | 'upload' | 'stage' }} props
 */
function ChaseReferenceMedia({ src, alt = '', imgClassName = '', fallbackVariant = 'stage' }) {
  const [broken, setBroken] = useState(false)
  useEffect(() => {
    setBroken(false)
  }, [src])
  const mod =
    fallbackVariant === 'thumb'
      ? 'chase-ref-fallback--thumb'
      : fallbackVariant === 'upload'
        ? 'chase-ref-fallback--upload'
        : 'chase-ref-fallback--stage'
  if (!src?.trim() || broken) {
    if (fallbackVariant === 'thumb') {
      return (
        <div className={`chase-ref-fallback ${mod}`} role="img" aria-label="no image">
          <span className="chase-ref-fallback-text">no image</span>
        </div>
      )
    }
    return (
      <div className={`chase-ref-fallback chase-ref-fallback--plus ${mod}`} aria-hidden>
        <span className="chase-ref-fallback-plus">+</span>
      </div>
    )
  }
  return <img className={imgClassName} src={src} alt={alt} onError={() => setBroken(true)} />
}

/**
 * @param {object} props
 * @param {(tab: 'tracker' | 'chase' | 'goal' | 'gallery' | 'settings') => void} [props.onTabChange]
 * @param {{ goalScreen?: boolean; gallery?: boolean }} [props.features]
 */
export default function ChaseScreen({ onTabChange, features = {} }) {
  const { t } = useLang()
  const chaseProjects = useAppStore((s) => s.chaseProjects)
  const seedChaseDummyIfEmpty = useAppStore((s) => s.seedChaseDummyIfEmpty)
  const addChaseProject = useAppStore((s) => s.addChaseProject)
  const updateChaseProject = useAppStore((s) => s.updateChaseProject)
  const removeChaseProject = useAppStore((s) => s.removeChaseProject)

  /** @type {['home' | 'flow', React.Dispatch<React.SetStateAction<'home' | 'flow'>>]} */
  const [view, setView] = useState('home')
  /** @type {[ChaseProjectStored | null, React.Dispatch<React.SetStateAction<ChaseProjectStored | null>>]} */
  const [activeProject, setActiveProject] = useState(null)
  const [step, setStep] = useState(1)
  const [title, setTitle] = useState('')
  const [referenceImageUri, setReferenceImageUri] = useState('')
  const [firstObservation, setFirstObservation] = useState('')
  /** @type {[string[], React.Dispatch<React.SetStateAction<string[]>>]} */
  const [concepts, setConcepts] = useState([])
  /** @type {[ZoneAnalysis[], React.Dispatch<React.SetStateAction<ZoneAnalysis[]>>]} */
  const [zoneAnalyses, setZoneAnalyses] = useState([])
  /** @type {[ApplyPlan[], React.Dispatch<React.SetStateAction<ApplyPlan[]>>]} */
  const [applyPlans, setApplyPlans] = useState([])
  const [roundNumber, setRoundNumber] = useState(1)
  const [myWorkImageUri, setMyWorkImageUri] = useState('')
  const [diffNote, setDiffNote] = useState('')
  const [isNewProject, setIsNewProject] = useState(true)

  const refFileInputRef = useRef(/** @type {HTMLInputElement | null} */ (null))
  const workFileInputRef = useRef(/** @type {HTMLInputElement | null} */ (null))
  const observationTextareaRef = useRef(/** @type {HTMLTextAreaElement | null} */ (null))
  const observationExDismissTsRef = useRef(0)

  /** ex) 반투명 예시 오버레이: 탭/클릭 시 제거 후 textarea 포커스 */
  const [observationExDismissed, setObservationExDismissed] = useState(false)
  /** 헤더 − 로만 태그 추가 — 인사이트 유형 패널 (개념 id) */
  const [insightAddPickerConcept, setInsightAddPickerConcept] = useState(/** @type {string | null} */ (null))

  useEffect(() => {
    seedChaseDummyIfEmpty()
  }, [seedChaseDummyIfEmpty])

  useEffect(() => {
    setInsightAddPickerConcept(null)
  }, [step])

  useEffect(() => {
    if (!insightAddPickerConcept) return undefined
    const close = (e) => {
      const t = /** @type {HTMLElement | null} */ (e.target)
      if (!t) return
      if (t.closest('.chase-insight-type-panel') || t.closest('.chase-insight-add-trigger')) return
      setInsightAddPickerConcept(null)
    }
    document.addEventListener('mousedown', close)
    document.addEventListener('touchstart', close, { passive: true })
    return () => {
      document.removeEventListener('mousedown', close)
      document.removeEventListener('touchstart', close)
    }
  }, [insightAddPickerConcept])

  const resetFlowState = useCallback(() => {
    setStep(1)
    setTitle('')
    setReferenceImageUri('')
    setFirstObservation('')
    setConcepts([])
    setZoneAnalyses([])
    setApplyPlans([])
    setRoundNumber(1)
    setMyWorkImageUri('')
    setDiffNote('')
    setIsNewProject(true)
    setActiveProject(null)
    setObservationExDismissed(false)
  }, [])

  const openNewChase = useCallback(() => {
    resetFlowState()
    setView('flow')
  }, [resetFlowState])

  const openProjectContinue = useCallback(
    (p) => {
      setActiveProject(p)
      setIsNewProject(false)
      setTitle(p.title)
      setReferenceImageUri(p.referenceImageUri)
      setFirstObservation(p.firstObservation)
      setConcepts([...p.concepts])
      setObservationExDismissed(false)

      const draft = p.inProgressRound
      if (draft && draft.completedAt == null) {
        const rs = draft.resumeFromStep
        setRoundNumber(draft.roundNumber)
        setZoneAnalyses(
          draft.zoneAnalyses?.length
            ? normalizeZoneAnalysesForConcepts(draft.zoneAnalyses, p.concepts)
            : buildZoneAnalyses(p.concepts),
        )
        setApplyPlans(
          draft.applyPlans?.length
            ? draft.applyPlans.map((x) => ({ ...x }))
            : [{ id: `plan-${Date.now()}`, title: '', memo: '', done: false, completeMemo: '' }],
        )
        setMyWorkImageUri(draft.myWorkImageUri ?? '')
        setDiffNote(draft.diffNote ?? '')
        /* resumeFromStep 없거나 옛 데이터면 관찰(1)부터. 1~4만 유효 */
        setStep(typeof rs === 'number' && rs >= 1 && rs <= 4 ? rs : 1)
      } else {
        const nextN = (p.rounds?.length ?? 0) + 1
        setRoundNumber(nextN)
        setZoneAnalyses(buildZoneAnalyses(p.concepts))
        setApplyPlans([{ id: `plan-${Date.now()}`, title: '', memo: '', done: false, completeMemo: '' }])
        setMyWorkImageUri('')
        setDiffNote('')
        /* 카드 탭 시 항상 관찰 단계(1)부터 — 회차만 올리고 개념 분석으로 건너뛰지 않음 */
        setStep(1)
      }
      setView('flow')
    },
    [],
  )

  const goHome = useCallback(() => {
    setView('home')
    resetFlowState()
  }, [resetFlowState])

  const observationOk = firstObservation.trim().length >= 5
  const hasReferenceImage = isUserChaseReferenceImage(referenceImageUri)
  const conceptUnlocked = hasReferenceImage && observationOk
  const step1NextOk = conceptUnlocked && concepts.length > 0
  const showRefUploadTooltipBar = observationOk && !hasReferenceImage

  const hasWorkImage = Boolean(myWorkImageUri?.trim())
  const verifyRoundCompleteOk = hasWorkImage && diffNote.trim().length >= 5
  const showVerifyWorkUploadTooltipBar = step === 4 && diffNote.trim().length >= 5 && !hasWorkImage

  const showObservationExOverlay =
    view === 'flow' && step === 1 && !firstObservation.trim() && !observationExDismissed

  const dismissObservationExOverlay = useCallback(() => {
    const now = Date.now()
    if (now - observationExDismissTsRef.current < 400) return
    observationExDismissTsRef.current = now
    setObservationExDismissed(true)
    requestAnimationFrame(() => {
      const el = observationTextareaRef.current
      if (!el) return
      try {
        el.focus({ preventScroll: true })
      } catch {
        el.focus()
      }
    })
  }, [])

  const toggleConcept = (c) => {
    setConcepts((prev) => (prev.includes(c) ? prev.filter((x) => x !== c) : [...prev, c]))
  }

  const onRefFileChange = useCallback((e) => {
    const f = e.target.files?.[0]
    e.target.value = ''
    if (!f?.type?.startsWith('image/')) return
    setReferenceImageUri(URL.createObjectURL(f))
  }, [])

  const onWorkFileChange = useCallback((e) => {
    const f = e.target.files?.[0]
    e.target.value = ''
    if (!f?.type?.startsWith('image/')) return
    setMyWorkImageUri(URL.createObjectURL(f))
  }, [])

  const onPickRef = useCallback(() => {
    if (Capacitor.isNativePlatform()) {
      void (async () => {
        try {
          const uri = await pickChaseImageNative()
          if (uri) setReferenceImageUri(uri)
        } catch {
          /* 사용자 취소 등 */
        }
      })()
    } else {
      refFileInputRef.current?.click()
    }
  }, [])

  const onPickWork = useCallback(() => {
    if (Capacitor.isNativePlatform()) {
      void (async () => {
        try {
          const uri = await pickChaseImageNative()
          if (uri) setMyWorkImageUri(uri)
        } catch {
          /* 사용자 취소 등 */
        }
      })()
    } else {
      workFileInputRef.current?.click()
    }
  }, [])

  const updateAnalysis = useCallback((concept, patch) => {
    setZoneAnalyses((list) =>
      list.map((row) => (row.concept === concept ? { ...row, ...patch } : row)),
    )
  }, [])

  const addInsight = useCallback((concept, accKey) => {
    setZoneAnalyses((list) =>
      list.map((row) => {
        if (row.concept !== concept) return row
        const entries = normalizeInsightEntries(row.insights)
        return { ...row, insights: [...entries, { kind: accKey, labels: [] }] }
      }),
    )
  }, [])

  const removeInsightEntry = useCallback((concept, removeIdx) => {
    setZoneAnalyses((list) =>
      list.map((row) => {
        if (row.concept !== concept) return row
        const entries = normalizeInsightEntries(row.insights)
        const next = entries.filter((_, i) => i !== removeIdx)
        return { ...row, insights: next }
      }),
    )
  }, [])

  const onStep1Next = () => {
    if (
      !isUserChaseReferenceImage(referenceImageUri) ||
      firstObservation.trim().length < 5 ||
      concepts.length === 0
    ) {
      return
    }
    const now = new Date().toISOString()
    const autoTitle = title.trim() || '새 따라잡기'
    if (isNewProject || !activeProject) {
      const id = `chase-${Date.now()}`
      const proj = {
        id,
        projectId: id,
        title: autoTitle,
        referenceImageUri,
        concepts: [...concepts],
        firstObservation: firstObservation.trim(),
        createdAt: now,
        rounds: [],
        inProgressRound: null,
      }
      addChaseProject(proj)
      setActiveProject(proj)
      setIsNewProject(false)
      setTitle(autoTitle)
    } else {
      updateChaseProject(activeProject.id, (prev) => ({
        ...prev,
        title: autoTitle,
        referenceImageUri,
        concepts: [...concepts],
        firstObservation: firstObservation.trim(),
      }))
      setActiveProject((p) =>
        p
          ? {
              ...p,
              title: autoTitle,
              referenceImageUri,
              concepts: [...concepts],
              firstObservation: firstObservation.trim(),
            }
          : p,
      )
    }
    setZoneAnalyses(buildZoneAnalyses(concepts))
    if (applyPlans.length === 0) {
      setApplyPlans([{ id: `plan-${Date.now()}`, title: '', memo: '', done: false, completeMemo: '' }])
    }
    setStep(2)
  }

  const onStep2Next = () => {
    setStep(3)
  }

  const onStep3Next = () => {
    setStep(4)
  }

  const persistDraft = useCallback(
    (resumeFromStep, projectOverride) => {
      const proj = projectOverride ?? activeProject
      if (!proj) return
      const draft = /** @type {ChaseRound} */ ({
        id: proj.inProgressRound?.id ?? `round-${Date.now()}`,
        chaseProjectId: proj.id,
        roundNumber,
        myWorkImageUri: myWorkImageUri || null,
        zoneAnalyses: zoneAnalyses.map((z) => ({ ...z, insights: [...z.insights] })),
        applyPlans: applyPlans.map((p) => ({ ...p })),
        diffNote: diffNote.trim(),
        completedAt: null,
        resumeFromStep,
      })
      updateChaseProject(proj.id, (prev) => ({
        ...prev,
        inProgressRound: draft,
      }))
    },
    [activeProject, applyPlans, diffNote, myWorkImageUri, roundNumber, updateChaseProject, zoneAnalyses],
  )

  const saveLater = () => {
    if (!activeProject) return
    persistDraft(step)
    goHome()
  }

  const onCompleteRound = () => {
    if (diffNote.trim().length < 5 || !myWorkImageUri?.trim() || !activeProject) return
    const round = /** @type {ChaseRound} */ ({
      id: activeProject.inProgressRound?.id ?? `round-${Date.now()}`,
      chaseProjectId: activeProject.id,
      roundNumber,
      myWorkImageUri: myWorkImageUri || null,
      zoneAnalyses: zoneAnalyses.map((z) => ({ ...z, insights: [...z.insights] })),
      applyPlans: applyPlans.map((p) => ({ ...p })),
      diffNote: diffNote.trim(),
      completedAt: new Date().toISOString(),
    })
    updateChaseProject(activeProject.id, (prev) => ({
      ...prev,
      rounds: [...prev.rounds.filter((r) => r.id !== round.id), round],
      inProgressRound: null,
    }))
    goHome()
  }

  const prevRoundWorkUri = useMemo(() => {
    if (!activeProject || roundNumber < 2) return ''
    const prev = activeProject.rounds.filter((r) => r.roundNumber === roundNumber - 1 && r.completedAt)
    const last = prev[0]
    return last?.myWorkImageUri ?? ''
  }, [activeProject, roundNumber])

  const insightKindLabel = (k) => {
    if (k === 'acc2') return '디테일'
    if (k === 'acc3') return '리마인드'
    if (k === 'acc') return '핵심'
    return k
  }

  const renderProgress = () => (
    <div className="chase-progress" role="navigation" aria-label="따라잡기 단계">
      {CHASE_STEP_LABELS.map((label, i) => {
        const n = i + 1
        const done = n < step
        const active = n === step
        return (
          <div
            key={label}
            className={[
              'chase-progress-step',
              done ? 'chase-progress-step--done' : '',
              active ? 'chase-progress-step--active' : '',
            ]
              .filter(Boolean)
              .join(' ')}
          >
            {label}
          </div>
        )
      })}
    </div>
  )

  const renderNav = () => (
    <nav className="goal-nav" aria-label={t.common.bottomNavAria}>
      <button type="button" className="goal-nav-item" onClick={() => onTabChange?.('tracker')}>
        <span className="goal-nav-icon" aria-hidden>
          <NavIconTracker />
        </span>
        {t.nav.tracker}
      </button>
      <button type="button" className="goal-nav-item goal-nav-item--active">
        <span className="goal-nav-icon" aria-hidden>
          <NavIconChase />
        </span>
        {t.nav.chase}
      </button>
      {features.goalScreen ? (
        <button type="button" className="goal-nav-item" onClick={() => onTabChange?.('goal')}>
          <span className="goal-nav-icon" aria-hidden>
            <NavIconGoal />
          </span>
          {t.nav.goal}
        </button>
      ) : null}
      {features.gallery ? (
        <button type="button" className="goal-nav-item" onClick={() => onTabChange?.('gallery')}>
          <span className="goal-nav-icon" aria-hidden>
            <NavIconGallery />
          </span>
          {t.nav.gallery}
        </button>
      ) : null}
      <button type="button" className="goal-nav-item" onClick={() => onTabChange?.('settings')}>
        <span className="goal-nav-icon" aria-hidden>
          <NavIconSettings />
        </span>
        {t.nav.setting}
      </button>
    </nav>
  )

  const hiddenFileInputs = (
    <>
      <input
        ref={refFileInputRef}
        type="file"
        accept="image/*"
        className="chase-visually-hidden"
        aria-hidden
        tabIndex={-1}
        onChange={onRefFileChange}
      />
      <input
        ref={workFileInputRef}
        type="file"
        accept="image/*"
        className="chase-visually-hidden"
        aria-hidden
        tabIndex={-1}
        onChange={onWorkFileChange}
      />
    </>
  )

  if (view === 'home') {
    return (
      <div className="chase-screen">
        {hiddenFileInputs}
        <main className="chase-main">
          <h1 className="chase-title">개념을 따라잡아요</h1>
          <p className="chase-sub">레퍼런스 → 관찰·분석 → 적용 → 검증</p>
          {chaseProjects.map((p) => {
            const lastRound = p.rounds[p.rounds.length - 1]
            const draft = p.inProgressRound
            const stepHint = draft?.completedAt == null && draft?.resumeFromStep ? draft.resumeFromStep : null
            const progressStep = stepHint ?? (lastRound ? 4 : draft ? 2 : 1)
            const pct = Math.min(100, (progressStep / 4) * 100)
            const obsCount = p.firstObservation.trim() ? 1 : 0
            const planCount = (draft?.applyPlans ?? lastRound?.applyPlans ?? []).length
            const roundCount = p.rounds.length + (draft && !draft.completedAt ? 1 : 0)
            return (
              <div key={p.id} className="chase-card-wrap">
                <button
                  type="button"
                  className="chase-card-remove"
                  aria-label={t.chase.removeCardAria}
                  onClick={(e) => {
                    e.stopPropagation()
                    removeChaseProject(p.id)
                  }}
                >
                  <span className="chase-card-remove-x" aria-hidden>
                    ×
                  </span>
                </button>
                <button type="button" className="chase-card" onClick={() => openProjectContinue(p)}>
                  <ChaseReferenceMedia
                    src={p.referenceImageUri}
                    alt=""
                    imgClassName="chase-card-thumb"
                    fallbackVariant="thumb"
                  />
                  <div className="chase-card-body">
                    <div className="chase-card-title">{p.title}</div>
                    <div className="chase-card-tags">
                      {p.concepts.slice(0, 4).map((c) => (
                        <span key={c} className="chase-tag">
                          {c}
                        </span>
                      ))}
                    </div>
                    <div className="chase-card-meta">
                      {chaseCardPhaseLabel(progressStep)} · {chaseRoundProgressLabel(roundCount)}
                    </div>
                    <div className="chase-card-bar">
                      <span style={{ width: `${pct}%` }} />
                    </div>
                    <div className="chase-stat-row">
                      <span>{obsCount ? '관찰 메모 있음' : '관찰 전'}</span>
                      <span>{chasePlanLinesLabel(planCount)}</span>
                      <span>{chaseChallengeBreathLabel(roundCount)}</span>
                    </div>
                  </div>
                </button>
              </div>
            )
          })}
          <button type="button" className="chase-new-btn" onClick={openNewChase}>
            + 새 따라잡기 시작
          </button>
        </main>
        {renderNav()}
      </div>
    )
  }

  /* ——— Flow steps ——— */
  return (
    <div className="chase-screen">
      {hiddenFileInputs}
      <main className="chase-main">
        {renderProgress()}
        <button type="button" className="chase-back" onClick={() => (step === 1 ? goHome() : setStep((s) => s - 1))}>
          {t.common.back}
        </button>

        {step === 1 ? (
          <>
            <p className="chase-label">레퍼런스 이미지</p>
            <button type="button" className="chase-upload" onClick={onPickRef} aria-label="레퍼런스 이미지 선택">
              <ChaseReferenceMedia
                src={referenceImageUri}
                alt="레퍼런스"
                imgClassName="chase-upload-preview"
                fallbackVariant="upload"
              />
            </button>
            {showRefUploadTooltipBar ? (
              <div className="chase-ref-upload-tooltip-bar" role="status" aria-live="polite">
                {t.chase.refUploadTooltipBar}
              </div>
            ) : null}
            <p className="chase-label">이 그림에서 제일 먼저 눈에 들어오는 게 뭐야?</p>
            <p className="chase-hint">직접 써야 다음 단계로 넘어갈 수 있어요</p>
            <div className="chase-observation-wrap">
              <textarea
                ref={observationTextareaRef}
                className="chase-textarea"
                value={firstObservation}
                onChange={(e) => setFirstObservation(e.target.value)}
                placeholder={showObservationExOverlay ? '' : '관찰을 적어주세요'}
                aria-label="첫 관찰 입력"
                tabIndex={showObservationExOverlay ? -1 : undefined}
              />
              {showObservationExOverlay ? (
                <button
                  type="button"
                  className="chase-observation-ex-overlay"
                  onClick={(e) => {
                    e.preventDefault()
                    dismissObservationExOverlay()
                  }}
                  onTouchEnd={(e) => {
                    e.preventDefault()
                    dismissObservationExOverlay()
                  }}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault()
                      dismissObservationExOverlay()
                    }
                  }}
                  aria-label="예시 닫고 관찰 입력"
                >
                  <span className="chase-observation-ex-overlay-text">
                    <span className="chase-observation-ex-prefix">ex)</span>
                    <span className="chase-observation-ex-sample">
                      {' '}
                      먼저 눈에 들어오는 건 얼굴 윤곽 같은 거 같아요 ~
                    </span>
                  </span>
                </button>
              ) : null}
            </div>
            <div className="chase-concept-wrap">
              {!conceptUnlocked ? (
                <div className="chase-lock-overlay">관찰을 다섯 글자 이상 적으면 개념 선택이 열려요</div>
              ) : null}
              <p className="chase-label">개념 선택 (복수)</p>
              <div className="chase-concept-grid">
                {CHASE_CONCEPT_OPTIONS.map((c) => (
                  <button
                    key={c}
                    type="button"
                    className={`chase-concept-btn${concepts.includes(c) ? ' chase-concept-btn--on' : ''}`}
                    onClick={() => conceptUnlocked && toggleConcept(c)}
                    disabled={!conceptUnlocked}
                  >
                    {concepts.includes(c) ? '✓ ' : ''}
                    {c}
                  </button>
                ))}
              </div>
            </div>
            <div className="chase-actions">
              <button type="button" className="chase-btn chase-btn--primary" disabled={!step1NextOk} onClick={onStep1Next}>
                다음
              </button>
            </div>
          </>
        ) : null}

        {step === 2 ? (
          <>
            <p className="chase-label">개념별 분석</p>
            <p className="chase-hint">선택한 개념마다 레퍼런스에서 배울 점을 적어요</p>
            <div className="chase-ref-preview">
              <ChaseReferenceMedia
                src={referenceImageUri}
                alt="레퍼런스"
                imgClassName="chase-ref-stage-img"
                fallbackVariant="stage"
              />
            </div>
            {concepts.map((concept) => {
              const row = zoneAnalyses.find((a) => a.concept === concept)
              if (!row) return null
              const insightEntries = normalizeInsightEntries(row.insights)
              const addPickerOpen = insightAddPickerConcept === concept
              return (
                <div key={concept} style={{ marginBottom: 16 }}>
                  <div className="chase-insight-row">
                    <div className="chase-insight-row-header">
                      <span className="chase-hint chase-insight-row-title">인사이트 태그</span>
                      <button
                        type="button"
                        className={`chase-insight-label-trigger chase-insight-add-trigger chase-insight-label-trigger--header${addPickerOpen ? ' chase-insight-label-trigger--open' : ''}`}
                        aria-expanded={addPickerOpen}
                        aria-label="인사이트 태그 추가"
                        onClick={() => setInsightAddPickerConcept(addPickerOpen ? null : concept)}
                      >
                        −
                      </button>
                    </div>
                    {addPickerOpen ? (
                      <div className="chase-insight-type-panel" role="group" aria-label="인사이트 유형">
                        {CHASE_INSIGHT_KIND_OPTIONS.map(({ kind, label }) => (
                          <button
                            key={kind}
                            type="button"
                            className={`chase-insight-type-btn ${chaseInsightToneClass(kind)}`}
                            onClick={() => {
                              addInsight(concept, kind)
                              setInsightAddPickerConcept(null)
                            }}
                          >
                            + {label}
                          </button>
                        ))}
                      </div>
                    ) : null}
                    <div className="chase-insight-tags-only">
                      {insightEntries.map((entry, idx) => (
                        <button
                          key={`${entry.kind}-${idx}`}
                          type="button"
                          className={`chase-insight-chip chase-insight-chip--tag ${chaseInsightToneClass(entry.kind)}`}
                          aria-label={`${insightKindLabel(entry.kind)} 태그 제거`}
                          onClick={() => removeInsightEntry(concept, idx)}
                        >
                          {insightKindLabel(entry.kind)}
                        </button>
                      ))}
                    </div>
                  </div>
                  <p className="chase-label">「{concept}」 관점으로 뭘 배울 수 있어?</p>
                  <textarea
                    className="chase-textarea"
                    value={row.observation}
                    onChange={(e) => updateAnalysis(concept, { observation: e.target.value })}
                  />
                </div>
              )
            })}
            <div className="chase-actions">
              <button type="button" className="chase-btn chase-btn--ghost" onClick={saveLater}>
                나중에 완료하기
              </button>
              <button type="button" className="chase-btn chase-btn--primary" onClick={onStep2Next}>
                다음
              </button>
            </div>
          </>
        ) : null}

        {step === 3 ? (
          <>
            <p className="chase-label">적용 계획</p>
            <p className="chase-hint">분석을 바탕으로 실행 항목을 정리해요</p>
            {applyPlans.map((plan, idx) => (
              <div key={plan.id} className={`chase-plan${plan.done ? ' chase-plan--done' : ''}`}>
                <input
                  type="checkbox"
                  className="chase-plan-check"
                  checked={plan.done}
                  onChange={() => {
                    setApplyPlans((list) =>
                      list.map((p, i) => (i === idx ? { ...p, done: !p.done } : p)),
                    )
                  }}
                />
                <div className="chase-plan-fields">
                  <input
                    type="text"
                    placeholder="제목"
                    value={plan.title}
                    onChange={(e) => {
                      const v = e.target.value
                      setApplyPlans((list) => list.map((p, i) => (i === idx ? { ...p, title: v } : p)))
                    }}
                  />
                  <textarea
                    className="chase-textarea"
                    style={{ minHeight: 56 }}
                    placeholder="메모"
                    value={plan.memo}
                    onChange={(e) => {
                      const v = e.target.value
                      setApplyPlans((list) => list.map((p, i) => (i === idx ? { ...p, memo: v } : p)))
                    }}
                  />
                  {plan.done ? (
                    <textarea
                      className="chase-textarea"
                      style={{ minHeight: 48 }}
                      placeholder="완료 메모"
                      value={plan.completeMemo}
                      onChange={(e) => {
                        const v = e.target.value
                        setApplyPlans((list) => list.map((p, i) => (i === idx ? { ...p, completeMemo: v } : p)))
                      }}
                    />
                  ) : null}
                </div>
              </div>
            ))}
            <button
              type="button"
              className="chase-add-plan"
              onClick={() =>
                setApplyPlans((list) => [
                  ...list,
                  { id: `plan-${Date.now()}`, title: '', memo: '', done: false, completeMemo: '' },
                ])
              }
            >
              + 적용 계획 추가
            </button>
            <div className="chase-actions">
              <button type="button" className="chase-btn chase-btn--ghost" onClick={saveLater}>
                나중에 완료하기
              </button>
              <button type="button" className="chase-btn chase-btn--primary" onClick={onStep3Next}>
                다음
              </button>
            </div>
          </>
        ) : null}

        {step === 4 ? (
          <>
            <p className="chase-label">내 작업물</p>
            <div className="chase-verify-work-picker">
              <button
                type="button"
                className="chase-verify-work-gallery"
                onClick={onPickWork}
                aria-label={t.common.imageAddAria}
              >
                <NavIconGallery className="chase-verify-work-gallery-svg" />
              </button>
            </div>
            {showVerifyWorkUploadTooltipBar ? (
              <div className="chase-ref-upload-tooltip-bar" role="status" aria-live="polite">
                {t.chase.workUploadTooltipBar}
              </div>
            ) : null}
            {roundNumber >= 2 ? (
              <>
                <p className="chase-label">회차 비교</p>
                <div className="chase-compare-grid">
                  <div className="chase-compare-cell">
                    <span>이전 회차</span>
                    {prevRoundWorkUri ? (
                      <img src={prevRoundWorkUri} alt="" />
                    ) : (
                      <div className="chase-compare-placeholder">이미지 없음</div>
                    )}
                  </div>
                  <div className="chase-compare-cell">
                    <span>이번 회차</span>
                    {myWorkImageUri ? (
                      <img src={myWorkImageUri} alt="" />
                    ) : (
                      <div className="chase-compare-placeholder">업로드 전</div>
                    )}
                  </div>
                </div>
              </>
            ) : null}
            <p className="chase-label">뭐가 달라졌어?</p>
            <p className="chase-hint">
              {roundNumber >= 2
                ? '지난 회차와 비교해 달라진 점을 한 줄 적어야 이번 회차가 완료돼요'
                : '이번 연습 소감을 다섯 글자 이상 적어야 회차가 완료돼요'}
            </p>
            <textarea
              className="chase-textarea"
              value={diffNote}
              onChange={(e) => setDiffNote(e.target.value)}
              placeholder={roundNumber >= 2 ? '이전 회차 대비 변화를 적어주세요' : '이번 연습에서 느낀 점을 적어주세요'}
            />
            <p className="chase-label">성장 일지</p>
            <div className="chase-timeline">
              {[...(activeProject?.rounds ?? [])]
                .filter((r) => r.completedAt && r.myWorkImageUri)
                .sort((a, b) => a.roundNumber - b.roundNumber)
                .map((r) => (
                  <div key={r.id} className="chase-tl-item">
                    <div className="chase-tl-r">{chaseRoundOrdinalLabel(r.roundNumber)}</div>
                    <img src={r.myWorkImageUri ?? ''} alt="" />
                    <p className="chase-tl-note">{r.diffNote || '—'}</p>
                  </div>
                ))}
            </div>
            <div className="chase-actions">
              <button type="button" className="chase-btn chase-btn--ghost" onClick={saveLater}>
                나중에 완료하기
              </button>
              <button
                type="button"
                className="chase-btn chase-btn--teal"
                disabled={!verifyRoundCompleteOk}
                onClick={onCompleteRound}
              >
                회차 완료
              </button>
            </div>
          </>
        ) : null}
      </main>
      {renderNav()}
    </div>
  )
}

const CHASE_CARD_PHASE = ['관찰 단계', '개념·분석 단계', '적용 계획 단계', '검증 단계']

/** @param {number} step 1..4 */
function chaseCardPhaseLabel(step) {
  return CHASE_CARD_PHASE[Math.min(Math.max(step, 1), 4) - 1] ?? '진행 중'
}

/** 누적 회차 수(진행 중 포함) */
function chaseRoundProgressLabel(total) {
  if (total <= 0) return '아직 회차 없음'
  const w = ['첫', '두', '세', '네', '다섯', '여섯', '일곱', '여덟', '아홉', '열']
  if (total <= w.length) return `${w[total - 1]} 번째 회차까지`
  return '열 번 넘게 도전 중'
}

/** 적용 계획 줄 수 */
function chasePlanLinesLabel(n) {
  if (n <= 0) return '계획 항목 없음'
  const w = ['', '한', '두', '세', '네', '다섯', '여섯', '일곱', '여덟', '아홉', '열']
  if (n < w.length) return `계획 ${w[n]} 줄`
  return '계획 여러 줄'
}

/** 도전 횟수 뉘앙스 */
function chaseChallengeBreathLabel(total) {
  if (total <= 0) return '도전 전'
  const w = ['첫', '두', '세', '네', '다섯', '여섯', '일곱', '여덟', '아홉', '열']
  if (total <= w.length) return `${w[total - 1]} 번째 도전`
  return '여러 번 도전 중'
}

/** 타임라인 회차 머리말 */
function chaseRoundOrdinalLabel(roundNumber) {
  const w = ['첫', '두', '세', '네', '다섯', '여섯', '일곱', '여덟', '아홉', '열']
  if (roundNumber >= 1 && roundNumber <= w.length) return `${w[roundNumber - 1]} 회차`
  return '이어진 회차'
}

/** 스키마 호환용 zone; UI에서는 부위 구분 없음 */
const CHASE_ZONE_PLACEHOLDER = /** @type {const} */ ('face')

/** @param {string[]} concepts */
function buildZoneAnalyses(concepts) {
  return concepts.map((c) => ({
    zone: CHASE_ZONE_PLACEHOLDER,
    concept: c,
    observation: '',
    insights: [],
  }))
}

/**
 * 예전 부위별 행이 있으면 개념당 한 행으로 합침.
 * @param {ZoneAnalysis[]|undefined} existing
 * @param {string[]} concepts
 */
function normalizeZoneAnalysesForConcepts(existing, concepts) {
  /** @type {ZoneAnalysis[]} */
  const out = []
  for (const c of concepts) {
    const rows = (existing ?? []).filter((a) => a.concept === c)
    if (rows.length === 0) {
      out.push({ zone: CHASE_ZONE_PLACEHOLDER, concept: c, observation: '', insights: [] })
      continue
    }
    let obs = ''
    /** @type {ReturnType<typeof normalizeInsightEntries>} */
    const ins = []
    for (const r of rows) {
      if ((r.observation ?? '').trim().length > obs.trim().length) obs = r.observation ?? ''
      ins.push(...normalizeInsightEntries(r.insights ?? []))
    }
    out.push({ zone: CHASE_ZONE_PLACEHOLDER, concept: c, observation: obs, insights: ins })
  }
  return out
}
