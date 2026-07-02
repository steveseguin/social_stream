var Currencies = { usd: { d: 2, s: "$" }, cad: { d: 2, s: "$" }, eur: { d: 2, s: "€" }, aed: { d: 2, s: "د.إ.‏" }, afn: { d: 0, s: "؋" }, all: { d: 0, s: "Lek" }, amd: { d: 0, s: "դր." }, ars: { d: 2, s: "$" }, aud: { d: 2, s: "$" }, azn: { d: 2, s: "ман." }, bam: { d: 2, s: "KM" }, bdt: { d: 2, s: "৳" }, bgn: { d: 2, s: "лв." }, bhd: { d: 3, s: "د.ب.‏" }, bif: { d: 0, s: "FBu" }, bnd: { d: 2, s: "$" }, bob: { d: 2, s: "Bs" }, brl: { d: 2, s: "R$" }, bwp: { d: 2, s: "P" }, byn: { d: 2, s: "руб." }, bzd: { d: 2, s: "$" }, cdf: { d: 2, s: "FrCD" }, chf: { d: 2, s: "CHF" }, clp: { d: 0, s: "$" }, cny: { d: 2, s: "CN¥" }, cop: { d: 0, s: "$" }, crc: { d: 0, s: "₡" }, cve: { d: 2, s: "CV$" }, czk: { d: 2, s: "Kč" }, djf: { d: 0, s: "Fdj" }, dkk: { d: 2, s: "kr" }, dop: { d: 2, s: "RD$" }, dzd: { d: 2, s: "د.ج.‏" }, eek: { d: 2, s: "kr" }, egp: { d: 2, s: "ج.م.‏" }, ern: { d: 2, s: "Nfk" }, etb: { d: 2, s: "Br" }, gbp: { d: 2, s: "£" }, gel: { d: 2, s: "GEL" }, ghs: { d: 2, s: "GH₵" }, gnf: { d: 0, s: "FG" }, gtq: { d: 2, s: "Q" }, hkd: { d: 2, s: "$" }, hnl: { d: 2, s: "L" }, hrk: { d: 2, s: "kn" }, huf: { d: 0, s: "Ft" }, idr: { d: 0, s: "Rp" }, ils: { d: 2, s: "₪" }, inr: { d: 2, s: "টকা" }, iqd: { d: 0, s: "د.ع.‏" }, irr: { d: 0, s: "﷼" }, isk: { d: 0, s: "kr" }, jmd: { d: 2, s: "$" }, jod: { d: 3, s: "د.أ.‏" }, jpy: { d: 0, s: "￥" }, kes: { d: 2, s: "Ksh" }, khr: { d: 2, s: "៛" }, kmf: { d: 0, s: "FC" }, krw: { d: 0, s: "₩" }, kwd: { d: 3, s: "د.ك.‏" }, kzt: { d: 2, s: "тңг." }, lbp: { d: 0, s: "ل.ل.‏" }, lkr: { d: 2, s: "SL Re" }, ltl: { d: 2, s: "Lt" }, lvl: { d: 2, s: "Ls" }, lyd: { d: 3, s: "د.ل.‏" }, mad: { d: 2, s: "د.م.‏" }, mdl: { d: 2, s: "MDL" }, mga: { d: 0, s: "MGA" }, mkd: { d: 2, s: "MKD" }, mmk: { d: 0, s: "K" }, mop: { d: 2, s: "MOP$" }, mur: { d: 0, s: "MURs" }, mxn: { d: 2, s: "$" }, myr: { d: 2, s: "RM" }, mzn: { d: 2, s: "MTn" }, nad: { d: 2, s: "N$" }, ngn: { d: 2, s: "₦" }, nio: { d: 2, s: "C$" }, nok: { d: 2, s: "kr" }, npr: { d: 2, s: "नेरू" }, nzd: { d: 2, s: "$" }, omr: { d: 3, s: "ر.ع.‏" }, pab: { d: 2, s: "B/." }, pen: { d: 2, s: "S/." }, php: { d: 2, s: "₱" }, pkr: { d: 0, s: "₨" }, pln: { d: 2, s: "zł" }, pyg: { d: 0, s: "₲" }, qar: { d: 2, s: "ر.ق.‏" }, ron: { d: 2, s: "RON" }, rsd: { d: 0, s: "дин." }, rub: { d: 2, s: "₽." }, rwf: { d: 0, s: "FR" }, sar: { d: 2, s: "ر.س.‏" }, sdg: { d: 2, s: "SDG" }, sek: { d: 2, s: "kr" }, sgd: { d: 2, s: "$" }, sos: { d: 0, s: "Ssh" }, syp: { d: 0, s: "ل.س.‏" }, thb: { d: 2, s: "฿" }, tnd: { d: 3, s: "د.ت.‏" }, top: { d: 2, s: "T$" }, try: { d: 2, s: "TL" }, ttd: { d: 2, s: "$" }, twd: { d: 2, s: "NT$" }, tzs: { d: 0, s: "TSh" }, uah: { d: 2, s: "₴" }, ugx: { d: 0, s: "USh" }, uyu: { d: 2, s: "$" }, uzs: { d: 0, s: "UZS" }, vef: { d: 2, s: "Bs.F." }, vnd: { d: 0, s: "₫" }, xaf: { d: 0, s: "FCFA" }, xof: { d: 0, s: "CFA" }, yer: { d: 0, s: "ر.ي.‏" }, zar: { d: 2, s: "R" }, zmk: { d: 0, s: "ZK" }, zwl: { d: 0, s: "ZWL$" } };

