import { API } from "../api";
import { UIComponent } from "./ui-components";
export class Selector extends UIComponent {
    constructor(id, items, selectedIndex = 0, handler) {
        super(id);
        this.items = items;
        this.selectedIndex = selectedIndex;
        this.value = items[selectedIndex];
        this.handler = handler;
    }
    getValue() {
        console.log(JSON.stringify(this.value));
        return this.value;
    }
    createView(context) {
        const Spinner = API.Spinner;
        const ArrayAdapter = API.ArrayAdapter;
        const String = API.JString;
        const R_layout = API.R_layout;
        this.view = Spinner.$new(context);
        this.view.setBackgroundColor(0xff555555 | 0);
        const javaItems = this.items.map((item) => String.$new(item.lable));
        const adapter = ArrayAdapter.$new(context, R_layout.simple_spinner_item.value, Java.array("java.lang.CharSequence", javaItems));
        adapter.setDropDownViewResource(R_layout.simple_spinner_dropdown_item.value);
        this.view.setAdapter(adapter);
        this.view.setSelection(this.selectedIndex);
        try {
            this.view.setPopupBackgroundResource(0xff333333 | 0);
        }
        catch (e) {
        }
        const AdapterViewOnItemSelectedListener = API.AdapterViewOnItemSelectedListener;
        const self = this;
        const itemSelectedListener = Java.registerClass({
            name: "com.frida.MyItemSelectedListener" +
                Date.now() +
                Math.random().toString(36).substring(6),
            implements: [AdapterViewOnItemSelectedListener],
            methods: {
                onItemSelected: function (parent, view, position, id) {
                    self.selectedIndex = position;
                    self.value = self.items[position];
                    console.log(JSON.stringify(self.value));
                    self.emit("valueChanged", self.value);
                    if (self.handler)
                        setImmediate(() => self.handler(self.value));
                },
                onNothingSelected: function (parent) {
                },
            },
        });
        this.view.setOnItemSelectedListener(itemSelectedListener.$new());
    }
    onValueChange(handler) {
        this.handler = handler;
    }
    updateView() {
        if (!this.view) {
            console.warn(`[Selector:${this.id}] Cannot update view - view not initialized`);
            return;
        }
        const index = this.items.findIndex((value) => value.lable == this.value.lable);
        if (index !== -1) {
            Java.scheduleOnMainThread(() => {
                this.view.setSelection(index);
            });
        }
    }
    setItems(items) {
        this.items = items;
        if (!this.view) {
            console.warn(`[Selector:${this.id}] Cannot set items - view not initialized`);
            return;
        }
        Java.scheduleOnMainThread(() => {
            try {
                const ArrayAdapter = API.ArrayAdapter;
                const context = this.view.getContext();
                const R_layout = API.R_layout;
                const String = API.JString;
                const javaItems = items.map((item) => String.$new(item.lable));
                const adapter = ArrayAdapter.$new(context, R_layout.simple_spinner_item.value, Java.array("java.lang.CharSequence", javaItems));
                adapter.setDropDownViewResource(R_layout.simple_spinner_dropdown_item.value);
                this.view.setAdapter(adapter);
            }
            catch (error) {
                console.error(`[Selector:${this.id}] Failed to set items:`, error);
            }
        });
    }
    getSelectedIndex() {
        return this.selectedIndex;
    }
}
