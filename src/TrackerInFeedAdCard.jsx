import { useEffect, useRef } from 'react'

/** Google 테스트 네이티브 광고 단위 — 네이티브 렌더는 별도 브릿지/플러그인 연동 시 이 슬롯에 붙이면 됨 */
export const TRACKER_INFEED_NATIVE_TEST_AD_ID = 'ca-app-pub-3940256099942544/2247696110'

/**
 * 트래커 스크롤 인피드 광고 카드 (@capacitor-community/admob 는 Native Advanced 미지원 → DOM 슬롯만 제공)
 * @param {{ slotKey: string | number }} props
 */
export function TrackerInFeedAdCard({ slotKey }) {
  const hostRef = useRef(/** @type {HTMLDivElement | null} */ (null))

  useEffect(() => {
    const el = hostRef.current
    if (!el) return
    el.dataset.adUnitId = TRACKER_INFEED_NATIVE_TEST_AD_ID
    el.dataset.slotKey = String(slotKey)
  }, [slotKey])

  return (
    <div className="mt-infeed-ad-card" role="complementary" aria-label="Advertisement">
      <span className="mt-infeed-ad-label">AD</span>
      <div ref={hostRef} className="mt-infeed-ad-native-host" />
    </div>
  )
}
