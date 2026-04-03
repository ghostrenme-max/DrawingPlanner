import { ymFromDate } from './trackerMonth.js'

export const TRACKER_SAMPLE_SEED = [
  {
    id: '1',
    displayTag: '메인 일러스트',
    title: '메인 일러스트',
    percent: 0,
    accent: 'orange',
    workFinalized: false,
  },
  {
    id: '2',
    displayTag: '전신/반신',
    title: '전신/반신',
    percent: 0,
    accent: 'teal',
    workFinalized: false,
  },
  {
    id: '3',
    displayTag: 'UI 디자인',
    title: 'UI 디자인',
    percent: 0,
    accent: 'orange',
    workFinalized: false,
  },
]

export function createDefaultTrackerCards() {
  const ym = ymFromDate(new Date())
  return TRACKER_SAMPLE_SEED.map((c) => ({
    ...c,
    barIntroNonce: 0,
    activeMonthYm: ym,
    isKeyCard: false,
    isCarryOver: false,
    workFinalized: Boolean(c.workFinalized),
  }))
}
