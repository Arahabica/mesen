export const THICKNESS_RATIOS = [0.002, 0.005, 0.01, 0.02, 0.05, 0.1]
export const DEFAULT_THICKNESS_RATIO = 0.01

export function getThicknessOptions(imageWidth: number, imageHeight: number): number[] {
  const maxDimension = Math.max(imageWidth, imageHeight)
  return THICKNESS_RATIOS.map(ratio => Math.round(ratio * maxDimension))
}

export function getDefaultThickness(imageWidth: number, imageHeight: number): number {
  const maxDimension = Math.max(imageWidth, imageHeight)
  return Math.round(DEFAULT_THICKNESS_RATIO * maxDimension)
}

export function getDynamicThickness(
  imageWidth: number, 
  imageHeight: number, 
  targetThickness: number
): number {
  const thicknessOptions = getThicknessOptions(imageWidth, imageHeight)
  
  // Find the largest thickness option that is <= targetThickness
  for (let i = thicknessOptions.length - 1; i >= 0; i--) {
    if (thicknessOptions[i] <= targetThickness) {
      return thicknessOptions[i]
    }
  }
  
  // If all options are larger than target, use the smallest
  return thicknessOptions[0]
}

export const LONG_PRESS_DURATION = 500
export const ADJUST_MODE_DELAY = 200  // 移動モードから調整モードへの遷移時間
export const DRAW_MODE_DELAY = 1000   // 調整モードから描画モードへの遷移時間
export const MAX_SCALE = 5
export const CLICK_DISTANCE_THRESHOLD = 3  // 移動判定を緩めるため3pxに変更
export const PINCH_DISTANCE_THRESHOLD = 7   // ピンチ/パン判定の距離変化閾値
export const PINCH_CENTER_THRESHOLD = 12    // ピンチ/パン判定の中心移動閾値

// 自動太さ計算用の画面幅に対する比率（2%）
export const AUTO_THICKNESS_SCREEN_RATIO = 0.02

// ダブルタップズーム設定
export const DOUBLE_TAP_ZOOM_FACTOR = 2.5   // ダブルタップ時のズーム倍率
export const ZOOM_ANIMATION_DURATION = 200  // ズームアニメーション時間（ms）

// 線の判定範囲設定
export const LINE_HIT_EXPANSION = 25        // 線のタップ判定拡張範囲（px）
export const LINE_ZOOM_EXCLUSION_RADIUS = 100  // 線の周囲でズームを無効化する範囲（px）
