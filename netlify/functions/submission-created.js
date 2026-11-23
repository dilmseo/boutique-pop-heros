// Déclenchée par Netlify à chaque envoi du formulaire « commande » : range la commande dans Netlify Blobs
const { connectLambda, getStore } = require('@netlify/blobs');

exports.handler = async (event) => {
  connectLambda(event);
  const { payload } = JSON.parse(event.body || '{}');
  if (!payload || payload.form_name !== 'commande') return { statusCode: 200, body: 'ignoré' };
  const d = payload.data || {};
  const total = parseFloat(String(d.total || '0').replace(/[^\d,.-]/g, '').replace(',', '.')) || 0;
  const commande = {
    id: payload.id, date: payload.created_at || new Date().toISOString(), statut: 'nouvelle',
    nom: d.nom || '', email: d.email || '', telephone: d.telephone || '', adresse: d.adresse || '',
    message: d.message || '', panier: d.panier || '', total,
  };
  await getStore('commandes').setJSON(commande.id, commande);
  return { statusCode: 200, body: 'ok' };
};
