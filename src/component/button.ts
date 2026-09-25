import Java from "../java-runtime.js";
import { API } from "../api.js";
import { Logger } from "../logger.js";
import { deferSafe } from "../runtime/safe-runtime.js";
import { createJavaListener } from "../android-listener.js";
import { applyStyle } from "./style/style.js";
import { UIComponent } from "./ui-components.js";

export class Button extends UIComponent {
  private label: string;
  private handler?: () => void;
  private kind: "primary" | "danger" = "primary";

  constructor(
    id: string,
    label: string,
    kind: "primary" | "danger" = "primary",
    handler?: () => void,
  ) {
    super(id);
    this.label = label;
    this.kind = kind;
    this.handler = handler;
    this.value = null;
  }

  protected createView(context: any): void {
    const Button = API.Button;
    const String = API.JString;
    const Gravity = API.Gravity;

    this.view = Button.$new(context);
    // this.view.setText(String.$new(this.label));
    this.view.setText.overload('java.lang.CharSequence').call(this.view, this.label);

    applyStyle(
      this.view,
      this.kind === "danger" ? "dangerButton" : "primaryButton",
      this.menu.options.theme!,
    );

    try {
      this.view.setGravity(Gravity.CENTER.value);
    } catch (_e) {}

    const OnClickListener = API.OnClickListener;
    const self = this;
    const clickListener = createJavaListener({
      key: "view-click",
      interfaceClass: OnClickListener,
      callbacks: {
        onClick: (_v: any) => {
          self.emit("click");
          if (self.handler) {
            deferSafe(`Button:${self.id}:click`, self.handler);
          }
        },
      },
    });
    this.own(() => clickListener.dispose());
    this.view.setOnClickListener(clickListener.instance);
  }

  protected updateView(): void {
    // Button value doesn't affect UI
  }

  public setLabel(label: string): void {
    this.label = label;
    if (!this.view) {
      Logger.instance.warn(
        `[Button:${this.id}] Cannot set label - view not initialized`,
      );
      return;
    }
    Java.scheduleOnMainThread(() => {
      const String = API.JString;
      // this.view.setText(String.$new(label));
      this.view.setText.overload('java.lang.CharSequence').call(this.view, label);
    });
  }

  public onClick(handler: () => void): void {
    this.handler = handler;
  }
}
