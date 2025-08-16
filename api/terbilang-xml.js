// api/terbilang.js
// Vercel Edge Function: Indonesian "terbilang" (number-to-words) API
// Sekarang mendukung JSON (default) dan XML (pakai query ?format=xml)

export const config = { runtime: 'edge' };

const WORDS_0_11 = [
  'nol', 'satu', 'dua', 'tiga', 'empat', 'lima', 'enam', 'tujuh', 'delapan', 'sembilan', 'sepuluh', 'sebelas'
];
const SCALES = ['', 'ribu', 'juta', 'miliar', 'triliun', 'kuadriliun', 'kuintiliun'];

function stripSpaces(s) { return (s ?? '').toString().trim(); }

function normalizeNumberString(raw) {
  let s = stripSpaces(raw);
  if (!s) return { normalized: null, error: 'EMPTY_INPUT' };
  s = s.replace(/[\u00A0\s]/g, '');
  const signMatch = s.match(/^[+-]/);
  const sign = signMatch ? signMatch[0] : '';
  if (sign) s = s.slice(1);
  const hasComma = s.includes(',');
  const hasDot = s.includes('.');
  let integerPart = s, fractionalPart = '';
  if (hasComma && hasDot) {
    const lastComma = s.lastIndexOf(',');
    const lastDot = s.lastIndexOf('.');
    const decimalSep = lastComma > lastDot ? ',' : '.';
    const thousandsSep = decimalSep === ',' ? '.' : ',';
    const parts = s.split(decimalSep);
    integerPart = parts[0].replace(new RegExp(`\\${thousandsSep}`, 'g'), '');
    fractionalPart = parts.slice(1).join('');
  } else if (hasComma) {
    const parts = s.split(',');
    if (parts.length === 2 && parts[1].length > 0 && parts[1].length <= 6) {
      integerPart = parts[0].replace(/\./g, '');
      fractionalPart = parts[1];
    } else {
      integerPart = s.replace(/,/g, '');
    }
  } else if (hasDot) {
    const parts = s.split('.');
    if (parts.length === 2 && parts[1].length > 0 && parts[1].length <= 6) {
      integerPart = parts[0].replace(/,/g, '');
      fractionalPart = parts[1];
    } else {
      integerPart = s.replace(/\./g, '');
    }
  } else {
    integerPart = s;
  }
  if (!/^\d+$/.test(integerPart)) {
    return { normalized: null, error: 'INVALID_INTEGER_PART' };
  }
  if (fractionalPart && !/^\d+$/.test(fractionalPart)) {
    return { normalized: null, error: 'INVALID_FRACTION_PART' };
  }
  const normalized = sign + integerPart + (fractionalPart ? '.' + fractionalPart : '');
  return { normalized };
}

function threeDigitsToWords(n) {
  if (n === 0) return '';
  if (n < 12) return WORDS_0_11[n];
  if (n < 20) return `${WORDS_0_11[n - 10]} belas`;
  if (n < 100) {
    const tens = Math.floor(n / 10);
    const rest = n % 10;
    return rest ? `${WORDS_0_11[tens]} puluh ${WORDS_0_11[rest]}` : `${WORDS_0_11[tens]} puluh`;
  }
  if (n < 200) {
    const rest = n - 100;
    return rest ? `seratus ${threeDigitsToWords(rest)}` : 'seratus';
  }
  const hundreds = Math.floor(n / 100);
  const rest = n % 100;
  const head = `${WORDS_0_11[hundreds]} ratus`;
  return rest ? `${head} ${threeDigitsToWords(rest)}` : head;
}

function integerToWords(numStr) {
  if (!numStr || /^0+$/.test(numStr)) return 'nol';
  const chunks = [];
  for (let i = numStr.length; i > 0; i -= 3) {
    const start = Math.max(0, i - 3);
    chunks.push(parseInt(numStr.slice(start, i), 10));
  }
  let parts = [];
  for (let i = 0; i < chunks.length; i++) {
    const chunk = chunks[i];
    if (!chunk) continue;
    if (i === 1 && chunk === 1) {
      parts.unshift('seribu');
    } else {
      const words = threeDigitsToWords(chunk);
      const scale = SCALES[i];
      parts.unshift(scale ? `${words} ${scale}` : words);
    }
  }
  return parts.join(' ').replace(/\s+/g, ' ').trim();
}

function fractionToWords(fracStr) {
  if (!fracStr) return '';
  return fracStr.split('').map(d => WORDS_0_11[parseInt(d, 10)]).join(' ').replace(/\s+/g, ' ').trim();
}

