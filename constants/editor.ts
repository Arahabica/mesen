export const THICKNESS_RATIOS = [0.003, 0.005, 0.01, 0.02, 0.05, 0.1]
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
export const MIN_SCALE = 0.1
export const CLICK_DISTANCE_THRESHOLD = 5
export const PINCH_DISTANCE_THRESHOLD = 7   // ピンチ/パン判定の距離変化閾値
export const PINCH_CENTER_THRESHOLD = 12    // ピンチ/パン判定の中心移動閾値