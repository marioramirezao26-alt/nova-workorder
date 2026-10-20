// Plata de las cotizaciones: pesos enteros (COP, empresas en Colombia) o dólares con centavos (USD, Estados Unidos).
const currencyOf = (company) => (company && company.lang === 'en' ? 'USD' : 'COP');

const roundMoney = (value, currency) => (currency === 'USD'
  ? Math.round((Number(value) + Number.EPSILON) * 100) / 100
  : Math.round(Number(value)));

// Totales de una lista de renglones { qty, unitPrice, taxRate }: cada renglón se redondea y luego se suma (lo mismo
// que se ve en la cotización impresa).
const totals = (items, currency) => {
  let subtotal = 0;
  let tax = 0;
  const lines = items.map((i) => {
    const amount = roundMoney(i.qty * i.unitPrice, currency);
    const lineTax = roundMoney(amount * (i.taxRate / 100), currency);
    subtotal += amount;
    tax += lineTax;
    return { ...i, amount, tax: lineTax };
  });
  subtotal = roundMoney(subtotal, currency);
  tax = roundMoney(tax, currency);
  return { lines, subtotal, tax, total: roundMoney(subtotal + tax, currency) };
};

module.exports = { currencyOf, roundMoney, totals };
