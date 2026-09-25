export async function runLaunchSequence(create, setup, onCleanupError) {
    let overlay;
    try {
        overlay = await create();
        await setup(overlay);
        await overlay.present("icon");
        return overlay;
    }
    catch (error) {
        if (overlay) {
            try {
                await overlay.dispose();
            }
            catch (cleanupError) {
                onCleanupError?.(cleanupError);
            }
        }
        throw error;
    }
}
