/**
 * 真实坐标转换为逻辑坐标，以左上角为原点转换为屏幕中心为原点
 * @param wx
 * @param wy
 * @returns
 */
export function windowToLogical(
  wx: number,
  wy: number,
  sw: number,
  sh: number,
  w: number,
  h: number,
) {

  return {
    x: Math.round(wx + (sw - w) / 2),
    y: Math.round(wy + (sh - h) / 2),
  };
}

/**
 * 逻辑坐标转换为真实坐标，以左上角为原点转换为屏幕中心为原点
 * @param lx
 * @param ly
 * @returns
 */
export function logicalToWindow(
  lx: number,
  ly: number,
  sw: number,
  sh: number,
  w: number,
  h: number,
) {
  return {
    x: Math.round(lx - (sw - w) / 2),
    y: Math.round(ly - (sh - h) / 2),
  };
}
