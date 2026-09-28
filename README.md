# frida-ui-runtime

用于 Frida 脚本的 Android 悬浮窗 UI 运行库，支持安全管理界面生命周期。

运行库通过使用方安装的 `frida-java-bridge` 同级依赖创建 Android 原生视图。使用方自行选择 Bridge 版本；运行库会检查所需能力，不依赖 REPL 注入的全局 `Java` 对象。

## 环境要求

- 目标 Android 进程中的 Frida Java 支持
- 目标应用的悬浮窗权限
- Android `WindowManager` 访问能力
- 用于打包 TypeScript 入口文件的 `frida-compile`

## 安装

```bash
npm install frida-ui-runtime frida-java-bridge
```

## 快速开始

```typescript
import {
  Button,
  FloatMenu,
  Slider,
  Switch,
  TextView,
} from "frida-ui-runtime";

async function main(): Promise<void> {
  const menu = await FloatMenu.launch({
    title: "运行工具",
    width: 820,
    height: 1100,
    icon: {
      base64: iconBase64,
      width: 160,
      height: 160,
    },
    tabs: [
      { id: "controls", label: "控制" },
      { id: "status", label: "状态" },
    ],
    activeTab: "controls",
  }, async menu => {
    await menu.addComponent(
      new Switch("enabled", "启用", false),
      "controls",
    );
    await menu.addComponent(
      new Slider("level", "级别", 0, 10, 3),
      "controls",
    );
    await menu.addComponent(
      new Button("run", "运行", "primary", () => console.log("运行")),
      "controls",
    );
    await menu.addComponent(
      new TextView("status", "就绪"),
      "status",
    );
  });

  // 悬浮图标显示后，仍可动态添加组件。
  await menu.addComponent(new TextView("late", "稍后添加"), "status");
}

void main().catch(error => console.error(error));
```

`FloatMenu.launch()` 会等待使用方提供的 Java Bridge、Android 应用上下文和主线程，并在初始化回调完成后显示悬浮图标。

`frida-java-bridge` 是不限制版本的同级依赖。在使用项目中安装一个 Bridge 版本，并让包管理器将应用和此运行库解析到同一个实例。`7.0.4` 是本库开发时使用的版本。

运行库启动时会检查 `use`、`scheduleOnMainThread`，以及 `performNow` 或 `perform`。如果 Bridge 不兼容，将尽早抛出 `JavaBridgeCompatibilityError`，并列出缺失的能力。

## 生命周期

`FloatMenu` 会串行执行生命周期操作，避免并发调用重复挂载或移除同一个窗口。

```typescript
await menu.mount();          // 创建并挂载两个窗口，初始均隐藏
await menu.present("icon"); // 只显示悬浮图标
await menu.present("menu"); // 只显示菜单
await menu.conceal();        // 视觉上隐藏，图标所在位置仍可点击
await menu.toggle();         // 切换图标和菜单
await menu.dispose();        // 移除窗口并释放监听器和组件
```

`FloatMenu.create()` 仍可作为底层 API 使用，返回一个隐藏的菜单。Gadget 入口文件建议使用 `FloatMenu.launch()`。不指定模式时，`present()` 默认显示悬浮图标。

点击最小化按钮会返回可见的悬浮图标。点击关闭按钮会调用 `conceal()`：两个界面都在视觉上消失，但图标窗口会在原位置保持透明且可点击。点击该位置可直接重新打开菜单；关闭时也会显示 Toast 提示点击位置。在此期间，视图和组件状态仍保持挂载。

只有不再需要悬浮窗、可以释放其状态时，才调用 `dispose()`。

## 状态

```typescript
const snapshot = menu.captureState();
await menu.conceal();

await menu.present("menu");
menu.restoreState(snapshot);
```

组件 ID 必须唯一。重复的 ID 会被拒绝，不会静默替换已有组件。

启动后仍可添加或移除组件，包括悬浮窗隐藏期间：

```typescript
await menu.conceal();
await menu.addComponent(new TextView("dynamic", "隐藏期间添加"));
await menu.removeComponent("dynamic");
await menu.present();
```

## 悬浮窗权限

运行库会在挂载窗口前检查权限。如果缺少权限，会显示 Toast 并抛出 `OverlayPermissionError`。需要自定义 Toast 文案时，可设置 `permissionDeniedMessage`。

## 自定义图标

`icon.base64` 接受原始 Base64 数据或 `data:image/...;base64,` 格式的值，不支持文件路径或网络 URL。无效的图片数据会导致启动时抛出 `InvalidOverlayIconError`，而不是创建空白图标窗口。

## 组件

包的根入口导出：

- `Button`
- `Category`
- `CheckBoxGroup`
- `Collapsible`
- `NumberInput`
- `Selector`
- `Slider`
- `Switch`
- `TextInput`
- `TextView`（别名为 `Text`）
- 用于自定义控件的 `UIComponent`

所有组件回调都与 Java 监听器边界隔离。回调出错时会记录日志，不会将错误传播到 Android UI 线程。

## 构建与类型检查

```bash
npm run build
npm run check
```

## 兼容性说明

- 选择窗口类型时，会检查框架中可用的字段，而不是直接信任可能被伪造的 `SDK_INT` 值。
- 获取应用上下文时，会依次尝试 `ActivityThread` 和 `AppGlobals`。
- 会检查 `WindowManager` 包装对象是否提供 `addView`、`updateViewLayout` 和 `removeView`。这适用于 Guise 等模块允许接口转换、却隐藏继承自 `ViewManager` 的方法的环境。
- 使用显示指标前会先校验；如果指标被伪造且无效，会回退到真实的显示指标。
