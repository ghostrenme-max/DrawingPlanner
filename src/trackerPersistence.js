import { createDefaultTrackerCards } from './trackerCardsDefaults.js'
import { ymFromDate } from './trackerMonth.js'

export const TRACKER_CARDS_LS = 'worthwith_tracker_cards_v1'
/** 트래커 카드별 스테이지 체크 — `${cardId}-${stageId}` → boolean */
export const TRACKER_STAGE_DONE_LS = 'worthwith_tracker_stage_done_v1'
export const TRACKER_CARRY_YM_LS = 'worthwith_tracker_carry_ym_v1'

/**
 * @param {string} key e.g. `n-123-s1`
 * @param {string[]} stageIds e.g. `['s1','s2','s3']`
 * @returns {string | null} cardId
 */
export function cardIdFromStageDoneKey(key, stageIds) {
  for (const sid of stageIds) {
    const suf = `-${sid}`
    if (key.endsWith(suf)) return key.slice(0, -suf.length)
  }
  return null
}

/** @returns {Record<string, boolean>} */
export function loadStageDoneFromStorage() {
  try {
    const raw = localStorage.getItem(TRACKER_STAGE_DONE_LS)
    if (!raw) return {}
    const o = JSON.parse(raw)
    if (!o || typeof o !== 'object' || Array.isArray(o)) return {}
    /** @type {Record<string, boolean>} */
    const out = {}
    for (const [k, v] of Object.entries(o)) {
      if (typeof k === 'string') out[k] = Boolean(v)
    }
    return out
  } catch {
    return {}
  }
}

/** @param {Record<string, boolean>} stageDone */
export function saveStageDoneToStorage(stageDone) {
  try {
    localStorage.setItem(TRACKER_STAGE_DONE_LS, JSON.stringify(stageDone))
  } catch {
    /* ignore */
  }
}
export const MONTHLY_GOALS_LS = 'worthwith_monthly_goals_v1'
export const FEEDBACK_CARDS_LS = 'worthwith_feedback_cards_v1'

/**
 * @returns {Array<{
 *   id: number
 *   text: string
 *   workTitle: string
 *   date: string
 *   type: 'orange' | 'teal'
 *   month: string
 *   previewImageUrl?: string
 *   confirmed?: boolean
 * }>}
 */
export function loadFeedbackCardsFromStorage() {
  try {
    const raw = localStorage.getItem(FEEDBACK_CARDS_LS)
    if (!raw) return []
    const arr = JSON.parse(raw)
    if (!Array.isArray(arr)) return []
    return arr
      .filter((x) => x && typeof x === 'object')
      .map((x) => ({
        id: typeof x.id === 'number' ? x.id : Number(x.id) || Date.now(),
        text: typeof x.text === 'string' ? x.text : '',
        workTitle: typeof x.workTitle === 'string' ? x.workTitle : '',
        date: typeof x.date === 'string' ? x.date : '',
        type: x.type === 'teal' ? 'teal' : 'orange',
        month: typeof x.month === 'string' ? x.month : '',
        previewImageUrl: typeof x.previewImageUrl === 'string' ? x.previewImageUrl : '',
        confirmed: Boolean(x.confirmed),
      }))
  } catch {
    return []
  }
}

export function loadTrackerCardsFromStorage() {
  try {
    const raw = localStorage.getItem(TRACKER_CARDS_LS)
    if (!raw) return createDefaultTrackerCards()
    const arr = JSON.parse(raw)
    if (!Array.isArray(arr) || arr.length === 0) return createDefaultTrackerCards()
    const ym = ymFromDate(new Date())
    return arr.map((c) => ({
      ...c,
      activeMonthYm: typeof c.activeMonthYm === 'string' ? c.activeMonthYm : ym,
      isCarryOver: Boolean(c.isCarryOver),
      isKeyCard: Boolean(c.isKeyCard),
      workFinalized: Boolean(c.workFinalized),
    }))
  } catch {
    return createDefaultTrackerCards()
  }
}

export function loadMonthlyGoalsFromStorage() {
  try {
    const raw = localStorage.getItem(MONTHLY_GOALS_LS)
    if (!raw) return Array.from({ length: 12 }, () => '')
    const a = JSON.parse(raw)
    if (!Array.isArray(a) || a.length !== 12) return Array.from({ length: 12 }, () => '')
    return a.map((x) => (typeof x === 'string' ? x : ''))
  } catch {
    return Array.from({ length: 12 }, () => '')
  }
}

export function readCarryProcessedYm() {
  try {
    return localStorage.getItem(TRACKER_CARRY_YM_LS)
  } catch {
    return null
  }
}

export function writeCarryProcessedYm(ym) {
  try {
    localStorage.setItem(TRACKER_CARRY_YM_LS, ym)
  } catch {
    /* ignore */
  }
}
