import { API } from '../context/AuthContext';

/* ---------- Periods ---------- */
export const PERIODS = [
  { value: 'year', short: 'Full year', label: 'Full year', months: [0, 11] },
  { value: 'h1', short: 'H1', label: 'First half', months: [0, 5] },
  { value: 'h2', short: 'H2', label: 'Second half', months: [6, 11] },
  { value: 'q1', short: 'Q1', label: 'Quarter 1', months: [0, 2] },
  { value: 'q2', short: 'Q2', label: 'Quarter 2', months: [3, 5] },
  { value: 'q3', short: 'Q3', label: 'Quarter 3', months: [6, 8] },
  { value: 'q4', short: 'Q4', label: 'Quarter 4', months: [9, 11] },
  { value: 'q1-q3', short: 'Q1–Q3', label: 'Three quarters', months: [0, 8] },
  { value: 'q2-q4', short: 'Q2–Q4', label: 'Three quarters', months: [3, 11] }
];
export const PERIOD_GROUPS = [
  { label: 'Year', values: ['year'] },
  { label: 'Half year', values: ['h1', 'h2'] },
  { label: 'Quarter', values: ['q1', 'q2', 'q3', 'q4'] }
];
export const periodOf = value => PERIODS.find(period => period.value === value) || PERIODS[0];

const monthName = (year, month) => new Intl.DateTimeFormat(undefined, { month: 'short' }).format(new Date(year, month, 1));
export const rangeLabel = (year, value) => {
  const { months: [from, to] } = periodOf(value);
  return from === 0 && to === 11 ? `January – December ${year}` : `${monthName(year, from)} – ${monthName(year, to)} ${year}`;
};
export const defaultTitle = (year, value) => (value === 'year' ? `My ${year} vision` : `${periodOf(value).short} ${year} vision`);

/* ---------- Themes & words colors (shared by the board UI and the export) ---------- */
// 'lime' is the stored value for the board theme that follows the dashboard theme colour (kept for existing boards).
export const THEMES = [
  { value: 'lime', label: 'Theme color', swatch: 'linear-gradient(160deg, color-mix(in srgb, var(--lime) 62%, #ffffff), color-mix(in srgb, var(--lime) 14%, #ffffff))' },
  { value: 'cream', label: 'Cream', swatch: 'linear-gradient(160deg, #f6efe2, #fffaf2)' },
  { value: 'midnight', label: 'Midnight', swatch: 'radial-gradient(circle at 50% 0%, color-mix(in srgb, var(--lime) 30%, #0e0f0c), #0e0f0c 70%)' }
];
export const WORD_COLORS = [
  { value: 'lime', label: 'Lime', bg: '#d8f36a', fg: '#1a2000' },
  { value: 'yellow', label: 'Sun', bg: '#f8d44c', fg: '#2a2100' },
  { value: 'pink', label: 'Blush', bg: '#ffc8e8', fg: '#3b0a2a' },
  { value: 'blue', label: 'Sky', bg: '#cdebff', fg: '#06223a' },
  { value: 'ink', label: 'Ink', bg: '#111111', fg: '#ffffff' }
];
export const wordColor = value => WORD_COLORS.find(color => color.value === value) || WORD_COLORS[0];

/* ---------- Export formats ---------- */
export const FORMATS = [
  { value: 'print-a4', group: 'Print', label: 'A4 print', detail: '210 × 297 mm · 300 dpi', icon: 'print', width: 2480, height: 3508, print: { size: 'A4' } },
  { value: 'print-letter', group: 'Print', label: 'US Letter print', detail: '8.5 × 11 in · 300 dpi', icon: 'print', width: 2550, height: 3300, print: { size: 'letter' } },
  { value: 'desktop', group: 'Wallpaper', label: 'Desktop wallpaper', detail: '3840 × 2160 · 4K', icon: 'desktop_windows', width: 3840, height: 2160 },
  { value: 'phone', group: 'Wallpaper', label: 'Phone wallpaper', detail: '1290 × 2796 · iPhone', icon: 'smartphone', width: 1290, height: 2796, lockScreen: true },
  { value: 'tablet', group: 'Wallpaper', label: 'Tablet wallpaper', detail: '2048 × 2732 · iPad', icon: 'tablet_mac', width: 2048, height: 2732 }
];

