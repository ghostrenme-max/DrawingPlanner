import { create } from 'zustand'
import { persist } from 'zustand/middleware'

export const CHASE_PERSIST_KEY = 'worthwith-app-chase-v1'

/** 시드/예전 더미에만 쓰이던 SVG — 실제 레퍼런스 업로드로 치지 않음 */
export const CHASE_SEEDED_PLACEHOLDER_REFERENCE_URI =
  'data:image/svg+xml,' +
  encodeURIComponent(
    `<svg xmlns="http://www.w3.org/2000/svg" width="200" height="260" viewBox="0 0 200 260"><rect fill="#2a2830" width="200" height="260"/><text x="100" y="130" fill="#FB923C" font-family="system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif" font-size="11" font-weight="600" text-anchor="middle">Reference</text></svg>`,
  )

const CHASE_SEEDED_PLACEHOLDER_WORK_URI =
  'data:image/svg+xml,' +
  encodeURIComponent(
    `<svg xmlns="http://www.w3.org/2000/svg" width="200" height="260" viewBox="0 0 200 260"><rect fill="#25232a" width="200" height="260"/><text x="100" y="130" fill="#2DD4BF" font-family="system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif" font-size="11" font-weight="600" text-anchor="middle">My work</text></svg>`,
  )

/** 관찰 단계 통과용: 사용자가 골라 넣은 이미지 URI만 true (빈 값·시드 placeholder 제외) */
export function isUserChaseReferenceImage(uri) {
  const s = String(uri ?? '').trim()
  if (!s) return false
  return s !== CHASE_SEEDED_PLACEHOLDER_REFERENCE_URI
}

const CHASE_SAMPLE_PROJECT_IDS = new Set(['dummy-chase-1', 'dummy-chase-2'])

/**
 * 샘플 카드는 새 따라잡기와 동일: 레퍼런스·관찰·개념을 단계에서 채우도록 초기값만 정리
 * @param {ChaseProjectStored} p
 */
function normalizeSampleChaseProjectForNewFlow(p) {
  if (!CHASE_SAMPLE_PROJECT_IDS.has(p.id)) return p
  let ref = String(p.referenceImageUri ?? '').trim()
  if (!ref || ref === CHASE_SEEDED_PLACEHOLDER_REFERENCE_URI) ref = ''
  return { ...p, referenceImageUri: ref, concepts: [] }
}

