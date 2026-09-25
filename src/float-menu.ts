import { EventEmitter } from "./event-emitter.js";
import { UIComponent } from "./component/ui-components.js";
import { Logger, LogLevel } from "./logger.js";
import { API } from "./api.js";
import { applyStyle, dp } from "./component/style/style.js";
import { DarkNeonTheme, Theme } from "./component/style/theme.js";
import { logicalToWindow, windowToLogical } from "./utils.js";
import { TabsView } from "./component/views/tabs-view.js";
import { HeaderView } from "./component/views/header-view.js";
import { ConstantConfig } from "./constant-config.js";
import {
  assertJavaBridgeCompatible,
  ensureWindowNotFocusable,
  getApplicationContext,
  getOverlayWindowType,
  getWindowManager,
  readDisplaySize,
  runWhenJavaReady,
  scheduleOnMainThread,
  waitForJavaAvailable,
  waitForApplicationContext,
} from "./android-runtime.js";
import { ComponentRegistry } from "./runtime/component-registry.js";
import {
  LifecycleController,
  LifecycleState,
} from "./runtime/lifecycle-controller.js";
import { ListenerRegistry } from "./runtime/listener-registry.js";
import Java from "./java-runtime.js";
import { createJavaListener } from "./android-listener.js";
import { runLaunchSequence } from "./runtime/launch-sequence.js";
import {
  DEFAULT_PERMISSION_DENIED_MESSAGE,
  InvalidOverlayIconError,
  normalizeIconBase64,
  requireOverlayPermission,
} from "./runtime/overlay-options.js";

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
  title?: string; // Main title text (default: "Frida Float Menu")
  tabs?: TabDefinition[]; // Tab definitions (optional)
  activeTab?: string; // Initially active tab ID (default: first tab or "default")
}

export type MenuPresentation = "icon" | "menu";
export type FloatMenuSetup = (menu: FloatMenu) => void | Promise<void>;

export interface FloatMenuSnapshot {
  activeTabId: string;
  presentation: MenuPresentation;
  components: Record<string, unknown>;
}

const HIDDEN_HOTSPOT_MESSAGE = "菜单已隐藏，点击原悬浮图标位置可重新打开";

export class FloatMenu {
  public static async waitForReady(timeoutMs: number = 30000): Promise<any> {
    assertJavaBridgeCompatible(Java);
    const startedAt = Date.now();
    await waitForJavaAvailable(Java, timeoutMs);
    const remaining = Math.max(1, timeoutMs - (Date.now() - startedAt));
    return waitForApplicationContext(Java, remaining);
  }

  public static async create(
    options: FloatMenuOptions = {},
    timeoutMs: number = 30000,
  ): Promise<FloatMenu> {
    await FloatMenu.waitForReady(timeoutMs);
    return runWhenJavaReady(
      Java,
      () => new FloatMenu(options),
      timeoutMs,
      "FloatMenu creation",
    );
  }

  public static launch(
    options: FloatMenuOptions = {},
    setup: FloatMenuSetup = () => {},
    timeoutMs: number = 30000,
  ): Promise<FloatMenu> {
    return runLaunchSequence(
      () => FloatMenu.create(options, timeoutMs),
      setup,
      error => Logger.instance.warn("FloatMenu launch cleanup failed:", error),
    );
  }

  public options: FloatMenuOptions;
  private headerView: any; // 标题栏容器
  private headerComponent: HeaderView;
  private iconView: any; // 图标容器
  private readonly components = new ComponentRegistry<UIComponent>();
  private readonly componentListeners = new ListenerRegistry();
  private readonly lifecycle = new LifecycleController();
  private pendingComponents: Array<{
    id: string;
    component: UIComponent;
    tabId: string;
  }> = [];
  private eventEmitter: EventEmitter = new EventEmitter();
  private isIconMode: boolean = true; // 当前显示图标还是菜单

  private _context: any = null;
  private lastTouchX: any;
  private lastTouchY: any;
  private screenWidth: any;
  private screenHeight: any;
  private readonly iconWidth: number;
  private readonly iconHeight: number;
  private menuWindowParams: any;
  private iconWindowParams: any;
  private iconContainerWin: any;
  private iconAttached: boolean = false;
  private menuAttached: boolean = false;
  private lastPresentation: MenuPresentation = "icon";
  private menuContainerWin: any; // 菜单界面窗口。是最底层容器