function applyCase(s, mode) {
  switch ((mode || 'lower').toLowerCase()) {
    case 'upper': return s.toUpperCase();
    case 'title': return s.replace(/\w\S*/g, w => w.charAt(0).toUpperCase() + w.slice(1));
    case 'sentence': return s.charAt(0).toUpperCase() + s.slice(1);
    default: return s.toLowerCase();
  }
}

function makeTerbilang(normalized) {
  const neg = normalized.startsWith('-');
  const unsigned = neg || normalized.startsWith('+') ? normalized.slice(1) : normalized;
  const [intStr, fracStr = ''] = unsigned.split('.');
  let words = integerToWords(intStr);
  if (fracStr) {
    const fracWords = fractionToWords(fracStr);
    if (fracWords) words = `${words} koma ${fracWords}`;
  }
  if (neg) words = `minus ${words}`;
  return { words, negative: neg, intStr, fracStr };
}

function makeIDRCurrency(normalized) {
  const neg = normalized.startsWith('-');
  const unsigned = neg || normalized.startsWith('+') ? normalized.slice(1) : normalized;
  let [intStr, fracStr = ''] = unsigned.split('.');
  let sen = 0;
  if (fracStr) {
    const asNum = Number('0.' + fracStr);
    sen = Math.round(asNum * 100);
    if (sen === 100) {
      sen = 0;
      intStr = (BigInt(intStr) + 1n).toString();
    }
  }
  let main = integerToWords(intStr);
  if (neg) main = `minus ${main}`;
  let full = `${main} rupiah`;
  let senWords = '';
  if (sen > 0) {
    senWords = integerToWords(String(sen));
    full = `${full} ${senWords} sen`;
  }
  return { rupiah: full, sen, senWords };
}

function okJSON(obj, pretty = false) {
  return new Response(JSON.stringify(obj, null, pretty ? 2 : 0), {
    headers: {
      'content-type': 'application/json; charset=UTF-8',
      'access-control-allow-origin': '*',
      'access-control-allow-methods': 'GET,POST,OPTIONS',
    },
  });
}

function okXML(obj) {
  let xml = '<?xml version="1.0" encoding="UTF-8"?>\n<response>';
  for (const key in obj) {
    let val = String(obj[key]).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
    xml += `\n  <${key}>${val}</${key}>`;
  }
  xml += '\n</response>';
  return new Response(xml, {
    headers: {
      'content-type': 'application/xml; charset=UTF-8',
      'access-control-allow-origin': '*',
      'access-control-allow-methods': 'GET,POST,OPTIONS',
    },
  });
}

export default async function handler(req) {
  if (req.method === 'OPTIONS') return okJSON({ ok: true });
  let url = new URL(req.url);
  const sp = url.searchParams;
  const pretty = sp.get('pretty') !== null || sp.get('format') === 'pretty';
  const modeCase = sp.get('case') || 'lower';
  const currency = (sp.get('currency') || '').toLowerCase();
  const format = (sp.get('format') || 'json').toLowerCase();

  let raw = sp.get('angka') ?? sp.get('q') ?? '';
  if (!raw && req.method === 'POST') {
    try {
      const data = await req.json();
      raw = data?.angka ?? data?.q ?? '';
    } catch (e) {}
  }

  const norm = normalizeNumberString(raw);
  if (!norm.normalized) {
    const errObj = {
      ok: false,
      error: 'BAD_REQUEST',
      detail: norm.error || 'Unable to parse input',
      hint: 'Kirim parameter ?angka=1234 atau body JSON {"angka":"1.234,56"}'
    };
    return format === 'xml' ? okXML(errObj) : okJSON(errObj, pretty);
  }

  const { words, negative, intStr, fracStr } = makeTerbilang(norm.normalized);
  let terbilang = applyCase(words, modeCase);

  const result = {
    ok: true,
    input: raw,
    normalized: norm.normalized,
    negative,
    integer: intStr,
    fraction: fracStr,
    terbilang,
  };

  if (currency === 'idr' || currency === 'rupiah') {
    const { rupiah, sen, senWords } = makeIDRCurrency(norm.normalized);
    result.terbilang_idr = applyCase(rupiah, modeCase);
    if (sen > 0) result.sen = sen;
    if (senWords) result.sen_terbilang = applyCase(senWords + ' sen', modeCase);
  }

  return format === 'xml' ? okXML(result) : okJSON(result, pretty);
}
