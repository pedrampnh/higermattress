// Minimal ZarinPal v4 client using native fetch (Node 18+).
// Docs: https://www.zarinpal.com/docs/paymentGateway/connectToGateway

const SANDBOX = String(process.env.ZARINPAL_SANDBOX || 'true') === 'true';
const MERCHANT_ID = process.env.ZARINPAL_MERCHANT_ID || '00000000-0000-0000-0000-000000000000';

const BASE = SANDBOX ? 'https://sandbox.zarinpal.com' : 'https://payment.zarinpal.com';
const REQUEST_URL = `${BASE}/pg/v4/payment/request.json`;
const VERIFY_URL = `${BASE}/pg/v4/payment/verify.json`;
const STARTPAY_URL = (authority) => `${BASE}/pg/StartPay/${authority}`;

/**
 * Create a payment request.
 * @param {object} opts
 * @param {number} opts.amount - amount in Toman
 * @param {string} opts.description
 * @param {string} opts.callbackUrl
 * @param {object} [opts.metadata] - e.g. { mobile, email }
 */
async function requestPayment({ amount, description, callbackUrl, metadata }) {
  const res = await fetch(REQUEST_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
    body: JSON.stringify({
      merchant_id: MERCHANT_ID,
      amount,
      description,
      callback_url: callbackUrl,
      metadata: metadata || {},
    }),
  });
  const data = await res.json();
  const authority = data && data.data ? data.data.authority : null;
  const code = data && data.data ? data.data.code : (data.errors ? -1 : null);
  if (!authority || code !== 100) {
    const message = data && data.errors ? JSON.stringify(data.errors) : 'unknown error';
    throw new Error(`ZarinPal request failed: ${message}`);
  }
  return { authority, payUrl: STARTPAY_URL(authority), raw: data };
}

/**
 * Verify a payment after the user returns from the gateway.
 * @param {object} opts
 * @param {number} opts.amount - amount in Toman (must match the original request)
 * @param {string} opts.authority
 */
async function verifyPayment({ amount, authority }) {
  const res = await fetch(VERIFY_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
    body: JSON.stringify({ merchant_id: MERCHANT_ID, amount, authority }),
  });
  const data = await res.json();
  const code = data && data.data ? data.data.code : (data.errors ? -1 : null);
  const success = code === 100 || code === 101; // 101 = already verified
  return {
    success,
    refId: success && data.data ? data.data.ref_id : null,
    code,
    raw: data,
  };
}

module.exports = { requestPayment, verifyPayment, SANDBOX, MERCHANT_ID };
