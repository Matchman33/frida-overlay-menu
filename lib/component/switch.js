import Java from "../java-runtime.js";
import { API } from "../api.js";
import { applyStyle, dp } from "./style/style.js";
import { UIComponent } from "./ui-components.js";
import { deferSafe } from "../runtime/safe-runtime.js";
import { createJavaListener } from "../android-listener.js";
export class Switch extends UIComponent {
    onValueChange(handler) {
        this.handler = handler;
    }
    constructor(id, label, initialValue = false, handler) {
        super(id);
        this.label = label;
        this.value = initialValue;
        this.handler = handler;
    }
    createView(context) {
        const LinearLayout = API.LinearLayout;
        const LinearLayoutParams = API.LinearLayoutParams;
        const ViewGroupLayoutParams = API.ViewGroupLayoutParams;
        const Gravity = API.Gravity;
        const TextView = API.TextView;
        const Switch = API.Switch;
        const String = API.JString;
        const OnClickListener = API.OnClickListener;
        const OnCheckedChangeListener = API.OnCheckedChangeListener;
        const theme = this.menu.options.theme;
        const row = LinearLayout.$new(context);
        row.setOrientation(LinearLayout.HORIZONTAL.value);
        row.setGravity(Gravity.CENTER_VERTICAL.value);
        applyStyle(row, "row", theme);
        row.setPadding(dp(context, 14), dp(context, 12), dp(context, 14), dp(context, 12));
        const label = TextView.$new(context);
        label.setText.overload('java.lang.CharSequence').call(label, this.label);
        applyStyle(label, "text", theme);
        label.setTextSize(2, 14);
        try {
            label.setTypeface(null, 1);
        }
        catch (_e) { }
        label.setSingleLine(true);
        label.setGravity(Gravity.LEFT.value | Gravity.CENTER_VERTICAL.value);
        label.setLayoutParams(LinearLayoutParams.$new(0, ViewGroupLayoutParams.WRAP_CONTENT.value, 1.0));
        const sw = Switch.$new(context);
        sw.setText.overload('java.lang.CharSequence').call(sw, "");
        sw.setChecked(!!this.value);
        sw.setShowText(false);
        try {
            sw.setMinWidth(dp(context, 50));
            sw.setMinimumWidth(dp(context, 50));
        }
        catch (_e) { }
        try {
            sw.setSwitchMinWidth(dp(context, 50));
        }
        catch (_e) { }
        try {
            sw.setScaleX(1.05);
            sw.setScaleY(1.05);
        }
        catch (_e) { }
        const switchLp = LinearLayoutParams.$new(ViewGroupLayoutParams.WRAP_CONTENT.value, ViewGroupLayoutParams.WRAP_CONTENT.value);
        switchLp.leftMargin = dp(context, 12);
        sw.setLayoutParams(switchLp);
        const self = this;
        const checkedListener = createJavaListener({
            key: "compound-button-checked-change",
            interfaceClass: OnCheckedChangeListener,
            callbacks: {
                onCheckedChanged: (_buttonView, isChecked) => {
                    self.value = !!isChecked;
                    self.emit("valueChanged", self.value);
                    if (self.handler) {
                        deferSafe(`Switch:${self.id}:valueChanged`, () => self.handler(self.value));
                    }
                },
            },
        });
        this.own(() => checkedListener.dispose());
        sw.setOnCheckedChangeListener(checkedListener.instance);
        const clickListener = createJavaListener({
            key: "view-click",
            interfaceClass: OnClickListener,
            callbacks: {
                onClick: (_v) => {
                    if (!self.switchView)
                        return;
                    self.switchView.setChecked(!self.switchView.isChecked());
                },
            },
        });
        this.own(() => clickListener.dispose());
        row.setClickable(true);
        row.setOnClickListener(clickListener.instance);
        row.addView(label);
        row.addView(sw);
        this.labelView = label;
        this.switchView = sw;
        this.view = row;
    }
    updateView() {
        if (!this.switchView)
            return;
        Java.scheduleOnMainThread(() => {
            this.switchView.setChecked(!!this.value);
        });
    }
    setLabel(label) {
        this.label = label;
        if (!this.labelView)
            return;
        Java.scheduleOnMainThread(() => {
            const String = API.JString;
            this.labelView.setText.overload('java.lang.CharSequence').call(this.labelView, String.$new(label));
        });
    }
}