/* ---------- Image helpers ---------- */

/** Resizes an uploaded photo so it fits the API limit while staying sharp enough to print. */
export const resizeUpload = file => new Promise((resolve, reject) => {
  const url = URL.createObjectURL(file);
  const image = new Image();
  image.onload = () => {
    const attempt = (maxSide, quality) => {
      const scale = Math.min(1, maxSide / Math.max(image.naturalWidth, image.naturalHeight));
      const canvas = document.createElement('canvas');
      canvas.width = Math.round(image.naturalWidth * scale);
      canvas.height = Math.round(image.naturalHeight * scale);
      const context = canvas.getContext('2d');
      context.imageSmoothingQuality = 'high';
      context.drawImage(image, 0, 0, canvas.width, canvas.height);
      return { dataUrl: canvas.toDataURL('image/jpeg', quality), width: canvas.width, height: canvas.height };
    };
    let result = attempt(1400, 0.82);
    if (result.dataUrl.length > 680 * 1024) result = attempt(1100, 0.72);
    if (result.dataUrl.length > 680 * 1024) result = attempt(900, 0.65);
    URL.revokeObjectURL(url);
    resolve(result);
  };
  image.onerror = () => { URL.revokeObjectURL(url); reject(new Error('unreadable')); };
  image.src = url;
});

const loadImage = src => new Promise((resolve, reject) => {
  const image = new Image();
  image.onload = () => resolve(image);
  image.onerror = reject;
  image.src = src;
});

/** Pinterest images have no CORS headers, so they go through our authenticated proxy for canvas export. */
const loadItemImage = async item => {
  if (item.imageUrl.startsWith('data:')) return loadImage(item.imageUrl);
  const response = await API.get('/vision/proxy', { params: { url: item.imageUrl }, responseType: 'blob' });
  const objectUrl = URL.createObjectURL(response.data);
  try { return await loadImage(objectUrl); } finally { setTimeout(() => URL.revokeObjectURL(objectUrl), 0); }
};

/* ---------- Collage renderer ---------- */
const FONT = '-apple-system, BlinkMacSystemFont, "SF Pro Display", Inter, "Segoe UI", sans-serif';

/** Mixes `hex` with `target` (weight = share of `hex`), for canvas colours that follow the theme. */
const mixHex = (hex, target, weight) => {
  const rgb = value => [1, 3, 5].map(index => parseInt(value.slice(index, index + 2), 16));
  const [a, b] = [rgb(hex), rgb(target)];
  return `#${a.map((value, index) => Math.round(value * weight + b[index] * (1 - weight)).toString(16).padStart(2, '0')).join('')}`;
};

const THEME_PAINT = {
  lime: { text: '#111111', sub: 'rgba(17,17,17,.62)', paint: (ctx, w, h, accent) => { const g = ctx.createLinearGradient(0, 0, 0, h); g.addColorStop(0, mixHex(accent, '#ffffff', 0.6)); g.addColorStop(0.55, mixHex(accent, '#ffffff', 0.3)); g.addColorStop(1, mixHex(accent, '#ffffff', 0.07)); return g; } },
  cream: { text: '#2b2620', sub: 'rgba(43,38,32,.6)', paint: (ctx, w, h) => { const g = ctx.createLinearGradient(0, 0, w, h); g.addColorStop(0, '#f6efe2'); g.addColorStop(1, '#fffaf2'); return g; } },
  midnight: { text: '#f5f5f7', sub: 'rgba(245,245,247,.62)', paint: (ctx, w, h, accent) => { const g = ctx.createRadialGradient(w / 2, 0, 0, w / 2, 0, Math.max(w, h) * 0.9); g.addColorStop(0, mixHex(accent, '#0e0f0c', 0.3)); g.addColorStop(0.55, '#15170f'); g.addColorStop(1, '#0b0c09'); return g; } }
};

