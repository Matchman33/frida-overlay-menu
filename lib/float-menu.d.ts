import { UIComponent } from "./component/ui-components.js";
import { Logger } from "./logger.js";
import { Theme } from "./component/style/theme.js";
import { LifecycleState } from "./runtime/lifecycle-controller.js";
export interface TabDefinition {
    id: string;
    label: string;
}
export interface FloatMenuIconOptions {
    base64: string;
    width?: number;
    height?: number;
}
export interface FloatMenuOptions {
    version?: string;
    width?: number;
    height?: number;
    x?: number;
    y?: number;
    icon?: FloatMenuIconOptions;
    permissionDeniedMessage?: string;
    logMaxLines?: number;
    theme?: Theme;
    title?: string;
    tabs?: TabDefinition[];
    activeTab?: string;
}
export type MenuPresentation = "icon" | "menu";
export type FloatMenuSetup = (menu: FloatMenu) => void | Promise<void>;
export interface FloatMenuSnapshot {
    activeTabId: string;
    presentation: MenuPresentation;
    components: Record<string, unknown>;
}
export declare class FloatMenu {
    static waitForReady(timeoutMs?: number): Promise<any>;
    static create(options?: FloatMenuOptions, timeoutMs?: number): Promise<FloatMenu>;
    static launch(options?: FloatMenuOptions, setup?: FloatMenuSetup, timeoutMs?: number): Promise<FloatMenu>;
    options: FloatMenuOptions;
    private headerView;
    private headerComponent;
    private iconView;
    private readonly components;
    private readonly componentListeners;
    private readonly lifecycle;
    private pendingComponents;
    private eventEmitter;
    private isIconMode;
    private _context;
    private lastTouchX;
    private lastTouchY;
    private screenWidth;
    private screenHeight;
    private readonly iconWidth;
    private readonly iconHeight;
    private menuWindowParams;
    private iconWindowParams;
    private iconContainerWin;
    private iconAttached;
    private menuAttached;
    private lastPresentation;
    private menuContainerWin;
    private menuPanelView;
    logger: Logger;
    private tabsView;
    get context(): any;
    private _windowManager;
    get windowManager(): any;
    private constructor();
    get state(): LifecycleState;
    private runOnMainThread;
    private reportAsyncFailure;
    private enforceNonFocusableWindow;
    private addDragListener;
    private createMenuContainerWindow;
    private updatePosition;
    private createIconWindow;
    private canDrawOverlays;
    private showToastNow;
    private concealFromHeader;
    private mountInternal;
    private presentInternal;
    mount(): Promise<void>;
    present(mode?: MenuPresentation): Promise<void>;
    conceal(): Promise<void>;
    toggle(): Promise<void>;
    private detachWindows;
    private bindComponentEvents;
    private processPendingComponents;
    private prepareComponentView;
    dispose(): Promise<void>;
    toast(msg: string, duration?: 0 | 1): Promise<void>;
    addComponent(component: UIComponent, tabId?: string): Promise<void>;
    addNestedComponent(ownerId: string, component: UIComponent, container: any): Promise<void>;
    attachNestedComponent(ownerId: string, component: UIComponent, container: any): void;
    removeComponent(id: string): Promise<void>;
    getComponent<T extends UIComponent>(id: string): T | undefined;
    setComponentValue(id: string, value: any): void;
    captureState(): FloatMenuSnapshot;
    restoreState(snapshot: FloatMenuSnapshot): Promise<void>;
    on(event: string, callback: (...args: any[]) => void): () => void;
    off(event: string, callback: (...args: any[]) => void): void;
}