  private menuPanelView: any; // 真正用来添加组件的容器

  public logger: Logger;
  private tabsView: TabsView;
  public get context(): any {
    if (this._context === null) {
      this._context = getApplicationContext(Java);
    }
    return this._context;
  }
  private _windowManager: any = null;

  public get windowManager(): any {
    if (this._windowManager === null) {
      this._windowManager = getWindowManager(Java, this.context);
    }
    return this._windowManager;
  }

  private constructor(options: FloatMenuOptions = {}) {
    const iconWidth = options.icon?.width ?? 200;
    const iconHeight = options.icon?.height ?? 200;
    if (!Number.isFinite(iconWidth) || iconWidth <= 0) {
      throw new RangeError("Overlay icon width must be greater than zero");
    }
    if (!Number.isFinite(iconHeight) || iconHeight <= 0) {
      throw new RangeError("Overlay icon height must be greater than zero");
    }
    const icon = options.icon
      ? {
          base64: normalizeIconBase64(options.icon.base64),
          width: Math.round(iconWidth),
          height: Math.round(iconHeight),
        }
      : undefined;

    this.options = {
      width: 1200,
      height: 1400,
      x: 0,
      y: 0,
      logMaxLines: 100,
      version: "v1.0.0",
      title: "Frida Float Menu",
      theme: DarkNeonTheme,
      tabs: [],
      activeTab: undefined,
      ...options,
      icon,
      permissionDeniedMessage:
        options.permissionDeniedMessage ?? DEFAULT_PERMISSION_DENIED_MESSAGE,
    };
    this.iconWidth = Math.round(iconWidth);
    this.iconHeight = Math.round(iconHeight);
    this.logger = Logger.instance;

    const display = readDisplaySize(this.context, this.windowManager);
    ConstantConfig.screenWidth = display.width;
    ConstantConfig.screenHeight = display.height;
    this.screenWidth = display.width;
    this.screenHeight = display.height;

    this.options.width = Math.min(this.options.width!, display.width);
    this.options.height = Math.min(
      this.options.height!,
      Math.max(1, display.height - 80),
    );


    this.headerComponent = new HeaderView(this.options.theme!);

    this.tabsView = new TabsView(
      this.context,
      this.options.theme!,
      this.options.tabs!,
      this.options.activeTab!,
    );
    // Initialize tabs
    this.tabsView.initializeTabs();
  }

  public get state(): LifecycleState {
    return this.lifecycle.state;
  }

  private runOnMainThread<T>(label: string, operation: () => T): Promise<T> {
    return scheduleOnMainThread(Java, operation, 30000, label);
  }

  private reportAsyncFailure(label: string, error: unknown): void {
    this.logger.error(`${label}:`, error);
  }

  private enforceNonFocusableWindow(
    window: any,
    params: any,
    attached: boolean,
  ): void {
    const changed = ensureWindowNotFocusable(params, API.LayoutParams);
    try {
      window?.clearFocus?.();
    } catch {}
    if (changed && attached) {
      this.windowManager.updateViewLayout(window, params);
    }
  }

