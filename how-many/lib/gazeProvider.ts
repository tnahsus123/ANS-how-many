/** Anything that can produce gaze estimates. WebGazer is the real one; tests use a mock. */
export interface GazeProvider {
  /** Start the camera/model; `onSample(null)` means the face was lost. */
  start(onSample: (s: { x: number; y: number } | null, absTime: number) => void): Promise<void>;
  /** Show/hide the camera preview (useful while calibrating, hidden during trials). */
  showPreview(show: boolean): void;
  /** Enable/disable learning from mouse clicks (on during calibration, off during trials). */
  setTraining(on: boolean): void;
  clearTraining(): void;
  stop(): void;
}

export type GazeProviderFactory = () => Promise<GazeProvider>;