function newId(prefix) {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`
}

/**
 * @typedef {'face' | 'hand' | 'bg' | 'body'} ChaseZoneId
 * @typedef {{ id: string; title: string; memo: string; done: boolean; completeMemo: string }} ApplyPlan
 * @typedef {{ zone: ChaseZoneId; concept: string; observation: string; insights: Array<{ kind: string; labels: string[] }>|string[] }} ZoneAnalysis
 * @typedef {{
 *   id: string
 *   chaseProjectId: string
 *   roundNumber: number
 *   myWorkImageUri: string | null
 *   zoneAnalyses: ZoneAnalysis[]
 *   applyPlans: ApplyPlan[]
 *   diffNote: string
 *   completedAt: string | null
 *   resumeFromStep?: number
 * }} ChaseRound
 * @typedef {{
 *   id: string
 *   projectId: string
 *   title: string
 *   referenceImageUri: string
 *   concepts: string[]
 *   firstObservation: string
 *   createdAt: string
 *   rounds: ChaseRound[]
 *   inProgressRound: ChaseRound | null
 * }} ChaseProjectStored
 */

/** @returns {ApplyPlan} */
function emptyPlan() {
  return { id: newId('plan'), title: '', memo: '', done: false, completeMemo: '' }
}

function buildDummyProjects() {
  const p1Id = 'dummy-chase-1'
  const p2Id = 'dummy-chase-2'

  /** @type {ChaseProjectStored} */
  const project1 = {
    id: p1Id,
    projectId: p1Id,
    title: '인물 스터디 — 빛 연습',
    referenceImageUri: '',
    concepts: [],
    firstObservation: '',
    createdAt: new Date(Date.now() - 86400000 * 3).toISOString(),
    rounds: [
      {
        id: 'dummy-r1-1',
        chaseProjectId: p1Id,
        roundNumber: 1,
        myWorkImageUri: CHASE_SEEDED_PLACEHOLDER_WORK_URI,
        zoneAnalyses: [
          {
            zone: 'face',
            concept: '빛과 그림자',
            observation: '코 옆 코어 섀도우가 선명함.',
            insights: ['acc'],
          },
        ],
        applyPlans: [
          {
            id: 'dummy-p1',
            title: '얼굴 분할 면 정리',
            memo: '스케치 단계에서 명암 3단계만',
            done: true,
            completeMemo: '완료',
          },
        ],
        diffNote: '첫 회차라 비교는 다음에.',
        completedAt: new Date(Date.now() - 86400000 * 2).toISOString(),
      },
    ],
    inProgressRound: null,
  }

  /** @type {ChaseProjectStored} */
  const project2 = {
    id: p2Id,
    projectId: p2Id,
    title: '풍경 — 원근과 구도',
    referenceImageUri: '',
    concepts: [],
    firstObservation: '',
    createdAt: new Date(Date.now() - 86400000).toISOString(),
    rounds: [],
    inProgressRound: {
      id: 'dummy-draft',
      chaseProjectId: p2Id,
      roundNumber: 1,
      myWorkImageUri: null,
      zoneAnalyses: [],
      applyPlans: [emptyPlan()],
      diffNote: '',
      completedAt: null,
    },
  }

  return [project1, project2]
}

export const useAppStore = create(
  persist(
    (set, get) => ({
      /** @type {ChaseProjectStored[]} */
      chaseProjects: [],

      chaseDummySeeded: false,

      seedChaseDummyIfEmpty: () => {
        const { chaseProjects, chaseDummySeeded } = get()
        if (chaseDummySeeded || chaseProjects.length > 0) return
        set({ chaseProjects: buildDummyProjects(), chaseDummySeeded: true })
      },

      /** @param {Omit<ChaseProjectStored, 'rounds' | 'inProgressRound'> & { rounds?: ChaseRound[]; inProgressRound?: ChaseRound | null }} p */
      addChaseProject: (p) =>
        set((s) => ({
          chaseProjects: [
            ...s.chaseProjects,
            {
              ...p,
              rounds: p.rounds ?? [],
              inProgressRound: p.inProgressRound ?? null,
            },
          ],
        })),

      /** @param {string} projectId @param {(prev: ChaseProjectStored) => ChaseProjectStored} fn */
      updateChaseProject: (projectId, fn) =>
        set((s) => ({
          chaseProjects: s.chaseProjects.map((x) => (x.id === projectId ? fn(x) : x)),
        })),

      /** @param {string} projectId */
      removeChaseProject: (projectId) =>
        set((s) => ({
          chaseProjects: s.chaseProjects.filter((x) => x.id !== projectId),
        })),

      /** 전체 초기화 후에는 더미를 다시 넣지 않음 */
      resetChaseData: () => set({ chaseProjects: [], chaseDummySeeded: true }),
    }),
    {
      name: CHASE_PERSIST_KEY,
      version: 1,
      migrate: (persistedState, _fromVersion) => {
        if (!persistedState || typeof persistedState !== 'object') return /** @type {any} */ (persistedState)
        const o = /** @type {{ chaseProjects?: ChaseProjectStored[]; chaseDummySeeded?: boolean }} */ (
          persistedState
        )
        const list = Array.isArray(o.chaseProjects) ? o.chaseProjects : []
        return {
          ...o,
          chaseProjects: list.map((p) => normalizeSampleChaseProjectForNewFlow(p)),
        }
      },
    },
  ),
)
