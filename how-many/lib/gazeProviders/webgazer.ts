import { WEBGAZER_FACEMESH_PATH } from "../../config/experiment";
import type { GazeProvider } from "../gazeProvider";

interface WebGazerLike {
  params: Record<string, unknown>;
  setRegression(name: string): unknown;
  setGazeListener(cb: (data: { x: number; y: number } | null, elapsed: number) => void): unknown;
  begin(onFail?: () => void): unknown;
  end(): unknown;
  showVideoPreview(show: boolean): unknown;
  showPredictionPoints(show: boolean): unknown;
  showFaceOverlay(show: boolean): unknown;
  showFaceFeedbackBox(show: boolean): unknown;
  clearData(): unknown;
  addMouseEventListeners(): unknown;
  removeMouseEventListeners(): unknown;
}

/**
 * WebGazer.js adapter. Loaded lazily (browser only) so it never affects the
 * default no-eye-tracking experience or server rendering. Video is processed
 * locally and never stored or transmitted; only gaze coordinates are kept.
 */
export async function createWebGazerProvider(): Promise<GazeProvider> {
  const mod = (await import("webgazer")) as unknown as { default?: WebGazerLike } & WebGazerLike;
  const wg: WebGazerLike = mod.default ?? mod;

  if (WEBGAZER_FACEMESH_PATH) wg.params.faceMeshSolutionPath = WEBGAZER_FACEMESH_PATH;

  return {
    async start(onSample) {
      wg.setRegression("ridge");
      wg.setGazeListener((data) => onSample(data ? { x: data.x, y: data.y } : null, performance.now()));
      await new Promise<void>((resolve, reject) => {
        try {
          Promise.resolve(wg.begin(() => reject(new Error("Camera unavailable")))).then(() => resolve(), reject);
        } catch (e) {
          reject(e);
        }
      });
      wg.showPredictionPoints(false);
      wg.showFaceOverlay(false);
      wg.showFaceFeedbackBox(true);
      wg.showVideoPreview(true);
    },
    showPreview(show) {
      wg.showVideoPreview(show);
      wg.showFaceFeedbackBox(show);
      wg.showPredictionPoints(false);
      wg.showFaceOverlay(false);
    },
    setTraining(on) {
      if (on) wg.addMouseEventListeners();
      else wg.removeMouseEventListeners();
    },
    clearTraining() {
      wg.clearData();
    },
    stop() {
      try {
        wg.end();
      } catch {
        /* already stopped */
      }
    },
  };
}
