import { API } from "../../api";
import { Logger } from "../../logger";
import { dp } from "../style/style";
import { Theme } from "../style/theme";
import { LogViewWindow } from "./log-view";

class HeaderView {
  private theme: Theme;
  private headerContainer: any;
  private title: string;
  private version: string;
  logPanelView: any;
  height: any;
  logMaxLines: number | undefined;
  onHideCallback: any;
  constructor(theme: Theme, title: string, version: string) {
    this.title = title;
    this.version = version;
    this.theme = theme;
  }
  private createView(context: any, parent: any): void {
    try {
      const LinearLayout = API.LinearLayout;
      const LinearLayoutParams = API.LinearLayoutParams;
      const TextView = API.TextView;
      const JString = API.JString;
      const GradientDrawable = API.GradientDrawable;
      const Gravity = API.Gravity;

      const self = this;

      const PAD_H = dp(context, 10);
      const PAD_V = dp(context, 8);
      const BTN_SIZE = dp(context, 34);
      const BTN_RADIUS = dp(context, 10);

      // 小按钮：字符 + 小方块描边（融入 header）
      const createIconCharBtn = (ch: string, isDanger = false) => {
        const btn = TextView.$new(context);
        btn.setText(JString.$new(ch));
        btn.setGravity(Gravity.CENTER.value);
        btn.setSingleLine(true);

        // 字体大小（符号稍大一点）
        btn.setTextSize(2, this.theme.textSp.title);
        btn.setTextColor(
          isDanger ? this.theme.colors.accent : this.theme.colors.text,
        );

        const lp = LinearLayoutParams.$new(BTN_SIZE, BTN_SIZE);
        btn.setLayoutParams(lp);

        // 轻量按压反馈：按下变暗，抬起恢复
        btn.setOnTouchListener(
          Java.registerClass({
            name:
              "HeaderBtnTouch_" +
              Date.now() +
              Math.random().toString(36).slice(2),
            implements: [Java.use("android.view.View$OnTouchListener")],
            methods: {
              onTouch: function (v: any, ev: any) {
                try {
                  const MotionEvent = Java.use("android.view.MotionEvent");
                  const action = ev.getAction();
                  if (action === MotionEvent.ACTION_DOWN.value) v.setAlpha(0.6);
                  else if (
                    action === MotionEvent.ACTION_UP.value ||
                    action === MotionEvent.ACTION_CANCEL.value
                  )
                    v.setAlpha(1.0);
                } catch {}
                return false; // 不吃掉事件，保证 onClick 正常
              },
            },
          }).$new(),
        );
        // 背景：透明 + 轻微圆角（不描边，不像按钮格子）
        const d = GradientDrawable.$new();
        d.setCornerRadius(BTN_RADIUS);
        d.setColor(0x00000000); // 默认透明
        btn.setBackgroundDrawable(d);

        // 点击区域 padding（主要靠 BTN_SIZE）
        btn.setPadding(
          dp(context, 6),
          dp(context, 6),
          dp(context, 6),
          dp(context, 6),
        );
        return btn;
      };

      // ===== header container =====

      const headerLp = LinearLayoutParams.$new(
        LinearLayoutParams.MATCH_PARENT.value,
        LinearLayoutParams.WRAP_CONTENT.value,
      );
      // headerRoot：竖向（行 + 分割线）
      const headerRoot = LinearLayout.$new(context);
      headerRoot.setOrientation(1); // VERTICAL
      headerRoot.setLayoutParams(headerLp);

      // headerRow：横向（真正的内容）
      const headerRow = LinearLayout.$new(context);
      headerRow.setOrientation(0);
      headerRow.setGravity(Gravity.CENTER_VERTICAL.value);
      headerRow.setPadding(PAD_H, PAD_V, PAD_H, PAD_V);

      // 用 headerRow 作为拖拽区域
      this.headerContainer = headerRow;

      try {
        this.headerContainer.setBackgroundColor(0x00000000);
      } catch {}

      // 在 headerView 下方加一条分割线（更像截图）
      const divider = API.View.$new(context);
      const divLp = LinearLayoutParams.$new(
        LinearLayoutParams.MATCH_PARENT.value,
        dp(context, 1),
      );
      divider.setLayoutParams(divLp);
      divider.setBackgroundColor(this.theme.colors.divider);

      // ===== left box: icon + title + version badge =====
      const leftBox = LinearLayout.$new(context);
      leftBox.setOrientation(0);
      leftBox.setGravity(Gravity.CENTER_VERTICAL.value);

      const leftLp = LinearLayoutParams.$new(
        0,
        LinearLayoutParams.WRAP_CONTENT.value,
        1.0, // 占满左侧
      );
      leftBox.setLayoutParams(leftLp);

      // 小图标（用字符替代，避免字体缺失；你也可以换成 "≡" 或 "▣"）
      const icon = TextView.$new(context);
      icon.setText(JString.$new("▸"));
      icon.setTextColor(this.theme.colors.accent);
      icon.setTextSize(2, this.theme.textSp.title);
      icon.setPadding(0, 0, dp(context, 8), 0);

      // 标题
      const titleView = TextView.$new(context);
      titleView.setText(JString.$new(this.title));
      titleView.setSingleLine(true);
      titleView.setTypeface(null, 1);
      titleView.setTextColor(this.theme.colors.text);
      titleView.setTextSize(2, this.theme.textSp.title);

      // 版本号 badge（小标签）
      const ver = TextView.$new(context);
      ver.setText(JString.$new("v2.4.0")); // 这里换成你的版本变量
      ver.setSingleLine(true);
      ver.setTextSize(2, this.theme.textSp.caption);
      ver.setTextColor(this.theme.colors.accent);

      // badge 背景：小圆角、弱底色
      const badgeBg = GradientDrawable.$new();
      badgeBg.setCornerRadius(dp(context, 8));
      badgeBg.setColor(0x22000000); // 透明黑（你也可以用 accentSoft）
      badgeBg.setStroke(dp(context, 1), this.theme.colors.divider);
      ver.setBackgroundDrawable(badgeBg);
      ver.setPadding(
        dp(context, 8),
        dp(context, 4),
        dp(context, 8),
        dp(context, 4),
      );

      const verLp = LinearLayoutParams.$new(
        LinearLayoutParams.WRAP_CONTENT.value,
        LinearLayoutParams.WRAP_CONTENT.value,
      );
      verLp.setMargins(dp(context, 10), 0, 0, 0);
      ver.setLayoutParams(verLp);

      // assemble left box
      leftBox.addView(icon);
      leftBox.addView(titleView);
      leftBox.addView(ver);

      // ===== right buttons container =====
      const rightBox = LinearLayout.$new(context);
      rightBox.setOrientation(0);
      rightBox.setGravity(Gravity.CENTER_VERTICAL.value);

      // 右侧按钮间距
      const rightLp = LinearLayoutParams.$new(
        LinearLayoutParams.WRAP_CONTENT.value,
        LinearLayoutParams.WRAP_CONTENT.value,
      );
      rightBox.setLayoutParams(rightLp);

      // 日志：用 “L” 或 “📝”，建议用简单字符避免字体缺失
      const logView = new LogViewWindow(
        context,
        this.height! - 240,
        this.theme!,
        this.logMaxLines,
      );
      const logButton = createIconCharBtn("L", false);
      logButton.setOnClickListener(
        Java.registerClass({
          name: "LogButtonClickListener" + Date.now(),
          implements: [API.OnClickListener],
          methods: {
            onClick: function () {
              logView.createViewOnce(self.logPanelView);
              // 开合
              if (logView.isLogDrawerOpen) {
                logView.closeLogDrawer();
                logButton.setText(API.JString.$new("L"));
              } else {
                logView.openLogDrawer();
                logButton.setText(API.JString.$new("←"));
              }
            },
          },
        }).$new(),
      );

      // 最小化：用 “—”
      const minButton = createIconCharBtn("—", false);
      minButton.setOnClickListener(
        Java.registerClass({
          name: "MinButtonClickListener" + Date.now(),
          implements: [API.OnClickListener],
          methods: {
            onClick: function () {
              //   self.isIconMode = true;
              //   self.toggleView();
              if (self.onMiniCallBack) self.onMiniCallBack();
            },
          },
        }).$new(),
      );

      // 隐藏：字符按钮（这里用 👁，你想用 “×” 也可以）
      const hideButton = createIconCharBtn("X", true);
      hideButton.setOnClickListener(
        Java.registerClass({
          name: "HideButtonClickListener" + Date.now(),
          implements: [API.OnClickListener],
          methods: {
            onClick: function () {
              if (self.onHideCallback) self.onHideCallback();
              //   self.isIconMode = true;
              //   self.toggleView();
              //   self.hide();
              //   self.toast("菜单已隐藏,单击原来位置显示");
            },
          },
        }).$new(),
      );

      // 给右侧两个按钮一点间距
      // const lpBtn = LinearLayoutParams.$new(BTN_SIZE, BTN_SIZE);
      // lpBtn.setMargins(0, 0, dp(context, 4), 0);
      // logButton.setLayoutParams(lpBtn);
      // minButton.setLayoutParams(lpBtn);

      const lp1 = LinearLayoutParams.$new(BTN_SIZE, BTN_SIZE);
      lp1.setMargins(0, 0, dp(context, 4), 0);
      logButton.setLayoutParams(lp1);

      const lp2 = LinearLayoutParams.$new(BTN_SIZE, BTN_SIZE);
      lp2.setMargins(0, 0, dp(context, 4), 0);
      minButton.setLayoutParams(lp2);

      // 最后一个不加右边距
      const lp3 = LinearLayoutParams.$new(BTN_SIZE, BTN_SIZE);
      lp3.setMargins(0, 0, 0, 0);
      hideButton.setLayoutParams(lp3);

      rightBox.addView(logButton);
      rightBox.addView(minButton);
      rightBox.addView(hideButton);
      // ===== assemble =====

      // this.headerView.addView(titleView);
      // this.headerView.addView(rightBox);
      headerRoot.addView(headerRow);
      headerRoot.addView(divider);
      headerRow.addView(leftBox);
      headerRow.addView(rightBox);
      parent.addView(headerRoot);

      // this.menuPanelView.addView(this.headerView);

      // drag support
      this.addDragListener(
        this.headerContainer,
        this.menuContainerWin,
        this.menuWindowParams,
      );
    } catch (error) {
      Logger.instance.error("Failed to create header view: " + error);
    }
  }
  private onMiniCallBack?: () => void;
  //   设置最小化的回调事件
  public setMiniCallBack(cb: () => void) {
    this.onMiniCallBack = cb;
  }


