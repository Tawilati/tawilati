// Builds brand/icons from lucide-static plus four custom Tawilati icons drawn on the same
// 24px grid, 2px stroke, round caps and joins.
// usage: node gen-icons.mjs <dir containing node_modules/lucide-static> <output dir>
import fs from 'fs';
import path from 'path';

const [PKG, OUT] = process.argv.slice(2);
const LUCIDE = path.join(PKG, 'node_modules', 'lucide-static', 'icons');

const head = (name, source) =>
  `<!-- Tawilati icon "${name}" · ${source} -->\n` +
  `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">\n`;

// Navigation set (names match the brand icon sheet). Value: lucide file, or custom body.
const nav = {
  home: { lucide: 'house' },
  menu: { custom: '<rect x="5" y="3" width="14" height="18" rx="2.5"/>\n<path d="M9 8h6"/>\n<path d="M9 12h6"/>\n<path d="M9 16h3.5"/>' },
  tables: { custom: '<ellipse cx="12" cy="8" rx="9" ry="3"/>\n<path d="M5.5 10.4 4.6 19"/>\n<path d="M18.5 10.4l.9 8.6"/>\n<path d="M12 11v8"/>' },
  orders: { lucide: 'shopping-cart' },
  kitchen: { custom: '<circle cx="12" cy="5" r="1.5"/>\n<path d="M12 6.5V8"/>\n<path d="M4 16a8 8 0 0 1 16 0"/>\n<path d="M2 16h20"/>\n<path d="M4.5 19.5h15"/>' },
  staff: { lucide: 'users' },
  reports: { custom: '<rect x="3" y="11" width="5" height="9" rx="1"/>\n<rect x="9.5" y="4" width="5" height="16" rx="1"/>\n<rect x="16" y="8" width="5" height="12" rx="1"/>' },
  settings: { lucide: 'settings' },
  qr: { lucide: 'scan-qr-code' },
  payment: { lucide: 'credit-card' }
};

// Interface icons used by the components.
const ui = [
  'mail', 'lock', 'eye', 'eye-off', 'check', 'circle-check', 'circle-alert', 'arrow-right', 'minus', 'plus',
  'x', 'search', 'bell', 'log-out', 'chevron-right', 'image', 'clock', 'receipt-text', 'utensils'
];

const lucideBody = (file) => {
  const src = fs.readFileSync(path.join(LUCIDE, `${file}.svg`), 'utf8');
  return src.slice(src.indexOf('>', src.indexOf('<svg')) + 1, src.lastIndexOf('</svg>')).trim()
    .split('\n').map((l) => l.trim()).filter(Boolean).join('\n');
};

for (const dir of ['', 'ui']) fs.mkdirSync(path.join(OUT, dir), { recursive: true });

for (const [name, def] of Object.entries(nav)) {
  const body = def.lucide ? lucideBody(def.lucide) : def.custom;
  const source = def.lucide ? `Lucide "${def.lucide}" (ISC)` : 'custom, Lucide grid';
  fs.writeFileSync(path.join(OUT, `${name}.svg`), head(name, source) + body + '\n</svg>\n');
}
for (const file of ui) {
  fs.writeFileSync(path.join(OUT, 'ui', `${file}.svg`), head(file, `Lucide "${file}" (ISC)`) + lucideBody(file) + '\n</svg>\n');
}
fs.copyFileSync(path.join(PKG, 'node_modules', 'lucide-static', 'LICENSE'), path.join(OUT, 'LICENSE-lucide.txt'));
console.log('icons:', Object.keys(nav).length, 'nav +', ui.length, 'ui');
