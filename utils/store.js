const fs = require('fs');
const path = require('path');

const DB_DIR = path.join(__dirname, '..', 'data');
const ORDERS_FILE = path.join(DB_DIR, 'orders.json');
const MESSAGES_FILE = path.join(DB_DIR, 'messages.json');

function ensureFile(file) {
  if (!fs.existsSync(file)) fs.writeFileSync(file, '[]', 'utf8');
}

function readJSON(file) {
  ensureFile(file);
  try {
    return JSON.parse(fs.readFileSync(file, 'utf8'));
  } catch (e) {
    return [];
  }
}

function writeJSON(file, data) {
  fs.writeFileSync(file, JSON.stringify(data, null, 2), 'utf8');
}

// ---- Orders ----
function createOrder(order) {
  const orders = readJSON(ORDERS_FILE);
  orders.push(order);
  writeJSON(ORDERS_FILE, orders);
  return order;
}

function updateOrder(orderId, patch) {
  const orders = readJSON(ORDERS_FILE);
  const idx = orders.findIndex(o => o.id === orderId);
  if (idx === -1) return null;
  orders[idx] = { ...orders[idx], ...patch };
  writeJSON(ORDERS_FILE, orders);
  return orders[idx];
}

function getOrder(orderId) {
  const orders = readJSON(ORDERS_FILE);
  return orders.find(o => o.id === orderId) || null;
}

function getOrderByAuthority(authority) {
  const orders = readJSON(ORDERS_FILE);
  return orders.find(o => o.zarinpalAuthority === authority) || null;
}

function allOrders() {
  return readJSON(ORDERS_FILE);
}

// ---- Contact messages ----
function saveMessage(msg) {
  const messages = readJSON(MESSAGES_FILE);
  messages.push(msg);
  writeJSON(MESSAGES_FILE, messages);
  return msg;
}

function allMessages() {
  return readJSON(MESSAGES_FILE);
}

module.exports = {
  createOrder, updateOrder, getOrder, getOrderByAuthority, allOrders,
  saveMessage, allMessages,
};