const roundRect = (ctx, x, y, w, h, r) => {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
};

const wrapLines = (ctx, text, maxWidth) => {
  const words = text.split(/\s+/);
  const lines = [];
  let line = '';
  words.forEach(word => {
    const next = line ? `${line} ${word}` : word;
    if (ctx.measureText(next).width > maxWidth && line) { lines.push(line); line = word; } else line = next;
  });
  if (line) lines.push(line);
  return lines;
};

/** Picks a column count whose cells best match the target tile shape while leaving few empty cells. */
const chooseGrid = (count, width, height, gap, target) => {
  let best = { cols: 1, rows: count, score: Infinity };
  for (let cols = 1; cols <= count; cols += 1) {
    const rows = Math.ceil(count / cols);
    const cellW = (width - gap * (cols - 1)) / cols;
    const cellH = (height - gap * (rows - 1)) / rows;
    const score = Math.abs(Math.log((cellW / cellH) / target)) + (cols * rows - count) * 0.18;
    if (score < best.score) best = { cols, rows, cellW, cellH, score };
  }
  return best;
};

/**
 * Draws the board as a collage on a canvas.
 * `scale` < 1 renders a quick preview with the identical layout.
 */
export async function renderBoard({ board, format, scale = 1, images, accent = '#d8f36a' }) {
  const width = Math.round(format.width * scale);
  const height = Math.round(format.height * scale);
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  const theme = THEME_PAINT[board.theme] || THEME_PAINT.lime;
  const unit = Math.min(width, height);
  const pad = unit * 0.06;
  const gap = unit * 0.018;
  const radius = unit * 0.022;

  if (document.fonts?.ready) await document.fonts.ready;

  ctx.fillStyle = theme.paint(ctx, width, height, /^#[0-9a-f]{6}$/i.test(accent) ? accent : '#d8f36a');
  ctx.fillRect(0, 0, width, height);

  // Header (title + period). On phone wallpapers it sits at the bottom, clear of the lock-screen clock.
  const titleSize = unit * (format.width > format.height ? 0.06 : 0.07);
  const subSize = titleSize * 0.42;
  const headerH = titleSize * 1.15 + subSize * 1.9;
  const title = board.title || defaultTitle(board.year, board.period);
  const drawHeader = top => {
    ctx.fillStyle = theme.text;
    ctx.textBaseline = 'top';
    ctx.textAlign = 'left';
    ctx.font = `700 ${titleSize}px ${FONT}`;
    ctx.fillText(title, pad, top, width - pad * 2);
    ctx.fillStyle = theme.sub;
    ctx.font = `italic 300 ${subSize}px ${FONT}`;
    ctx.fillText(rangeLabel(board.year, board.period), pad, top + titleSize * 1.2, width - pad * 2);
  };

  let gridTop;
  let gridBottom;
  if (format.lockScreen) {
    gridTop = height * 0.27;
    gridBottom = height - pad - headerH - gap * 2;
    drawHeader(height - pad - headerH);
  } else {
    drawHeader(pad);
    gridTop = pad + headerH + gap * 1.5;
    gridBottom = height - pad;
  }

  const items = board.items;
  if (!items.length) return canvas;
  const gridW = width - pad * 2;
  const gridH = gridBottom - gridTop;
  const grid = chooseGrid(items.length, gridW, gridH, gap, format.width > format.height ? 1.05 : 0.8);

  items.forEach((item, index) => {
    const row = Math.floor(index / grid.cols);
    const col = index % grid.cols;
    const inRow = row === grid.rows - 1 ? items.length - row * grid.cols : grid.cols;
    const offset = ((grid.cols - inRow) * (grid.cellW + gap)) / 2; // center a partial last row
    const x = pad + offset + col * (grid.cellW + gap);
    const y = gridTop + row * (grid.cellH + gap);
    const w = grid.cellW;
    const h = grid.cellH;

    ctx.save();
    roundRect(ctx, x, y, w, h, radius);
    ctx.clip();

    if (item.type === 'text') {
      const color = wordColor(item.color);
      ctx.fillStyle = color.bg;
      ctx.fillRect(x, y, w, h);
      ctx.fillStyle = color.fg;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      let size = Math.min(w, h) * 0.16;
      let lines;
      do {
        ctx.font = `700 ${size}px ${FONT}`;
        lines = wrapLines(ctx, item.text, w * 0.82);
        size *= 0.9;
      } while ((lines.length * size * 1.25 > h * 0.8 || lines.some(line => ctx.measureText(line).width > w * 0.86)) && size > 6);
      const lineH = size / 0.9 * 1.2;
      lines.forEach((line, lineIndex) => ctx.fillText(line, x + w / 2, y + h / 2 + (lineIndex - (lines.length - 1) / 2) * lineH));
    } else {
      const image = images.get(item._id);
      if (image) {
        const ratio = Math.max(w / image.naturalWidth, h / image.naturalHeight);
        const drawW = image.naturalWidth * ratio;
        const drawH = image.naturalHeight * ratio;
        ctx.drawImage(image, x + (w - drawW) / 2, y + (h - drawH) / 2, drawW, drawH);
      } else {
        ctx.fillStyle = 'rgba(120,120,128,.18)';
        ctx.fillRect(x, y, w, h);
      }
      if (item.caption) {
        const capSize = Math.max(8, Math.min(w, h) * 0.075);
        const shade = ctx.createLinearGradient(0, y + h - capSize * 3.2, 0, y + h);
        shade.addColorStop(0, 'rgba(0,0,0,0)');
        shade.addColorStop(1, 'rgba(0,0,0,.55)');
        ctx.fillStyle = shade;
        ctx.fillRect(x, y + h - capSize * 3.2, w, capSize * 3.2);
        ctx.fillStyle = '#ffffff';
        ctx.font = `600 ${capSize}px ${FONT}`;
        ctx.textAlign = 'left';
        ctx.textBaseline = 'bottom';
        ctx.fillText(item.caption, x + capSize * 0.8, y + h - capSize * 0.7, w - capSize * 1.6);
      }
    }
    ctx.restore();
  });
  return canvas;
}

/** Loads every image once (shared by preview and full-size render). Missing images render as placeholders. */
export async function loadBoardImages(items) {
  const images = new Map();
  await Promise.all(items.filter(item => item.type === 'image').map(async item => {
    try { images.set(item._id, await loadItemImage(item)); } catch { /* placeholder tile */ }
  }));
  return images;
}

export const canvasToBlob = canvas => new Promise(resolve => canvas.toBlob(resolve, 'image/png'));

export const downloadBlob = (blob, filename) => {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
};

/** Prints the rendered board edge-to-edge on the chosen paper size via a hidden iframe. */
export const printBlob = (blob, paper) => new Promise(resolve => {
  const url = URL.createObjectURL(blob);
  const frame = document.createElement('iframe');
  frame.setAttribute('aria-hidden', 'true');
  frame.style.cssText = 'position:fixed;right:0;bottom:0;width:0;height:0;border:0;';
  document.body.appendChild(frame);
  const doc = frame.contentDocument;
  doc.open();
  doc.write(`<!doctype html><html><head><title>Vision board</title><style>@page{size:${paper} portrait;margin:0}html,body{margin:0;height:100%}img{display:block;width:100%;height:100%;object-fit:contain}</style></head><body><img src="${url}" alt=""></body></html>`);
  doc.close();
  const image = doc.querySelector('img');
  const go = () => {
    frame.contentWindow.focus();
    frame.contentWindow.print();
    setTimeout(() => { frame.remove(); URL.revokeObjectURL(url); resolve(); }, 1500);
  };
  if (image.complete) go(); else image.onload = go;
});
