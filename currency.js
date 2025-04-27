function convertToUSD(valueStr, source = '') {
  // Currency conversion rates
  const currencyRates = {
    EUR: 1.08,
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
    BRL: 0.20,
    RUB: 0.011,
    MXN: 0.058,
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
    
    // Kick
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
      sub: 4.99
    },
    youtube: {
      superchat: 1.0,
      super: 1.0
    },
    kick: {
      sub: 3.75, // Kick takes a smaller cut
      subscription: 3.75
    },
    tiktok: {
      coin: 0.01,
      coins: 0.01,
      diamond: 0.005,
      diamonds: 0.005
    },
    facebook: {
      star: 0.01,
      stars: 0.01
    }
  };

  if (typeof valueStr !== 'string') valueStr = String(valueStr);
  valueStr = valueStr.trim();
  
  // Extract numeric value, including negative numbers and decimal patterns
  const numericMatch = valueStr.match(/-?[\d]+([.,][\d]+)?/);
  if (!numericMatch) return 0;
  
  const amount = parseFloat(numericMatch[0].replace(',', '.'));
  if (isNaN(amount)) return 0;

  // Clean the string for currency/type detection, preserve important symbols
  const cleanValue = valueStr.toLowerCase().replace(/[$€£¥₩₹₽]/g, '').replace(/[^\w\s]/g, ' ').trim();
  
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
  
  // Check for fiat currencies
  for (const [currency, rate] of Object.entries(currencyRates)) {
    if (cleanValue.includes(currency.toLowerCase())) {
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
  
  // Default to USD if no specific currency found
  return amount;
}