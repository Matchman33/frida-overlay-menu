export function windowToLogical(wx, wy, sw, sh, w, h) {
    return {
        x: Math.round(wx + (sw - w) / 2),
        y: Math.round(wy + (sh - h) / 2),
    };
}
export function logicalToWindow(lx, ly, sw, sh, w, h) {
    return {
        x: Math.round(lx - (sw - w) / 2),
        y: Math.round(ly - (sh - h) / 2),
    };
}
