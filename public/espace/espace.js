const $ = s => document.querySelector(s);
const euros = n => (n || 0).toFixed(2).replace('.', ',') + ' €';
const echap = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const STATUTS = { 'nouvelle': '🆕 Nouvelle', 'confirmée': '✅ Confirmée', 'expédiée': '📦 Expédiée', 'livrée': '🏠 Livrée', 'annulée': '✖ Annulée' };
const ETAPES = [
  ['stripe', "J'ai créé mon compte Stripe"],
  ['stripe_active', "J'ai activé Stripe (identité + IBAN) et prévenu Etienne"],
  ['produits', "J'ai envoyé tous mes produits (photo, nom, prix)"],
  ['domaine', "J'ai choisi mon nom de domaine (ex. magique-boutique.fr)"],
];

let mdp = '';
try { mdp = sessionStorage.getItem('mdp-espace') || ''; } catch (e) {}
let donnees = null, filtre = 'toutes';

async function api(corps) {
  const r = await fetch('/api/espace', {
    method: corps ? 'POST' : 'GET',
    headers: { 'x-mdp': mdp, 'Content-Type': 'application/json' },
    body: corps ? JSON.stringify(corps) : undefined,
  });
  if (r.status === 401) throw new Error('401');
  if (!r.ok) throw new Error('Erreur ' + r.status);
  return r.json();
}

async function charger() {
  try {
    donnees = await api();
    try { sessionStorage.setItem('mdp-espace', mdp); } catch (e) {}
    $('#connexion').hidden = true; $('#tableau').hidden = false; $('#deco').hidden = false;
    rendre();
  } catch (e) {
    $('#connexion').hidden = false; $('#tableau').hidden = true; $('#deco').hidden = true;
    if (mdp) { $('#erreur').hidden = false; $('#erreur').textContent = e.message === '401' ? 'Mot de passe incorrect.' : 'Connexion impossible, réessayez.'; }
  }
}

function rendre() {
  const { stats, commandes, etapes } = donnees;
  $('#k-ca').textContent = euros(stats.ca);
  $('#k-nb').textContent = stats.nb;
  $('#k-att').textContent = stats.enAttente;
  $('#k-pm').textContent = euros(stats.panierMoyen);
  $('#maj').textContent = 'Mis à jour à ' + new Date().toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });

  const f = ['toutes', ...Object.keys(STATUTS)];
  $('#filtres-statut').innerHTML = f.map(s => {
    const n = s === 'toutes' ? commandes.length : commandes.filter(c => c.statut === s).length;
    return `<button class="chip${s === filtre ? ' on' : ''}" data-filtre="${s}">${s === 'toutes' ? 'Toutes' : STATUTS[s]} <small>${n}</small></button>`;
  }).join('');

  const liste = commandes.filter(c => filtre === 'toutes' || c.statut === filtre);
  $('#liste-commandes').innerHTML = liste.length ? liste.map(c => `
    <article class="commande st-${c.statut.normalize('NFD').replace(/[̀-ͯ]/g, '')}">
      <div class="cmd-tete">
        <div><b>${echap(c.nom)}</b><span class="doux">${new Date(c.date).toLocaleString('fr-FR', { dateStyle: 'medium', timeStyle: 'short' })}</span></div>
        <strong class="prix">${euros(c.total)}</strong>
      </div>
      <pre class="cmd-panier">${echap(c.panier)}</pre>
      <div class="cmd-contact">
        <a href="tel:${echap(c.telephone)}">📞 ${echap(c.telephone)}</a>
        <a href="mailto:${echap(c.email)}">✉️ ${echap(c.email)}</a>
        <span>📍 ${echap(c.adresse).replace(/\n/g, ', ')}</span>
        ${c.message ? `<span>💬 ${echap(c.message)}</span>` : ''}
      </div>
      <label class="cmd-statut">Statut
        <select data-cmd="${echap(c.id)}">${Object.entries(STATUTS).map(([k, v]) => `<option value="${k}"${k === c.statut ? ' selected' : ''}>${v}</option>`).join('')}</select>
      </label>
      ${c.statut === 'annulée' ? `<button class="lien suppr" data-suppr="${echap(c.id)}">🗑 Supprimer définitivement</button>` : ''}
    </article>`).join('')
    : `<div class="vide-bloc"><div>🛍️</div><p>${commandes.length ? 'Aucune commande avec ce statut.' : 'Pas encore de commande. Elles apparaîtront ici dès qu\'un client valide son panier.'}</p></div>`;

  $('#etapes').innerHTML = ETAPES.map(([k, t]) => `
    <li><label><input type="checkbox" data-etape="${k}"${etapes[k] ? ' checked' : ''}><span>${t}</span></label></li>`).join('');

  $('#mes-produits').innerHTML = PRODUITS.map(p => `
    <li><img src="/img/${p.imgs[0]}.webp" alt=""><span>${echap(p.nom)}</span><b>${euros(p.prix)}</b></li>`).join('');
}

document.addEventListener('click', e => {
  const b = e.target.closest('[data-filtre]');
  if (b) { filtre = b.dataset.filtre; rendre(); }
  const d = e.target.closest('[data-suppr]');
  if (d && confirm('Supprimer définitivement cette commande annulée ?')) {
    api({ action: 'supprimer', id: d.dataset.suppr }).then(charger).catch(() => alert('Suppression impossible.'));
  }
});
document.addEventListener('change', async e => {
  const s = e.target.closest('[data-cmd]');
  if (s) {
    s.disabled = true;
    try { await api({ action: 'statut', id: s.dataset.cmd, statut: s.value });
      donnees.commandes.find(c => c.id === s.dataset.cmd).statut = s.value; donnees = await api(); rendre(); }
    catch (err) { alert("Le statut n'a pas pu être enregistré."); s.disabled = false; }
  }
  const c = e.target.closest('[data-etape]');
  if (c) {
    try { const r = await api({ action: 'etape', etape: c.dataset.etape, fait: c.checked }); donnees.etapes = r.etapes; }
    catch (err) { c.checked = !c.checked; alert("Impossible d'enregistrer, réessayez."); }
  }
});
$('#form-connexion').addEventListener('submit', e => { e.preventDefault(); mdp = $('#mdp').value; $('#erreur').hidden = true; charger(); });
$('#rafraichir').onclick = charger;
$('#deco').onclick = () => { mdp = ''; try { sessionStorage.removeItem('mdp-espace'); } catch (e) {} $('#mdp').value = ''; charger(); };
setInterval(() => { if (!$('#tableau').hidden) charger(); }, 60000);
if (mdp) charger();