  private addDragListener(
    targetView: any,
    window: any,
    winParams: any,
    isShowing: () => boolean,
  ) {
    const OnTouchListener = API.OnTouchListener;
    const MotionEvent = API.MotionEvent;
    // const isShow = isShowing();
    targetView.setClickable(true);
    const getBounds = () => {
      const w = this.isIconMode ? this.iconWidth : this.options.width!;
      const h = this.isIconMode
        ? this.iconHeight
        : this.options.height!;
      return {
        left: 0,
        top: -40,
        right: this.screenWidth - w,
        bottom: this.screenHeight - h,
      };
    };
    const self = this;

    let isDragging = false;
    const DRAG_THRESHOLD = 5;

    // 在 addDragListener 里加两个局部变量（闭包变量）
    let touchOffsetX = 0;
    let touchOffsetY = 0;
    const touchListener = createJavaListener({
      key: "view-touch",
      interfaceClass: OnTouchListener,
      fallback: { onTouch: false },
      callbacks: {
        onTouch: (_v: any, event: any) => {
          const action = event.getAction();

          switch (action) {
            case MotionEvent.ACTION_DOWN.value: {
              isDragging = false;

              const rawX = event.getRawX();
              const rawY = event.getRawY();

              // 当前窗口位置（注意：这里的 winParams.x/y 是“window坐标”）
              const startWx = winParams.x.value;
              const startWy = winParams.y.value;

              // 记录手指按下点相对窗口左上角的偏移（window坐标系内）
              touchOffsetX = rawX - startWx;
              touchOffsetY = rawY - startWy;

              // 记录 down 时的位置，用于阈值判断
              self.lastTouchX = rawX;
              self.lastTouchY = rawY;

              return true;
            }

            case MotionEvent.ACTION_MOVE.value: {
              const rawX = event.getRawX();
              const rawY = event.getRawY();

              const dx = rawX - self.lastTouchX;
              const dy = rawY - self.lastTouchY;
              if (
                !isDragging &&
                (Math.abs(dx) > DRAG_THRESHOLD || Math.abs(dy) > DRAG_THRESHOLD)
              ) {
                isDragging = true;
              }

              if (isDragging) {
                // 直接由手指位置反推窗口左上角（不会积累漂移）
                let wx = rawX - touchOffsetX;
                let wy = rawY - touchOffsetY;

                // window → logical（如果你当前还在用 logical 做边界）
                const p = windowToLogical(
                  wx,
                  wy,
                  self.isIconMode
                    ? self.iconWidth
                    : self.options.width!,
                  self.isIconMode
                    ? self.iconHeight
                    : self.options.height!,
                );
                let newX = p.x;
                let newY = p.y;

                const bounds = getBounds();
                newX = Math.max(bounds.left, Math.min(bounds.right, newX));
                newY = Math.max(bounds.top, Math.min(bounds.bottom, newY));
                if (isShowing()) {
                  self.updatePosition(window, winParams, { x: newX, y: newY });
                }
              }

              return true;
            }

            case MotionEvent.ACTION_UP.value:
            case MotionEvent.ACTION_CANCEL.value: {
              // 没拖动则当点击处理（否则你 return true 会吃掉 click）
              if (!isDragging) {
                try {
                  self.isIconMode = false;

                  // 再次被点击以后设置为不透明
                  self.iconContainerWin.setAlpha(1);

                  void self.present("menu").catch((error) =>
                    self.reportAsyncFailure("Failed to open menu", error),
                  );
                } catch {}
              }
              return true;
            }
          }
          return false;
        },
      },
    });
    this.componentListeners.add("java:menu", () => touchListener.dispose());
    targetView.setOnTouchListener(touchListener.instance);
  }

