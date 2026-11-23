// API de l'espace marchand (/api/espace) — protégé par le mot de passe dont l'empreinte SHA-256 est dans ESPACE_MDP_HASH
import { getStore } from '@netlify/blobs';
import { createHash, timingSafeEqual } from 'node:crypto';
import { ecrireCle, retirerCle, lireCle, infoStripe, stripe, verifierSession } from '../lib/stripe.mjs';
import { verifierCleGemini, ecrireCleGemini, retirerCleGemini, infoGemini } from '../lib/gemini.mjs';

const STATUTS = ['nouvelle', 'confirmée', 'expédiée', 'livrée', 'annulée'];
const ETAPES = ['stripe', 'stripe_active', 'produits', 'domaine'];
const json = (o, s = 200) => new Response(JSON.stringify(o), { status: s, headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' } });

function autorise(req) {
  const attendu = Buffer.from(process.env.ESPACE_MDP_HASH || '', 'hex');
  const recu = createHash('sha256').update(req.headers.get('x-mdp') || '').digest();
  return attendu.length === 32 && timingSafeEqual(attendu, recu);
}

async function cocher(reglages, ...etapes) {
  const e = (await reglages.get('etapes', { type: 'json' })) || {};
  for (const k of etapes) e[k] = e[k] || new Date().toISOString();
  await reglages.setJSON('etapes', e);
}

export default async (req) => {
  if (!autorise(req)) { await new Promise(r => setTimeout(r, 600)); return json({ erreur: 'Mot de passe incorrect' }, 401); }
  const commandes = getStore('commandes'), reglages = getStore('reglages'), paiements = getStore('paiements');

  if (req.method === 'POST') {
    const b = await req.json().catch(() => ({}));
    if (b.action === 'statut' && STATUTS.includes(b.statut)) {
      const c = await commandes.get(b.id, { type: 'json' });
      if (!c) return json({ erreur: 'Commande introuvable' }, 404);
      c.statut = b.statut; c.maj = new Date().toISOString();
      await commandes.setJSON(b.id, c);
      return json({ ok: true });
    }
    if (b.action === 'supprimer') {
      const c = await commandes.get(b.id, { type: 'json' });
      if (!c || c.statut !== 'annulée') return json({ erreur: 'Seule une commande annulée peut être supprimée' }, 400);
      await commandes.delete(b.id);
      return json({ ok: true });
    }
    if (b.action === 'etape' && ETAPES.includes(b.etape)) {
      const e = (await reglages.get('etapes', { type: 'json' })) || {};
      e[b.etape] = b.fait ? new Date().toISOString() : null;
      await reglages.setJSON('etapes', e);
      return json({ ok: true, etapes: e });
    }
    if (b.action === 'stripe') {
      const cle = String(b.cle || '').trim();
      const m = cle.match(/^(sk|rk)_(live|test)_[A-Za-z0-9]{10,}$/);
      if (!m) return json({ erreur: 'Ce n\'est pas une clé Stripe : elle commence par rk_live_ (clé restreinte) ou sk_live_.' }, 400);
      try { await stripe(cle, 'checkout/sessions?limit=1'); }
      catch (e) {
        return json({ erreur: e.status === 401 ? 'Stripe refuse cette clé : vérifiez que vous l\'avez copiée en entier.'
          : e.status === 403 ? 'La clé n\'a pas la permission « Checkout Sessions : Écriture ». Modifiez la clé restreinte dans Stripe.'
          : 'Stripe ne répond pas, réessayez dans un instant.' }, 400);
      }
      const info = await ecrireCle(cle, m[2]);
      await cocher(reglages, 'stripe', 'stripe_active');
      return json({ ok: true, stripe: info });
    }
    if (b.action === 'stripe_retirer') { await retirerCle(); return json({ ok: true, stripe: { actif: false } }); }
    if (b.action === 'gemini') {
      const cle = String(b.cle || '').trim();
      if (!/^(AIza[0-9A-Za-z_-]{30,}|AQ\.[0-9A-Za-z_.-]{20,})$/.test(cle)) return json({ erreur: 'Ce n\'est pas une clé Gemini : elle commence par AIza… (copiez-la en entier depuis Google AI Studio).' }, 400);
      try { await verifierCleGemini(cle); }
      catch (e) {
        return json({ erreur: [400, 401, 403].includes(e.status) ? 'Google refuse cette clé : vérifiez que vous l\'avez copiée en entier.'
          : 'Google ne répond pas, réessayez dans un instant.' }, 400);
      }
      return json({ ok: true, gemini: await ecrireCleGemini(cle) });
    }
    if (b.action === 'gemini_retirer') { await retirerCleGemini(); return json({ ok: true }); }
    return json({ erreur: 'Action inconnue' }, 400);
  }

  const { blobs } = await commandes.list();
  const liste = (await Promise.all(blobs.map(b => commandes.get(b.key, { type: 'json' })))).filter(Boolean)
    .sort((a, b) => b.date.localeCompare(a.date));

  // État des paiements par carte : rafraîchit auprès de Stripe ceux encore « en attente » (moins de 2 jours)
  const info = await infoStripe();
  const cle = info.actif ? await lireCle().catch(() => null) : null;
  await Promise.all(liste.filter(c => c.ref).map(async c => {
    let p = await paiements.get(c.ref, { type: 'json' });
    if (p && p.statut === 'en attente' && cle && Date.now() - new Date(c.date).getTime() < 2 * 86400e3) {
      try { await verifierSession(cle, p.session); p = await paiements.get(c.ref, { type: 'json' }); } catch (e) {}
    }
    if (p) c.paiement = { statut: p.statut, montant: p.montant };
  }));

  const valides = liste.filter(c => c.statut !== 'annulée');
  return json({
    commandes: liste,
    stats: {
      ca: valides.reduce((s, c) => s + (c.total || 0), 0),
      nb: valides.length,
      enAttente: liste.filter(c => c.statut === 'nouvelle').length,
      panierMoyen: valides.length ? valides.reduce((s, c) => s + (c.total || 0), 0) / valides.length : 0,
      encaisse: liste.filter(c => c.paiement?.statut === 'payée').reduce((s, c) => s + (c.paiement.montant || 0), 0),
    },
    etapes: (await reglages.get('etapes', { type: 'json' })) || {},
    stripe: { actif: !!info.actif, mode: info.mode, date: info.date, fin: info.fin },
    gemini: await infoGemini(),
  });
};

export const config = { path: '/api/espace' };
