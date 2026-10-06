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

// Mojibake in this archive always decodes back into one of three
// blocks: Latin-1 Supplement and Latin Extended-A (the umlauts, the
// eszett, the ring and the accents) or General Punctuation (the curly
// quotes, the en and em dashes, the ellipsis). Nothing else is a
// plausible repair of a German family archive.
//
// This guard is what makes the round trip safe, and it is not
// theoretical. Mac Roman puts the curly quotes and dashes at 0xD0-0xD5,
// inside UTF-8's two-byte lead range, and the umlauts at 0x80-0x9F,
// inside its continuation range -- so a dash or a non-breaking space
// immediately followed by an umlaut encodes to a valid two-byte
// sequence and decodes, silently, into Cyrillic:
//
//   "1900–Über"  ->  "1900Іber"
//   "—Überall"   ->  "цberall"
//   NBSP + "ü"   ->  "ʟ"
//
// Latent when this was written -- nothing currently in the archive
// trips it -- but it fires the first time somebody types "—Über" or
// pastes from a word processor carrying a non-breaking space, which is
// exactly what a FileMaker re-import brings.
function isPlausibleRepair(decoded: string): boolean {
  for (const char of decoded) {
    const code = char.codePointAt(0)!
    if (code < 0x80) continue
    if (code >= 0x00a0 && code <= 0x024f) continue
    if (code >= 0x2000 && code <= 0x206f) continue
    return false
  }
  return true
}

// A run that isn't Mac-Roman-encodable, doesn't decode as UTF-8
// afterwards, or decodes into something no German text would contain,
// is genuine text and comes back untouched. That is what makes this
// safe to run over everything -- "Sauerbraten mit Klößen" survives
// unchanged, and so does "1900–Über".
function repairRun(run: string): string {
  const bytes: number[] = []
  for (const char of run) {
    const byte = MAC_ROMAN_BY_CHAR.get(char)
    if (byte === undefined) return run
    bytes.push(byte)
  }
  try {
    const decoded = UTF8_STRICT.decode(new Uint8Array(bytes))
    return isPlausibleRepair(decoded) ? decoded : run
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
