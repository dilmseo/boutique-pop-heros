// API de l'espace marchand (/api/espace) — protégé par le mot de passe dont l'empreinte SHA-256 est dans ESPACE_MDP_HASH
import { getStore } from '@netlify/blobs';
import { createHash, timingSafeEqual } from 'node:crypto';

const STATUTS = ['nouvelle', 'confirmée', 'expédiée', 'livrée', 'annulée'];
const ETAPES = ['stripe', 'stripe_active', 'produits', 'domaine'];
const json = (o, s = 200) => new Response(JSON.stringify(o), { status: s, headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' } });

function autorise(req) {
  const attendu = Buffer.from(process.env.ESPACE_MDP_HASH || '', 'hex');
  const recu = createHash('sha256').update(req.headers.get('x-mdp') || '').digest();
  return attendu.length === 32 && timingSafeEqual(attendu, recu);
}

export default async (req) => {
  if (!autorise(req)) { await new Promise(r => setTimeout(r, 600)); return json({ erreur: 'Mot de passe incorrect' }, 401); }
  const commandes = getStore('commandes'), reglages = getStore('reglages');

  if (req.method === 'POST') {
    const b = await req.json().catch(() => ({}));
    if (b.action === 'statut' && STATUTS.includes(b.statut)) {
      const c = await commandes.get(b.id, { type: 'json' });
      if (!c) return json({ erreur: 'Commande introuvable' }, 404);
      c.statut = b.statut; c.maj = new Date().toISOString();
      await commandes.setJSON(b.id, c);
      return json({ ok: true });
    }
    if (b.action === 'etape' && ETAPES.includes(b.etape)) {
      const e = (await reglages.get('etapes', { type: 'json' })) || {};
      e[b.etape] = b.fait ? new Date().toISOString() : null;
      await reglages.setJSON('etapes', e);
      return json({ ok: true, etapes: e });
    }
    return json({ erreur: 'Action inconnue' }, 400);
  }

  const { blobs } = await commandes.list();
  const liste = (await Promise.all(blobs.map(b => commandes.get(b.key, { type: 'json' })))).filter(Boolean)
    .sort((a, b) => b.date.localeCompare(a.date));
  const valides = liste.filter(c => c.statut !== 'annulée');
  return json({
    commandes: liste,
    stats: {
      ca: valides.reduce((s, c) => s + (c.total || 0), 0),
      nb: valides.length,
      enAttente: liste.filter(c => c.statut === 'nouvelle').length,
      panierMoyen: valides.length ? valides.reduce((s, c) => s + (c.total || 0), 0) / valides.length : 0,
    },
    etapes: (await reglages.get('etapes', { type: 'json' })) || {},
  });
};

export const config = { path: '/api/espace' };
