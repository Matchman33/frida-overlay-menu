export interface LaunchableOverlay {
  present(mode: "icon"): Promise<void>;
  dispose(): Promise<void>;
}

export async function runLaunchSequence<T extends LaunchableOverlay>(
  create: () => Promise<T>,
  setup: (overlay: T) => void | Promise<void>,
  onCleanupError?: (error: unknown) => void,
): Promise<T> {
  let overlay: T | undefined;
  try {
    overlay = await create();
    await setup(overlay);
    await overlay.present("icon");
    return overlay;
  } catch (error) {
    if (overlay) {
      try {
        await overlay.dispose();
      } catch (cleanupError) {
        onCleanupError?.(cleanupError);
      }
    }
    throw error;
  }
}
