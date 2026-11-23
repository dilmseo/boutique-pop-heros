// Génère, à chaque déploiement, les pages produits (/produits/<id>/), le blog (/blog/), sitemap.xml et robots.txt
// Source unique : public/catalogue.js (produits) + contenu/blog/*.html (articles). Les gabarits viennent de public/index.html.
import { readFileSync, writeFileSync, mkdirSync, readdirSync, rmSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const RACINE = join(dirname(fileURLToPath(import.meta.url)), '..');
const PUB = join(RACINE, 'public');
const SITE = 'https://boutique-pop-heros.netlify.app';
const NOM = 'Magique Boutique';
const PRODUITS = new Function(readFileSync(join(PUB, 'catalogue.js'), 'utf8') + '\n;return PRODUITS;')();

const echap = s => String(s ?? '').replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const euros = n => n.toFixed(2).replace('.', ',') + ' €';
const img = n => `/img/${n}.webp`;
const resume = (t, n = 155) => { t = t.replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim(); return t.length > n ? t.slice(0, n - 1).replace(/\s\S*$/, '') + '…' : t; };

// ---- Articles du blog (lus avant les produits pour le maillage produit -> article) ----
const DOSSIER_BLOG = join(RACINE, 'contenu', 'blog');
const articles = (existsSync(DOSSIER_BLOG) ? readdirSync(DOSSIER_BLOG) : []).filter(f => f.endsWith('.html')).map(f => {
  const brut = readFileSync(join(DOSSIER_BLOG, f), 'utf8');
  const m = brut.match(/^<!--\s*(\{[\s\S]*?\})\s*-->/);
  if (!m) throw new Error('En-tête JSON manquant : ' + f);
  return { slug: f.replace(/\.html$/, ''), ...JSON.parse(m[1]), corps: brut.slice(m[0].length).trim() };
}).sort((a, b) => b.date.localeCompare(a.date));
const articlesDuProduit = id => articles.filter(a => (a.produits || []).includes(id));

// ---- Gabarits pris dans la page d'accueil (en-tête, pied, panier, fiche) ----
let accueil = readFileSync(join(PUB, 'index.html'), 'utf8');
// liens du pied de page (crawlables, la grille de l'accueil étant rendue en JS) — remplacement idempotent
accueil = accueil
  .replace(/<!--LIENS-PRODUITS-->[\s\S]*?<!--\/LIENS-PRODUITS-->/, '<!--LIENS-PRODUITS--><ul>' + PRODUITS.map(p => `<li><a href="/produits/${p.id}/">${echap(p.nom)}</a></li>`).join('') + '</ul><!--/LIENS-PRODUITS-->')
  .replace(/<!--LIENS-BLOG-->[\s\S]*?<!--\/LIENS-BLOG-->/, '<!--LIENS-BLOG--><ul>' + articles.map(a => `<li><a href="/blog/${a.slug}/">${echap(a.titre)}</a></li>`).join('') + '<li><a href="/blog/">Tous les articles →</a></li></ul><!--/LIENS-BLOG-->');
writeFileSync(join(PUB, 'index.html'), accueil);
const entete = accueil.slice(accueil.indexOf('<div class="annonce">'), accueil.indexOf('</header>') + 9);
const pied = accueil.slice(accueil.indexOf('<footer'), accueil.indexOf('<script src="catalogue.js">'));
if (!entete || !pied) throw new Error('Gabarit introuvable dans index.html');

function page({ titre, description, chemin, contenu, jsonld = [], image, type = 'website' }) {
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
${image ? `<meta property="og:image" content="${SITE}${image}">` : ''}
<link rel="icon" href="data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'><text y='.9em' font-size='90'>⭐</text></svg>">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Fredoka:wght@500;600;700&family=Nunito:wght@400;600;700;800&display=swap" rel="stylesheet">
<link rel="stylesheet" href="/style.css">
${jsonld.map(j => `<script type="application/ld+json">${JSON.stringify(j)}</script>`).join('\n')}
</head>
<body>
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

// ---- Pages produits ----
const out = join(PUB, 'produits');
rmSync(out, { recursive: true, force: true });
for (const p of PRODUITS) {
  const choix = (nom, vals) => vals ? `<label class="choix">${nom}<select data-opt="${nom}">${vals.map(v => `<option>${echap(v)}</option>`).join('')}</select></label>` : '';
  const proches = [...PRODUITS.filter(x => x.id !== p.id && x.rayon === p.rayon), ...PRODUITS.filter(x => x.id !== p.id && x.rayon !== p.rayon)].slice(0, 4);
  const lies = articlesDuProduit(p.id);
  const contenu = `
<main class="page-produit" id="page-produit">
  <nav class="fil" aria-label="Fil d'Ariane"><a href="/">Accueil</a> › <a href="/#boutique">${echap(p.rayon)}</a> › <span>${echap(p.nom)}</span></nav>
  <div class="fiche-grille">
    <div class="fiche-galerie">
      <img id="page-grande" src="${img(p.imgs[0])}" alt="${echap(p.nom)}" width="600" height="600">
      ${p.imgs.length > 1 ? `<div class="vignettes">${p.imgs.map((m, i) => `<button class="vign${i ? '' : ' on'}" data-vign-page="${m}" aria-label="Photo ${i + 1}"><img src="${img(m)}" alt=""></button>`).join('')}</div>` : ''}
    </div>
    <div class="fiche-infos">
      <span class="rayon">${echap(p.rayon)}${p.age ? ' · ' + echap(p.age) : ''}</span>
      <h1>${echap(p.nom)}</h1>
      <strong class="prix grand">${euros(p.prix)}</strong>
      <p>${echap(p.desc)}</p>
      <ul class="points">${p.points.map(x => `<li>${echap(x)}</li>`).join('')}</ul>
      <div class="options">${choix('Taille', p.tailles)}${choix('Coloris', p.couleurs)}
        <label class="choix">Quantité<input type="number" id="page-qte" min="1" max="20" value="1"></label></div>
      <button class="btn btn-plein large" data-ajout-page="${p.id}">Ajouter au panier</button>
      <ul class="garanties">
        <li>🚚 Livraison 4,90 €, offerte dès 49 € d'achat</li>
        <li>↩️ 14 jours pour changer d'avis</li>
        <li>🎁 Emballage cadeau sur demande (précisez-le dans votre message)</li>
      </ul>
    </div>
  </div>
  ${lies.length ? `<section class="bloc-lies"><h2 class="titre">À lire sur le blog</h2><div class="liens-blog">${lies.map(a => `<a href="/blog/${a.slug}/">📖 ${echap(a.titre)}</a>`).join('')}</div></section>` : ''}
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
    contenu, jsonld, image: img(p.imgs[0]), type: 'product' }));
}

// ---- Blog ----
const outB = join(PUB, 'blog');
rmSync(outB, { recursive: true, force: true });
mkdirSync(outB, { recursive: true });
const dateFr = d => new Date(d + 'T12:00:00').toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' });
for (const a of articles) {
  const corps = a.corps.replace(/<!--produits:([\w,-]+)-->/g, (_, ids) =>
    `<div class="grille grille-article">${ids.split(',').map(id => PRODUITS.find(p => p.id === id)).filter(Boolean).map(carte).join('')}</div>`);
  const autres = articles.filter(x => x.slug !== a.slug).slice(0, 3);
  const contenu = `
<main class="article">
  <nav class="fil" aria-label="Fil d'Ariane"><a href="/">Accueil</a> › <a href="/blog/">Blog</a> › <span>${echap(a.titre)}</span></nav>
  <header class="article-tete">
    <span class="rayon">${echap(a.rubrique || 'Conseils')}</span>
    <h1>${echap(a.titre)}</h1>
    <p class="chapo">${echap(a.chapo)}</p>
    <p class="doux">Publié le ${dateFr(a.date)} · ${Math.max(2, Math.round(a.corps.replace(/<[^>]+>/g, ' ').split(/\s+/).length / 220))} min de lecture</p>
  </header>
  ${a.image ? `<img class="article-img" src="${img(a.image)}" alt="${echap(a.titre)}" width="600" height="600">` : ''}
  <div class="article-corps">${corps}</div>
  ${autres.length ? `<section class="bloc-lies"><h2 class="titre">Autres articles</h2><div class="cartes-blog">${autres.map(carteBlog).join('')}</div></section>` : ''}
</main>`;
  mkdirSync(join(outB, a.slug), { recursive: true });
  writeFileSync(join(outB, a.slug, 'index.html'), page({
    titre: `${a.titre} | ${NOM}`, description: a.description || resume(a.chapo), chemin: `/blog/${a.slug}/`, contenu, type: 'article',
    image: a.image ? img(a.image) : undefined,
    jsonld: [{ '@context': 'https://schema.org', '@type': 'BlogPosting', headline: a.titre, description: a.description || a.chapo,
      datePublished: a.date, dateModified: a.maj || a.date, image: a.image ? SITE + img(a.image) : undefined,
      author: { '@type': 'Organization', name: NOM }, publisher: { '@type': 'Organization', name: NOM },
      mainEntityOfPage: `${SITE}/blog/${a.slug}/` }] }));
}
function carteBlog(a) {
  return `<a class="carte-blog" href="/blog/${a.slug}/">
      ${a.image ? `<div class="cb-img"><img src="${img(a.image)}" alt="" loading="lazy" width="600" height="600"></div>` : ''}
      <div class="cb-corps"><span class="rayon">${echap(a.rubrique || 'Conseils')}</span><h3>${echap(a.titre)}</h3><p>${echap(a.chapo)}</p><span class="cb-lire">Lire l'article →</span></div></a>`;
}
writeFileSync(join(outB, 'index.html'), page({
  titre: `Blog : idées cadeaux et conseils | ${NOM}`, chemin: '/blog/',
  description: "Idées cadeaux KPop Demon Hunters, Stitch et Disney, conseils pour choisir un jouet, décorer une chambre d'enfant ou équiper son petit chien.",
  contenu: `
<main class="blog">
  <header class="article-tete"><span class="sur-titre">Le blog</span><h1>Idées cadeaux <span class="neon">& conseils</span></h1>
    <p class="chapo">Des guides pratiques pour faire plaisir aux fans de vos héros préférés, petits et grands (et même à quatre pattes).</p></header>
  <div class="cartes-blog">${articles.map(carteBlog).join('')}</div>
</main>` }));

// ---- Pages légales (mentions, CGV, confidentialité) : contenu/legal/*.html + contenu/boutique.json ----
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
  writeFileSync(join(PUB, slug, 'index.html'), page({ titre: `${meta.titre} | ${NOM}`, description: meta.description, chemin: `/${slug}/`,
    contenu: `
<main class="article">
  <nav class="fil" aria-label="Fil d'Ariane"><a href="/">Accueil</a> › <span>${echap(meta.titre)}</span></nav>
  <header class="article-tete"><h1>${echap(meta.titre)}</h1><p class="doux">Dernière mise à jour : ${dateFr(INFOS.mise_a_jour)}</p></header>
  <div class="article-corps">${corps}</div>
</main>` }));
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
