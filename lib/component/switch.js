import { API } from "../api";
import { applyStyle } from "./style/style";
import { UIComponent } from "./ui-components";
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
        const row = LinearLayout.$new(context);
        row.setOrientation(LinearLayout.HORIZONTAL.value);
        row.setGravity(Gravity.CENTER_VERTICAL.value);
        applyStyle(row, "row", this.menu.options.theme);
        const label = TextView.$new(context);
        label.setText(String.$new(this.label));
        applyStyle(label, "text", this.menu.options.theme);
        label.setLayoutParams(LinearLayoutParams.$new(0, ViewGroupLayoutParams.WRAP_CONTENT.value, 1));
        const sw = Switch.$new(context);
        sw.setChecked(this.value);
        sw.setText(String.$new(""));
        row.addView(label);
        row.addView(sw);
        this.view = row;
        this.switchView = sw;
        this.labelView = label;
        const Listener = API.CompoundButtonOnCheckedChangeListener;
        const self = this;
        const changeListener = Java.registerClass({
            name: "com.frida.MyCheckedChangeListener" +
                Date.now() +
                Math.random().toString(36).substring(6),
            implements: [Listener],
            methods: {
                onCheckedChanged: function (_btn, isChecked) {
                    self.value = isChecked;
                    self.emit("valueChanged", isChecked);
                    if (self.handler)
                        setImmediate(() => self.handler(isChecked));
                },
            },
        });
        this.switchView.setOnCheckedChangeListener(changeListener.$new());
    }
    updateView() {
        if (!this.view)
            return;
        Java.scheduleOnMainThread(() => {
            if (this.switchView)
                this.switchView.setChecked(this.value);
        });
    }
    setLabel(label) {
        this.label = label;
        if (!this.view)
            return;
        Java.scheduleOnMainThread(() => {
            const String = API.JString;
            if (this.labelView)
                this.labelView.setText(String.$new(label));
        });
    }
}
