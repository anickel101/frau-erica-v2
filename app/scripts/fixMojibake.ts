// Repairs mojibake in text coming out of the archive database.
//
// The corruption is UTF-8 bytes that were read as Mac Roman and re-saved
// as UTF-8: "Müllers" became "M√ºllers", "Molly’s" became "Molly‚Äôs".
// Encoding back to Mac Roman and decoding as UTF-8 reverses it exactly.
//
// This replaced a hand-written list of six punctuation substitutions
// (’ – — ‘ “ ”), which silently passed every accented letter straight
// through -- so "M√ºllers", "Gro√ü", "Frauenflei√ü", "P√§sel" and
// "Pite√•" were live on the site, the family's own name among them. A
// general rule costs the same and cannot have that kind of gap.
//
// The source database has since been repaired directly, so this is a
// no-op on current data. It stays as a guard: the archive is re-imported
// from FileMaker, which is where the corruption came from.
//
// Its own module rather than a helper inside export-data.ts so it can be
// tested -- it now runs over every piece of text the archive publishes,
// and the risk worth covering is not that it fails to repair a broken
// value but that it mangles a correct one.

// Mac Roman's upper half, character -> byte. Node has no Mac Roman
// decoder and 'latin1' is a different mapping, so the table is explicit.
// Generated from Python's mac_roman codec, not hand-typed.
const MAC_ROMAN_BY_CHAR = new Map<string, number>([
  ['Ä', 0x80],
  ['Å', 0x81],
  ['Ç', 0x82],
  ['É', 0x83],
  ['Ñ', 0x84],
  ['Ö', 0x85],
  ['Ü', 0x86],
  ['á', 0x87],
  ['à', 0x88],
  ['â', 0x89],
  ['ä', 0x8a],
  ['ã', 0x8b],
  ['å', 0x8c],
  ['ç', 0x8d],
  ['é', 0x8e],
  ['è', 0x8f],
  ['ê', 0x90],
  ['ë', 0x91],
  ['í', 0x92],
  ['ì', 0x93],
  ['î', 0x94],
  ['ï', 0x95],
  ['ñ', 0x96],
  ['ó', 0x97],
  ['ò', 0x98],
  ['ô', 0x99],
  ['ö', 0x9a],
  ['õ', 0x9b],
  ['ú', 0x9c],
  ['ù', 0x9d],
  ['û', 0x9e],
  ['ü', 0x9f],
  ['†', 0xa0],
  ['°', 0xa1],
  ['¢', 0xa2],
  ['£', 0xa3],
  ['§', 0xa4],
  ['•', 0xa5],
  ['¶', 0xa6],
  ['ß', 0xa7],
  ['®', 0xa8],
  ['©', 0xa9],
  ['™', 0xaa],
  ['´', 0xab],
  ['¨', 0xac],
  ['≠', 0xad],
  ['Æ', 0xae],
  ['Ø', 0xaf],
  ['∞', 0xb0],
  ['±', 0xb1],
  ['≤', 0xb2],
  ['≥', 0xb3],
  ['¥', 0xb4],
  ['µ', 0xb5],
  ['∂', 0xb6],
  ['∑', 0xb7],
  ['∏', 0xb8],
  ['π', 0xb9],
  ['∫', 0xba],
  ['ª', 0xbb],
  ['º', 0xbc],
  ['Ω', 0xbd],
  ['æ', 0xbe],
  ['ø', 0xbf],
  ['¿', 0xc0],
  ['¡', 0xc1],
  ['¬', 0xc2],
  ['√', 0xc3],
  ['ƒ', 0xc4],
  ['≈', 0xc5],
  ['∆', 0xc6],
  ['«', 0xc7],
  ['»', 0xc8],
  ['…', 0xc9],
  ['\xa0', 0xca],
  ['À', 0xcb],
  ['Ã', 0xcc],
  ['Õ', 0xcd],
  ['Œ', 0xce],
  ['œ', 0xcf],
  ['–', 0xd0],
  ['—', 0xd1],
  ['“', 0xd2],
  ['”', 0xd3],
  ['‘', 0xd4],
  ['’', 0xd5],
  ['÷', 0xd6],
  ['◊', 0xd7],
  ['ÿ', 0xd8],
  ['Ÿ', 0xd9],
  ['⁄', 0xda],
  ['€', 0xdb],
  ['‹', 0xdc],
  ['›', 0xdd],
  ['ﬁ', 0xde],
  ['ﬂ', 0xdf],
  ['‡', 0xe0],
  ['·', 0xe1],
  ['‚', 0xe2],
  ['„', 0xe3],
  ['‰', 0xe4],
  ['Â', 0xe5],
  ['Ê', 0xe6],
  ['Á', 0xe7],
  ['Ë', 0xe8],
  ['È', 0xe9],
  ['Í', 0xea],
  ['Î', 0xeb],
  ['Ï', 0xec],
  ['Ì', 0xed],
  ['Ó', 0xee],
  ['Ô', 0xef],
  ['\uf8ff', 0xf0],
  ['Ò', 0xf1],
  ['Ú', 0xf2],
  ['Û', 0xf3],
  ['Ù', 0xf4],
  ['ı', 0xf5],
  ['ˆ', 0xf6],
  ['˜', 0xf7],
  ['¯', 0xf8],
  ['˘', 0xf9],
  ['˙', 0xfa],
  ['˚', 0xfb],
  ['¸', 0xfc],
  ['˝', 0xfd],
  ['˛', 0xfe],
  ['ˇ', 0xff],
])

// A run of two or more non-ASCII characters -- the shape mojibake takes.
// Repaired run by run rather than whole-string, because a value is often
// part clean UTF-8 and part mojibake; round-tripping the whole value
// throws on the clean part and misses the corruption entirely.
// Written as a positive range (\u0080 and up) rather than the more
// obvious negated /[^\x00-\x7F]/, which trips eslint's no-control-regex
// for the \x00. Same set of characters either way.
const NON_ASCII_RUN = /[\u0080-\uffff]{2,}/g

const UTF8_STRICT = new TextDecoder('utf-8', { fatal: true })

// A run that isn't Mac-Roman-encodable, or doesn't decode as UTF-8
// afterwards, is genuine text and comes back untouched. That is what
// makes this safe to run over everything -- "Sauerbraten mit Klößen"
// survives unchanged.
function repairRun(run: string): string {
  const bytes: number[] = []
  for (const char of run) {
    const byte = MAC_ROMAN_BY_CHAR.get(char)
    if (byte === undefined) return run
    bytes.push(byte)
  }
  try {
    return UTF8_STRICT.decode(new Uint8Array(bytes))
  } catch {
    return run
  }
}

export function fixMojibake(text: string): string
export function fixMojibake(text: string | null): string | null
export function fixMojibake(text: string | null): string | null {
  if (text === null) return null
  return text.replaceAll(NON_ASCII_RUN, repairRun)
}
