const $ = s => document.querySelector(s);
const euros = n => (n || 0).toFixed(2).replace('.', ',') + ' €';
const echap = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const STATUTS = { 'nouvelle': '🆕 Nouvelle', 'confirmée': '✅ Confirmée', 'expédiée': '📦 Expédiée', 'livrée': '🏠 Livrée', 'annulée': '✖ Annulée' };
const ETAPES = [
  ['stripe', "J'ai créé mon compte Stripe"],
  ['stripe_active', "J'ai branché Stripe sur la boutique (clé collée ci-dessous)"],
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
        <div class="cmd-droite"><strong class="prix">${euros(c.total)}</strong>${badgePaiement(c)}</div>
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

  rendreStripe(donnees.stripe || {});
  $('#mes-produits').innerHTML = PRODUITS.map(p => `
    <li><img src="/img/${p.imgs[0]}.webp" alt=""><span>${echap(p.nom)}</span><b>${euros(p.prix)}</b></li>`).join('');
}

function badgePaiement(c) {
  const p = c.paiement;
  if (p?.statut === 'payée') return `<span class="pay pay-ok">💳 Payée ${euros(p.montant)}</span>`;
  if (p?.statut === 'en attente') return '<span class="pay pay-att">⏳ Paiement en cours</span>';
  if (p?.statut === 'expirée') return '<span class="pay pay-ko">✖ Paiement abandonné</span>';
  return '<span class="pay">Règlement à convenir</span>';
}
function rendreStripe(s) {
  $('#bloc-stripe').innerHTML = s.actif ? `
    <div class="stripe-ok"><b>✅ Paiement par carte activé</b>
      <p>Vos clients paient par carte sur la boutique ; l'argent arrive sur votre compte Stripe, puis sur votre compte bancaire.
      ${s.mode === 'test' ? '<br><b>⚠️ Clé de TEST : aucun vrai paiement n\'est encaissé.</b>' : ''}</p>
      <p class="mini">Clé se terminant par …${echap(s.fin)} · branchée le ${new Date(s.date).toLocaleDateString('fr-FR')}</p>
      <a class="btn btn-contour large" href="https://dashboard.stripe.com/payments" target="_blank" rel="noopener">Voir mes paiements sur Stripe ↗</a>
      <button class="lien suppr" id="stripe-retirer">Débrancher Stripe</button></div>` : `
    <p class="doux">Pour que vos clients paient par carte directement sur la boutique (l'argent arrive sur votre compte bancaire). Inscription gratuite, Stripe prend une petite commission par vente.</p>
    <ol class="pas">
      <li><b>Créez votre compte</b> sur <a href="https://dashboard.stripe.com/register" target="_blank" rel="noopener">stripe.com</a> et activez-le (pièce d'identité + IBAN).</li>
      <li>Dans Stripe, ouvrez <a href="https://dashboard.stripe.com/apikeys/create" target="_blank" rel="noopener"><b>Développeurs → Clés API → Créer une clé restreinte</b></a>.</li>
      <li>Nommez-la « Magique Boutique », et à la ligne <b>Checkout Sessions</b> choisissez <b>Écriture</b>. Laissez le reste sur « Aucune », puis « Créer la clé ».</li>
      <li>Copiez la clé (elle commence par <code>rk_live_</code>) et collez-la ici :</li>
    </ol>
    <form id="form-stripe" class="form-stripe">
      <input id="cle-stripe" placeholder="rk_live_…" autocomplete="off" spellcheck="false" required>
      <button class="btn btn-plein large" type="submit">Brancher Stripe</button>
      <p class="erreur" id="stripe-erreur" hidden></p>
    </form>
    <p class="mini">🔒 La clé est vérifiée auprès de Stripe puis enregistrée chiffrée. Ne l'envoyez jamais par mail.</p>`;
}

document.addEventListener('submit', async e => {
  if (e.target.id !== 'form-stripe') return;
  e.preventDefault();
  const btn = e.target.querySelector('button'), err = $('#stripe-erreur');
  btn.disabled = true; btn.textContent = 'Vérification…'; err.hidden = true;
  try {
    const r = await fetch('/api/espace', { method: 'POST', headers: { 'x-mdp': mdp, 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'stripe', cle: $('#cle-stripe').value }) });
    const j = await r.json();
    if (!r.ok) throw new Error(j.erreur || 'Erreur');
    donnees = await api(); rendre();
    $('#stripe').scrollIntoView({ behavior: 'smooth' });
  } catch (x) { err.textContent = x.message; err.hidden = false; btn.disabled = false; btn.textContent = 'Brancher Stripe'; }
});

document.addEventListener('click', e => {
  if (e.target.id === 'stripe-retirer' && confirm('Débrancher Stripe ? Vos clients ne pourront plus payer par carte.')) {
    api({ action: 'stripe_retirer' }).then(charger).catch(() => alert('Impossible, réessayez.')); return;
  }
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