  private createMenuContainerWindow() {
    const FrameLayout = API.FrameLayout;
    const LinearLayout = API.LinearLayout;
    const FrameLayoutParams = API.FrameLayoutParams;
    const ViewGroupLayoutParams = API.ViewGroupLayoutParams;
    const View = API.View;
    const LayoutParams = API.LayoutParams;

    // --------------------
    // 创建 window root（透明根容器）
    // --------------------
    this.menuContainerWin = FrameLayout.$new(this.context);
    const rootLp = FrameLayoutParams.$new(
      ViewGroupLayoutParams.MATCH_PARENT.value,
      ViewGroupLayoutParams.MATCH_PARENT.value,
    );
    rootLp.gravity = API.Gravity.TOP.value | API.Gravity.START.value;
    this.menuContainerWin.setLayoutParams(rootLp);

    // root 保持透明，避免灰块叠加
    try {
      this.menuContainerWin.setBackgroundColor(0x00000000);
    } catch (e) {}

    // --------------------
    // 创建 panel（真正的面板壳：背景/圆角/阴影/内边距）
    // --------------------
    const panel = LinearLayout.$new(this.context);
    panel.setOrientation(LinearLayout.VERTICAL.value);
    panel.setLayoutParams(
      ViewGroupLayoutParams.$new(
        ViewGroupLayoutParams.MATCH_PARENT.value,
        ViewGroupLayoutParams.MATCH_PARENT.value,
      ),
    );

    // 用你 style.ts 的 overlay role 来统一风格
    applyStyle(panel, "overlay", this.options.theme!);

    // 可选：圆角裁剪/阴影更稳（失败就忽略）
    try {
      panel.setClipToOutline(true);
    } catch (e) {}
    try {
      panel.setClipChildren(false);
    } catch (e) {}
    try {
      panel.setClipToPadding(false);
    } catch (e) {}

    // 保存引用：以后内容都加到 panel
    this.menuPanelView = panel;

    // root -> panel
    this.menuContainerWin.addView(panel);

    // --------------------
    // Window 参数
    // --------------------
    this.menuWindowParams = LayoutParams.$new(
      this.options.width,
      this.options.height,
      0,
      0,
      getOverlayWindowType(LayoutParams),
      LayoutParams.FLAG_NOT_FOCUSABLE.value |
        LayoutParams.FLAG_NOT_TOUCH_MODAL.value,
      1, // PixelFormat.TRANSLUCENT
    );

    // --------------------
    // 往 panel 里塞内容（别再塞到 menuContainerView）
    // --------------------
    this.headerView = this.headerComponent.createView(
      {
        context: this.context,
        parent: this.menuPanelView,
        logMaxLines: this.options.logMaxLines,
        title: this.options.title!,
        // version: "v2.4.0",
        version: this.options.version!,
      },
      {
        onMinimize: () => {
          void this.present("icon").catch((error) =>
            this.reportAsyncFailure("Failed to minimize menu", error),
          );
        },
        onHide: () => {
          void this.concealFromHeader();
        },
      },
    );

    if (this.headerView) {
      this.addDragListener(
        this.headerView,
        this.menuContainerWin,
        this.menuWindowParams,
        () => !this.isIconMode,
      );
    }

    // tab bar
    // 不在构造函数中添加父组件是害怕父组件那时候还没初始化成功
    this.tabsView.createTabView(this.menuPanelView);
    this.tabsView.createTabContainer();

    // --------------------
    // attach window
    // --------------------
    this.windowManager.addView(this.menuContainerWin, this.menuWindowParams);
    this.menuAttached = true;
    this.menuContainerWin.setVisibility(View.GONE.value);
  }
  private updatePosition(
    window: any,
    winParams: any,
    newPos: { x: number; y: number },
  ): void {
    const { x: wx, y: wy } = logicalToWindow(
      newPos.x,
      newPos.y,
      this.isIconMode ? this.iconWidth : this.options.width!,
      this.isIconMode ? this.iconHeight : this.options.height!,
    );
    winParams.x.value = wx | 0;
    winParams.y.value = wy | 0;

    Java.scheduleOnMainThread(() => {
      this.enforceNonFocusableWindow(window, winParams, true);
      this.windowManager.updateViewLayout(window, winParams);
    });

    // 刷新
  }

  private createIconWindow(): void {
    const ImageView = API.ImageView;
    const ImageView$ScaleType = API.ImageViewScaleType;
    const FrameLayoutParams = API.FrameLayoutParams;
    const Gravity = API.Gravity;
    const LayoutParams = API.LayoutParams;
    const BitmapFactory = API.BitmapFactory;
    const Base64 = API.Base64;
    const FrameLayout = API.FrameLayout;

    this.iconView = ImageView.$new(this.context);

    // icon 图片或默认圆
    if (this.options.icon) {
      try {
        const decoded = Base64.decode(
          this.options.icon.base64,
          Base64.DEFAULT.value,
        );
        if (!decoded || decoded.length <= 0) {
          throw new InvalidOverlayIconError(
            "Overlay icon decoded to an empty byte array",
          );
        }
        const bitmap = BitmapFactory.decodeByteArray(decoded, 0, decoded.length);
        if (!bitmap) {
          throw new InvalidOverlayIconError(
            "Overlay icon Base64 is not a supported bitmap",
          );
        }
        this.iconView.setImageBitmap(bitmap);
      } catch (error) {
        if (error instanceof InvalidOverlayIconError) throw error;
        throw new InvalidOverlayIconError(
          `Failed to decode overlay icon: ${String(error)}`,
        );
      }
    } else {
      this.iconView.setBackgroundColor(0xff4285f4 | 0);
      try {
        this.iconView.setClipToOutline(true);
      } catch {}
    }

    this.iconView.setScaleType(ImageView$ScaleType.FIT_CENTER.value);

    const { x, y } = logicalToWindow(
      this.options.x!,
      this.options.y!,
      this.iconWidth,
      this.iconHeight,
    );
    // icon window
    this.iconWindowParams = LayoutParams.$new(
      this.iconWidth,
      this.iconHeight,
      x,
      y,
      getOverlayWindowType(LayoutParams),
      LayoutParams.FLAG_NOT_FOCUSABLE.value |
        LayoutParams.FLAG_NOT_TOUCH_MODAL.value,
      1,
    );

    this.iconContainerWin = FrameLayout.$new(this.context);
    this.iconContainerWin.setLayoutParams(
      FrameLayoutParams.$new(
        this.iconWidth,
        this.iconHeight,
        Gravity.CENTER.value,
      ),
    );
    this.iconContainerWin.addView(this.iconView);

    this.windowManager.addView(this.iconContainerWin, this.iconWindowParams);
    this.iconAttached = true;

    this.addDragListener(
      this.iconContainerWin,
      this.iconContainerWin,
      this.iconWindowParams,
      () => this.isIconMode,
    );
  }

