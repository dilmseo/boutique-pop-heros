// Génère, à chaque déploiement : pages produits (/produits/<id>/), blog (/blog/), pages légales, sitemap.xml, robots.txt,
// et les blocs générés de l'accueil (liens du pied de page, articles récents). Sources : public/catalogue.js,
// contenu/blog/*.html, contenu/legal/*.html + contenu/boutique.json. Gabarits (en-tête, pied, panier) : public/index.html.
import { readFileSync, writeFileSync, mkdirSync, readdirSync, rmSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const RACINE = join(dirname(fileURLToPath(import.meta.url)), '..');
const PUB = join(RACINE, 'public');
const SITE = 'https://boutique-pop-heros.netlify.app';
const NOM = 'Magique Boutique';
const FRANCO = 49;
const PRODUITS = new Function(readFileSync(join(PUB, 'catalogue.js'), 'utf8') + '\n;return PRODUITS;')();

const echap = s => String(s ?? '').replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const euros = n => n.toFixed(2).replace('.', ',') + ' €';
const img = n => `/img/${n}.webp`;
const resume = (t, n = 155) => { t = t.replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim(); return t.length > n ? t.slice(0, n - 1).replace(/\s\S*$/, '') + '…' : t; };
const dateFr = d => new Date(d + 'T12:00:00').toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' });
const slugifier = s => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/<[^>]+>/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 60);
const minutes = h => Math.max(2, Math.round(h.replace(/<[^>]+>/g, ' ').split(/\s+/).length / 220));

// ---- Articles ----
const DOSSIER_BLOG = join(RACINE, 'contenu', 'blog');
const articles = (existsSync(DOSSIER_BLOG) ? readdirSync(DOSSIER_BLOG) : []).filter(f => f.endsWith('.html')).map(f => {
  const brut = readFileSync(join(DOSSIER_BLOG, f), 'utf8');
  const m = brut.match(/^<!--\s*(\{[\s\S]*?\})\s*-->/);
  if (!m) throw new Error('En-tête JSON manquant : ' + f);
  return { slug: f.replace(/\.html$/, ''), ...JSON.parse(m[1]), corps: brut.slice(m[0].length).trim() };
}).sort((a, b) => b.date.localeCompare(a.date));
const articlesDuProduit = id => articles.filter(a => (a.produits || []).includes(id));
const RAYONS = [...new Set(PRODUITS.map(p => p.rayon))];

function carteBlog(a, grande = false) {
  return `<a class="carte-blog${grande ? ' a-la-une' : ''}" href="/blog/${a.slug}/">
      ${a.image ? `<div class="cb-img"><img src="${img(a.image)}" alt="" loading="lazy" width="600" height="600"></div>` : ''}
      <div class="cb-corps"><span class="cb-meta"><span class="rayon">${echap(a.rubrique || 'Conseils')}</span><span>${minutes(a.corps)} min</span></span>
        <h3>${echap(a.titre)}</h3><p>${echap(a.chapo)}</p><span class="cb-lire">Lire l'article <i>→</i></span></div></a>`;
}

// ---- Blocs générés de l'accueil (remplacements idempotents entre marqueurs) ----
let accueil = readFileSync(join(PUB, 'index.html'), 'utf8');
const bloc = (nom, html) => { accueil = accueil.replace(new RegExp(`<!--${nom}-->[\\s\\S]*?<!--\\/${nom}-->`), `<!--${nom}-->${html}<!--/${nom}-->`); };
bloc('LIENS-PRODUITS', '<div class="pied-puces">' + PRODUITS.map(p => `<a href="/produits/${p.id}/">${echap(p.nom.split(' — ')[0])}</a>`).join('') + '</div>');
bloc('LIENS-BLOG', '<ul>' + articles.slice(0, 4).map(a => `<li><a href="/blog/${a.slug}/">${echap(a.titre.split(' : ')[0])}</a></li>`).join('') + '<li><a class="pied-plus" href="/blog/">Tous les articles →</a></li></ul>');
bloc('LIENS-RAYONS', '<ul>' + RAYONS.map(r => `<li><a href="/?rayon=${encodeURIComponent(r)}#boutique">${echap(r)}</a></li>`).join('') + '<li><a class="pied-plus" href="/#boutique">Toute la boutique →</a></li></ul>');
bloc('BLOG-ACCUEIL', articles.slice(0, 3).map(a => carteBlog(a)).join(''));
writeFileSync(join(PUB, 'index.html'), accueil);

