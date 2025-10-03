export type TooltipType = 'reset' | 'thickness' | 'undo' | 'download' | 'ai'

export class TooltipStateManager {
  private shownTooltips = new Set<TooltipType>()

  shouldShow(type: TooltipType): boolean {
    return !this.shownTooltips.has(type)
  }

  requestShow(type: TooltipType): boolean {
    if (!this.shouldShow(type)) {
      return false
    }
    this.shownTooltips.add(type)
    return true
  }

  markShown(type: TooltipType): void {
    this.shownTooltips.add(type)
  }

  reset(type?: TooltipType): void {
    if (type) {
      this.shownTooltips.delete(type)
    } else {
      this.shownTooltips.clear()
    }
  }
}
