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
  landmarks?: Eye[];
}

export interface FaceDetectorOptions {
  maxFaces?: number;
  minDetectionConfidence?: number;
  debug?: boolean;
  modelBasePath?: string;
  inputSize?: number;
  inputSizes?: number[];
  minFaceAreaRatio?: number;
  mergeIoUThreshold?: number;
}

export interface FaceDetector {
  detect(blob: Blob): Promise<Face[]>;
  dispose(): Promise<void>;
}
