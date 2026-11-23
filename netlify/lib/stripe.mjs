// Outils partagés : clé Stripe du marchand (chiffrée AES-256-GCM dans Netlify Blobs), appels API Stripe, catalogue
import { getStore } from '@netlify/blobs';
import { createCipheriv, createDecipheriv, randomBytes } from 'node:crypto';

export const LIVRAISON = 4.90, FRANCO = 49;
const cleChiffre = () => {
  const k = Buffer.from(process.env.STRIPE_CHIFFRE || '', 'hex');
  if (k.length !== 32) throw new Error('STRIPE_CHIFFRE absente');
  return k;
};

export async function ecrireCle(cle, mode) {
  const iv = randomBytes(12), c = createCipheriv('aes-256-gcm', cleChiffre(), iv);
  const data = Buffer.concat([c.update(cle, 'utf8'), c.final()]);
  await getStore('secret').setJSON('stripe', { iv: iv.toString('hex'), tag: c.getAuthTag().toString('hex'), data: data.toString('hex') });
  const info = { actif: true, mode, date: new Date().toISOString(), fin: cle.slice(-4) };
  await getStore('reglages').setJSON('stripe', info);
  return info;
}
export async function retirerCle() {
  await getStore('secret').delete('stripe');
  await getStore('reglages').setJSON('stripe', { actif: false });
}
export async function lireCle() {
  const s = await getStore('secret').get('stripe', { type: 'json' });
  if (!s) return null;
  const d = createDecipheriv('aes-256-gcm', cleChiffre(), Buffer.from(s.iv, 'hex'));
  d.setAuthTag(Buffer.from(s.tag, 'hex'));
  return Buffer.concat([d.update(Buffer.from(s.data, 'hex')), d.final()]).toString('utf8');
}
export async function infoStripe() {
  return (await getStore('reglages').get('stripe', { type: 'json' })) || { actif: false };
}

// Paramètres imbriqués façon Stripe : {a:{b:[{c:1}]}} -> a[b][0][c]=1
function aplatir(o, prefixe = '', sortie = new URLSearchParams()) {
  for (const [k, v] of Object.entries(o)) {
    const cle = prefixe ? `${prefixe}[${k}]` : k;
    if (v === undefined || v === null) continue;
    if (typeof v === 'object') aplatir(v, cle, sortie); else sortie.append(cle, String(v));
  }
  return sortie;
}
export async function stripe(cle, chemin, params, methode) {
  const m = methode || (params ? 'POST' : 'GET');
  const r = await fetch('https://api.stripe.com/v1/' + chemin, {
    method: m,
    headers: { Authorization: 'Bearer ' + cle, 'Content-Type': 'application/x-www-form-urlencoded' },
    body: m === 'POST' && params ? aplatir(params).toString() : undefined,
  });
  const j = await r.json().catch(() => ({}));
  if (!r.ok) { const e = new Error(j.error?.message || 'Stripe ' + r.status); e.status = r.status; throw e; }
  return j;
}

// Interroge Stripe sur une session Checkout et range le résultat dans le store « paiements » (clé = ref de la commande)
export async function verifierSession(cle, sessionId) {
  const s = await stripe(cle, 'checkout/sessions/' + encodeURIComponent(sessionId));
  const ref = s.metadata?.ref;
  if (!ref) return { paye: false };
  const paye = s.payment_status === 'paid';
  const p = { session: s.id, statut: paye ? 'payée' : (s.status === 'expired' ? 'expirée' : 'en attente'),
    montant: (s.amount_total || 0) / 100, date: new Date().toISOString() };
  await getStore('paiements').setJSON(ref, p);
  return { paye, montant: p.montant, ref };
}

export async function catalogue(origine) {
  const t = await (await fetch(origine + '/catalogue.js')).text();
  return new Function(t + '\n;return PRODUITS;')();
}
