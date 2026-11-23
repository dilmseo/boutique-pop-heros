// /api/paiement — paiement par carte via Stripe Checkout (compte Stripe du marchand)
//  GET  ?etat=1          -> { actif }
//  POST { ref, panier:[{id,opts,qte}], email }  -> { url }  (prix recalculés ici, jamais ceux du navigateur)
//  GET  ?session=cs_...  -> { paye, montant }  (vérifié auprès de Stripe, enregistré dans le store « paiements »)
import { getStore } from '@netlify/blobs';
import { lireCle, infoStripe, stripe, catalogue, verifierSession, LIVRAISON, FRANCO } from '../lib/stripe.mjs';

const json = (o, s = 200) => new Response(JSON.stringify(o), { status: s, headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' } });

export default async (req) => {
  const url = new URL(req.url), origine = url.origin;
  const info = await infoStripe();
  if (req.method === 'GET' && url.searchParams.has('etat')) return json({ actif: !!info.actif });
  const cle = info.actif ? await lireCle() : null;
  if (!cle) return json({ erreur: 'Paiement en ligne non activé' }, 503);

  if (req.method === 'GET' && url.searchParams.get('session')) {
    try { return json(await verifierSession(cle, url.searchParams.get('session'))); }
    catch (e) { return json({ erreur: 'Vérification impossible' }, 502); }
  }

  if (req.method !== 'POST') return json({ erreur: 'Méthode' }, 405);
  const b = await req.json().catch(() => ({}));
  if (!/^[a-z0-9-]{8,40}$/i.test(b.ref || '') || !Array.isArray(b.panier) || !b.panier.length || b.panier.length > 50)
    return json({ erreur: 'Panier invalide' }, 400);
  const produits = await catalogue(origine);
  const lignes = [];
  let st = 0;
  for (const l of b.panier) {
    const p = produits.find(x => x.id === l.id), q = Math.min(20, Math.max(1, parseInt(l.qte) || 1));
    if (!p) return json({ erreur: 'Produit inconnu' }, 400);
    st += p.prix * q;
    lignes.push({ quantity: q, price_data: { currency: 'eur', unit_amount: Math.round(p.prix * 100),
      product_data: { name: (p.nom + (l.opts ? ' (' + String(l.opts).slice(0, 60) + ')' : '')).slice(0, 250), images: [origine + '/img/' + p.imgs[0] + '.webp'] } } });
  }
  if (st < FRANCO) lignes.push({ quantity: 1, price_data: { currency: 'eur', unit_amount: Math.round(LIVRAISON * 100), product_data: { name: 'Livraison' } } });
  try {
    const s = await stripe(cle, 'checkout/sessions', {
      mode: 'payment', locale: 'fr', line_items: lignes,
      customer_email: /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(b.email || '') ? b.email : undefined,
      metadata: { ref: b.ref }, payment_intent_data: { metadata: { ref: b.ref } },
      success_url: origine + '/merci.html?session_id={CHECKOUT_SESSION_ID}',
      cancel_url: origine + '/?paiement=annule',
    });
    await getStore('paiements').setJSON(b.ref, { session: s.id, statut: 'en attente', montant: (s.amount_total || 0) / 100, date: new Date().toISOString() });
    return json({ url: s.url });
  } catch (e) {
    return json({ erreur: 'Le paiement n\'a pas pu être préparé' }, 502);
  }
};

export const config = { path: '/api/paiement' };
