// PRODUITS est défini dans catalogue.js (chargé avant)
const LIVRAISON = 4.90, FRANCO = 49;
const euros = n => n.toFixed(2).replace('.', ',') + ' €';
const $ = s => document.querySelector(s);
const img = n => `/img/${n}.webp`;
const lienProduit = id => `/produits/${id}/`;

let panier = [];
try { panier = JSON.parse(localStorage.getItem('panier-magique') || '[]'); } catch (e) { panier = []; }
const sauver = () => { try { localStorage.setItem('panier-magique', JSON.stringify(panier)); } catch (e) {} };

// ---------- Catalogue ----------
let filtre = 'Tout', univers = null;
// univers (héros) : filtre transversal aux rayons, par le nom du produit
const UNIVERS = { kpop: ['KPop Demon Hunters', /k-?pop|huntr/i], stitch: ['Stitch', /stitch/i], spiderman: ['Spider-Man', /spider/i], disney: ['Disney', /disney|minnie|mickey|stitch/i] };
function rayons() {
  const r = ['Tout', ...new Set(PRODUITS.map(p => p.rayon))];
  $('#filtres').innerHTML = (univers ? `<button class="chip on chip-univers" data-univers-off>✦ ${UNIVERS[univers][0]} ✕</button>` : '') +
    r.map(x => `<button class="chip${x === filtre && !univers ? ' on' : ''}" data-rayon="${x}">${x}</button>`).join('');
}
function grille() {
  const liste = PRODUITS.filter(p => (filtre === 'Tout' || p.rayon === filtre) && (!univers || UNIVERS[univers][1].test(p.nom)));
  $('#grille').innerHTML = liste.map(p => `
    <article class="carte" data-id="${p.id}" tabindex="0">
      <div class="carte-img">
        ${p.badge ? `<span class="badge">${p.badge}</span>` : ''}
        <img src="${img(p.imgs[0])}" alt="${p.nom}" loading="lazy" width="600" height="600">
      </div>
      <div class="carte-corps">
        <span class="rayon">${p.rayon}</span>
        <h3><a href="${lienProduit(p.id)}">${p.nom}</a></h3>
        <div class="carte-pied">
          <strong class="prix">${euros(p.prix)}</strong>
          <button class="btn-ajout" data-ajout="${p.id}" aria-label="Ajouter ${p.nom} au panier">+ Panier</button>
        </div>
      </div>
    </article>`).join('');
}
document.addEventListener('click', e => {
  if (e.target.closest('[data-univers-off]')) { univers = null; history.replaceState(null, '', location.pathname + '#boutique'); rayons(); grille(); return; }
  const r = e.target.closest('[data-rayon]');
  if (r) { filtre = r.dataset.rayon; univers = null; rayons(); grille();
    if (r.classList.contains('univ')) $('#boutique').scrollIntoView({ behavior: 'smooth' }); return; }
  const a = e.target.closest('[data-ajout]');
  if (a) { e.stopPropagation(); const p = PRODUITS.find(x => x.id === a.dataset.ajout);
    if (p.tailles || p.couleurs) ouvrirFiche(p.id); else ajouter(p.id); return; }
  const pg = e.target.closest('[data-ajout-page]');
  if (pg) { const zone = document.querySelector('#page-produit');
    const opts = [...zone.querySelectorAll('[data-opt]')].map(s => s.value).join(' · ');
    ajouter(pg.dataset.ajoutPage, opts, Math.max(1, parseInt(zone.querySelector('#page-qte')?.value) || 1)); return; }
  const vg = e.target.closest('[data-vign-page]');
  if (vg) { document.querySelector('#page-grande').src = img(vg.dataset.vignPage);
    document.querySelectorAll('[data-vign-page]').forEach(v => v.classList.toggle('on', v === vg)); return; }
  const c = e.target.closest('.carte');
  if (c && !e.target.closest('a')) location.href = lienProduit(c.dataset.id);
});
document.addEventListener('keydown', e => {
  if (e.key === 'Enter' && e.target.classList?.contains('carte')) location.href = lienProduit(e.target.dataset.id);
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
      <a class="lien-fiche" href="${lienProduit(p.id)}">Voir la fiche complète →</a>
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
// Paiement par carte : actif seulement quand le marchand a branché son compte Stripe dans son espace
let carte = false;
fetch('/api/paiement?etat=1').then(r => r.json()).then(j => {
  carte = !!j.actif;
  if (carte) {
    $('#form-commande button[type=submit]').textContent = 'Payer par carte';
    $('#rassure-form').textContent = '🔒 Paiement sécurisé par Stripe. Vous êtes redirigé vers la page de paiement.';
  }
}).catch(() => {});
const libelleBouton = () => carte ? 'Payer par carte' : 'Valider ma commande';
$('#form-commande').addEventListener('submit', async e => {
  e.preventDefault();
  const f = e.target, btn = f.querySelector('button[type=submit]');
  btn.disabled = true; btn.textContent = carte ? 'Redirection vers le paiement…' : 'Envoi…';
  const ref = (crypto.randomUUID ? crypto.randomUUID() : Date.now().toString(36) + Math.random().toString(36).slice(2)).slice(0, 36);
  f.ref.value = ref; f.mode.value = carte ? 'carte' : 'contact';
  try {
    const r = await fetch('/', { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams(new FormData(f)).toString() });
    if (!r.ok) throw new Error(r.status);
  } catch (err) {
    btn.disabled = false; btn.textContent = libelleBouton();
    alert("L'envoi a échoué. Vérifiez votre connexion et réessayez."); return;
  }
  if (carte) {
    try {
      const r = await fetch('/api/paiement', { method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ref, email: f.email.value, panier }) });
      const j = await r.json();
      if (!j.url) throw new Error(j.erreur);
      panier = []; sauver(); location.href = j.url; return;
    } catch (err) {
      // la commande est enregistrée : le marchand recontactera le client pour le règlement
      panier = []; sauver(); location.href = '/merci.html?paiement=plus-tard'; return;
    }
  }
  panier = []; sauver(); location.href = '/merci.html';
});
if (new URLSearchParams(location.search).get('paiement') === 'annule')
  setTimeout(() => alert("Paiement annulé : votre carte n'a pas été débitée. Votre commande est notée, nous pouvons vous recontacter pour le règlement."), 300);

