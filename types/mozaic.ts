export interface Rectangle {
  start: { x: number; y: number }
  end: { x: number; y: number }
}

export interface MozaicArea extends Rectangle {
  id: string
}