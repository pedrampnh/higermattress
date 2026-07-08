const express = require('express');
const crypto = require('crypto');
const router = express.Router();

const productsStore = require('../utils/products-store');
const contentStore = require('../utils/content-store');
const store = require('../utils/store');
const zarinpal = require('../utils/zarinpal');
const { formatToman } = require('../utils/format');

const SIZES = productsStore.SIZES;

function findProduct(slug) {
  return productsStore.getBySlug(slug);
}

function getCart(req) {
  if (!req.session.cart) req.session.cart = {};
  return req.session.cart;
}

function cartToLines(cart) {
  return Object.values(cart).map(item => {
    const product = findProduct(item.slug);
    if (!product) return null;
    const unitPrice = product.prices[item.size];
    return {
      slug: item.slug,
      size: item.size,
      qty: item.qty,
      faName: product.faName,
      enName: product.enName,
      unitPrice,
      lineTotal: unitPrice * item.qty,
    };
  }).filter(Boolean);
}

function cartTotal(lines) {
  return lines.reduce((sum, l) => sum + l.lineTotal, 0);
}

// ---------------- Home / catalog ----------------
router.get('/', (req, res) => {
  const content = contentStore.get();
  const all = productsStore.getAll();
  // just a small teaser on the homepage; full catalog with filters lives at /products
  const featured = all.slice(0, 6);
  res.render('home', {
    featured, categories: productsStore.CATEGORIES, sizeCategories: productsStore.SIZE_CATEGORIES, formatToman, content,
  });
});

// ---------------- Full product catalog with filters + sorting ----------------
router.get('/products', (req, res) => {
  const content = contentStore.get();
  let list = productsStore.getAll();

  // category filter (multi-select checkboxes)
  let selectedCategories = req.query.category || [];
  if (!Array.isArray(selectedCategories)) selectedCategories = [selectedCategories];
  if (selectedCategories.length > 0) {
    list = list.filter(p => selectedCategories.includes(p.category));
  }

  // size-category filter (by number of sleepers / age group)
  const sizeCategory = req.query.sizeCategory || '';
  const activeSizeCategory = productsStore.getSizeCategory(sizeCategory);
  if (activeSizeCategory) {
    list = list.filter(p => activeSizeCategory.sizes.some(s => p.prices[s]));
  }

  // price bucket filter (single select)
  const priceBucket = req.query.priceBucket || '';
  const referenceSize = activeSizeCategory ? activeSizeCategory.sizes[0] : '160x200';
  const priceOf = p => p.prices[referenceSize];
  if (priceBucket === 'under5') list = list.filter(p => priceOf(p) <= 5000000);
  else if (priceBucket === '5to10') list = list.filter(p => priceOf(p) > 5000000 && priceOf(p) <= 10000000);
  else if (priceBucket === '10to20') list = list.filter(p => priceOf(p) > 10000000 && priceOf(p) <= 20000000);
  else if (priceBucket === 'over20') list = list.filter(p => priceOf(p) > 20000000);

  // sorting
  const sort = req.query.sort || 'default';
  if (sort === 'price_asc') list = [...list].sort((a, b) => priceOf(a) - priceOf(b));
  else if (sort === 'price_desc') list = [...list].sort((a, b) => priceOf(b) - priceOf(a));
  else if (sort === 'name') list = [...list].sort((a, b) => a.faName.localeCompare(b.faName, 'fa'));
  else if (sort === 'tier') list = [...list].sort((a, b) => a.tier - b.tier);

  res.render('products-page', {
    products: list,
    categories: productsStore.CATEGORIES,
    sizeCategories: productsStore.SIZE_CATEGORIES,
    selectedCategories,
    sizeCategory,
    activeSizeCategory,
    referenceSize,
    priceBucket,
    sort,
    formatToman,
    content,
  });
});

// ---------------- Product detail ----------------
router.get('/product/:slug', (req, res) => {
  const product = findProduct(req.params.slug);
  if (!product) return res.status(404).render('404');
  const content = contentStore.get();
  const tierInfo = content.tiers[product.tier] || { label: `درجه ${product.tier}`, desc: '' };
  const categoryLabel = productsStore.categoryLabel(product.category);
  res.render('product', { product, tierInfo, categoryLabel, SIZES, formatToman });
});

// ---------------- Cart ----------------
router.post('/cart/add', (req, res) => {
  const { slug, size, qty } = req.body;
  const product = findProduct(slug);
  if (!product || !product.prices[size]) return res.status(400).send('محصول یا سایز نامعتبر است');
  const cart = getCart(req);
  const key = `${slug}__${size}`;
  const quantity = Math.max(1, parseInt(qty, 10) || 1);
  if (cart[key]) cart[key].qty += quantity;
  else cart[key] = { slug, size, qty: quantity };
  res.redirect(`/cart?added=${encodeURIComponent(product.faName)}`);
});

router.post('/cart/update', (req, res) => {
  const { key, qty } = req.body;
  const cart = getCart(req);
  if (cart[key]) {
    const q = Math.max(1, parseInt(qty, 10) || 1);
    cart[key].qty = q;
  }
  res.redirect('/cart');
});

router.post('/cart/remove', (req, res) => {
  const { key } = req.body;
  const cart = getCart(req);
  delete cart[key];
  res.redirect('/cart');
});