// ---------- Panneaux ----------
function ouvrir(s) { $(s).classList.add('ouvert'); document.body.classList.add('bloque'); }
function fermer(s) { $(s).classList.remove('ouvert');
  if (!document.querySelector('.ouvert')) document.body.classList.remove('bloque');
  if (s === '#tiroir') { $('#etape-panier').hidden = false; $('#etape-form').hidden = true; } }
document.querySelectorAll('[data-fermer]').forEach(b => b.onclick = () => fermer(b.dataset.fermer));
$('#btn-panier').onclick = () => ouvrir('#tiroir');

if ($('#grille')) { rayons(); grille(); }
rendrePanier();

// ---------- Navigation (refonte) ----------
(function () {
  const corps = document.body, bm = document.querySelector('#btn-menu'), menu = document.querySelector('#menu');
  if (bm && menu) {
    const basculer = (ouvert) => { corps.classList.toggle('menu-ouvert', ouvert); bm.setAttribute('aria-expanded', ouvert); bm.setAttribute('aria-label', ouvert ? 'Fermer le menu' : 'Ouvrir le menu'); };
    bm.addEventListener('click', () => basculer(!corps.classList.contains('menu-ouvert')));
    menu.addEventListener('click', e => { if (e.target.closest('a')) basculer(false); });
    document.addEventListener('keydown', e => { if (e.key === 'Escape') basculer(false); });
  }
  // lien actif
  const ch = location.pathname;
  const actif = ch.startsWith('/blog') ? 'blog' : ch.startsWith('/produits') ? 'boutique' : null;
  if (actif) document.querySelector(`[data-nav="${actif}"]`)?.classList.add('actif');
  // en-tête compact au défilement + barre de lecture des articles
  const ent = document.querySelector('.entete'), barre = document.querySelector('#lecture'), art = document.querySelector('.article-corps');
  const auDefilement = () => {
    ent?.classList.toggle('compact', scrollY > 40);
    if (barre && art) {
      const r = art.getBoundingClientRect(), total = r.height - innerHeight * .6;
      barre.style.width = Math.min(100, Math.max(0, (-r.top + innerHeight * .2) / total * 100)) + '%';
    }
  };
  addEventListener('scroll', auDefilement, { passive: true }); auDefilement();
  // filtre de rayon passé dans l'URL (?rayon=Jouets#boutique) depuis le pied de page ou une page produit
  const r = new URLSearchParams(location.search).get('rayon');
  if (r && document.querySelector('#grille') && PRODUITS.some(p => p.rayon === r)) { filtre = r; rayons(); grille(); }
  const u = new URLSearchParams(location.search).get('univers');
  if (u && UNIVERS[u] && document.querySelector('#grille')) { univers = u; rayons(); grille(); }
  document.querySelector('.pied .haut')?.addEventListener('click', e => { e.preventDefault(); scrollTo({ top: 0, behavior: 'smooth' }); });
})();
// ---------- Héros : vrais prix du catalogue + parallaxe à la souris ----------
(function () {
  document.querySelectorAll('[data-prix-de]').forEach(el => {
    const p = PRODUITS.find(x => x.id === el.dataset.prixDe);
    if (p) el.textContent = euros(p.prix); else el.closest('.h3-carte')?.remove();
  });
  const scene = document.querySelector('#h3-scene');
  if (!scene || matchMedia('(prefers-reduced-motion: reduce)').matches || matchMedia('(hover: none)').matches) return;
  const cartes = [...scene.querySelectorAll('[data-p]')];
  let rx = 0, ry = 0, tx = 0, ty = 0, raf = 0;
  const boucle = () => {
    rx += (tx - rx) * .08; ry += (ty - ry) * .08;
    cartes.forEach(c => c.style.setProperty('--px', (rx * c.dataset.p).toFixed(2) + 'px'));
    cartes.forEach(c => c.style.setProperty('--py', (ry * c.dataset.p).toFixed(2) + 'px'));
    scene.style.setProperty('--rx', (ry * -.25).toFixed(2) + 'deg'); scene.style.setProperty('--ry', (rx * .25).toFixed(2) + 'deg');
    raf = Math.abs(tx - rx) + Math.abs(ty - ry) > .05 ? requestAnimationFrame(boucle) : 0;
  };
  document.querySelector('.hero3').addEventListener('pointermove', e => {
    const b = scene.getBoundingClientRect();
    tx = ((e.clientX - b.left) / b.width - .5) * 16; ty = ((e.clientY - b.top) / b.height - .5) * 16;
    if (!raf) raf = requestAnimationFrame(boucle);
  });
  document.querySelector('.hero3').addEventListener('pointerleave', () => { tx = ty = 0; if (!raf) raf = requestAnimationFrame(boucle); });
})();
