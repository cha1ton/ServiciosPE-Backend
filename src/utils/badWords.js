// backend/src/utils/badWords.js

// Lista mínima de ejemplo. Puedes ampliarla con tu JSON propio.
export const BAD_WORDS = [
  'tonto','idiota','estupido','imbecil','mierda','carajo','puta','puto'
];

export function containsBadWords(text = '') {
  const t = text.toLowerCase();
  return BAD_WORDS.some(w => t.includes(w));
}
