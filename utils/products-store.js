const fs = require('fs');
const path = require('path');

const FILE = path.join(__dirname, '..', 'data', 'products.json');
const SIZES = ['70x130', '80x180', '90x200', '100x200', '120x200', '140x200', '160x200', '180x200', '200x200'];

const CATEGORIES = [
  { slug: 'spring-bonnell', label: 'فنر متصل', group: 'فنری' },
  { slug: 'spring-pocket', label: 'فنر منفصل', group: 'فنری' },
  { slug: 'foam', label: 'اسفنجی', group: 'بدون فنر' },
  { slug: 'memory-foam', label: 'مموری فوم', group: 'بدون فنر' },
];

function categoryLabel(slug) {
  const c = CATEGORIES.find(c => c.slug === slug);
  if (!c) return slug;
  return c.group ? `${c.group} — ${c.label}` : c.label;
}

function ensureFile() {
  if (!fs.existsSync(FILE)) fs.writeFileSync(FILE, '[]', 'utf8');
}

function readAll() {
  ensureFile();
  try {
    return JSON.parse(fs.readFileSync(FILE, 'utf8'));
  } catch (e) {
    return [];
  }
}

function writeAll(list) {
  fs.writeFileSync(FILE, JSON.stringify(list, null, 2), 'utf8');
}

function slugify(str) {
  return String(str)
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9\u0600-\u06FF]+/g, '-')
    .replace(/(^-|-$)/g, '') || 'model';
}

function getAll() {
  return readAll();
}

function getByTier(tier) {
  return readAll().filter(p => p.tier === Number(tier));
}

function getByCategory(category) {
  return readAll().filter(p => p.category === category);
}

function getBySlug(slug) {
  return readAll().find(p => p.slug === slug) || null;
}

function create(data) {
  const list = readAll();
  let baseSlug = slugify(data.enName || data.faName);
  let slug = baseSlug;
  let i = 2;
  while (list.some(p => p.slug === slug)) { slug = `${baseSlug}-${i}`; i++; }

  const prices = {};
  SIZES.forEach(s => { prices[s] = Number(data.prices[s]) || 0; });

  const product = {
    slug,
    faName: data.faName,
    enName: data.enName,
    tier: Number(data.tier) || 1,
    category: data.category || 'no-spring',
    prices,
  };
  list.push(product);
  writeAll(list);
  return product;
}

function update(slug, data) {
  const list = readAll();
  const idx = list.findIndex(p => p.slug === slug);
  if (idx === -1) return null;
  const prices = {};
  SIZES.forEach(s => { prices[s] = Number(data.prices[s]) || 0; });
  list[idx] = {
    ...list[idx],
    faName: data.faName,
    enName: data.enName,
    tier: Number(data.tier) || 1,
    category: data.category || list[idx].category,
    prices,
  };
  writeAll(list);
  return list[idx];
}

function remove(slug) {
  const list = readAll();
  const next = list.filter(p => p.slug !== slug);
  writeAll(next);
  return next.length !== list.length;
}

module.exports = { SIZES, CATEGORIES, categoryLabel, getAll, getByTier, getByCategory, getBySlug, create, update, remove };
