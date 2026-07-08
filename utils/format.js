function formatToman(n) {
  return Number(n).toLocaleString('fa-IR') + ' تومان';
}

function faDigits(n) {
  return Number(n).toLocaleString('fa-IR');
}

module.exports = { formatToman, faDigits };
