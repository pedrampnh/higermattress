require('dotenv').config();
const express = require('express');
const session = require('express-session');
const path = require('path');

const shopRoutes = require('./routes/shop');
const adminRoutes = require('./routes/admin');
const contentStore = require('./utils/content-store');

const app = express();

app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

app.use(express.urlencoded({ extended: true }));
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

app.use(session({
  secret: process.env.SESSION_SECRET || 'dev-secret-change-me',
  resave: false,
  saveUninitialized: true,
  cookie: { maxAge: 1000 * 60 * 60 * 24 * 7 }, // 7 days
}));

// make cart item count + site content available to every view
app.use((req, res, next) => {
  const cart = req.session.cart || {};
  const content = contentStore.get();
  res.locals.cartCount = Object.values(cart).reduce((sum, item) => sum + item.qty, 0);
  res.locals.SUPPORT_PHONE = content.contact.phone;
  res.locals.SUPPORT_WHATSAPP = content.contact.whatsapp;
  res.locals.siteFooter = content.footer;
  next();
});

app.use('/admin', adminRoutes);
app.use('/', shopRoutes);

app.use((req, res) => {
  res.status(404).render('404');
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Higer store running at http://localhost:${PORT}`);
  console.log(`ZarinPal sandbox mode: ${String(process.env.ZARINPAL_SANDBOX || 'true')}`);
});
