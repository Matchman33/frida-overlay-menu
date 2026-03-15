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

    accentSoft?: number;
    accentStroke?: number;

    rowBg?: number;
    inputBg?: number;
    chipBg?: number;

    // 新增：更接近图里的信息块/说明块
    infoCardBg?: number;
    noteCardBg?: number;
    sectionText?: number;
    buttonText?: number;
  };
  radiusDp: { overlay: number; card: number; control: number };
  textSp: { title: number; body: number; caption: number };
};

export const DarkNeonTheme: Theme = {
  colors: {
    // 主面板背景：更接近图里的深蓝黑，稍微带透明
    overlayBg: 0xE60a1426 | 0,

    // 卡片背景：比主面板稍亮一点，形成层级
    cardBg: 0xee101b31 | 0,

    // 主文字 / 次文字
    text: 0xfff3f6ff | 0,
    subText: 0xff8fa5c7 | 0,

    // 主强调蓝
    accent: 0xff0f6cff | 0,
    danger: 0xffef4444 | 0,

    // 线条 / 分隔线
    divider: 0x263b5f93 | 0,
    controlBg: 0x44111d33 | 0,
    controlStroke: 0x2e4d79b8 | 0,

    // 软蓝背景 / 蓝色描边
    accentSoft: 0x1a0f6cff | 0,
    accentStroke: 0xaa1f63ff | 0,

    // 行背景 / 输入框 / chip
    rowBg: 0x70111a2d | 0,
    inputBg: 0x66101a2d | 0,
    chipBg: 0x40111827 | 0,

    // 信息块 / note 卡片
    infoCardBg: 0xcc102347 | 0,
    noteCardBg: 0xd0122344 | 0,

    sectionText: 0xffb4c3dc | 0,
    buttonText: 0xffffffff | 0,
  },

  // 主面板圆角略大一点，更像图里那种壳
  radiusDp: { overlay: 18, card: 14, control: 12 },

  // 标题略大一点更接近截图
  textSp: { title: 15, body: 13, caption: 12 },
};
