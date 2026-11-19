import pako from "pako";

// Z85 alphabet with a leading padding count for a partial four-byte group.
export const PACKED_DATA_ALPHABET = "0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ.-:+=^!/*?&<>()[]{}@%$#";

// Build-time compressed JSON only; no executable payload or external resources.
// Language and PDF CMap dictionaries share this codec. Keep decode buffers
// local so only the ordinary dictionaries remain resident.
export function decodePackedJson(payload) {
  const binary = atob(payload);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return JSON.parse(pako.inflateRaw(bytes, { to: "string" }));
}

export function decodeTranslationData(payload) {
  const bytes = new Uint8Array((payload.length - 1) / 5 * 4);
  for (let i = 1, offset = 0; i < payload.length; i += 5, offset += 4) {
    let group = 0;
    for (let j = 0; j < 5; j++) group = group * 85 + PACKED_DATA_ALPHABET.indexOf(payload[i + j]);
    for (let j = 0; j < 4; j++) bytes[offset + j] = group >>> (24 - j * 8);
  }
  const { keys, locales } = JSON.parse(pako.inflateRaw(bytes.subarray(0, bytes.length - Number(payload[0])), { to: "string" }));
  const translations = {};
  for (const [id, values] of Object.entries(locales)) {
    const dictionary = translations[id] = {};
    for (let i = 0; i < keys.length; i++) {
      if (values[i] !== null) Object.defineProperty(dictionary, keys[i], { value: values[i], enumerable: true, writable: true, configurable: true });
    }
  }
  return translations;
}
