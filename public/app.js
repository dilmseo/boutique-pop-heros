// PRODUITS est défini dans catalogue.js (chargé avant)
const LIVRAISON = 4.90, FRANCO = 49;
const euros = n => n.toFixed(2).replace('.', ',') + ' €';
const $ = s => document.querySelector(s);
const img = n => `img/${n}.webp`;

let panier = [];
try { panier = JSON.parse(localStorage.getItem('panier-magique') || '[]'); } catch (e) { panier = []; }
const sauver = () => { try { localStorage.setItem('panier-magique', JSON.stringify(panier)); } catch (e) {} };

// ---------- Catalogue ----------
let filtre = 'Tout';
function rayons() {
  const r = ['Tout', ...new Set(PRODUITS.map(p => p.rayon))];
  $('#filtres').innerHTML = r.map(x => `<button class="chip${x === filtre ? ' on' : ''}" data-rayon="${x}">${x}</button>`).join('');
}
function grille() {
  const liste = PRODUITS.filter(p => filtre === 'Tout' || p.rayon === filtre);
  $('#grille').innerHTML = liste.map(p => `
    <article class="carte" data-id="${p.id}" tabindex="0">
      <div class="carte-img">
        ${p.badge ? `<span class="badge">${p.badge}</span>` : ''}
        <img src="${img(p.imgs[0])}" alt="${p.nom}" loading="lazy" width="600" height="600">
      </div>
      <div class="carte-corps">
        <span class="rayon">${p.rayon}</span>
        <h3>${p.nom}</h3>
        <div class="carte-pied">
          <strong class="prix">${euros(p.prix)}</strong>
          <button class="btn-ajout" data-ajout="${p.id}" aria-label="Ajouter ${p.nom} au panier">+ Panier</button>
        </div>
      </div>
    </article>`).join('');
}
document.addEventListener('click', e => {
  const r = e.target.closest('[data-rayon]');
  if (r) { filtre = r.dataset.rayon; rayons(); grille();
    if (r.classList.contains('univ')) $('#boutique').scrollIntoView({ behavior: 'smooth' }); return; }
  const a = e.target.closest('[data-ajout]');
  if (a) { e.stopPropagation(); const p = PRODUITS.find(x => x.id === a.dataset.ajout);
    if (p.tailles || p.couleurs) ouvrirFiche(p.id); else ajouter(p.id); return; }
  const c = e.target.closest('.carte');
  if (c) ouvrirFiche(c.dataset.id);
});
document.addEventListener('keydown', e => {
  if (e.key === 'Enter' && e.target.classList?.contains('carte')) ouvrirFiche(e.target.dataset.id);
  if (e.key === 'Escape') { fermer('#fiche'); fermer('#tiroir'); }
});

// ---------- Fiche produit ----------
function ouvrirFiche(id) {
  const p = PRODUITS.find(x => x.id === id);
  const choix = (nom, vals) => vals ? `<label class="choix">${nom}<select data-opt="${nom}">${vals.map(v => `<option>${v}</option>`).join('')}</select></label>` : '';
  $('#fiche-contenu').innerHTML = `
    <div class="fiche-galerie">
      <img id="fiche-grande" src="${img(p.imgs[0])}" alt="${p.nom}">
      ${p.imgs.length > 1 ? `<div class="vignettes">${p.imgs.map((m, i) => `<button class="vign${i ? '' : ' on'}" data-vign="${m}"><img src="${img(m)}" alt=""></button>`).join('')}</div>` : ''}
    </div>
    <div class="fiche-infos">
      <span class="rayon">${p.rayon}${p.age ? ' · ' + p.age : ''}</span>
      <h2>${p.nom}</h2>
      <strong class="prix grand">${euros(p.prix)}</strong>
      <p>${p.desc}</p>
      <ul class="points">${p.points.map(x => `<li>${x}</li>`).join('')}</ul>
      <div class="options">${choix('Taille', p.tailles)}${choix('Coloris', p.couleurs)}
        <label class="choix">Quantité<input type="number" id="fiche-qte" min="1" max="20" value="1"></label></div>
      <button class="btn btn-plein" id="fiche-ajout">Ajouter au panier</button>
      <p class="rassure">🚚 Livraison offerte dès ${FRANCO} € · Retour sous 14 jours</p>
    </div>`;
  $('#fiche-contenu').querySelectorAll('[data-vign]').forEach(b => b.onclick = () => {
    $('#fiche-grande').src = img(b.dataset.vign);
    $('#fiche-contenu').querySelectorAll('.vign').forEach(v => v.classList.toggle('on', v === b));
  });
  $('#fiche-ajout').onclick = () => {
    const opts = [...$('#fiche-contenu').querySelectorAll('[data-opt]')].map(s => s.value).join(' · ');
    ajouter(p.id, opts, Math.max(1, parseInt($('#fiche-qte').value) || 1));
    fermer('#fiche');
  };
  ouvrir('#fiche');
}