router.get('/cart', (req, res) => {
  const cart = getCart(req);
  const lines = cartToLines(cart);
  // attach the session key back onto each line for form actions
  Object.keys(cart).forEach((key, i) => {});
  const linesWithKeys = Object.entries(cart).map(([key, item]) => {
    const product = findProduct(item.slug);
    if (!product) return null;
    const unitPrice = product.prices[item.size];
    return {
      key, slug: item.slug, size: item.size, qty: item.qty,
      faName: product.faName, unitPrice, lineTotal: unitPrice * item.qty,
    };
  }).filter(Boolean);
  const total = cartTotal(linesWithKeys);
  res.render('cart', { lines: linesWithKeys, total, formatToman, addedName: req.query.added || null });
});

// ---------------- Checkout ----------------
router.get('/checkout', (req, res) => {
  const cart = getCart(req);
  const lines = Object.entries(cart).map(([key, item]) => {
    const product = findProduct(item.slug);
    if (!product) return null;
    const unitPrice = product.prices[item.size];
    return { key, ...item, faName: product.faName, unitPrice, lineTotal: unitPrice * item.qty };
  }).filter(Boolean);
  if (lines.length === 0) return res.redirect('/cart');
  const total = cartTotal(lines);
  res.render('checkout', { lines, total, formatToman, error: req.query.error || null });
});

router.post('/checkout', async (req, res) => {
  const cart = getCart(req);
  const lines = Object.entries(cart).map(([key, item]) => {
    const product = findProduct(item.slug);
    if (!product) return null;
    const unitPrice = product.prices[item.size];
    return { key, ...item, faName: product.faName, unitPrice, lineTotal: unitPrice * item.qty };
  }).filter(Boolean);
  if (lines.length === 0) return res.redirect('/cart');

  const { name, phone, address, mobile, email } = req.body;
  if (!name || !phone || !address) {
    return res.redirect('/checkout?error=' + encodeURIComponent('لطفاً نام، تلفن و آدرس را کامل وارد کنید'));
  }

  const total = cartTotal(lines);
  const orderId = crypto.randomUUID();

  const order = store.createOrder({
    id: orderId,
    createdAt: new Date().toISOString(),
    customer: { name, phone, address },
    items: lines.map(({ slug, size, qty, faName, unitPrice, lineTotal }) => ({ slug, size, qty, faName, unitPrice, lineTotal })),
    total,
    status: 'pending_payment',
    zarinpalAuthority: null,
    zarinpalRefId: null,
  });

  const baseUrl = process.env.BASE_URL || `${req.protocol}://${req.get('host')}`;
  const callbackUrl = `${baseUrl}/payment/callback?orderId=${orderId}`;

  try {
    const { authority, payUrl } = await zarinpal.requestPayment({
      amount: total,
      description: `سفارش هیگر #${orderId.slice(0, 8)}`,
      callbackUrl,
      metadata: { mobile: mobile || phone, email: email || undefined },
    });
    store.updateOrder(orderId, { zarinpalAuthority: authority });
    return res.redirect(payUrl);
  } catch (err) {
    store.updateOrder(orderId, { status: 'payment_request_failed', error: String(err.message || err) });
    return res.render('payment-result', {
      success: false,
      message: 'اتصال به درگاه پرداخت با خطا مواجه شد. لطفاً دوباره تلاش کنید یا با پشتیبانی تماس بگیرید.',
      detail: String(err.message || err),
      order: null,
      formatToman,
    });
  }
});

// ---------------- Payment callback ----------------
router.get('/payment/callback', async (req, res) => {
  const { orderId, Authority, Status } = req.query;
  const order = store.getOrder(orderId);
  if (!order) return res.status(404).render('404');

  if (Status !== 'OK') {
    store.updateOrder(orderId, { status: 'canceled_by_user' });
    return res.render('payment-result', {
      success: false,
      message: 'پرداخت لغو شد. سفارش شما ثبت نشد.',
      detail: null,
      order,
      formatToman,
    });
  }

  try {
    const result = await zarinpal.verifyPayment({ amount: order.total, authority: Authority });
    if (result.success) {
      const updated = store.updateOrder(orderId, {
        status: 'paid',
        zarinpalRefId: result.refId,
      });
      // clear the cart on successful payment
      req.session.cart = {};
      return res.render('payment-result', {
        success: true,
        message: 'پرداخت با موفقیت انجام شد. سفارش شما ثبت شد.',
        detail: null,
        order: updated,
        formatToman,
      });
    }
    store.updateOrder(orderId, { status: 'verify_failed' });
    return res.render('payment-result', {
      success: false,
      message: 'تأیید پرداخت ناموفق بود.',
      detail: JSON.stringify(result.raw && result.raw.errors ? result.raw.errors : result.raw),
      order,
      formatToman,
    });
  } catch (err) {
    store.updateOrder(orderId, { status: 'verify_error', error: String(err.message || err) });
    return res.render('payment-result', {
      success: false,
      message: 'خطا در ارتباط با درگاه هنگام تأیید پرداخت.',
      detail: String(err.message || err),
      order,
      formatToman,
    });
  }
});

// ---------------- Contact ----------------
router.get('/contact', (req, res) => {
  const content = contentStore.get();
  res.render('contact', { sent: req.query.sent || false, content });
});

router.post('/contact', (req, res) => {
  const { name, phone, message } = req.body;
  if (!name || !phone || !message) return res.redirect('/contact');
  store.saveMessage({
    id: crypto.randomUUID(),
    createdAt: new Date().toISOString(),
    name, phone, message,
  });
  res.redirect('/contact?sent=1');
});

module.exports = router;
