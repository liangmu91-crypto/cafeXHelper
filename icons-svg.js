// icons-svg.js — 内联 SVG 图标字符串（Lucide 风格，stroke-based，currentColor）
// 全局挂在 window.XICONS。每个返回 <svg> 字符串。

(function () {
  const wrap = (paths, opts = {}) => {
    const { size = 20, fill = "none", strokeW = 2 } = opts;
    return `<svg class="icon" width="${size}" height="${size}" viewBox="0 0 24 24" fill="${fill}" stroke="currentColor" stroke-width="${strokeW}" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${paths}</svg>`;
  };

  window.XICONS = {
    check: (o) => wrap('<polyline points="20 6 9 17 4 12"/>', o),
    checkCircle: (o) => wrap('<path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/>', o),
    user: (o) => wrap('<path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/>', o),
    list: (o) => wrap('<line x1="8" y1="6" x2="21" y2="6"/><line x1="8" y1="12" x2="21" y2="12"/><line x1="8" y1="18" x2="21" y2="18"/><line x1="3" y1="6" x2="3.01" y2="6"/><line x1="3" y1="12" x2="3.01" y2="12"/><line x1="3" y1="18" x2="3.01" y2="18"/>', o),
    settings: (o) => wrap('<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/>', o),
    refresh: (o) => wrap('<polyline points="23 4 23 10 17 10"/><polyline points="1 20 1 14 7 14"/><path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"/>', o),
    external: (o) => wrap('<path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/><polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/>', o),
    twitter: (o) =>
      wrap('<path d="M18.244 2H21.5l-7.5 8.57L22.5 22h-6.844l-5.36-7.01L4.16 22H.9l8.02-9.17L1.5 2h6.99l4.84 6.4L18.244 2zm-1.2 18h1.9L7.04 4H5.02l12.024 16z"/>', {
        ...o,
        fill: "currentColor",
        strokeW: 0,
      }),
    sparkles: (o) => wrap('<path d="M12 3l1.9 4.6L18.5 9.5l-4.6 1.9L12 16l-1.9-4.6L5.5 9.5l4.6-1.9L12 3z"/><path d="M19 14l.9 2.2L22 17l-2.1.8L19 20l-.9-2.2L16 17l2.1-.8L19 14z"/>', o),
    sync: (o) => wrap('<polyline points="23 4 23 10 17 10"/><polyline points="1 20 1 14 7 14"/><path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"/>', o),
  };
})();
