// El mercado de una empresa (dónde trabaja y en qué moneda cotiza), aparte del idioma de su app:
// - us: Estados Unidos (dólares, hora del Este, celulares +1). Las empresas en inglés de antes cuentan como us (antes el
//   idioma decía el país).
// - mx: México (pesos mexicanos, IVA del 16 %, hora de Ciudad de México, celulares +52).
// - co: Colombia (pesos colombianos, IVA del 19 %, Wompi y factura DIAN con Factus).
const MARKETS = ['co', 'us', 'mx'];
const marketOf = (company) => {
  if (!company) return 'co';
  if (company.market === 'us' || company.lang === 'en') return 'us';
  if (company.market === 'mx') return 'mx';
  return 'co';
};
const isUS = (company) => marketOf(company) === 'us';
const isMX = (company) => marketOf(company) === 'mx';
// Wompi (cobra en pesos colombianos) y la factura DIAN (Factus) solo existen en Colombia.
const isColombia = (company) => marketOf(company) === 'co';

// Plata de las cotizaciones: pesos colombianos enteros (COP), dólares (USD) o pesos mexicanos (MXN) con centavos.
// La decide el mercado, no el idioma: una empresa hispana de EE. UU. cotiza en dólares y una de México en pesos
// mexicanos, las dos con la app en español.
const CURRENCY = { co: 'COP', us: 'USD', mx: 'MXN' };
const currencyOf = (company) => CURRENCY[marketOf(company)];
const withCents = (currency) => currency === 'USD' || currency === 'MXN';

// El impuesto con que arranca cada renglón: el IVA general de Colombia (19 %) o de México (16 %); en EE. UU. el negocio
// escribe el suyo (el sales tax cambia por estado y ciudad), así que arranca en 0.
const DEFAULT_TAX = { COP: 19, MXN: 16, USD: 0 };
const defaultTaxRate = (currency) => DEFAULT_TAX[currency] ?? 0;

// Redondeo comercial (medio centavo hacia arriba). Antes de redondear se quita el ruido binario con toPrecision(15):
// 85 × 9,5 % da 8,074999… en punto flotante y debe quedar en 8,08, no en 8,07.
const roundMoney = (value, currency) => {
  const scale = withCents(currency) ? 100 : 1;
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

module.exports = { MARKETS, currencyOf, defaultTaxRate, isColombia, isMX, isUS, marketOf, roundMoney, totals, withCents };