  private canDrawOverlays(): boolean {
    try {
      const Settings = Java.use("android.provider.Settings");
      return Boolean(Settings.canDrawOverlays(this.context));
    } catch (error) {
      Logger.instance.warn(
        "Unable to query overlay permission; addView will perform the final check:",
        error,
      );
      return true;
    }
  }

  private showToastNow(message: string, duration: 0 | 1 = 0): void {
    const Toast = Java.use("android.widget.Toast");
    const JString = Java.use("java.lang.String");
    Toast.makeText(this.context, JString.$new(message), duration).show();
  }

  private async concealFromHeader(): Promise<void> {
    try {
      await this.conceal();
    } catch (error) {
      this.reportAsyncFailure("Failed to hide menu", error);
      return;
    }

    try {
      await this.toast(HIDDEN_HOTSPOT_MESSAGE);
    } catch (error) {
      this.reportAsyncFailure("Failed to show hidden hotspot guidance", error);
    }
  }

  private async mountInternal(): Promise<void> {
    if (this.iconAttached && this.menuAttached) return;
    await this.runOnMainThread("mount floating windows", () => {
      requireOverlayPermission(
        this.canDrawOverlays(),
        this.options.permissionDeniedMessage!,
        message => this.showToastNow(message),
        error => this.logger.warn("Failed to show overlay permission Toast:", error),
      );
      try {
        if (!this.iconAttached) this.createIconWindow();
        if (!this.menuAttached) this.createMenuContainerWindow();
        this.enforceNonFocusableWindow(
          this.iconContainerWin,
          this.iconWindowParams,
          this.iconAttached,
        );
        this.enforceNonFocusableWindow(
          this.menuContainerWin,
          this.menuWindowParams,
          this.menuAttached,
        );
        this.processPendingComponents(this.context);
        const View = API.View;
        this.iconContainerWin.setVisibility(View.GONE.value);
        this.menuContainerWin.setVisibility(View.GONE.value);
      } catch (error) {
        this.detachWindows();
        throw error;
      }
    });
    this.lifecycle.transition("mounted");
  }

  private async presentInternal(mode: MenuPresentation): Promise<void> {
    await this.mountInternal();
    await this.runOnMainThread(`present ${mode}`, () => {
      const View = API.View;
      this.isIconMode = mode === "icon";
      this.lastPresentation = mode;
      this.enforceNonFocusableWindow(
        this.iconContainerWin,
        this.iconWindowParams,
        this.iconAttached,
      );
      this.enforceNonFocusableWindow(
        this.menuContainerWin,
        this.menuWindowParams,
        this.menuAttached,
      );
      this.iconContainerWin.setAlpha(1);
      this.iconContainerWin.setVisibility(
        mode === "icon" ? View.VISIBLE.value : View.GONE.value,
      );
      this.menuContainerWin.setVisibility(
        mode === "menu" ? View.VISIBLE.value : View.GONE.value,
      );
    });
    this.lifecycle.transition(mode === "icon" ? "icon-visible" : "menu-visible");
  }

  public mount(): Promise<void> {
    return this.lifecycle.run("mount", () => this.mountInternal());
  }

  public present(mode: MenuPresentation = this.lastPresentation): Promise<void> {
    return this.lifecycle.run(`present:${mode}`, () => this.presentInternal(mode));
  }

  public conceal(): Promise<void> {
    return this.lifecycle.run("conceal", async () => {
      if (this.iconAttached || this.menuAttached) {
        await this.runOnMainThread("conceal floating windows", () => {
          const View = API.View;
          if (this.iconAttached) {
            this.enforceNonFocusableWindow(
              this.iconContainerWin,
              this.iconWindowParams,
              true,
            );
            this.isIconMode = true;
            this.iconContainerWin.setAlpha(0);
            this.iconContainerWin.setVisibility(View.VISIBLE.value);
          }
          if (this.menuAttached) {
            this.enforceNonFocusableWindow(
              this.menuContainerWin,
              this.menuWindowParams,
              true,
            );
            this.menuContainerWin.setVisibility(View.GONE.value);
          }
        });
      }
      this.lifecycle.transition("hidden");
    });
  }

