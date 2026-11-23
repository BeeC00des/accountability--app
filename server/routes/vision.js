const express = require('express');
const { body, query } = require('express-validator');
const VisionBoard = require('../models/VisionBoard');
const Goal = require('../models/Goal');
const { suggestGoals } = require('../services/goalSuggestions');
const { PERIODS, THEMES, TEXT_COLORS } = require('../models/VisionBoard');
const { protect } = require('../middleware/auth');
const User = require('../models/User');
const { requireObjectIds, handleValidation } = require('../utils/validate');

const router = express.Router();
router.use(protect);

const MAX_ITEMS = 40;
const MAX_UPLOAD_LENGTH = 700 * 1024; // data URL chars (~520KB image); clients resize first
const PINIMG = /^https:\/\/i\.pinimg\.com\/[\w/.-]+\.(?:jpe?g|png|webp|gif)$/i;
const UPLOAD = /^data:image\/(?:png|jpeg|webp);base64,[A-Za-z0-9+/=]+$/;
const PINTEREST_HOST = /(^|\.)pinterest\.(?:com|[a-z]{2,3}(?:\.[a-z]{2})?)$/i;
const BROWSER_UA = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124 Safari/537.36';

const boardKey = [
  body('year').isInt({ min: 2020, max: 2100 }).withMessage('Choose a year between 2020 and 2100.').toInt(),
  body('period').isIn(PERIODS).withMessage('Choose a valid period.')
];

const summarize = board => ({
  _id: board._id,
  year: board.year,
  period: board.period,
  title: board.title,
  theme: board.theme,
  count: board.items.length,
  updatedAt: board.updatedAt
});

// GET /api/vision/boards?year=2027 - Which periods already have boards (for the period picker)
router.get('/boards', [query('year').isInt({ min: 2020, max: 2100 }).toInt(), handleValidation], async (req, res) => {
  try {
    const boards = await VisionBoard.find({ owner: req.user._id, year: req.query.year }).select('year period title theme items._id updatedAt');
    res.json({ boards: boards.map(summarize) });
  } catch (error) {
    console.error('List vision boards error:', error);
    res.status(500).json({ message: 'Could not load your vision boards.' });
  }
});

// GET /api/vision?year=2027&period=year - One board (an unsaved empty board if none yet)
router.get('/', [
  query('year').isInt({ min: 2020, max: 2100 }).withMessage('Choose a valid year.').toInt(),
  query('period').isIn(PERIODS).withMessage('Choose a valid period.'),
  handleValidation
], async (req, res) => {
  try {
    const board = await VisionBoard.findOne({ owner: req.user._id, year: req.query.year, period: req.query.period });
    res.json({ board: board || { _id: null, year: req.query.year, period: req.query.period, title: '', theme: 'lime', items: [] } });
  } catch (error) {
    console.error('Get vision board error:', error);
    res.status(500).json({ message: 'Could not load this vision board.' });
  }
});

// GET /api/vision/suggestions?year=2027&period=year - Goals (with dated steps) suggested from what's on the board
router.get('/suggestions', [
  query('year').isInt({ min: 2020, max: 2100 }).toInt(),
  query('period').isIn(PERIODS),
  handleValidation
], async (req, res) => {
  try {
    const [board, goals] = await Promise.all([
      VisionBoard.findOne({ owner: req.user._id, year: req.query.year, period: req.query.period }).select('year period items.type items.text items.topic items.caption'),
      Goal.find({ owner: req.user._id, isActive: true }).select('title')
    ]);
    res.json({ suggestions: board ? suggestGoals({ board, existingTitles: goals.map(goal => goal.title) }) : [] });
  } catch (error) {
    console.error('Goal suggestions error:', error);
    res.status(500).json({ message: 'Could not suggest goals.' });
  }
});

// PUT /api/vision - Create or update a board's title/theme
router.put('/', [
  ...boardKey,
  body('title').optional().isString().trim().isLength({ max: 60 }).withMessage('Titles can be up to 60 characters.'),
  body('theme').optional().isIn(THEMES),
  handleValidation
], async (req, res) => {
  try {
    const update = {};
    if (req.body.title !== undefined) update.title = req.body.title;
    if (req.body.theme !== undefined) update.theme = req.body.theme;
    const board = await VisionBoard.findOneAndUpdate(
      { owner: req.user._id, year: req.body.year, period: req.body.period },
      { $set: update, $setOnInsert: { owner: req.user._id, year: req.body.year, period: req.body.period } },
      { new: true, upsert: true, runValidators: true }
    );
    res.json({ board });
  } catch (error) {
    console.error('Save vision board error:', error);
    res.status(500).json({ message: 'Could not save this vision board.' });
  }
});

