export interface Eye {
  x: number;
  y: number;
}

export interface Face {
  eyes: Eye[];
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface FaceDetectorOptions {
  maxFaces?: number;
  minDetectionConfidence?: number;
  debug?: boolean;
}

export interface FaceDetector {
  detect(blob: Blob): Promise<Face[]>;
  dispose(): Promise<void>;
}