const entete = accueil.slice(accueil.indexOf('<div class="annonce"'), accueil.indexOf('</header>') + 9);
const pied = accueil.slice(accueil.indexOf('<footer'), accueil.indexOf('<script src="/catalogue.js">'));
if (entete.length < 50 || pied.length < 50) throw new Error('Gabarit introuvable dans index.html');

function page({ titre, description, chemin, contenu, jsonld = [], image, type = 'website', classe = '' }) {
  const url = SITE + chemin;
  return `<!doctype html>
<html lang="fr">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${echap(titre)}</title>
<meta name="description" content="${echap(description)}">
<link rel="canonical" href="${url}">
<meta property="og:type" content="${type}">
<meta property="og:title" content="${echap(titre)}">
<meta property="og:description" content="${echap(description)}">
<meta property="og:url" content="${url}">
<meta property="og:image" content="${SITE}${image || '/og-image.png'}">
<link rel="icon" href="/favicon.svg" type="image/svg+xml">
<link rel="icon" href="/favicon-32.png" sizes="32x32" type="image/png">
<link rel="apple-touch-icon" href="/apple-touch-icon.png">
<link rel="manifest" href="/site.webmanifest">
<meta name="theme-color" content="#140b2e">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Fredoka:wght@500;600;700&family=Nunito:wght@400;600;700;800&display=swap" rel="stylesheet">
<link rel="stylesheet" href="/style.css">
${jsonld.map(j => `<script type="application/ld+json">${JSON.stringify(j)}</script>`).join('\n')}
</head>
<body class="${classe}">
${entete}
${contenu}
${pied}
<script src="/catalogue.js"></script>
<script src="/app.js"></script>
</body>
</html>
`;
}

const carte = p => `
    <article class="carte" data-id="${p.id}" tabindex="0">
      <div class="carte-img">${p.badge ? `<span class="badge">${echap(p.badge)}</span>` : ''}
        <img src="${img(p.imgs[0])}" alt="${echap(p.nom)}" loading="lazy" width="600" height="600"></div>
      <div class="carte-corps"><span class="rayon">${echap(p.rayon)}</span>
        <h3><a href="/produits/${p.id}/">${echap(p.nom)}</a></h3>
        <div class="carte-pied"><strong class="prix">${euros(p.prix)}</strong>
          <button class="btn-ajout" data-ajout="${p.id}" aria-label="Ajouter ${echap(p.nom)} au panier">+ Panier</button></div></div>
    </article>`;
const fil = (...e) => `<nav class="fil" aria-label="Fil d'Ariane">${e.map(([t, u]) => u ? `<a href="${u}">${echap(t)}</a>` : `<span>${echap(t)}</span>`).join('<i>›</i>')}</nav>`;

