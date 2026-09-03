import {expect,test} from "bun:test";
import {setBarItemValue} from "./util";

test("numeric tool sliders retain zero through their native setter", () => {
  const globals = globalThis as unknown as Record<string, unknown>;
  const before = globals.BarItems;
  let stored = 255;
  const item = {value:255,setValue(value:number){stored=value;this.value=value;},update(){this.value=stored;}};
  try {
    globals.BarItems={slider_brush_opacity:item};
    setBarItemValue("slider_brush_opacity",0);
    item.update();
    expect(stored).toBe(0);expect(item.value).toBe(0);
  } finally {if(before===undefined)delete globals.BarItems;else globals.BarItems=before;}
});
