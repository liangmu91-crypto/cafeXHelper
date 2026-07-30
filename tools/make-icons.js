// tools/make-icons.js — 纯 JS 生成 PNG 图标（无外部依赖）
// 生成 teal 圆角方块 + 白色 X 字形，尺寸 16/48/128。
// 用法：node tools/make-icons.js

const fs = require("fs");
const path = require("path");
const zlib = require("zlib");

const TEAL = [13, 148, 136]; // #0d9488
const WHITE = [255, 255, 255];

// ---------- 极简 PNG 编码（RGBA, 8bit） ----------
function crc32(buf) {
  let c = ~0;
  for (let i = 0; i < buf.length; i++) {
    c ^= buf[i];
    for (let k = 0; k < 8; k++) c = (c >>> 1) ^ (0xedb88320 & -(c & 1));
  }
  return ~c >>> 0;
}
function chunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length, 0);
  const typeBuf = Buffer.from(type, "ascii");
  const crcBuf = Buffer.alloc(4);
  crcBuf.writeUInt32BE(crc32(Buffer.concat([typeBuf, data])), 0);
  return Buffer.concat([len, typeBuf, data, crcBuf]);
}
function encodePng(width, height, rgba) {
  const sig = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 6; // color type RGBA
  ihdr[10] = 0;
  ihdr[11] = 0;
  ihdr[12] = 0;
  // 加过滤字节 0（None）每行开头
  const stride = width * 4;
  const raw = Buffer.alloc((stride + 1) * height);
  for (let y = 0; y < height; y++) {
    raw[y * (stride + 1)] = 0;
    rgba.copy(raw, y * (stride + 1) + 1, y * stride, y * stride + stride);
  }
  const idat = zlib.deflateSync(raw, { level: 9 });
  return Buffer.concat([sig, chunk("IHDR", ihdr), chunk("IDAT", idat), chunk("IEND", Buffer.alloc(0))]);
}

// ---------- 绘制 ----------
function makeIcon(size) {
  const rgba = Buffer.alloc(size * size * 4);
  const cx = (size - 1) / 2;
  const radius = size * 0.46; // 圆角方块近似为圆
  // 笔画宽度随尺寸缩放
  const stroke = Math.max(1.5, size * 0.14);
  // X 两条对角线：从 (m,p)→(n,q) 与 (n,p)→(m,q)
  const m = size * 0.3;
  const n = size * 0.7;
  const p = size * 0.3;
  const q = size * 0.7;

  const inStroke = (x, y, x1, y1, x2, y2) => {
    // 点到线段距离
    const dx = x2 - x1, dy = y2 - y1;
    const len2 = dx * dx + dy * dy || 1;
    let t = ((x - x1) * dx + (y - y1) * dy) / len2;
    t = Math.max(0, Math.min(1, t));
    const px = x1 + t * dx, py = y1 + t * dy;
    return Math.hypot(x - px, y - py) <= stroke / 2;
  };

  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const i = (y * size + x) * 4;
      const distC = Math.hypot(x - cx, y - cx);
      const fill = distC <= radius;
      if (!fill) {
        rgba[i] = 0; rgba[i + 1] = 0; rgba[i + 2] = 0; rgba[i + 3] = 0; // 透明
        continue;
      }
      // X 笔画
      const isX = inStroke(x, y, m, p, n, q) || inStroke(x, y, n, p, m, q);
      const c = isX ? WHITE : TEAL;
      rgba[i] = c[0]; rgba[i + 1] = c[1]; rgba[i + 2] = c[2]; rgba[i + 3] = 255;
    }
  }
  return encodePng(size, size, rgba);
}

const outDir = path.join(__dirname, "..", "icons");
if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });
[16, 48, 128].forEach((s) => {
  const p = path.join(outDir, `icon${s}.png`);
  fs.writeFileSync(p, makeIcon(s));
  console.log("wrote", p);
});
