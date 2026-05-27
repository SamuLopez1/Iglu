import {
  FaceLandmarker,
  FilesetResolver,
  type FaceLandmarkerResult,
} from '@mediapipe/tasks-vision';

const MEDIAPIPE_VERSION = '0.10.22';
const WASM_ASSET_BASE_URL = `https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@${MEDIAPIPE_VERSION}/wasm`;
const FACE_LANDMARKER_MODEL_URL =
  'https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/latest/face_landmarker.task';

export class FaceDetectionService {
  private faceLandmarker: FaceLandmarker | null = null;

  async initialize(): Promise<void> {
    if (this.faceLandmarker) {
      return;
    }

    const visionFileset = await FilesetResolver.forVisionTasks(WASM_ASSET_BASE_URL);

    try {
      this.faceLandmarker = await this.createFaceLandmarker(visionFileset, 'GPU');
    } catch {
      this.faceLandmarker = await this.createFaceLandmarker(visionFileset, 'CPU');
    }
  }

  private async createFaceLandmarker(
    visionFileset: Awaited<ReturnType<typeof FilesetResolver.forVisionTasks>>,
    delegate: 'CPU' | 'GPU',
  ): Promise<FaceLandmarker> {
    return FaceLandmarker.createFromOptions(visionFileset, {
      baseOptions: {
        modelAssetPath: FACE_LANDMARKER_MODEL_URL,
        delegate,
      },
      runningMode: 'VIDEO',
      numFaces: 1,
      outputFaceBlendshapes: false,
      outputFacialTransformationMatrixes: true,
    });
  }

  detect(video: HTMLVideoElement, timestampMs: number): FaceLandmarkerResult {
    if (!this.faceLandmarker) {
      throw new Error('Face landmarker has not been initialized.');
    }

    return this.faceLandmarker.detectForVideo(video, timestampMs);
  }

  dispose(): void {
    this.faceLandmarker?.close();
    this.faceLandmarker = null;
  }
}
