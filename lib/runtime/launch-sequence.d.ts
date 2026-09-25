export interface LaunchableOverlay {
    present(mode: "icon"): Promise<void>;
    dispose(): Promise<void>;
}
export declare function runLaunchSequence<T extends LaunchableOverlay>(create: () => Promise<T>, setup: (overlay: T) => void | Promise<void>, onCleanupError?: (error: unknown) => void): Promise<T>;
