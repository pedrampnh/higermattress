const express = require('express');
const router = express.Router();

const productsStore = require('../utils/products-store');
const contentStore = require('../utils/content-store');
const store = require('../utils/store');
const { formatToman } = require('../utils/format');
const { requireAdmin } = require('../middleware/auth');

const SIZES = productsStore.SIZES;

// ---------------- Auth ----------------
router.get('/login', (req, res) => {
  res.render('admin/login', { error: null });
});

router.post('/login', (req, res) => {
  const { password } = req.body;
  const expected = process.env.ADMIN_PASSWORD || 'higer-admin';
  if (password === expected) {
    req.session.isAdmin = true;
    return res.redirect('/admin');
  }
  res.render('admin/login', { error: 'رمز عبور اشتباه است' });
});

router.post('/logout', (req, res) => {
  req.session.isAdmin = false;
  res.redirect('/admin/login');
});

router.use(requireAdmin);

// ---------------- Dashboard ----------------
router.get('/', (req, res) => {
  const productCount = productsStore.getAll().length;
  const messages = store.allMessages();
  const orders = store.allOrders();

  // آخرین ۵ سفارش (جدیدترین)
  const recentOrders = orders.slice().reverse().slice(0, 5);
  // آخرین ۵ پیام
  const recentMessages = messages.slice().reverse().slice(0, 5);

  res.render('admin/dashboard', {
    productCount,
    messageCount: messages.length,
    orderCount: orders.length,
    paidOrderCount: orders.filter(o => o.status === 'paid').length,
    recentOrders,
    recentMessages,
    formatToman,
  });
});

// ---------------- Products ----------------
router.get('/products', (req, res) => {
  const products = productsStore.getAll();
  res.render('admin/products-list', { products, formatToman, categoryLabel: productsStore.categoryLabel });
});

router.get('/products/new', (req, res) => {
  res.render('admin/product-form', { product: null, SIZES, CATEGORIES: productsStore.CATEGORIES, error: null });
});

router.post('/products/new', (req, res) => {
  const { faName, enName, tier, category, ...rest } = req.body;
  if (!faName || !enName) {
    return res.render('admin/product-form', {
      product: req.body,
      SIZES,
      CATEGORIES: productsStore.CATEGORIES,
      error: 'نام فارسی و انگلیسی الزامی است'
    });
  }
  const prices = {};
  SIZES.forEach(s => { prices[s] = rest[`price_${s}`]; });
  productsStore.create({ faName, enName, tier, category, prices });
  res.redirect('/admin/products');
});

router.get('/products/:slug/edit', (req, res) => {
  const product = productsStore.getBySlug(req.params.slug);
  if (!product) return res.status(404).send('محصول پیدا نشد');
  res.render('admin/product-form', { product, SIZES, CATEGORIES: productsStore.CATEGORIES, error: null });
});

router.post('/products/:slug/edit', (req, res) => {
  const { faName, enName, tier, category, ...rest } = req.body;
  const prices = {};
  SIZES.forEach(s => { prices[s] = rest[`price_${s}`]; });
  const updated = productsStore.update(req.params.slug, { faName, enName, tier, category, prices });
  if (!updated) return res.status(404).send('محصول پیدا نشد');
  res.redirect('/admin/products');
});

router.post('/products/:slug/delete', (req, res) => {
  productsStore.remove(req.params.slug);
  res.redirect('/admin/products');
});

// ---------------- Site content ----------------
router.get('/content', (req, res) => {
  const content = contentStore.get();
  res.render('admin/content-form', { content, saved: req.query.saved || false });
});

router.post('/content', (req, res) => {
  const body = req.body;
  const patch = {
    home: {
      eyebrow: body.home_eyebrow,
      title: body.home_title,
      subtitle: body.home_subtitle,
    },
    contact: {
      phone: body.contact_phone,
      whatsapp: body.contact_whatsapp,
      address: body.contact_address,
      hours: body.contact_hours,
    },
    footer: {
      line1: body.footer_line1,
    },
    tiers: {
      1: { label: body.tier1_label, desc: body.tier1_desc },
      2: { label: body.tier2_label, desc: body.tier2_desc },
      3: { label: body.tier3_label, desc: body.tier3_desc },
      4: { label: body.tier4_label, desc: body.tier4_desc },
    },
  };
  contentStore.save(patch);
  res.redirect('/admin/content?saved=1');
});

// ---------------- Messages ----------------
router.get('/messages', (req, res) => {
  const messages = store.allMessages().slice().reverse();
  res.render('admin/messages', { messages });
});

// ---------------- Orders ----------------
router.get('/orders', (req, res) => {
  const orders = store.allOrders().slice().reverse();
  res.render('admin/orders', { orders, formatToman });
});

module.exports = router;