function convertToUSD(valueStr, source = '') {
  // Currency conversion rates
  const currencyRates = {
    EUR: 1.17,
    GBP: 1.26,
    JPY: 0.0067,
    CHF: 1.12,
    AUD: 0.66,
    CAD: 0.74,
    CNY: 0.14,
    HKD: 0.13,
    NZD: 0.61,
    KRW: 0.00075,
    INR: 0.012,
    BRL: 0.202,
    RUB: 0.011,
    MXN: 0.0575,
    ARS: 0.000717,
    BOB: 0.144,
    CLP: 0.0011,
    COP: 0.000268,
    PEN: 0.286,
    UYU: 0.0248,
    PYG: 0.000161,
    VES: 0.00203,
    CRC: 0.0022,
    GTQ: 0.131,
    HNL: 0.0375,
    DOP: 0.0168,
    NIO: 0.0272,
    PAB: 1.0,
    AWG: 0.559,
    BBD: 0.5,
    BMD: 1.0,
    BSD: 1.0,
    BZD: 0.5,
    CUP: 0.0417,
    GYD: 0.0048,
    HTG: 0.00765,
    JMD: 0.00635,
    KYD: 1.2,
    SRD: 0.0267,
    TTD: 0.1475,
    XCD: 0.3704,
    ANG: 0.559,
    SEK: 0.093,
    NOK: 0.094,
    DKK: 0.14,
    PLN: 0.24,
    THB: 0.028,
    IDR: 0.000064
  };

  // Platform-specific virtual currencies
  const virtualCurrencies = {
    // Twitch
    bits: 0.01,
    bit: 0.01,
    cheer: 0.01,
    
    // TikTok
    coins: 0.01,
    coin: 0.01,
    diamond: 0.005,
    diamonds: 0.005,
    
    // YouTube
    super: 1.0, // Super Chat base rate
    superchat: 1.0,
    
    // Generic/Other platforms
    rose: 0.01,
    roses: 0.01,
    gold: 0.01,
    gift: 0.02,
    gem: 0.01,
    gems: 0.01,
    token: 0.01,
    tokens: 0.01,
    heart: 0.01,
    hearts: 0.01,
    
    // Kick (10,000 KICKs = $15 USD)
    kick: 0.0015,
    kicks: 0.0015,
    sub: 4.99,
    subscription: 4.99,
    
    // Platform-specific tokens
    flame: 0.01,
    flames: 0.01,
    spark: 0.01,
    sparks: 0.01,
    crown: 0.05,
    crowns: 0.05,
    balloon: 0.01,
    balloons: 0.01
  };

  // Platform-specific adjustments
  const platformAdjustments = {
    twitch: {
      bits: 0.01,
      bit: 0.01,
      sub: 4.99,
      subscription: 4.99,
      giftsub: 4.99,
      giftsubscription: 4.99,
      tier1: 4.99,
      tier2: 9.99,
      tier3: 24.99
    },
    youtube: {
      superchat: 1.0,
      super: 1.0,
      membership: 4.99,
      giftmembership: 4.99,
      sponsorship: 4.99
    },
    kick: {
      kick: 0.0015, // 10,000 KICKs = $15 USD
      kicks: 0.0015,
      sub: 3.75, // Kick takes a smaller cut
      subscription: 3.75,
      giftsub: 3.75,
      giftsubscription: 3.75
    },
    tiktok: {
      coin: 0.01,
      coins: 0.01,
      diamond: 0.005,
      diamonds: 0.005,
      gift: 0.01,
      rose: 0.01,
      tiktokgift: 0.01
    },
    facebook: {
      star: 0.01,
      stars: 0.01,
      support: 0.99,
      badge: 0.99
    }
  };

  if (typeof valueStr !== 'string') valueStr = String(valueStr);
  valueStr = valueStr.trim();
  
  function parseCurrencyAmount(rawValue) {
    const match = String(rawValue).match(/-?\d[\d.,]*(?:\s\d{3})*/);
    if (!match) return null;

    let numericText = match[0].replace(/\s/g, '');
    const lastComma = numericText.lastIndexOf(',');
    const lastDot = numericText.lastIndexOf('.');
    let decimalSeparator = '';

    if (lastComma !== -1 && lastDot !== -1) {
      decimalSeparator = lastComma > lastDot ? ',' : '.';
    } else if (lastComma !== -1 || lastDot !== -1) {
      const separator = lastComma !== -1 ? ',' : '.';
      const lastSeparator = lastComma !== -1 ? lastComma : lastDot;
      const decimals = numericText.length - lastSeparator - 1;
      const count = (numericText.match(new RegExp('\\' + separator, 'g')) || []).length;
      const integerPart = numericText.slice(0, lastSeparator).replace('-', '');
      if (decimals > 0 && (decimals !== 3 || integerPart === '0') && count === 1) {
        decimalSeparator = separator;
      }
    }

    if (decimalSeparator) {
      const thousandsSeparator = decimalSeparator === ',' ? '.' : ',';
      numericText = numericText.split(thousandsSeparator).join('');
      numericText = numericText.replace(decimalSeparator, '.');
    } else {
      numericText = numericText.replace(/[.,]/g, '');
    }

    return parseFloat(numericText);
  }

  // Extract numeric value, including negative numbers, decimals, and thousands separators.
  const numericMatch = valueStr.match(/-?\d[\d.,]*(?:\s\d{3})*/);
  if (!numericMatch) return 0;
  
  const amount = parseCurrencyAmount(valueStr);
  if (isNaN(amount)) return 0;

  // Clean the string for currency/type detection, preserve important symbols
  const cleanValue = valueStr.toLowerCase().replace(/[$€£¥₩₹₽]/g, '').replace(/[^\w\s]/g, ' ').trim();
  
  const currencyAliases = {
    MX: 'MXN',
    MEX: 'MXN',
    'MEXICAN PESO': 'MXN',
    'MEXICAN PESOS': 'MXN',
    AR: 'ARS',
    ARG: 'ARS',
    'ARGENTINE PESO': 'ARS',
    'ARGENTINE PESOS': 'ARS',
    BS: 'BOB',
    BOB: 'BOB',
    BOLIVIANO: 'BOB',
    BOLIVIANOS: 'BOB',
    CL: 'CLP',
    CLP: 'CLP',
    'CHILEAN PESO': 'CLP',
    'CHILEAN PESOS': 'CLP',
    COL: 'COP',
    COP: 'COP',
    'COLOMBIAN PESO': 'COP',
    'COLOMBIAN PESOS': 'COP',
    PEN: 'PEN',
    SOL: 'PEN',
    SOLES: 'PEN',
    UYU: 'UYU',
    URU: 'UYU',
    'URUGUAYAN PESO': 'UYU',
    'URUGUAYAN PESOS': 'UYU',
    PYG: 'PYG',
    GUARANI: 'PYG',
    GUARANIES: 'PYG',
    VES: 'VES',
    VEF: 'VES',
    BOLIVAR: 'VES',
    BOLIVARES: 'VES',
    CRC: 'CRC',
    COLON: 'CRC',
    COLONES: 'CRC',
    GTQ: 'GTQ',
    QUETZAL: 'GTQ',
    QUETZALES: 'GTQ',
    HNL: 'HNL',
    LEMPIRA: 'HNL',
    LEMPIRAS: 'HNL',
    DOP: 'DOP',
    'DOMINICAN PESO': 'DOP',
    'DOMINICAN PESOS': 'DOP',
    NIO: 'NIO',
    CORDOBA: 'NIO',
    CORDOBAS: 'NIO',
    PAB: 'PAB',
    BALBOA: 'PAB',
    BALBOAS: 'PAB',
    AWG: 'AWG',
    AFL: 'AWG',
    'ARUBAN FLORIN': 'AWG',
    BBD: 'BBD',
    BDS: 'BBD',
    'BARBADIAN DOLLAR': 'BBD',
    'BARBADOS DOLLAR': 'BBD',
    BMD: 'BMD',
    'BERMUDIAN DOLLAR': 'BMD',
    'BERMUDA DOLLAR': 'BMD',
    BSD: 'BSD',
    'BAHAMIAN DOLLAR': 'BSD',
    BZD: 'BZD',
    BZ: 'BZD',
    'BELIZE DOLLAR': 'BZD',
    CUP: 'CUP',
    'CUBAN PESO': 'CUP',
    GYD: 'GYD',
    'GUYANESE DOLLAR': 'GYD',
    HTG: 'HTG',
    'HAITIAN GOURDE': 'HTG',
    JMD: 'JMD',
    'JAMAICAN DOLLAR': 'JMD',
    KYD: 'KYD',
    'CAYMAN ISLANDS DOLLAR': 'KYD',
    SRD: 'SRD',
    'SURINAMESE DOLLAR': 'SRD',
    TTD: 'TTD',
    TT: 'TTD',
    'TRINIDAD DOLLAR': 'TTD',
    'TRINIDAD AND TOBAGO DOLLAR': 'TTD',
    XCD: 'XCD',
    EC: 'XCD',
    'EAST CARIBBEAN DOLLAR': 'XCD',
    ANG: 'ANG',
    NAF: 'ANG',
    'ANTILLEAN GUILDER': 'ANG',
    'NETHERLANDS ANTILLEAN GUILDER': 'ANG',
    'CARIBBEAN GUILDER': 'ANG'
  };

  function hasCurrencyTerm(term) {
    const escapedTerm = String(term).toLowerCase().replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    return new RegExp('(^|\\s|\\d)' + escapedTerm + '(?=\\s|\\d|$)').test(cleanValue);
  }

  const currencySymbolPatterns = [
    { pattern: /\bBZ\s*\$/i, currency: 'BZD' },
    { pattern: /\bBDS\s*\$/i, currency: 'BBD' },
    { pattern: /\bBD\s*\$/i, currency: 'BMD' },
    { pattern: /\bBS\s*\$/i, currency: 'BSD' },
    { pattern: /\bCI\s*\$/i, currency: 'KYD' },
    { pattern: /\bJ\s*\$/i, currency: 'JMD' },
    { pattern: /\bTT\s*\$/i, currency: 'TTD' },
    { pattern: /\bEC\s*\$/i, currency: 'XCD' },
    { pattern: /\bGY\s*\$/i, currency: 'GYD' },
    { pattern: /\bSR\s*\$/i, currency: 'SRD' },
    { pattern: /\bRD\s*\$/i, currency: 'DOP' },
    { pattern: /\bC\s*\$/i, currency: 'NIO' },
    { pattern: /\bQ(?=\s*\d)/i, currency: 'GTQ' },
    { pattern: /\bL(?=\s*\d)/i, currency: 'HNL' },
    { pattern: /\u20a1/i, currency: 'CRC' },
    { pattern: /\u20b2/i, currency: 'PYG' },
    { pattern: /\u0192|Afl\.?/i, currency: 'AWG' },
    { pattern: /\bNAf\.?/i, currency: 'ANG' }
  ];

  for (const item of currencySymbolPatterns) {
    if (currencyRates[item.currency] && item.pattern.test(valueStr)) {
      return amount * currencyRates[item.currency];
    }
  }

  // Check fiat currencies and common YouTube display aliases before platform words like "super chat".
  for (const [alias, currency] of Object.entries(currencyAliases)) {
    if (currencyRates[currency] && hasCurrencyTerm(alias)) {
      return amount * currencyRates[currency];
    }
  }

  for (const [currency, rate] of Object.entries(currencyRates)) {
    if (hasCurrencyTerm(currency.toLowerCase())) {
      return amount * rate;
    }
  }

  // Check for platform-specific currencies first
  if (source && platformAdjustments[source]) {
    for (const [currency, rate] of Object.entries(platformAdjustments[source])) {
      if (cleanValue.includes(currency)) {
        return amount * rate;
      }
    }
  }
  
  // Check for virtual currencies
  for (const [currency, rate] of Object.entries(virtualCurrencies)) {
    if (cleanValue.includes(currency)) {
      return amount * rate;
    }
  }
  
  // Check for currency symbols
  if (valueStr.includes('€')) return amount * currencyRates.EUR;
  if (valueStr.includes('£')) return amount * currencyRates.GBP;
  if (valueStr.includes('¥')) return amount * currencyRates.JPY;
  if (valueStr.includes('₩')) return amount * currencyRates.KRW;
  if (valueStr.includes('₹')) return amount * currencyRates.INR;
  if (valueStr.includes('R$')) return amount * currencyRates.BRL;
  if (valueStr.includes('₽')) return amount * currencyRates.RUB;
  if (/S\/\.?/i.test(valueStr)) return amount * currencyRates.PEN;
  if (valueStr.includes('₲')) return amount * currencyRates.PYG;
  if (/\$U/i.test(valueStr)) return amount * currencyRates.UYU;
  
  // Default to USD if no specific currency found
  return amount;
}

// Helper function to get gift values by platform
function getGiftValue(platform, giftType = 'default') {
  const giftValues = {
    twitch: {
      default: 4.99,
      tier1: 4.99,
      tier2: 9.99,
      tier3: 24.99,
      sub: 4.99,
      giftsub: 4.99
    },
    youtube: {
      default: 4.99,
      membership: 4.99,
      giftmembership: 4.99,
      sponsorship: 4.99
    },
    kick: {
      default: 3.75,
      sub: 3.75,
      giftsub: 3.75
    },
    tiktok: {
      default: 0.99,
      rose: 0.01,
      gift: 0.99,
      treasure: 5.00
    },
    facebook: {
      default: 0.99,
      support: 0.99,
      badge: 0.99
    }
  };
  
  const platformGifts = giftValues[platform] || giftValues.twitch;
  return platformGifts[giftType] || platformGifts.default || 4.99;
}
