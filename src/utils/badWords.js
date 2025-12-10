// backend/src/utils/badWords.js

// Lista mínima de ejemplo. Puedes ampliarla con tu JSON propio.
export const BAD_WORDS = [
  
  'huevon','huevón','huevona','huevonazo','huevónazo',
  'weon','weón','weona','weonas','weones', 'wevon', 'webon', 'webón',
  'cojudo','cojuda','cojudazo','cojudita',
  'imbecil','imbécil','idiota','estupido','estúpido','estupida','estúpida',
  'tarado','tarada','baboso','babosa','sonso','sonsa','bruto','bruta',

  'mierda','mrd','mrd*','carajo','chucha','chucha madre','a la mierda',
  'conchatumadre','conchadesumadre','concha su madre','ctm','ctmr',
  'chucha tu madre','chucha de tu madre',
  'puta','puto','puta madre','puta madre','putamadre',

  'soplon','soplón','maricón','mariconazo','cagón','cagona','cagonazo',
  'pendejo','pendeja','pendejazo','pendejita',
  'cochina','cochino','cochinada','rata','ratero','ladron','ladrón',
  'miserable','desgraciado','desgraciada',

  'huev0n','huev0na','huev0nes','huebon','webon','wbn',
  'c0jud0','c0judo','m13rd4','m1erda','p3ndejo','p3ndeja','c4gon','c4gona',

  'maldito','maldita','asqueroso','asquerosa','repulsivo','repulsiva',
  'perra','zorra',

  'gil','gilete','huachafo','huachafa','chusco','chusca'
];

export function containsBadWords(text = '') {
  const t = text.toLowerCase();
  return BAD_WORDS.some(w => t.includes(w));
}