// ---- Pages produits ----
const out = join(PUB, 'produits');
rmSync(out, { recursive: true, force: true });
for (const p of PRODUITS) {
  const choix = (nom, vals) => vals ? `<label class="choix">${nom}<select data-opt="${nom}">${vals.map(v => `<option>${echap(v)}</option>`).join('')}</select></label>` : '';
  const proches = [...PRODUITS.filter(x => x.id !== p.id && x.rayon === p.rayon), ...PRODUITS.filter(x => x.id !== p.id && x.rayon !== p.rayon)].slice(0, 4);
  const lies = articlesDuProduit(p.id);
  const manque = Math.max(0, FRANCO - p.prix);
  const contenu = `
<main class="page-produit" id="page-produit">
  ${fil(['Accueil', '/'], [p.rayon, `/?rayon=${encodeURIComponent(p.rayon)}#boutique`], [p.nom])}
  <div class="pp-grille">
    <div class="pp-galerie">
      <div class="pp-cadre">${p.badge ? `<span class="badge">${echap(p.badge)}</span>` : ''}
        <img id="page-grande" src="${img(p.imgs[0])}" alt="${echap(p.nom)}" width="600" height="600"></div>
      ${p.imgs.length > 1 ? `<div class="vignettes">${p.imgs.map((m, i) => `<button class="vign${i ? '' : ' on'}" data-vign-page="${m}" aria-label="Photo ${i + 1}"><img src="${img(m)}" alt=""></button>`).join('')}</div>` : ''}
    </div>
    <aside class="pp-achat">
      <span class="rayon">${echap(p.rayon)}${p.age ? ' · ' + echap(p.age) : ''}</span>
      <h1>${echap(p.nom)}</h1>
      <div class="pp-prix"><strong class="prix grand">${euros(p.prix)}</strong><span class="stock"><i></i>En stock</span></div>
      <p class="pp-accroche">${echap(resume(p.desc, 140))}</p>
      <div class="options">${choix('Taille', p.tailles)}${choix('Coloris', p.couleurs)}
        <label class="choix">Quantité<input type="number" id="page-qte" min="1" max="20" value="1"></label></div>
      <button class="btn btn-plein large btn-xl" data-ajout-page="${p.id}">Ajouter au panier ✨</button>
      <div class="franco"><div class="franco-barre"><span style="width:${Math.min(100, Math.round(p.prix / FRANCO * 100))}%"></span></div>
        <small>${manque ? `Encore ${euros(manque)} pour la livraison offerte` : 'Livraison offerte avec cet article 🎉'}</small></div>
      <ul class="garanties">
        <li><b>🚚</b><span>Livraison 4,90 €<br><small>offerte dès ${FRANCO} €</small></span></li>
        <li><b>↩️</b><span>14 jours<br><small>pour changer d'avis</small></span></li>
        <li><b>🎁</b><span>Emballage cadeau<br><small>sur demande</small></span></li>
      </ul>
    </aside>
  </div>

  <section class="pp-details">
    <details open><summary>Description</summary><p>${echap(p.desc)}</p></details>
    <details open><summary>Points forts</summary><ul class="points">${p.points.map(x => `<li>${echap(x)}</li>`).join('')}</ul></details>
    <details><summary>Livraison et retours</summary><p>Expédition en France métropolitaine. Livraison 4,90 €, offerte dès ${FRANCO} € d'achat.
      Vous disposez de 14 jours après réception pour changer d'avis (voir nos <a href="/cgv/">conditions de vente</a>). Pour un cadeau,
      précisez-le dans le message de votre commande.</p></details>
  </section>

  ${lies.length ? `<section class="bloc-lies"><h2 class="titre">À lire sur le blog</h2><div class="cartes-blog">${lies.slice(0, 3).map(a => carteBlog(a)).join('')}</div></section>` : ''}
  <section class="bloc-lies"><h2 class="titre">Vous aimerez aussi</h2><div class="grille">${proches.map(carte).join('')}</div></section>
</main>`;
  const jsonld = [{
    '@context': 'https://schema.org', '@type': 'Product', name: p.nom, description: p.desc, sku: p.id, category: p.rayon,
    image: p.imgs.map(m => SITE + img(m)),
    offers: { '@type': 'Offer', price: p.prix.toFixed(2), priceCurrency: 'EUR', availability: 'https://schema.org/InStock', url: `${SITE}/produits/${p.id}/`,
      shippingDetails: { '@type': 'OfferShippingDetails', shippingRate: { '@type': 'MonetaryAmount', value: '4.90', currency: 'EUR' }, shippingDestination: { '@type': 'DefinedRegion', addressCountry: 'FR' } },
      hasMerchantReturnPolicy: { '@type': 'MerchantReturnPolicy', applicableCountry: 'FR', returnPolicyCategory: 'https://schema.org/MerchantReturnFiniteReturnWindow', merchantReturnDays: 14 } },
  }, { '@context': 'https://schema.org', '@type': 'BreadcrumbList', itemListElement: [
    { '@type': 'ListItem', position: 1, name: 'Accueil', item: SITE + '/' },
    { '@type': 'ListItem', position: 2, name: p.nom, item: `${SITE}/produits/${p.id}/` }] }];
  mkdirSync(join(out, p.id), { recursive: true });
  writeFileSync(join(out, p.id, 'index.html'), page({
    titre: `${p.nom} — ${euros(p.prix)} | ${NOM}`, description: resume(p.desc), chemin: `/produits/${p.id}/`,
    contenu, jsonld, image: img(p.imgs[0]), type: 'product', classe: 'p-produit' }));
}

// ---- Blog ----
const outB = join(PUB, 'blog');
rmSync(outB, { recursive: true, force: true });
mkdirSync(outB, { recursive: true });
for (const a of articles) {
  const sommaire = [];
  let corps = a.corps.replace(/<h2>([\s\S]*?)<\/h2>/g, (_, t) => { const id = slugifier(t); sommaire.push([id, t]); return `<h2 id="${id}">${t}</h2>`; });
  corps = corps.replace(/<!--produits:([\w,-]+)-->/g, (_, ids) =>
    `<div class="grille grille-article">${ids.split(',').map(id => PRODUITS.find(p => p.id === id)).filter(Boolean).map(carte).join('')}</div>`);
  const autres = articles.filter(x => x.slug !== a.slug).slice(0, 3);
  const contenu = `
<div class="lecture" aria-hidden="true"><span id="lecture"></span></div>
<header class="art-bandeau">
  <div class="halo h1"></div><div class="halo h2"></div>
  <div class="art-bandeau-in">
    <div class="art-texte">
      ${fil(['Accueil', '/'], ['Blog', '/blog/'], [a.rubrique || 'Conseils'])}
      <span class="sur-titre">${echap(a.rubrique || 'Conseils')}</span>
      <h1>${echap(a.titre)}</h1>
      <p class="chapo">${echap(a.chapo)}</p>
      <p class="art-meta"><span>📅 ${dateFr(a.date)}</span><span>⏱ ${minutes(a.corps)} min de lecture</span><span>✍️ L'équipe ${NOM}</span></p>
    </div>
    ${a.image ? `<div class="art-visuel"><img src="${img(a.image)}" alt="${echap(a.titre)}" width="600" height="600"></div>` : ''}
  </div>
</header>
<main class="article">
  ${sommaire.length > 2 ? `<nav class="sommaire" aria-label="Sommaire"><b>Au sommaire</b><ol>${sommaire.map(([id, t]) => `<li><a href="#${id}">${t}</a></li>`).join('')}</ol></nav>` : ''}
  <div class="article-corps">${corps}</div>
  <aside class="art-fin">
    <div><b>✨ Envie de faire plaisir ?</b><p>Jouets, déco et accessoires des héros préférés de vos enfants, livrés chez vous.</p></div>
    <a class="btn btn-plein" href="/#boutique">Découvrir la boutique</a>
  </aside>
  ${autres.length ? `<section class="bloc-lies"><h2 class="titre">À lire aussi</h2><div class="cartes-blog">${autres.map(x => carteBlog(x)).join('')}</div></section>` : ''}
</main>`;
  mkdirSync(join(outB, a.slug), { recursive: true });
  writeFileSync(join(outB, a.slug, 'index.html'), page({
    titre: `${a.titre} | ${NOM}`, description: a.description || resume(a.chapo), chemin: `/blog/${a.slug}/`, contenu, type: 'article', classe: 'p-article',
    image: a.image ? img(a.image) : undefined,
    jsonld: [{ '@context': 'https://schema.org', '@type': 'BlogPosting', headline: a.titre, description: a.description || a.chapo,
      datePublished: a.date, dateModified: a.maj || a.date, image: a.image ? SITE + img(a.image) : undefined,
      author: { '@type': 'Organization', name: NOM }, publisher: { '@type': 'Organization', name: NOM },
      mainEntityOfPage: `${SITE}/blog/${a.slug}/` }] }));
}
writeFileSync(join(outB, 'index.html'), page({
  titre: `Blog : idées cadeaux et conseils | ${NOM}`, chemin: '/blog/', classe: 'p-blog',
  description: "Idées cadeaux KPop Demon Hunters, Stitch et Disney, conseils pour choisir un jouet, décorer une chambre d'enfant ou équiper son petit chien.",
  contenu: `
<header class="art-bandeau blog-bandeau">
  <div class="halo h1"></div><div class="halo h2"></div>
  <div class="art-bandeau-in"><div class="art-texte">
    ${fil(['Accueil', '/'], ['Blog'])}
    <span class="sur-titre">Le blog</span><h1>Idées cadeaux <span class="neon">& conseils</span></h1>
    <p class="chapo">Des guides pratiques pour faire plaisir aux fans de vos héros préférés, petits et grands (et même à quatre pattes).</p>
  </div></div>
</header>
<main class="blog">
  <div class="cartes-blog">${articles.map((a, i) => carteBlog(a, i === 0)).join('')}</div>
</main>` }));

// ---- Pages légales ----
const INFOS = JSON.parse(readFileSync(join(RACINE, 'contenu', 'boutique.json'), 'utf8'));
const legales = [];
for (const f of readdirSync(join(RACINE, 'contenu', 'legal')).filter(f => f.endsWith('.html'))) {
  const brut = readFileSync(join(RACINE, 'contenu', 'legal', f), 'utf8');
  const m = brut.match(/^<!--\s*(\{[\s\S]*?\})\s*-->/);
  const meta = JSON.parse(m[1]), slug = f.replace(/\.html$/, '');
  const corps = brut.slice(m[0].length).replace(/\{\{(\w+)\}\}/g, (_, k) =>
    INFOS[k] ? echap(INFOS[k]) : '<em class="a-completer">en cours de mise à jour</em>');
  rmSync(join(PUB, slug), { recursive: true, force: true });
  mkdirSync(join(PUB, slug), { recursive: true });
  writeFileSync(join(PUB, slug, 'index.html'), page({ titre: `${meta.titre} | ${NOM}`, description: meta.description, chemin: `/${slug}/`, classe: 'p-legal',
    contenu: `
<header class="art-bandeau legal-bandeau"><div class="art-bandeau-in"><div class="art-texte">
  ${fil(['Accueil', '/'], [meta.titre])}
  <h1>${echap(meta.titre)}</h1><p class="art-meta"><span>Dernière mise à jour : ${dateFr(INFOS.mise_a_jour)}</span></p>
</div></div></header>
<main class="article"><div class="article-corps">${corps}</div></main>` }));
  legales.push(`/${slug}/`);
}

// ---- Sitemap + robots ----
const urls = ['/', '/blog/', ...PRODUITS.map(p => `/produits/${p.id}/`), ...articles.map(a => `/blog/${a.slug}/`), ...legales];
writeFileSync(join(PUB, 'sitemap.xml'), `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls.map(u => `  <url><loc>${SITE}${u}</loc></url>`).join('\n')}
</urlset>
`);
writeFileSync(join(PUB, 'robots.txt'), `User-agent: *\nDisallow: /espace/\nDisallow: /merci.html\n\nSitemap: ${SITE}/sitemap.xml\n`);
console.log(`généré : ${PRODUITS.length} pages produits, ${articles.length} articles, ${legales.length} pages légales, sitemap ${urls.length} URL`);