  public toggle(): Promise<void> {
    return this.lifecycle.run("toggle", () => {
      const mode = this.lifecycle.state === "menu-visible"
        ? "icon"
        : this.lifecycle.state === "icon-visible"
          ? "menu"
          : this.lastPresentation;
      return this.presentInternal(mode);
    });
  }

  private detachWindows(): void {
    if (this.menuContainerWin && this.menuAttached) {
      try {
        this.windowManager.removeView(this.menuContainerWin);
      } catch {}
    }
    if (this.iconContainerWin && this.iconAttached) {
      try {
        this.windowManager.removeView(this.iconContainerWin);
      } catch {}
    }
    this.menuAttached = false;
    this.iconAttached = false;
  }

  private bindComponentEvents(component: UIComponent): void {
    const id = component.getId();
    const owner = `component:${id}`;
    this.componentListeners.clear(owner);
    this.componentListeners.add(owner, component.on("valueChanged", (value: any) => {
      this.eventEmitter.emit("component:" + id + ":valueChanged", value);
    }));
    this.componentListeners.add(owner, component.on("action", (data: any) => {
      this.eventEmitter.emit("component:" + id + ":action", data);
    }));
    this.componentListeners.add(owner, component.on("click", (data: any) => {
      this.eventEmitter.emit("component:" + id + ":click", data);
    }));
  }

  private processPendingComponents(context: any): void {
    if (this.pendingComponents.length === 0) return;

    for (const { id, component, tabId } of this.pendingComponents) {
      try {
        const tabInfo = this.tabsView.tabs.get(tabId);
        if (!tabInfo) {
          this.logger.error(
            `Cannot add pending component ${id} - tab ${tabId} not found`,
          );
          continue;
        }

        const view = this.prepareComponentView(context, component);

        const container = tabInfo.container || this.tabsView.currentContentContainer;
        if (!container) throw new Error(`Tab ${tabId} has no container`);
        container.addView(view);
        component.attach(container);
        this.components.attach(id, container);

        tabInfo.components.add(id);
        this.bindComponentEvents(component);
      } catch (error) {
        this.componentListeners.clear(`component:${id}`);
        this.components.remove(id);
        const tabInfo = this.tabsView.tabs.get(tabId);
        tabInfo?.components.delete(id);
        component.dispose();
        Logger.instance.error(
          `Failed to add pending component ${id}: ` + error,
        );
      }
    }

    this.pendingComponents = [];
  }

  private prepareComponentView(context: any, component: UIComponent): any {
    const LinearLayoutParams = API.LinearLayoutParams;
    const ViewGroupLayoutParams = API.ViewGroupLayoutParams;

    const gapNormal = dp(context, 10);

    component.initialize(context, this);

    const view = component.getView();

    const lp = LinearLayoutParams.$new(
      ViewGroupLayoutParams.MATCH_PARENT.value,
      ViewGroupLayoutParams.WRAP_CONTENT.value,
    );

    lp.setMargins(0, 0, 0, gapNormal);

    view.setLayoutParams(lp);
    return view;
  }

  public dispose(): Promise<void> {
    return this.lifecycle.run("dispose", async () => {
      if (this.lifecycle.disposed) return;
      this.componentListeners.clearAll();
      this.eventEmitter.removeAllListeners();
      for (const { component } of this.components.values()) component.detach();
      this.headerComponent.destroy();
      this.tabsView.destroy();
      await this.runOnMainThread("dispose floating windows", () => {
        this.detachWindows();
      });
      this.lifecycle.transition("disposing");
      for (const { component } of this.components.values()) {
        await component.dispose();
      }
      this.iconView = null;
      this.iconContainerWin = null;
      this.iconWindowParams = null;
      this.menuPanelView = null;
      this.menuContainerWin = null;
      this.menuWindowParams = null;
      this.pendingComponents = [];
      this.components.clear();
      this.lifecycle.transition("disposed");
    });
  }

  public toast(msg: string, duration: 0 | 1 = 0): Promise<void> {
    return this.runOnMainThread("show toast", () =>
      this.showToastNow(msg, duration),
    );
  }

