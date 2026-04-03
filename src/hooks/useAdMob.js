import { useCallback, useEffect, useRef } from 'react'
import { Capacitor } from '@capacitor/core'
import { AdMob, BannerAdPosition, BannerAdSize } from '@capacitor-community/admob'

const TEST_BANNER_ID = 'ca-app-pub-3940256099942544/6300978111'
const TEST_INTERSTITIAL_ID = 'ca-app-pub-3940256099942544/1033173712'

/** 하단 탭 전환: 매번 1/6 확률, 6번 연속 미적중 시 강제 1회 */
const NAV_INTERSTITIAL_WINDOW = 6
const NAV_INTERSTITIAL_CHANCE = 1 / 6

let initializePromise = null

/**
 * AdMob SDK 초기화 (네이티브에서 한 번만)
 * @returns {Promise<void>}
 */
export function initialize() {
  if (!Capacitor.isNativePlatform()) return Promise.resolve()
  if (!initializePromise) {
    initializePromise = AdMob.initialize({
      testingDevices: ['EMULATOR'],
      initializeForTesting: true,
    }).catch((e) => {
      initializePromise = null
      throw e
    })
  }
  return initializePromise
}

/**
 * 갤러리·설정: 헤더 아래 상단 배너
 * @param {number} [marginTop=0] 헤더 높이(px) — 플러그인이 density로 변환
 */
export async function showBanner(marginTop = 0) {
  if (!Capacitor.isNativePlatform()) return
  try {
    await initialize()
    await AdMob.showBanner({
      adId: TEST_BANNER_ID,
      adSize: BannerAdSize.BANNER,
      position: BannerAdPosition.TOP_CENTER,
      margin: Math.max(0, Math.round(marginTop)),
      isTesting: true,
    })
  } catch (e) {
    console.warn('[AdMob] showBanner', e)
  }
}

/**
 * 갤러리·설정 이탈 또는 이번 방문 미노출 시 배너 정리.
 * Android: `hideBanner()`만 쓰면 뷰가 GONE으로 남고, 다음 `showBanner()`가
 * 기존 AdView에 loadAd만 해서 화면에 다시 안 나오는 플러그인 동작이 있음 → `removeBanner`로 제거.
 */
export async function hideBanner() {
  if (!Capacitor.isNativePlatform()) return
  try {
    await AdMob.removeBanner()
  } catch (e) {
    console.warn('[AdMob] removeBanner', e)
  }
}

/** 갤러리·설정 탭 진입마다 독립 시행 — 몇 번째 진입인지와 무관하게 약 1/3만 배너 */
const BANNER_SHOW_CHANCE = 1 / 3

/** 컴포넌트 마운트 시 한 번만 호출해 `useState` 초기값 등에 사용 */
export function shouldShowBannerOnThisTabVisit() {
  return Math.random() < BANNER_SHOW_CHANCE
}

/**
 * @param {{ adsEnabled?: boolean }} opts — false면 초기화 생략(예: 웹 스플래시 구간)
 */
export function useAdMob(opts = {}) {
  const { adsEnabled = true } = opts
  const navMovesSinceLastInterstitialRef = useRef(0)

  useEffect(() => {
    if (!Capacitor.isNativePlatform()) return undefined
    if (!adsEnabled) return undefined

    let cancelled = false
    async function run() {
      try {
        await initialize()
      } catch (e) {
        if (!cancelled) console.warn('[AdMob] init', e)
      }
    }
    void run()
    return () => {
      cancelled = true
    }
  }, [adsEnabled])

  const showInterstitial = useCallback(async () => {
    if (!Capacitor.isNativePlatform()) return
    try {
      await initialize()
      await AdMob.prepareInterstitial({
        adId: TEST_INTERSTITIAL_ID,
        isTesting: true,
      })
      await AdMob.showInterstitial()
    } catch (e) {
      console.warn('[AdMob] interstitial', e)
    }
  }, [])

  /** 트래커 → 갤러리 보내기 성공할 때마다 */
  const showInterstitialAfterGallerySend = useCallback(async () => {
    await showInterstitial()
  }, [showInterstitial])

  /**
   * 실제 화면이 바뀐 하단 탭 전환 1회마다 호출.
   * 독립 시행 1/6 또는 누적 6회 미적중 시 전면 (그 안에 반드시 1번)
   */
  const maybeShowInterstitialAfterBottomNavMove = useCallback(() => {
    if (!Capacitor.isNativePlatform()) return
    navMovesSinceLastInterstitialRef.current += 1
    const m = navMovesSinceLastInterstitialRef.current
    const lucky = Math.random() < NAV_INTERSTITIAL_CHANCE
    const mustShowWithinWindow = m >= NAV_INTERSTITIAL_WINDOW
    if (!lucky && !mustShowWithinWindow) return
    navMovesSinceLastInterstitialRef.current = 0
    void showInterstitial()
  }, [showInterstitial])

  return { showInterstitialAfterGallerySend, maybeShowInterstitialAfterBottomNavMove }
}
