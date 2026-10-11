import fs from 'node:fs';
import path from 'node:path';
import { randomUUID } from 'node:crypto';

export const rootDir = path.resolve(import.meta.dirname, '..');
export const dataDir = path.resolve(process.env.DATA_DIR || path.join(rootDir, 'server/data'));
export const uploadDir = path.join(dataDir, 'uploads');
const storePath = path.join(dataDir, 'store.json');
fs.mkdirSync(uploadDir, { recursive: true });

// Clearly labeled placeholders for interface testing; demos cannot be purchased.
const demos = [
  ['Assorted General Merchandise Case', 'General merchandise', 8900, '/demo/organizer.svg', 'DEMO LISTING ONLY · Example of a mixed merchandise case. Replace with your actual inventory and pricing.', '#f4f0e6'],
  ['Electronics Accessories Lot', 'Closeout lots', 24900, '/demo/headphones.svg', 'DEMO LISTING ONLY · Example of a closeout electronics accessories lot.', '#f0eee9'],
  ['Home Goods Bulk Case', 'Wholesale cases', 12900, '/demo/mug.svg', 'DEMO LISTING ONLY · Example of assorted home goods offered by the case.', '#f4f0e6'],
  ['Pallet of Mixed Goods', 'Pallet quantities', 59900, '/demo/tote.svg', 'DEMO LISTING ONLY · Example bulk pallet listing. Actual quantity and freight are not specified.', '#ece9e2'],
  ['Store Supply Case', 'Business supplies', 9900, '/demo/notebook.svg', 'DEMO LISTING ONLY · Example case of general store supplies.', '#f1eee8'],
  ['Lighting Closeout Lot', 'Closeout lots', 34900, '/demo/lamp.svg', 'DEMO LISTING ONLY · Example clearance lighting lot.', '#edeae5']
];
const initialStore = () => ({
  settings: { name: 'M&M Wholesale & Liquidation', eyebrow: 'WHOLESALE · CLOSEOUTS · PALLET DEALS', headline: 'Big inventory. Better deals.', tagline: 'General merchandise, wholesale cases, closeout lots and pallet quantities — built for business buyers.', announcement: 'BULK DEALS · COMPETITIVE PRICES · RELIABLE SUPPLY', supportEmail: '', currency: 'USD' },
  products: demos.map(([name, category, priceCents, image, description, color], index) => ({
    id: randomUUID(), name, category, priceCents, image, description, color,
    stock: 25, featured: index === 0, active: true, isDemo: true,
    createdAt: new Date().toISOString()
  })),
  orders: []
});
let db;
try {
  db = JSON.parse(fs.readFileSync(storePath, 'utf8'));
} catch (e) {
  if (e.code !== 'ENOENT') throw e;
  db = initialStore();
  persist();
}
function persist() {
  const tmp = `${storePath}.${process.pid}.tmp`;
  fs.writeFileSync(tmp, JSON.stringify(db, null, 2), { mode: 0o600 });
  fs.renameSync(tmp, storePath);
}
export const readStore = () => db;
export function updateStore(fn) {
  const result = fn(db);
  persist();
  return result;
}