  private addDragListener(targetView: any, window: any, winParams: any) {
      const OnTouchListener = API.OnTouchListener;
      const MotionEvent = API.MotionEvent;
  
      targetView.setClickable(true);
      const getBounds = () => {
        const w = this.isIconMode ? this.options.iconWidth! : this.options.width!;
        const h = this.isIconMode
          ? this.options.iconHeight!
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
      const touchListener = Java.registerClass({
        name:
          "com.frida.FloatDragListener" +
          Date.now() +
          Math.random().toString(36).substring(6),
        implements: [OnTouchListener],
        methods: {
          onTouch: function (v: any, event: any) {
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
                    self.screenWidth,
                    self.screenHeight,
                    self.isIconMode
                      ? self.options.iconWidth!
                      : self.options.width!,
                    self.isIconMode
                      ? self.options.iconHeight!
                      : self.options.height!,
                  );
                  let newX = p.x;
                  let newY = p.y;
  
                  const bounds = getBounds();
                  newX = Math.max(bounds.left, Math.min(bounds.right, newX));
                  newY = Math.max(bounds.top, Math.min(bounds.bottom, newY));
  
                  self.updatePosition(window, winParams, { x: newX, y: newY });
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
  
                    self.toggleView();
                  } catch {}
                }
                return true;
              }
            }
            // if (
            //   action === MotionEvent.ACTION_UP.value ||
            //   action === MotionEvent.ACTION_CANCEL.value
            // ) {
            //   // ✅ 如果你需要“点击”功能，这里判断：
            //   if (!isDragging) {
  
            //   }
            //   return true;
            // }
  
            // return false;
          },
        },
      });
  
      targetView.setOnTouchListener(touchListener.$new());
    }
}