// ---------- Panier ----------
function ajouter(id, opts = '', qte = 1) {
  const l = panier.find(x => x.id === id && x.opts === opts);
  if (l) l.qte += qte; else panier.push({ id, opts, qte });
  sauver(); rendrePanier(); ouvrir('#tiroir');
}
function totaux() {
  const st = panier.reduce((s, l) => s + PRODUITS.find(p => p.id === l.id).prix * l.qte, 0);
  const liv = st === 0 || st >= FRANCO ? 0 : LIVRAISON;
  return { st, liv, total: st + liv };
}
function rendrePanier() {
  const n = panier.reduce((s, l) => s + l.qte, 0);
  $('#compteur').textContent = n; $('#compteur').hidden = n === 0;
  const { st, liv, total } = totaux();
  $('#lignes').innerHTML = panier.length ? panier.map((l, i) => {
    const p = PRODUITS.find(x => x.id === l.id);
    return `<div class="ligne"><img src="${img(p.imgs[0])}" alt="">
      <div><b>${p.nom}</b>${l.opts ? `<small>${l.opts}</small>` : ''}
        <div class="qte"><button data-q="${i}" data-d="-1" aria-label="Moins">−</button><span>${l.qte}</span><button data-q="${i}" data-d="1" aria-label="Plus">+</button></div></div>
      <strong>${euros(p.prix * l.qte)}</strong></div>`;
  }).join('') : '<p class="vide">Votre panier est vide.</p>';
  $('#recap').innerHTML = panier.length ? `
    <div><span>Sous-total</span><span>${euros(st)}</span></div>
    <div><span>Livraison</span><span>${liv ? euros(liv) : 'Offerte'}</span></div>
    ${liv ? `<p class="franco">Plus que ${euros(FRANCO - st)} pour la livraison offerte</p>` : ''}
    <div class="total"><span>Total</span><span>${euros(total)}</span></div>` : '';
  $('#commander').hidden = !panier.length;
}
$('#lignes').addEventListener('click', e => {
  const b = e.target.closest('[data-q]'); if (!b) return;
  const l = panier[+b.dataset.q]; l.qte += +b.dataset.d;
  if (l.qte < 1) panier.splice(+b.dataset.q, 1);
  sauver(); rendrePanier();
});

// ---------- Commande (formulaire Netlify) ----------
$('#commander').onclick = () => {
  const { total } = totaux();
  $('#champ-panier').value = panier.map(l => {
    const p = PRODUITS.find(x => x.id === l.id);
    return `${l.qte} × ${p.nom}${l.opts ? ' (' + l.opts + ')' : ''} — ${euros(p.prix * l.qte)}`;
  }).join('\n');
  $('#champ-total').value = euros(total);
  $('#total-form').textContent = euros(total);
  $('#etape-panier').hidden = true; $('#etape-form').hidden = false;
};
$('#retour').onclick = () => { $('#etape-panier').hidden = false; $('#etape-form').hidden = true; };
$('#form-commande').addEventListener('submit', async e => {
  e.preventDefault();
  const f = e.target, btn = f.querySelector('button[type=submit]');
  btn.disabled = true; btn.textContent = 'Envoi…';
  try {
    const r = await fetch('/', { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams(new FormData(f)).toString() });
    if (!r.ok) throw new Error(r.status);
    panier = []; sauver(); location.href = '/merci.html';
  } catch (err) {
    btn.disabled = false; btn.textContent = 'Valider ma commande';
    alert("L'envoi a échoué. Vérifiez votre connexion et réessayez.");
  }
});

// ---------- Panneaux ----------
function ouvrir(s) { $(s).classList.add('ouvert'); document.body.classList.add('bloque'); }
function fermer(s) { $(s).classList.remove('ouvert');
  if (!document.querySelector('.ouvert')) document.body.classList.remove('bloque');
  if (s === '#tiroir') { $('#etape-panier').hidden = false; $('#etape-form').hidden = true; } }
document.querySelectorAll('[data-fermer]').forEach(b => b.onclick = () => fermer(b.dataset.fermer));
$('#btn-panier').onclick = () => ouvrir('#tiroir');

rayons(); grille(); rendrePanier();
