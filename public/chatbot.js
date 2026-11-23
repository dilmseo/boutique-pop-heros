// Étoile — l'assistante de la Magique Boutique.
// Elle connaît tout le catalogue (catalogue.js) et répond dans le navigateur : aucune IA payante, aucune donnée envoyée.
// Chargée en defer depuis l'en-tête (copiée sur toutes les pages par generer.mjs).
(function () {
  if (typeof PRODUITS === 'undefined' || document.querySelector('.eb-lanceur')) return;
  const FRANCO_ = typeof FRANCO !== 'undefined' ? FRANCO : 49, LIV_ = typeof LIVRAISON !== 'undefined' ? LIVRAISON : 4.9;
  const eur = n => n.toFixed(2).replace('.', ',') + ' €';
  const esc = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const norm = s => String(s).toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[’']/g, ' ');
  const reduit = matchMedia('(prefers-reduced-motion: reduce)').matches;

  // ---------- Connaissance ----------
  // familles de mots : ce que le visiteur tape → ce qu'on cherche dans les fiches
  const FAMILLES = [
    [/^(chien|chiens|chiot|toutou|canin)/, ['chien']],
    [/^(chat|chats|chaton|felin)/, ['chat']],
    [/^(animal|animaux|compagnon)/, ['chien', 'chat']],
    [/^(bebe|bebes|naissance|nourrisson|naiss)/, ['bebe']],
    [/^(pokemon|pikachu|evoli|bulbizarre|dracaufeu|mewtwo|sinnoh|dresseur)/, ['pokemon', 'pikachu']],
    [/^(kpop|k-pop|huntrix|huntr|demon|hunters|rumi|mira|zoey|derpy)/, ['kpop', 'k-pop', 'huntr', 'demon hunters']],
    [/^(stitch|angel|lilo)/, ['stitch']],
    [/^(minnie)/, ['minnie']], [/^(mickey)/, ['mickey']],
    [/^(disney)/, ['disney']], [/^(marvel|captain|avengers)/, ['marvel', 'captain']],
    [/^(spider|spiderman|araignee)/, ['spider']],
    [/^(super|superheros|heros)$/, ['spider', 'captain', 'marvel']],
    [/^(princesse|sirene|ariel)/, ['ariel', 'princess']],
    [/^(toy|buzz|woody)/, ['buzz', 'toy story']], [/^(cars|flash|mcqueen|voiture)/, ['cars']],
    [/^(haribo|bonbon)/, ['haribo']],
    [/^(noel|sapin|fetes)/, ['noel']],
    [/^(jeu|jeux|societe|famille)$/, ['jeu', 'jeux', 'puzzle', 'dobble']],
    [/^(puzzle|puzzles)/, ['puzzle']], [/^(carte|cartes|deck)/, ['cartes', 'deck']],
    [/^(jouet|jouets|joujou)/, ['jouet', 'jouets']],
    [/^(deco|decoration|chambre|dodo)/, ['deco', 'chambre', 'veilleuse', 'coussin', 'lampe']],
    [/^(lampe|veilleuse|lumiere|lumineu|led|nuit)/, ['lumineu', 'lampe', 'led', 'veilleuse']],
    [/^(vetement|vetements|habit|habits|tenue|fringue)/, ['vetements']],
    [/^(hiver|froid|chaud)/, ['chaud', 'hiver', 'polaire', 'bonnet', 'sweat']],
    [/^(tshirt|tee|t-shirt)/, ['t-shirt']], [/^(sweat|pull|capuche)/, ['sweat', 'capuche']],
    [/^(deguisement|costume|carnaval|halloween)/, ['deguisement']],
    [/^(ecole|rentree|cartable|maternelle)/, ['ecole', 'sac', 'carnet']],
    [/^(musique|guitare|chanter)/, ['guitare']], [/^(plage|piscine|bain)/, ['plage', 'bain', 'serviette']],
    [/^(mug|tasse|chocolat)/, ['mug']], [/^(bougie|parfum)/, ['bougie']],
    [/^(promenade|balade|laisse|harnais|collier)/, ['laisse', 'harnais', 'collier']],
    [/^(macher|mordiller|dent|dents)/, ['macher', 'picots']],
  ];
  const VIDES = new Set('je j tu il on nous vous un une des de du la le les l a au aux et ou en pour avec sans sur dans par est c ce cet cette ces mon ma mes ton ta son sa ses qui que quoi quel quelle quels quelles vous avez avez-vous auriez y a il-y-a cherche cherchais voudrais veux voulais trouver acheter offrir besoin idee idees cadeau cadeaux produit produits article articles chose truc quelque bonjour salut svp merci please moi mon ma fils fille enfant enfants garcon petit petite petits grand grande ans an mois age euros euro eur prix max maximum budget moins plus entre et environ combien coute fait faites montre montrez voir afficher tout tous toutes avoir aime adore fan fans genre style type modele modeles boutique magique site bien beau belle joli jolie super'.split(' '));
  const INDEX = PRODUITS.map(p => ({
    p, nom: norm(p.nom), rayon: norm(p.rayon),
    tout: norm([p.nom, p.rayon, p.desc, (p.points || []).join(' '), p.badge || '', (p.tailles || []).join(' ')].join(' ')),
    ageMin: p.age ? (/(\d+)\s*mois/.test(p.age) ? 0 : +(p.age.match(/\d+/) || [0])[0]) : null,
  }));
  const estBebe = x => x.rayon === 'bebe' || /bebe/.test(x.nom) || (x.p.tailles || []).some(t => /mois/.test(t));
  const estAnimal = x => x.rayon === 'animaux';

  function comprendre(texte) {
    const t = norm(texte);
    const q = { brut: t, mots: [], prixMax: null, prixMin: null, age: null, bebe: false, tri: null };
    // budget
    let m = t.match(/entre\s*(\d+)\s*(?:€|e|euros?)?\s*et\s*(\d+)/);
    if (m) { q.prixMin = +m[1]; q.prixMax = +m[2]; }
    m = t.match(/(?:moins de|max(?:imum)?|budget|sous|pas plus de|jusqu a|<)\s*(\d+)/) || t.match(/(\d+)\s*(?:€|e\b|euros?)\s*(?:max|maximum)?/);
    if (m && q.prixMax == null) q.prixMax = +m[1];
    if (/pas cher|petit prix|petits prix|economique|bon marche/.test(t)) q.tri = 'asc', q.prixMax = q.prixMax || 12;
    if (/moins cher|le moins|prix croissant/.test(t)) q.tri = 'asc';
    if (/plus cher|haut de gamme|prix decroissant/.test(t)) q.tri = 'desc';
    // âge
    m = t.match(/(\d+)\s*(ans?|mois)\b/);
    if (m && !/(\d+)\s*(?:€|euros?)/.test(m[0])) { if (m[2].startsWith('mois')) q.bebe = true; else q.age = +m[1]; }
    if (/\bbebe|naissance|nourrisson|tout petit/.test(t)) q.bebe = true;
    // mots utiles, élargis par familles
    const brut = t.replace(/\d+\s*(ans?|mois|€|euros?)/g, ' ').split(/[^a-z0-9-]+/).filter(w => w.length > 2 && !VIDES.has(w) && !/^\d+$/.test(w));
    brut.forEach(w => {
      const f = FAMILLES.find(([re]) => re.test(w));
      q.mots.push(f ? { w, alt: f[1] } : { w, alt: [w.replace(/(s|x)$/, '')] });
    });
    return q;
  }

  function chercher(q) {
    let res = INDEX.map(x => {
      let s = 0, ok = 0;
      q.mots.forEach(({ alt }) => {
        let best = 0;
        alt.forEach(a => {
          if (x.nom.includes(a)) best = Math.max(best, 4);
          else if (x.rayon.includes(a)) best = Math.max(best, 3);
          else if (x.tout.includes(a)) best = Math.max(best, 1.5);
        });
        if (best) ok++; s += best;
      });
      return { x, s, ok };
    });
    const avecMots = q.mots.length > 0;
    if (avecMots) {
      // tous les mots reconnus doivent compter ; sinon, au moins un
      const maxOk = Math.max(...res.map(r => r.ok));
      res = res.filter(r => r.ok > 0 && r.ok >= Math.min(maxOk, q.mots.length));
    }
    const veutAnimal = q.mots.some(m => m.alt.includes('chien') || m.alt.includes('chat'));
    res = res.filter(({ x }) => {
      const pr = x.p.prix;
      if (q.prixMax != null && pr > q.prixMax) return false;
      if (q.prixMin != null && pr < q.prixMin) return false;
      if (!veutAnimal && !avecMots && estAnimal(x)) return false;
      if (q.bebe && !estBebe(x) && !(x.ageMin === 0)) return false;
      if (q.age != null) {
        if (estAnimal(x) && !veutAnimal) return false;
        if (q.age >= 3 && estBebe(x) && !(x.p.tailles || []).some(t => /ans/.test(t))) return false;
        if (x.ageMin != null && x.ageMin > q.age) return false;
        if (/1000 pieces/.test(x.nom) && q.age < 10) return false;
        if (/bougie/.test(x.nom)) return false;
        if (x.p.tailles && x.p.tailles.some(t => /ans/.test(t))) {
          const ok = x.p.tailles.some(t => { const n = t.match(/\d+/g).map(Number); return n.length > 1 ? q.age >= n[0] - 1 && q.age <= n[1] + 1 : Math.abs(n[0] - q.age) <= 1; });
          if (!ok) return false;
        }
      }
      return true;
    });
    if (q.tri === 'asc') res.sort((a, b) => a.x.p.prix - b.x.p.prix);
    else if (q.tri === 'desc') res.sort((a, b) => b.x.p.prix - a.x.p.prix);
    else res.sort((a, b) => b.s - a.s || (b.x.p.badge ? 1 : 0) - (a.x.p.badge ? 1 : 0));
    return res.map(r => r.x.p);
  }

  // ---------- Réponses ----------
  const RAYONS = [...new Set(PRODUITS.map(p => p.rayon))];
  const vedettes = () => PRODUITS.filter(p => /coeur|cœur|noel|noël/i.test(p.badge || '')).concat(PRODUITS.filter(p => p.badge === 'Nouveau')).slice(0, 6);
  const panierInfo = () => {
    try {
      const pan = (typeof panier !== 'undefined' ? panier : JSON.parse(localStorage.getItem('panier-magique') || '[]'));
      const n = pan.reduce((s, l) => s + l.qte, 0);
      const st = pan.reduce((s, l) => s + (PRODUITS.find(p => p.id === l.id)?.prix || 0) * l.qte, 0);
      return { n, st };
    } catch (e) { return { n: 0, st: 0 }; }
  };
  const PUCES_BASE = ['🎁 Idée cadeau', '🎄 Spécial Noël', '🐶 Pour mon chien', '💸 Moins de 15 €', '🚚 Livraison'];

  const FAQ = [
    [/livr|expedi|envoi|frais de port|port\b|colis|recevoir|delai|quand/, () => {
      const { st } = panierInfo();
      return { txt: `🚚 La livraison coûte <b>${eur(LIV_)}</b> en France métropolitaine. Elle est <b>offerte dès ${FRANCO_} €</b> d'achat.` +
        (st > 0 && st < FRANCO_ ? `<br>Il vous manque <b>${eur(FRANCO_ - st)}</b> dans votre panier pour l'avoir gratuitement ✨` : '') +
        `<br>Après la commande, nous vous recontactons pour confirmer l'envoi et le délai.`, puces: ['💸 Moins de 15 €', '🎁 Idée cadeau'] };
    }],
    [/retour|rembours|rétract|retract|echange|changer d avis|annul/, () => ({
      txt: `↩️ Vous avez <b>14 jours</b> après la réception pour changer d'avis (droit de rétractation). Le détail se trouve dans nos <a href="/cgv/">conditions générales de vente</a>.`, puces: ['🚚 Livraison', '🔒 Paiement'] })],
    [/paie|payer|paiement|carte bancaire|\bcb\b|paypal|stripe|securis|regl/, () => ({
      txt: `🔒 Vous remplissez votre panier puis le petit formulaire de commande. Selon le cas, vous payez par carte sur une page sécurisée Stripe, ou nous vous recontactons pour confirmer et régler en toute sécurité.`, puces: ['🛒 Mon panier', '🚚 Livraison'] })],
    [/licence|officiel|contrefa|vrai|authentique|original/, () => ({
      txt: `⭐ Nos produits sont des <b>produits officiels</b> : Disney, Marvel, Pokémon, Haribo, KPop Demon Hunters… La mention « Produit sous licence officielle » figure sur la fiche concernée.`, puces: PUCES_BASE.slice(0, 3) })],
    [/contact|joindre|telephone|mail|parler a|humain|vendeur|conseiller/, () => ({
      txt: `💌 Une question que je ne sais pas régler ? Passez une commande ou laissez vos coordonnées dans le formulaire du panier : la boutique vous recontacte directement.`, puces: ['🛒 Mon panier'] })],
    [/panier|commande|ma commande/, () => {
      const { n, st } = panierInfo();
      if (!n) return { txt: `🛒 Votre panier est vide pour l'instant. On lui trouve un trésor ?`, puces: PUCES_BASE.slice(0, 4) };
      return { txt: `🛒 Votre panier contient <b>${n} article${n > 1 ? 's' : ''}</b> pour <b>${eur(st)}</b>.` + (st < FRANCO_ ? ` Encore ${eur(FRANCO_ - st)} et la livraison est offerte !` : ' La livraison est offerte 🎉'),
        action: { lib: 'Ouvrir mon panier', f: () => document.querySelector('#btn-panier')?.click() }, puces: st < FRANCO_ ? ['💸 Moins de 15 €'] : [] };
    }],
    [/^(salut|bonjour|bonsoir|coucou|hello|hey|yo)\b/, () => ({ txt: `Bonjour ✨ Dites-moi pour qui vous cherchez, son âge, son héros préféré ou votre budget : je fouille la boutique pour vous.`, puces: PUCES_BASE })],
    [/^(merci|super|genial|parfait|top|cool|ok|d accord)( beaucoup| bien)?\s*[!.]*$/, () => ({ txt: `Avec plaisir ! 🌟 Je reste là si vous avez une autre question.`, puces: ['🎁 Idée cadeau', '🛒 Mon panier'] })],
    [/rayon|categorie|que vendez|vous vendez|catalogue|tout voir|quoi comme/, () => ({
      txt: `La boutique compte <b>${PRODUITS.length} produits</b> rangés en ${RAYONS.length} rayons. Lequel vous fait envie ?`, puces: RAYONS.map(r => '› ' + r) })],
  ];

  // Contexte : un « moins de 15 € » qui suit « Pokémon » s'applique aux Pokémon.
  let dernier = null, dernierProduit = null;

  function repondre(texte) {
    const t = norm(texte).trim();
    if (t.startsWith('› ')) {
      const r = RAYONS.find(x => norm(x) === t.slice(2));
      if (r) { const l = PRODUITS.filter(p => p.rayon === r); dernier = { mots: [{ w: norm(r), alt: [norm(r)] }] }; return { txt: `Voici le rayon <b>${esc(r)}</b> (${l.length} produit${l.length > 1 ? 's' : ''}) :`, produits: l }; }
    }
    if (/idee cadeau|^🎁/.test(t) || t === 'idee cadeau') return { txt: `Avec plaisir ! 🎁 C'est pour qui ?`, puces: ['👶 Un bébé', '🧒 3 à 5 ans', '🧑 6 à 9 ans', '🧑‍🎤 10 ans et plus', '🐶 Un chien', '🐱 Un chat'] };
    if (/^(🧒 )?3 a 5 ans/.test(t)) texte = 'cadeau 4 ans';
    if (/^(🧑 )?6 a 9 ans/.test(t)) texte = 'cadeau 7 ans';
    if (/10 ans et plus/.test(t)) texte = 'cadeau 10 ans';
    if (/^(👶 )?un bebe/.test(t)) texte = 'bébé';
    // question sur la taille / les coloris / l'âge d'un produit déjà montré
    const pr = trouverProduitNomme(t) || (/(taille|coloris|couleur|age|piles?|lavable|dimension|matiere)/.test(t) ? dernierProduit : null);
    if (pr && /(taille|coloris|couleur|age|ans|piles?|lavable|dimension|matiere|comment|detail|info|plus)/.test(t)) return detail(pr);
    for (const [re, f] of FAQ) if (re.test(t)) return f();

    let q = comprendre(texte);
    const seulementFiltre = !q.mots.length && (q.prixMax != null || q.tri);
    if (seulementFiltre && dernier) q = { ...dernier, prixMax: q.prixMax ?? dernier.prixMax, prixMin: q.prixMin ?? dernier.prixMin, tri: q.tri || dernier.tri || 'asc' };
    const res = chercher(q);
    if (!q.mots.length && q.prixMax == null && q.age == null && !q.bebe && !q.tri)
      return { txt: `Je n'ai pas bien saisi 🙈 Essayez par exemple « un cadeau pour 6 ans », « Stitch pour chien » ou « Pokémon à moins de 20 € ».`, puces: PUCES_BASE };
    dernier = q;
    if (!res.length) {
      const sansPrix = q.prixMax != null ? chercher({ ...q, prixMax: null, prixMin: null }) : [];
      if (sansPrix.length) return { txt: `Rien à moins de ${eur(q.prixMax)} pour cette recherche, mais voici les plus proches de votre budget :`, produits: sansPrix.sort((a, b) => a.prix - b.prix).slice(0, 4) };
      return { txt: `Je n'ai rien trouvé pour « ${esc(texte)} » 😕 Voici nos coups de cœur du moment :`, produits: vedettes(), puces: PUCES_BASE.slice(0, 4) };
    }
    if (res.length === 1) dernierProduit = res[0];
    const resume = [q.age != null ? `${q.age} ans` : '', q.bebe ? 'bébé' : '', q.prixMax != null ? `moins de ${eur(q.prixMax)}` : ''].filter(Boolean).join(', ');
    const intro = res.length === 1 ? `J'ai exactement ce qu'il vous faut ✨` : `J'ai trouvé <b>${res.length} produits</b>${resume ? ' (' + resume + ')' : ''} :`;
    const puces = [];
    if (q.prixMax == null && res.length > 3) puces.push('💸 Moins de 15 €', '↕️ Du moins cher au plus cher');
    if (res.length === 1) puces.push('ℹ️ Plus de détails');
    puces.push('🎁 Idée cadeau');
    return { txt: intro, produits: res.slice(0, 8), puces };
  }
  function trouverProduitNomme(t) {
    // un produit est « nommé » si un mot distinctif de son nom apparaît (guitare, dobble, horloge…)
    const mots = t.split(/[^a-z0-9]+/).filter(w => w.length > 3 && !VIDES.has(w));
    let best = null, bs = 0;
    INDEX.forEach(x => {
      const s = mots.filter(w => x.nom.split(/[^a-z0-9]+/).some(n => n.length > 3 && (n === w || n === w.replace(/s$/, '')))).length;
      if (s > bs) { bs = s; best = x.p; }
    });
    const uniques = best && INDEX.filter(x => mots.some(w => x.nom.includes(w))).length;
    return bs && uniques === 1 ? best : null;
  }
  function detail(p) {
    dernierProduit = p;
    const l = [];
    if (p.age) l.push(`👧 <b>Âge</b> : ${esc(p.age)}`);
    if (p.tailles) l.push(`📏 <b>Tailles</b> : ${p.tailles.map(esc).join(', ')}`);
    if (p.couleurs) l.push(`🎨 <b>Modèles</b> : ${p.couleurs.map(esc).join(', ')}`);
    (p.points || []).forEach(x => l.push('✔️ ' + esc(x)));
    return { txt: `<b>${esc(p.nom)}</b> — ${eur(p.prix)}<br>${esc(p.desc)}<ul class="eb-liste">${l.map(x => `<li>${x}</li>`).join('')}</ul>`, produits: [p], puces: ['🚚 Livraison', '↩️ Retours'] };
  }

  // ---------- Interface ----------
  const css = `
  .eb-lanceur{position:fixed;right:max(16px,env(safe-area-inset-right));bottom:max(16px,env(safe-area-inset-bottom));z-index:45;width:64px;height:64px;border-radius:50%;
    background:radial-gradient(circle at 30% 25%,#ff8fd0,#ff3ea5 35%,#8b5cf6 70%,#3fb8ff);box-shadow:0 12px 34px -8px rgba(255,62,165,.8),0 0 0 1px rgba(255,255,255,.25) inset;
    display:grid;place-items:center;cursor:pointer;transition:transform .25s cubic-bezier(.3,1.6,.5,1),box-shadow .25s}
  .eb-lanceur:hover{transform:scale(1.08) rotate(-6deg)}
  .eb-lanceur img{width:46px;height:46px;filter:drop-shadow(0 2px 6px rgba(0,0,0,.35));animation:eb-flotte 3.2s ease-in-out infinite}
  .eb-lanceur::before{content:"";position:absolute;inset:-6px;border-radius:50%;border:2px solid rgba(255,210,63,.55);animation:eb-onde 2.6s ease-out infinite}
  .eb-lanceur .eb-point{position:absolute;top:2px;right:2px;width:16px;height:16px;border-radius:50%;background:#ffd23f;border:3px solid #140b2e;box-shadow:0 0 10px #ffd23f}
  .eb-ouvert .eb-lanceur{transform:scale(.0);pointer-events:none}
  .menu-ouvert .eb-lanceur,.bloque .eb-lanceur{opacity:0;pointer-events:none}
  .eb-invite{position:fixed;right:max(92px,calc(env(safe-area-inset-right) + 92px));bottom:max(26px,env(safe-area-inset-bottom));z-index:45;max-width:230px;
    background:#fff;color:#2a1660;font:700 .92rem/1.35 Nunito,system-ui,sans-serif;padding:12px 34px 12px 15px;border-radius:18px 18px 4px 18px;
    box-shadow:0 14px 40px -10px rgba(0,0,0,.55);opacity:0;translate:10px 0;transition:opacity .35s,translate .35s;pointer-events:none}
  .eb-invite.on{opacity:1;translate:0 0;pointer-events:auto;cursor:pointer}
  .eb-invite b{color:#ff3ea5}.eb-invite button{position:absolute;top:6px;right:8px;color:#9c8fc4;font-size:1.1rem;line-height:1}
  .eb-panneau{position:fixed;right:max(16px,env(safe-area-inset-right));bottom:max(16px,env(safe-area-inset-bottom));z-index:46;width:min(400px,calc(100vw - 32px));height:min(620px,calc(100dvh - 32px));
    display:flex;flex-direction:column;border-radius:26px;overflow:hidden;color:#f6f2ff;font-family:Nunito,system-ui,sans-serif;
    background:linear-gradient(180deg,rgba(36,22,90,.97),rgba(20,11,46,.98));border:1px solid rgba(255,255,255,.14);
    box-shadow:0 30px 80px -20px rgba(0,0,0,.8),0 0 0 1px rgba(139,92,246,.25),0 0 60px -20px rgba(255,62,165,.55);
    transform-origin:100% 100%;transform:scale(.6) translateY(20px);opacity:0;visibility:hidden;transition:transform .35s cubic-bezier(.3,1.4,.5,1),opacity .25s,visibility 0s .35s}
  .eb-ouvert .eb-panneau{transform:none;opacity:1;visibility:visible;transition:transform .35s cubic-bezier(.3,1.4,.5,1),opacity .25s}
  .eb-tete{position:relative;display:flex;align-items:center;gap:12px;padding:16px 16px 14px;background:linear-gradient(120deg,#ff3ea5,#8b5cf6 55%,#3fb8ff);overflow:hidden}
  .eb-tete::after{content:"✦ ✧ ✦ ✧ ✦";position:absolute;right:56px;top:6px;font-size:.7rem;letter-spacing:10px;color:rgba(255,255,255,.55);animation:eb-scintille 3s ease-in-out infinite}
  .eb-avatar{position:relative;width:46px;height:46px;border-radius:50%;background:rgba(255,255,255,.18);display:grid;place-items:center;flex:none;box-shadow:0 0 0 2px rgba(255,255,255,.35)}
  .eb-avatar img{width:36px;height:36px}
  .eb-avatar::after{content:"";position:absolute;right:0;bottom:1px;width:12px;height:12px;border-radius:50%;background:#3ff09a;border:2px solid #8b5cf6}
  .eb-tete h2{font:700 1.15rem/1.1 Fredoka,Nunito,sans-serif;margin:0}
  .eb-tete small{display:block;font-size:.78rem;font-weight:700;opacity:.9;margin-top:3px}
  .eb-fermer{margin-left:auto;width:36px;height:36px;border-radius:50%;background:rgba(20,11,46,.25);color:#fff;font-size:1.3rem;display:grid;place-items:center;flex:none}
  .eb-fermer:hover{background:rgba(20,11,46,.45)}
  .eb-fil{flex:1;overflow-y:auto;overscroll-behavior:contain;padding:18px 14px 8px;display:flex;flex-direction:column;gap:10px;scroll-behavior:smooth;
    background:radial-gradient(600px 300px at 100% 0,rgba(255,62,165,.10),transparent),radial-gradient(500px 300px at 0 100%,rgba(63,184,255,.10),transparent)}
  .eb-fil>*{flex-shrink:0}
  .eb-fil::-webkit-scrollbar{width:6px}.eb-fil::-webkit-scrollbar-thumb{background:rgba(255,255,255,.15);border-radius:3px}
  .eb-msg{max-width:86%;padding:11px 14px;border-radius:18px;font-size:.94rem;line-height:1.45;animation:eb-entre .35s cubic-bezier(.3,1.3,.5,1) both;word-wrap:break-word}
  .eb-msg a{color:#ffd23f;text-decoration:underline}
  .eb-bot{align-self:flex-start;background:rgba(255,255,255,.08);border:1px solid rgba(255,255,255,.1);border-bottom-left-radius:5px}
  .eb-moi{align-self:flex-end;background:linear-gradient(135deg,#ff3ea5,#8b5cf6);border-bottom-right-radius:5px;box-shadow:0 8px 20px -10px #ff3ea5}
  .eb-liste{list-style:none;margin:8px 0 0;padding:0;display:grid;gap:4px;font-size:.88rem;color:#e3dbff}
  .eb-ecrit{display:flex;gap:5px;padding:14px 16px}.eb-ecrit i{width:7px;height:7px;border-radius:50%;background:#c9bdf0;animation:eb-saute 1s infinite}
  .eb-ecrit i:nth-child(2){animation-delay:.15s}.eb-ecrit i:nth-child(3){animation-delay:.3s}
  .eb-cartes{display:flex;gap:10px;overflow-x:auto;padding:2px 2px 8px;margin:0 -14px;padding-left:14px;padding-right:14px;scroll-snap-type:x mandatory;animation:eb-entre .4s .05s both}
  .eb-cartes::-webkit-scrollbar{height:5px}.eb-cartes::-webkit-scrollbar-thumb{background:rgba(255,255,255,.15);border-radius:3px}
  .eb-carte{flex:none;width:156px;scroll-snap-align:start;background:linear-gradient(170deg,#2c1b6b,#1f1247);border:1px solid rgba(255,255,255,.12);border-radius:18px;overflow:hidden;display:flex;flex-direction:column;transition:transform .2s,border-color .2s}
  .eb-carte:hover{transform:translateY(-3px);border-color:rgba(255,62,165,.6)}
  .eb-carte a.eb-img{position:relative;display:block;aspect-ratio:1;background:#fff}
  .eb-carte img{width:100%;height:100%;object-fit:contain}
  .eb-carte .eb-badge{position:absolute;top:7px;left:7px;background:#ff3ea5;color:#fff;font-size:.62rem;font-weight:800;padding:3px 8px;border-radius:999px;text-transform:uppercase;letter-spacing:.04em}
  .eb-carte-c{padding:9px 10px 10px;display:flex;flex-direction:column;gap:6px;flex:1}
  .eb-carte-c a{font-size:.8rem;font-weight:800;line-height:1.25;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden;color:#f6f2ff;text-decoration:none}
  .eb-carte-p{display:flex;align-items:center;justify-content:space-between;margin-top:auto}
  .eb-carte-p b{font:700 1.08rem Fredoka,Nunito,sans-serif;color:#ffd23f}
  .eb-ajout{background:linear-gradient(135deg,#ff3ea5,#8b5cf6);color:#fff;font-size:.74rem;font-weight:800;padding:6px 10px;border-radius:999px;box-shadow:0 6px 14px -6px #ff3ea5}
  .eb-ajout:hover{filter:brightness(1.12)}
  .eb-ajout.fait{background:#3ff09a;color:#140b2e;box-shadow:none}
  .eb-puces{display:flex;flex-wrap:wrap;gap:7px;animation:eb-entre .4s .1s both}
  .eb-puce{border:1px solid rgba(255,255,255,.2);background:rgba(255,255,255,.05);color:#f6f2ff;font-size:.82rem;font-weight:700;padding:7px 12px;border-radius:999px;transition:background .15s,border-color .15s,transform .15s}
  .eb-puce:hover{background:rgba(255,62,165,.18);border-color:#ff3ea5;transform:translateY(-1px)}
  .eb-action{align-self:flex-start;background:#ffd23f;color:#140b2e;font-weight:800;font-size:.86rem;padding:8px 16px;border-radius:999px}
  .eb-saisie{display:flex;gap:8px;padding:12px;border-top:1px solid rgba(255,255,255,.08);background:rgba(10,5,28,.5)}
  .eb-saisie input{flex:1;min-width:0;background:rgba(255,255,255,.07);border:1px solid rgba(255,255,255,.14);border-radius:999px;color:#fff;font:600 16px Nunito,system-ui,sans-serif;padding:11px 16px;outline:none;transition:border-color .2s,box-shadow .2s}
  .eb-saisie input::placeholder{color:#a99bd6}
  .eb-saisie input:focus{border-color:#ff7ac6;box-shadow:0 0 0 3px rgba(255,62,165,.2)}
  .eb-envoi{width:46px;height:46px;flex:none;border-radius:50%;background:linear-gradient(135deg,#ff3ea5,#8b5cf6);display:grid;place-items:center;box-shadow:0 8px 20px -8px #ff3ea5;transition:transform .15s}
  .eb-envoi:hover{transform:scale(1.06)}.eb-envoi svg{width:20px;height:20px;fill:#fff}
  .eb-mention{text-align:center;font-size:.68rem;color:#8f83bb;padding:0 0 8px;background:rgba(10,5,28,.5)}
  @keyframes eb-flotte{50%{transform:translateY(-3px) rotate(6deg)}}
  @keyframes eb-onde{0%{transform:scale(.9);opacity:.9}100%{transform:scale(1.35);opacity:0}}
  @keyframes eb-entre{from{opacity:0;transform:translateY(8px) scale(.97)}}
  @keyframes eb-saute{0%,60%,100%{transform:none;opacity:.5}30%{transform:translateY(-5px);opacity:1}}
  @keyframes eb-scintille{50%{opacity:.25}}
  @media (max-width:560px){
    .eb-panneau{right:0;left:0;bottom:0;width:100%;height:min(88dvh,720px);border-radius:24px 24px 0 0;transform-origin:50% 100%;transform:translateY(100%);opacity:1}
    .eb-invite{max-width:200px}
  }
  @media (prefers-reduced-motion:reduce){.eb-lanceur img,.eb-lanceur::before,.eb-tete::after{animation:none}.eb-msg,.eb-cartes,.eb-puces{animation:none}}`;
  document.head.insertAdjacentHTML('beforeend', `<style id="eb-style">${css}</style>`);

  const racine = document.createElement('div');
  racine.className = 'eb';
  racine.innerHTML = `
    <button class="eb-lanceur" type="button" aria-label="Ouvrir l'assistante Étoile" aria-expanded="false"><img src="/logo-mark.svg" alt="" width="46" height="46"><span class="eb-point" aria-hidden="true"></span></button>
    <div class="eb-invite" role="status"><button type="button" aria-label="Masquer">×</button>Besoin d'une <b>idée cadeau</b> ? Je connais toute la boutique ✨</div>
    <section class="eb-panneau" role="dialog" aria-label="Assistante Étoile" aria-modal="false">
      <header class="eb-tete">
        <span class="eb-avatar"><img src="/logo-mark.svg" alt="" width="36" height="36"></span>
        <div><h2>Étoile</h2><small>La fée de la boutique · connaît les ${PRODUITS.length} produits</small></div>
        <button class="eb-fermer" type="button" aria-label="Fermer">×</button>
      </header>
      <div class="eb-fil" aria-live="polite"></div>
      <form class="eb-saisie"><input type="text" placeholder="Ex. : un cadeau Stitch pour 6 ans" aria-label="Votre question" autocomplete="off" maxlength="200">
        <button class="eb-envoi" type="submit" aria-label="Envoyer"><svg viewBox="0 0 24 24"><path d="M3.4 20.4 21 12 3.4 3.6 3.4 10l12.6 2-12.6 2z"/></svg></button></form>
      <div class="eb-mention">Assistante automatique · vos messages restent sur votre appareil</div>
    </section>`;
  document.body.appendChild(racine);
  const $e = s => racine.querySelector(s);
  const fil = $e('.eb-fil'), champ = $e('.eb-saisie input'), invite = $e('.eb-invite');
  const deroule = () => requestAnimationFrame(() => { fil.scrollTop = fil.scrollHeight; });

  function bulle(html, qui) {
    const d = document.createElement('div'); d.className = 'eb-msg ' + (qui === 'moi' ? 'eb-moi' : 'eb-bot');
    if (qui === 'moi') d.textContent = html; else d.innerHTML = html;
    fil.appendChild(d); deroule(); return d;
  }
  function cartes(liste) {
    const w = document.createElement('div'); w.className = 'eb-cartes';
    w.innerHTML = liste.map(p => `
      <article class="eb-carte">
        <a class="eb-img" href="/produits/${p.id}/">${p.badge ? `<span class="eb-badge">${esc(p.badge)}</span>` : ''}<img src="/img/${p.imgs[0]}.webp" alt="${esc(p.nom)}" loading="lazy" width="156" height="156"></a>
        <div class="eb-carte-c"><a href="/produits/${p.id}/">${esc(p.nom)}</a>
          <div class="eb-carte-p"><b>${eur(p.prix)}</b><button class="eb-ajout" type="button" data-eb-ajout="${p.id}">+ Panier</button></div></div>
      </article>`).join('');
    fil.appendChild(w); deroule();
  }
  function puces(liste) {
    if (!liste || !liste.length) return;
    const w = document.createElement('div'); w.className = 'eb-puces';
    liste.forEach(x => { const b = document.createElement('button'); b.type = 'button'; b.className = 'eb-puce'; b.textContent = x; b.onclick = () => envoyer(x); w.appendChild(b); });
    fil.appendChild(w); deroule();
  }
  function afficher(r) {
    bulle(r.txt, 'bot');
    if (r.produits && r.produits.length) cartes(r.produits);
    if (r.action) { const b = document.createElement('button'); b.type = 'button'; b.className = 'eb-action'; b.textContent = r.action.lib; b.onclick = r.action.f; fil.appendChild(b); }
    puces(r.puces);
  }
  function envoyer(texte) {
    texte = String(texte).trim(); if (!texte) return;
    fil.querySelectorAll('.eb-puces').forEach(p => p.remove());
    bulle(texte, 'moi');
    let txt = texte.replace(/^[^\p{L}\d›]+/u, '');
    if (/^plus de details$/i.test(norm(txt)) && dernierProduit) txt = 'détails ' + dernierProduit.nom;
    if (/du moins cher au plus cher/i.test(norm(txt))) txt = 'moins cher';
    if (/^specia?l noel/i.test(norm(txt))) txt = 'noël';
    if (/^pour mon chien/i.test(norm(txt))) txt = 'chien';
    const r = (() => { try { return repondre(txt); } catch (e) { return { txt: `Oups, une petite étourderie de ma part 🙈 Reformulez votre question ?`, puces: PUCES_BASE }; } })();
    const ecrit = document.createElement('div'); ecrit.className = 'eb-msg eb-bot eb-ecrit'; ecrit.innerHTML = '<i></i><i></i><i></i>';
    fil.appendChild(ecrit); deroule();
    setTimeout(() => { ecrit.remove(); afficher(r); }, reduit ? 120 : 450 + Math.min(500, r.txt.length * 3));
  }

  // ajout au panier (avec choix de taille / coloris dans la conversation)
  fil.addEventListener('click', e => {
    const b = e.target.closest('[data-eb-ajout]'); if (!b) return;
    const p = PRODUITS.find(x => x.id === b.dataset.ebAjout); if (!p) return;
    fil.querySelectorAll('.eb-puces').forEach(w => w.remove());
    const choix = [p.tailles && p.tailles.length > 1 ? ['Taille', p.tailles] : null, p.couleurs && p.couleurs.length > 1 ? ['Coloris', p.couleurs] : null].filter(Boolean);
    const fixes = [p.tailles && p.tailles.length === 1 ? p.tailles[0] : null, p.couleurs && p.couleurs.length === 1 ? p.couleurs[0] : null].filter(Boolean);
    const valider = opts => {
      if (typeof ajouter === 'function') { ajouter(p.id, opts.join(' · '), 1); }
      b.textContent = '✓ Ajouté'; b.classList.add('fait');
      const { st } = panierInfo();
      setTimeout(() => afficher({ txt: `C'est dans le panier ! 🛒 ${esc(p.nom)}${opts.length ? ' (' + esc(opts.join(' · ')) + ')' : ''}.` + (st && st < FRANCO_ ? ` Plus que <b>${eur(FRANCO_ - st)}</b> pour la livraison offerte.` : st ? ' La livraison est offerte 🎉' : ''), puces: ['🛒 Mon panier', '🎁 Idée cadeau'] }), 250);
    };
    if (!choix.length) return valider(fixes);
    const pris = [...fixes];
    const etape = i => {
      if (i >= choix.length) return valider(pris);
      const [lib, vals] = choix[i];
      bulle(`${lib === 'Taille' ? '📏 Quelle taille' : '🎨 Quel modèle'} pour <b>${esc(p.nom)}</b> ?`, 'bot');
      const w = document.createElement('div'); w.className = 'eb-puces';
      vals.forEach(v => { const c = document.createElement('button'); c.type = 'button'; c.className = 'eb-puce'; c.textContent = v;
        c.onclick = () => { w.remove(); bulle(v, 'moi'); pris.push(v); etape(i + 1); }; w.appendChild(c); });
      fil.appendChild(w); deroule();
    };
    etape(0);
  });

  // ouverture / fermeture
  let accueilFait = false;
  function accueil() {
    if (accueilFait) return; accueilFait = true;
    const m = location.pathname.match(/^\/produits\/([^/]+)/), p = m && PRODUITS.find(x => x.id === m[1]);
    const h = new Date().getHours(), salut = h >= 18 || h < 5 ? 'Bonsoir' : 'Bonjour';
    if (p) { dernierProduit = p;
      afficher({ txt: `${salut} ✨ Je suis <b>Étoile</b>. Une question sur <b>${esc(p.nom)}</b> ? Taille, âge, livraison… ou je vous montre des produits du même univers.`, puces: ['ℹ️ Plus de détails', '🚚 Livraison', '🎁 Idée cadeau', '💸 Moins de 15 €'] });
    } else afficher({ txt: `${salut} ✨ Je suis <b>Étoile</b>, la fée de la Magique Boutique. Je connais nos ${PRODUITS.length} produits par cœur : dites-moi pour qui vous cherchez, son âge, son héros préféré ou votre budget.`, puces: PUCES_BASE });
  }
  const btn = $e('.eb-lanceur');
  function basculer(ouvert) {
    document.body.classList.toggle('eb-ouvert', ouvert); btn.setAttribute('aria-expanded', ouvert);
    invite.classList.remove('on'); $e('.eb-point')?.remove();
    try { sessionStorage.setItem('eb-vu', '1'); } catch (e) {}
    if (ouvert) { accueil(); if (matchMedia('(hover: hover)').matches) setTimeout(() => champ.focus(), 300); }
  }
  btn.onclick = () => basculer(true);
  $e('.eb-fermer').onclick = () => basculer(false);
  invite.onclick = e => { if (e.target.closest('button')) { invite.classList.remove('on'); try { sessionStorage.setItem('eb-vu', '1'); } catch (x) {} } else basculer(true); };
  document.addEventListener('keydown', e => { if (e.key === 'Escape' && document.body.classList.contains('eb-ouvert')) basculer(false); });
  $e('.eb-saisie').addEventListener('submit', e => { e.preventDefault(); const v = champ.value; champ.value = ''; envoyer(v); });
  // petite invitation une fois par visite, après quelques secondes
  let vu = false; try { vu = !!sessionStorage.getItem('eb-vu'); } catch (e) {}
  if (!vu) setTimeout(() => { if (!document.body.classList.contains('eb-ouvert') && !document.body.classList.contains('bloque')) invite.classList.add('on');
    setTimeout(() => invite.classList.remove('on'), 9000); }, 7000);
  window.etoileTest = q => repondre(q); // diagnostic : etoileTest('cadeau 6 ans')
})();