  public addComponent(component: UIComponent, tabId?: string): Promise<void> {
    const id = component.getId();
    return this.lifecycle.run(`addComponent:${id}`, async () => {
      const targetTabId = tabId || this.tabsView.activeTabId;
      const tabInfo = this.tabsView.tabs.get(targetTabId);
      if (!tabInfo) {
        throw new Error(`Cannot add component ${id}: tab ${targetTabId} not found`);
      }

      this.components.add(component, targetTabId);
      component.setMenu(this);
      tabInfo.components.add(id);

      if (!this.menuPanelView) {
        this.pendingComponents.push({ id, component, tabId: targetTabId });
        return;
      }

      try {
        await this.runOnMainThread(`add component ${id}`, () => {
          const context = this.menuPanelView.getContext();
          const view = this.prepareComponentView(context, component);
          const container = tabInfo.container || this.tabsView.currentContentContainer;
          if (!container) throw new Error(`Tab ${targetTabId} has no container`);
          container.addView(view);
          component.attach(container);
          this.components.attach(id, container);
          this.bindComponentEvents(component);
        });
      } catch (error) {
        tabInfo.components.delete(id);
        this.components.remove(id);
        this.componentListeners.clear(`component:${id}`);
        component.dispose();
        throw error;
      }
    });
  }

  public addNestedComponent(
    ownerId: string,
    component: UIComponent,
    container: any,
  ): Promise<void> {
    const id = component.getId();
    return this.lifecycle.run(`addNestedComponent:${id}`, async () => {
      await this.runOnMainThread(`add nested component ${id}`, () =>
        this.attachNestedComponent(ownerId, component, container),
      );
    });
  }

  public attachNestedComponent(
    ownerId: string,
    component: UIComponent,
    container: any,
  ): void {
    const id = component.getId();
    const owner = this.components.getEntry(ownerId);
    if (!owner) throw new Error(`Parent component ${ownerId} is not registered`);
    this.components.add(component, owner.tabId, ownerId);
    component.setMenu(this);
    try {
      const view = this.prepareComponentView(container.getContext(), component);
      container.addView(view);
      component.attach(container);
      this.components.attach(id, container);
      this.bindComponentEvents(component);
    } catch (error) {
      this.components.remove(id);
      this.componentListeners.clear(`component:${id}`);
      component.dispose();
      throw error;
    }
  }

  public removeComponent(id: string): Promise<void> {
    return this.lifecycle.run(`removeComponent:${id}`, async () => {
      const entry = this.components.getEntry(id);
      if (!entry) return;
      const { component, tabId, container } = entry;
      const tabInfo = this.tabsView.tabs.get(tabId);
      this.pendingComponents = this.pendingComponents.filter((item) => item.id !== id);
      this.componentListeners.clear(`component:${id}`);

      if (component.isInitialized) {
        await this.runOnMainThread(`remove component ${id}`, () => {
          const view = component.getView();
          const parent = container || tabInfo?.container || this.tabsView.currentContentContainer;
          if (parent && view) (parent as any).removeView(view);
        });
      }
      component.detach();
      await component.dispose();
      tabInfo?.components.delete(id);
      this.components.remove(id);
    });
  }

  public getComponent<T extends UIComponent>(id: string): T | undefined {
    return this.components.get(id) as T | undefined;
  }

  public setComponentValue(id: string, value: any): void {
    this.components.get(id)?.setValue(value);
  }

  public captureState(): FloatMenuSnapshot {
    return {
      activeTabId: this.tabsView.activeTabId,
      presentation: this.lastPresentation,
      components: this.components.captureState(),
    };
  }

  public restoreState(snapshot: FloatMenuSnapshot): Promise<void> {
    return this.lifecycle.run("restoreState", async () => {
      if (!this.tabsView.tabs.has(snapshot.activeTabId)) {
        throw new Error(`Cannot restore unknown tab ${snapshot.activeTabId}`);
      }
      this.tabsView.selectTab(snapshot.activeTabId);
      this.lastPresentation = snapshot.presentation;
      for (const [id, state] of Object.entries(snapshot.components)) {
        this.components.get(id)?.restoreState(state);
      }
    });
  }

  public on(event: string, callback: (...args: any[]) => void): () => void {
    return this.eventEmitter.on(event, callback);
  }

  public off(event: string, callback: (...args: any[]) => void): void {
    this.eventEmitter.off(event, callback);
  }
}
