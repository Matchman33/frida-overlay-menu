export type Theme = {
  colors: {
    overlayBg: number;
    cardBg: number;
    text: number;
    subText: number;
    accent: number;
    danger: number;
    divider: number;
    controlBg: number;
    controlStroke: number;

    // ✅ 交互态（可选）：用于可点/可编辑元素的强调
    accentSoft?: number;   // accent 的柔和底色（带 alpha）
    accentStroke?: number; // accent 描边（更亮更醒目）

    // ✅ 新增（可选）：让新 role 更好看
    rowBg?: number;     // row/列表行更浅的底色
    inputBg?: number;   // EditText 背景
    chipBg?: number;    // chip 背景
  };
  radiusDp: { overlay: number; card: number; control: number };
  textSp: { title: number; body: number; caption: number };
};
export const DarkNeonTheme: Theme = {
  colors: {
    overlayBg: 0xcc0b0f1a | 0,
    cardBg: 0xe61a1f2e | 0,
    text: 0xffeaf0ff | 0,
    subText: 0xff9aa4b2 | 0,
    accent: 0xff3b82f6 | 0,
    danger: 0xffef4444 | 0,
    divider: 0x22ffffff | 0,
    controlBg: 0x33111827 | 0,
    controlStroke: 0x333b82f6 | 0,

    // ✅ 交互态：用于 input / category 等需要更“像控件”的块
    accentSoft: 0x223b82f6 | 0,
    accentStroke: 0x663b82f6 | 0,

    // ✅ 新增
    rowBg: 0x1a111827 | 0,    // 比 cardBg 更浅一点
    inputBg: 0x2a111827 | 0,  // 和 controlBg 接近即可
    chipBg: 0x22111827 | 0,
  },
  radiusDp: { overlay: 16, card: 14, control: 12 },
  textSp: { title: 14, body: 13, caption: 11 },
};