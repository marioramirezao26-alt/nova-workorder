// Una empresa de Estados Unidos: su mercado es us, o es de antes y está en inglés (antes el idioma decía el país).
const isUS = (company) => Boolean(company && (company.market === 'us' || company.lang === 'en'));
const marketOf = (company) => (isUS(company) ? 'us' : 'co');

// Plata de las cotizaciones: pesos enteros (COP, empresas en Colombia) o dólares con centavos (USD, Estados Unidos).
// La decide el mercado, no el idioma: una empresa hispana de EE. UU. cotiza en dólares con la app en español.
const currencyOf = (company) => (isUS(company) ? 'USD' : 'COP');

// Redondeo comercial (medio centavo hacia arriba). Antes de redondear se quita el ruido binario con toPrecision(15):
// 85 × 9,5 % da 8,074999… en punto flotante y debe quedar en 8,08, no en 8,07.
const roundMoney = (value, currency) => {
  const scale = currency === 'USD' ? 100 : 1;
  return Math.round(Number((Number(value) * scale).toPrecision(15))) / scale;
};

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

module.exports = { currencyOf, isUS, marketOf, roundMoney, totals };