// POST /api/vision/items - Add an image (Pinterest or upload) or a words card
router.post('/items', [
  ...boardKey,
  body('item.type').isIn(['image', 'text']).withMessage('Choose an image or words.'),
  body('item.caption').optional().isString().trim().isLength({ max: 80 }).withMessage('Captions can be up to 80 characters.'),
  body('item').custom(item => {
    if (item.type === 'text') {
      if (typeof item.text !== 'string' || !item.text.trim() || item.text.trim().length > 120) throw new Error('Words cards need 1–120 characters.');
      if (item.color && !TEXT_COLORS.includes(item.color)) throw new Error('Choose a valid color.');
      return true;
    }
    if (item.source === 'pinterest' && typeof item.imageUrl === 'string' && PINIMG.test(item.imageUrl)) return true;
    if (item.source === 'openverse' && typeof item.imageUrl === 'string' && OPENVERSE_IMG.test(item.imageUrl)) return true;
    if (item.source === 'upload' && typeof item.imageUrl === 'string' && item.imageUrl.length <= MAX_UPLOAD_LENGTH && UPLOAD.test(item.imageUrl)) return true;
    throw new Error('Add a Pinterest image or upload a JPEG, PNG or WebP under 500 KB.');
  }),
  handleValidation
], async (req, res) => {
  try {
    const { item } = req.body;
    const clean = item.type === 'text'
      ? { type: 'text', text: item.text.trim(), color: item.color || 'lime', caption: '' }
      : {
        type: 'image',
        imageUrl: item.imageUrl,
        source: item.source,
        sourceUrl: item.source === 'pinterest' && typeof item.sourceUrl === 'string' && /^https:\/\//.test(item.sourceUrl) ? item.sourceUrl.slice(0, 500) : '',
        width: Number(item.width) || undefined,
        height: Number(item.height) || undefined,
        topic: typeof item.topic === 'string' ? item.topic.replace(/[^\p{L}\p{N} &'-]/gu, '').trim().slice(0, 40) : '',
        caption: (item.caption || '').trim()
      };

    const board = await VisionBoard.findOneAndUpdate(
      { owner: req.user._id, year: req.body.year, period: req.body.period, [`items.${MAX_ITEMS - 1}`]: { $exists: false } },
      { $push: { items: clean }, $setOnInsert: { owner: req.user._id, year: req.body.year, period: req.body.period } },
      { new: true, upsert: true, runValidators: true }
    ).catch(error => {
      // Upsert collides with an existing full board → the board is at its limit.
      if (error.code === 11000) return null;
      throw error;
    });
    if (!board) return res.status(400).json({ message: `A board can hold up to ${MAX_ITEMS} items.` });
    res.status(201).json({ board });
  } catch (error) {
    console.error('Add vision item error:', error);
    res.status(500).json({ message: 'Could not add this to your board.' });
  }
});

// PATCH /api/vision/:boardId/items/:itemId - Edit caption / words / color
router.patch('/:boardId/items/:itemId', [
  requireObjectIds('boardId', 'itemId'),
  body('caption').optional().isString().trim().isLength({ max: 80 }),
  body('text').optional().isString().trim().isLength({ min: 1, max: 120 }).withMessage('Words cards need 1–120 characters.'),
  body('color').optional().isIn(TEXT_COLORS),
  handleValidation
], async (req, res) => {
  try {
    const board = await VisionBoard.findOne({ _id: req.params.boardId, owner: req.user._id });
    const item = board?.items.id(req.params.itemId);
    if (!item) return res.status(404).json({ message: 'Item not found.' });
    ['caption', 'text', 'color'].forEach(field => { if (req.body[field] !== undefined) item[field] = req.body[field]; });
    await board.save();
    res.json({ board });
  } catch (error) {
    console.error('Update vision item error:', error);
    res.status(500).json({ message: 'Could not update this item.' });
  }
});

// PUT /api/vision/:boardId/order - Reorder items  body: { order: [itemId, ...] }
router.put('/:boardId/order', [requireObjectIds('boardId'), body('order').isArray({ max: MAX_ITEMS }), handleValidation], async (req, res) => {
  try {
    const board = await VisionBoard.findOne({ _id: req.params.boardId, owner: req.user._id });
    if (!board) return res.status(404).json({ message: 'Board not found.' });
    const position = new Map(req.body.order.map((id, index) => [String(id), index]));
    board.items.sort((a, b) => (position.get(String(a._id)) ?? 999) - (position.get(String(b._id)) ?? 999));
    await board.save();
    res.json({ board });
  } catch (error) {
    console.error('Reorder vision items error:', error);
    res.status(500).json({ message: 'Could not reorder your board.' });
  }
});

// DELETE /api/vision/:boardId/items/:itemId
router.delete('/:boardId/items/:itemId', requireObjectIds('boardId', 'itemId'), async (req, res) => {
  try {
    const board = await VisionBoard.findOneAndUpdate(
      { _id: req.params.boardId, owner: req.user._id },
      { $pull: { items: { _id: req.params.itemId } } },
      { new: true }
    );
    if (!board) return res.status(404).json({ message: 'Board not found.' });
    res.json({ board });
  } catch (error) {
    console.error('Delete vision item error:', error);
    res.status(500).json({ message: 'Could not remove this item.' });
  }
});

/* ---------- Pinterest ---------- */

const isPinterestHost = hostname => PINTEREST_HOST.test(hostname) || hostname === 'pin.it';

/** Follows redirects manually so every hop stays on Pinterest (no open SSRF). */
// Browser-like headers matter: with a bare `Accept: text/html`, Pinterest drip-feeds the page for 20s+.
const fetchPinterestPage = async (startUrl, accept = 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8') => {
  let url = new URL(startUrl);
  for (let hop = 0; hop < 5; hop += 1) {
    if (url.protocol !== 'https:' || !isPinterestHost(url.hostname)) throw Object.assign(new Error('not pinterest'), { status: 400 });
    const response = await fetch(url, { redirect: 'manual', headers: { 'User-Agent': BROWSER_UA, Accept: accept, 'Accept-Language': 'en-US,en;q=0.9' }, signal: AbortSignal.timeout(15000) });
    if (response.status >= 300 && response.status < 400 && response.headers.get('location')) {
      url = new URL(response.headers.get('location'), url);
      continue;
    }
    if (!response.ok) throw Object.assign(new Error('fetch failed'), { status: 502 });
    return { finalUrl: url, html: (await response.text()).slice(0, 2_000_000) };
  }
  throw Object.assign(new Error('too many redirects'), { status: 502 });
};

const metaContent = (html, property) => {
  const tag = html.match(new RegExp(`<meta[^>]+(?:property|name)="${property}"[^>]*>`, 'i'))?.[0];
  return tag?.match(/content="([^"]*)"/i)?.[1]?.replace(/&amp;/g, '&') || '';
};

/** Prefer the full-size original when Pinterest has it; fall back to the 736px version. */
const bestImageUrl = async imageUrl => {
  const original = imageUrl.replace(/\/(?:\d+x(?:\d+)?|originals)\//, '/originals/');
  if (original === imageUrl) return imageUrl;
  try {
    const head = await fetch(original, { method: 'HEAD', signal: AbortSignal.timeout(6000) });
    return head.ok ? original : imageUrl;
  } catch { return imageUrl; }
};

// POST /api/vision/resolve  { url } - Pin link (pinterest.com/pin/…, pin.it/…) or direct i.pinimg.com image → image URL
router.post('/resolve', [body('url').isString().trim().isLength({ min: 8, max: 500 }).withMessage('Paste a Pinterest link.'), handleValidation], async (req, res) => {
  try {
    let parsed;
    try { parsed = new URL(req.body.url.trim()); } catch { return res.status(400).json({ message: 'That doesn’t look like a link. Paste a Pinterest pin URL.' }); }

    if (parsed.hostname === 'i.pinimg.com') {
      if (!PINIMG.test(parsed.href)) return res.status(400).json({ message: 'That Pinterest image link isn’t supported.' });
      return res.json({ imageUrl: await bestImageUrl(parsed.href), sourceUrl: '', title: '' });
    }
    if (!isPinterestHost(parsed.hostname)) {
      return res.status(400).json({ message: 'Paste a link from Pinterest (pinterest.com/pin/… or pin.it/…). For other images, use Upload.' });
    }

    const { finalUrl, html } = await fetchPinterestPage(parsed.href);
    const image = metaContent(html, 'og:image');
    if (!finalUrl.pathname.startsWith('/pin/') || !PINIMG.test(image)) {
      return res.status(404).json({ message: 'We couldn’t find an image on that link. Open the pin on Pinterest and copy its link again.' });
    }
    res.json({
      imageUrl: await bestImageUrl(image),
      sourceUrl: `https://www.pinterest.com${finalUrl.pathname}`,
      title: (metaContent(html, 'og:description') || metaContent(html, 'og:title')).slice(0, 80),
      width: Number(metaContent(html, 'og:image:width')) || undefined,
      height: Number(metaContent(html, 'og:image:height')) || undefined
    });
  } catch (error) {
    if (error.status === 400) return res.status(400).json({ message: 'Only Pinterest links are supported here.' });
    console.error('Resolve pin error:', error.message);
    res.status(502).json({ message: 'Pinterest didn’t respond. Check the link or try again in a moment.' });
  }
});

/* ---------- Inspiration gallery (public Pinterest RSS feeds) ---------- */

const FEATURED_SOURCES = [
  { url: 'https://www.pinterest.com/pinterest/pinterest-predicts-2024/', label: 'Pinterest Predicts — trends' },
  { url: 'https://www.pinterest.com/pinterest/', label: 'Pinterest — latest ideas' }
];
const RESERVED_PATHS = new Set(['pin', 'search', 'ideas', 'today', 'settings', 'business', '_saved', '_created']);
const MAX_SOURCES = 10;

const decodeEntities = text => text
  .replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#39;|&apos;/g, "'").replace(/&amp;/g, '&');

/** pinterest.com/<user>/ → <user>/feed.rss ; pinterest.com/<user>/<board>/ → <user>/<board>.rss */
const feedUrlFor = raw => {
  let url;
  try { url = new URL(raw); } catch { return null; }
  if (url.protocol !== 'https:' || !PINTEREST_HOST.test(url.hostname)) return null;
  const parts = url.pathname.split('/').filter(Boolean).map(decodeURIComponent);
  if (!parts.length || parts.length > 2 || RESERVED_PATHS.has(parts[0]) || parts.some(part => !/^[\w.-]{1,80}$/.test(part))) return null;
  const canonical = `https://www.pinterest.com/${parts.join('/')}/`;
  const feed = parts.length === 1 ? `https://www.pinterest.com/${parts[0]}/feed.rss` : `https://www.pinterest.com/${parts[0]}/${parts[1]}.rss`;
  return { canonical, feed, label: parts.length === 1 ? `@${parts[0]}` : `${parts[1].replace(/-/g, ' ')} · @${parts[0]}` };
};

const readFeed = async feedUrl => {
  const { html } = await fetchPinterestPage(feedUrl, 'application/rss+xml, application/xml;q=0.9, */*;q=0.8');
  const items = html.split('<item>').slice(1).map(chunk => {
    const link = chunk.match(/<link>(https:\/\/www\.pinterest\.[^<]+\/pin\/[\w-]+\/?)<\/link>/)?.[1];
    const description = decodeEntities(chunk.match(/<description>([\s\S]*?)<\/description>/)?.[1] || '');
    const thumb = description.match(/src="(https:\/\/i\.pinimg\.com\/[^"]+)"/)?.[1];
    const title = decodeEntities(chunk.match(/<title>([\s\S]*?)<\/title>/)?.[1] || '').trim();
    if (!link || !thumb || !PINIMG.test(thumb)) return null;
    return { pinUrl: link, thumbUrl: thumb, imageUrl: thumb.replace(/\/\d+x(?:\d+)?\//, '/736x/'), title: title.slice(0, 80) };
  }).filter(Boolean);
  return items.slice(0, 50);
};

// GET /api/vision/gallery?source=<pinterest profile or board url> (or source=featured:0)
router.get('/gallery', [query('source').isString().isLength({ min: 1, max: 300 }), handleValidation], async (req, res) => {
  try {
    const featured = /^featured:(\d)$/.exec(req.query.source);
    const target = featured ? FEATURED_SOURCES[Number(featured[1])] : { url: req.query.source };
    const parsed = target && feedUrlFor(target.url);
    if (!parsed) return res.status(400).json({ message: 'Paste a Pinterest profile or board link, like pinterest.com/name/board-name.' });
    const pins = await readFeed(parsed.feed);
    if (!pins.length) return res.status(404).json({ message: 'No public pins found there. Check the link, or make sure the board is public.' });
    res.json({ source: { url: parsed.canonical, label: target.label || parsed.label }, pins });
  } catch (error) {
    if (error.status === 400) return res.status(400).json({ message: 'Only Pinterest links are supported.' });
    console.error('Gallery error:', error.message);
    res.status(502).json({ message: 'Pinterest didn’t respond. Check the link — boards must be public — or try again.' });
  }
});

// GET /api/vision/sources - Featured + my saved Pinterest sources
router.get('/sources', async (req, res) => {
  const user = await User.findById(req.user._id).select('inspirationSources');
  res.json({ featured: FEATURED_SOURCES.map((source, index) => ({ ...source, id: `featured:${index}` })), mine: user.inspirationSources || [] });
});

// POST /api/vision/sources { url } - Save a Pinterest profile/board to browse later
router.post('/sources', [body('url').isString().isLength({ max: 300 }), handleValidation], async (req, res) => {
  const parsed = feedUrlFor(req.body.url.trim());
  if (!parsed) return res.status(400).json({ message: 'Paste a Pinterest profile or board link, like pinterest.com/name/board-name.' });
  const user = await User.findById(req.user._id).select('inspirationSources');
  if (user.inspirationSources.some(source => source.url === parsed.canonical)) return res.json({ mine: user.inspirationSources });
  if (user.inspirationSources.length >= MAX_SOURCES) return res.status(400).json({ message: `You can save up to ${MAX_SOURCES} sources.` });
  user.inspirationSources.push({ url: parsed.canonical, label: parsed.label });
  await user.save();
  res.status(201).json({ mine: user.inspirationSources });
});

// DELETE /api/vision/sources?url=...
router.delete('/sources', [query('url').isString(), handleValidation], async (req, res) => {
  const user = await User.findByIdAndUpdate(req.user._id, { $pull: { inspirationSources: { url: req.query.url } } }, { new: true }).select('inspirationSources');
  res.json({ mine: user.inspirationSources });
});

/* ---------- Keyword search (Openverse: free, openly licensed photos, no API key) ---------- */

const OPENVERSE = 'https://api.openverse.org/v1/images/';
const OPENVERSE_ID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
// Full-size image served by Openverse itself (works even when the original host blocks hotlinking).
const openverseImage = id => `${OPENVERSE}${id}/thumb/?full_size=true`;
const OPENVERSE_IMG = /^https:\/\/api\.openverse\.org\/v1\/images\/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\/thumb\/\?full_size=true$/i;
const OPENVERSE_UA = 'AccountableVisionBoard/1.0';
const SEARCH_TTL = 6 * 60 * 60 * 1000;
const searchCache = new Map(); // `${q}|${page}` -> { at, data }  (keeps us well inside Openverse's anonymous rate limit)

const remember = (map, key, value, limit) => {
  map.set(key, value);
  if (map.size > limit) map.delete(map.keys().next().value);
};


const openverseGet = async url => {
  const response = await fetch(url, { headers: { 'User-Agent': OPENVERSE_UA, Accept: 'application/json' }, signal: AbortSignal.timeout(15000) });
  if (response.status === 429) throw Object.assign(new Error('rate limited'), { status: 429 });
  if (response.status === 404) throw Object.assign(new Error('not found'), { status: 404 });
  if (!response.ok) throw Object.assign(new Error(`openverse ${response.status}`), { status: 502 });
  return response.json();
};

// Stock-photo sources first (clean, aspirational images); widen only when a rare keyword needs it.
const SOURCE_TIERS = ['stocksnap', 'stocksnap,rawpixel', ''];
const NOT_PHOTO = /\b(sticker|png|vector|illustration|clipart|clip art|icon|drawing|engraving|lithograph|poster|logo|mockup)\b/i;
const tierCache = new Map(); // query -> { at, tier, pages }

const searchPage = async (q, page, sources) => {
  const key = `${q.toLowerCase()}|${sources}|${page}`;
  const hit = searchCache.get(key);
  if (hit && Date.now() - hit.at < SEARCH_TTL) return hit.data;
  const params = new URLSearchParams({ q, page: String(page), page_size: '20', category: 'photograph', mature: 'false' });
  if (sources) params.set('source', sources);
  const data = await openverseGet(`${OPENVERSE}?${params}`);
  remember(searchCache, key, { at: Date.now(), data }, 500);
  return data;
};

/** Finds the narrowest source tier with enough results for this keyword (cached per keyword). */
const tierFor = async q => {
  const key = q.toLowerCase();
  const hit = tierCache.get(key);
  if (hit && Date.now() - hit.at < SEARCH_TTL) return hit;
  let chosen = null;
  for (const sources of SOURCE_TIERS) {
    // eslint-disable-next-line no-await-in-loop
    const first = await searchPage(q, 1, sources);
    chosen = { at: Date.now(), sources, pages: Math.max(1, Math.min(first.page_count || 1, 12)) };
    if ((first.result_count || 0) >= 60) break;
  }
  remember(tierCache, key, chosen, 500);
  return chosen;
};

// GET /api/vision/search?q=travel - Photos for a keyword; a random results page each call so reloads show fresh images
router.get('/search', [query('q').isString().trim().isLength({ min: 2, max: 60 }).withMessage('Type at least 2 letters.'), handleValidation], async (req, res) => {
  const q = req.query.q.trim().replace(/\s+/g, ' ');
  try {
    const tier = await tierFor(q);
    const page = 1 + Math.floor(Math.random() * tier.pages);
    const data = await searchPage(q, page, tier.sources).catch(error => {
      if (error.status === 404 || error.status === 400) return searchPage(q, 1, tier.sources);
      throw error;
    });
    const photos = (data.results || []).filter(photo => OPENVERSE_ID.test(photo.id || '') && !NOT_PHOTO.test(photo.title || ''));
    for (let i = photos.length - 1; i > 0; i -= 1) { const j = Math.floor(Math.random() * (i + 1)); [photos[i], photos[j]] = [photos[j], photos[i]]; }
    res.json({
      query: q,
      pins: photos.map(photo => ({
        id: photo.id,
        thumbUrl: `${OPENVERSE}${photo.id}/thumb/`,
        imageUrl: openverseImage(photo.id),
        width: photo.width,
        height: photo.height,
        title: (photo.title || '').slice(0, 80),
        credit: photo.creator || ''
      }))
    });
  } catch (error) {
    if (error.status === 429) return res.status(429).json({ message: 'Lots of searches right now. Try again in a minute.' });
    console.error('Image search error:', error.message);
    res.status(502).json({ message: 'Image search didn’t respond. Try again in a moment.' });
  }
});

// GET /api/vision/proxy?url=https://i.pinimg.com/... - Same-origin copy so the browser can export the board to PNG
router.get('/proxy', [query('url').isString(), handleValidation], async (req, res) => {
  const { url } = req.query;
  if (!PINIMG.test(url) && !OPENVERSE_IMG.test(url)) return res.status(400).json({ message: 'That image can’t be loaded here.' });
  try {
    const upstream = await fetch(url, { headers: { 'User-Agent': BROWSER_UA }, signal: AbortSignal.timeout(15000) });
    const type = upstream.headers.get('content-type') || '';
    if (!upstream.ok || !type.startsWith('image/')) return res.status(502).json({ message: 'Could not load that image.' });
    const buffer = Buffer.from(await upstream.arrayBuffer());
    if (buffer.length > 15 * 1024 * 1024) return res.status(413).json({ message: 'Image is too large.' });
    res.set({ 'Content-Type': type, 'Cache-Control': 'private, max-age=86400' }).send(buffer);
  } catch (error) {
    res.status(502).json({ message: 'Could not load that image.' });
  }
});

module.exports = router;
