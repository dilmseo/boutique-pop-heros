// Article de blog quotidien, lancé chaque matin par GitHub Actions (.github/workflows/blog-du-jour.yml).
// 1. lit la clé Gemini du marchand (Netlify Blobs, chiffrée RSA) et la déchiffre avec le secret GEMINI_CLE_PRIVEE ;
// 2. demande à Gemini un article de CONSEILS (pas de pub) lié au catalogue, sans doublon avec les articles existants ;
// 3. contrôle le résultat (JSON, accents, longueur, balises, produits réels) puis écrit contenu/blog/<slug>.html.
// Le workflow commit le fichier puis redéploie. L'état (succès ou erreur) est rangé dans le store « reglages » → espace marchand.
import { getStore } from '@netlify/blobs';
import { privateDecrypt, constants } from 'node:crypto';
import { readFileSync, writeFileSync, readdirSync, existsSync, appendFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const RACINE = join(dirname(fileURLToPath(import.meta.url)), '..');
const DOSSIER = join(RACINE, 'contenu', 'blog');
const PRODUITS = new Function(readFileSync(join(RACINE, 'public', 'catalogue.js'), 'utf8') + '\n;return PRODUITS;')();
const MODELES = ['gemini-2.5-flash', 'gemini-flash-latest', 'gemini-3-flash-preview', 'gemini-2.5-flash-lite'];
const aujourdhui = new Date().toISOString().slice(0, 10);
const TEST = process.env.BLOG_TEST_SORTIE; // essai local : clé dans GEMINI_CLE_TEST, article écrit dans ce fichier, rien publié
const store = nom => getStore({ name: nom, siteID: process.env.NETLIFY_SITE_ID, token: process.env.NETLIFY_AUTH_TOKEN });
const sortie = (k, v) => process.env.GITHUB_OUTPUT && appendFileSync(process.env.GITHUB_OUTPUT, `${k}=${v}\n`);
const slugifier = s => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 70);

async function noter(etat) {
  if (TEST) return;
  const r = store('reglages');
  const avant = (await r.get('blog', { type: 'json' })) || {};
  await r.setJSON('blog', { ...avant, ...etat, essai: new Date().toISOString() });
}

const existants = (existsSync(DOSSIER) ? readdirSync(DOSSIER) : []).filter(f => f.endsWith('.html')).map(f => {
  const m = readFileSync(join(DOSSIER, f), 'utf8').match(/^<!--\s*(\{[\s\S]*?\})\s*-->/);
  return { slug: f.replace(/\.html$/, ''), ...(m ? JSON.parse(m[1]) : {}) };
});
if (!process.env.BLOG_TEST_SORTIE && existants.some(a => a.date === aujourdhui)) { console.log('Un article existe déjà pour', aujourdhui); sortie('nouveau', 'non'); process.exit(0); }

// ---- clé ----
const s = TEST ? { test: true } : await store('secret').get('gemini', { type: 'json' });
if (!s) { console.log('Pas de clé Gemini branchée dans l\'espace marchand : rien à faire.'); sortie('nouveau', 'non'); process.exit(0); }
const CLE = TEST ? process.env.GEMINI_CLE_TEST : privateDecrypt({ key: process.env.GEMINI_CLE_PRIVEE, padding: constants.RSA_PKCS1_OAEP_PADDING, oaepHash: 'sha256' }, Buffer.from(s.rsa, 'base64')).toString('utf8');

// ---- consigne ----
const RUBRIQUES = [...new Set([...PRODUITS.map(p => p.rayon), 'Idées cadeaux', 'Conseils'])];
const catalogue = PRODUITS.map(p => `- ${p.id} | ${p.nom} | ${p.rayon} | ${p.prix.toFixed(2)} €${p.age ? ' | ' + p.age : ''} | ${p.desc}`).join('\n');
const deja = existants.map(a => `- ${a.titre}`).join('\n') || '(aucun)';
const moisFr = new Date().toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' });
const consigne = `Tu es la rédactrice du blog de « Magique Boutique », petite boutique en ligne française de produits sous licence (Disney, Stitch, Pokémon, KPop Demon Hunters, Marvel…) : jouets, vêtements enfant, déco de chambre, accessoires pour chiens et chats.

Nous sommes le ${moisFr}. Écris UN nouvel article de blog en français, utile pour des parents (ou des maîtres d'animaux) qui cherchent sur Google : un guide pratique, des conseils concrets, des idées, des réponses à de vraies questions. Tiens compte de la saison (fêtes, rentrée, été…).

RÈGLES STRICTES :
- Français impeccable, AVEC tous les accents (é, è, à, ç, ê…). Ton chaleureux, clair, vouvoiement.
- Contenu informatif d'abord, PAS un texte publicitaire : pas de « achetez », pas de superlatifs creux, pas de promotion de prix. Les produits apparaissent comme des exemples concrets au fil des conseils.
- N'invente AUCUNE caractéristique de produit : n'utilise que ce qui est écrit dans le catalogue ci-dessous. N'invente ni statistique, ni étude, ni avis client, ni promotion, ni délai de livraison.
- Choisis un sujet DIFFÉRENT des articles déjà publiés (liste plus bas) et qui permet de citer 2 à 4 produits du catalogue.
- Corps de l'article : 700 à 1100 mots, en HTML simple uniquement : <h2>, <h3>, <p>, <ul>, <li>, <strong>, <em>. Pas de <h1>, pas de lien, pas d'image, pas de style.
- Commence par un paragraphe d'introduction <p>, puis 4 à 6 sections <h2>. Termine par une section <h2> de conclusion courte.
- Après la section où tu cites des produits, ajoute sur une ligne à part le marqueur exact <!--produits:id1,id2--> avec les identifiants du catalogue cités (2 marqueurs au maximum dans l'article).
- Une ligne vide entre chaque bloc HTML.

Articles déjà publiés (ne pas refaire) :
${deja}

Catalogue (identifiant | nom | rayon | prix | âge | description) :
${catalogue}

Réponds UNIQUEMENT avec un objet JSON :
{"titre": "titre accrocheur et précis, 50 à 75 caractères, qui reprend la question que se posent les gens",
 "chapo": "une à deux phrases d'accroche (180 caractères max)",
 "description": "méta-description Google, 140 à 160 caractères",
 "rubrique": "une valeur parmi : ${RUBRIQUES.join(', ')}",
 "produits": ["2 à 4 identifiants du catalogue cités"],
 "corps": "le HTML de l'article"}`;

// ---- contrôles ----
function controler(a) {
  const pb = [];
  for (const k of ['titre', 'chapo', 'description', 'rubrique', 'corps']) if (typeof a[k] !== 'string' || !a[k].trim()) pb.push('champ ' + k + ' manquant');
  if (pb.length) return pb;
  const ids = new Set(PRODUITS.map(p => p.id));
  a.produits = (Array.isArray(a.produits) ? a.produits : []).filter(id => ids.has(id));
  if (a.produits.length < 1) pb.push('aucun produit réel cité');
  const mots = a.corps.replace(/<[^>]+>/g, ' ').split(/\s+/).filter(Boolean).length;
  if (mots < 550 || mots > 1500) pb.push(`longueur ${mots} mots`);
  const texte = a.titre + ' ' + a.corps.replace(/<[^>]+>/g, ' ');
  if ((texte.match(/[éèàêçù]/g) || []).length < mots / 25) pb.push('accents manquants');
  const balises = [...a.corps.matchAll(/<\/?([a-z0-9]+)[^>]*>/gi)].map(m => m[1].toLowerCase());
  const interdites = balises.filter(b => !['h2', 'h3', 'p', 'ul', 'ol', 'li', 'strong', 'em', 'b', 'i', 'br'].includes(b));
  if (interdites.length) pb.push('balises interdites : ' + [...new Set(interdites)].join(','));
  if ((a.corps.match(/<h2/g) || []).length < 3) pb.push('moins de 3 sections');
  if (/<[^>]+\s(on\w+|style|href|src)=/i.test(a.corps)) pb.push('attributs interdits');
  const deja = new Set(existants.map(x => slugifier(x.titre || '')));
  if (deja.has(slugifier(a.titre))) pb.push('titre déjà publié');
  return pb;
}
function nettoyer(a) {
  // marqueurs produits : ne garder que les identifiants réels
  const ids = new Set(PRODUITS.map(p => p.id));
  a.corps = a.corps.replace(/<!--\s*produits\s*:\s*([^>]*?)\s*-->/g, (_, l) => {
    const ok = l.split(',').map(x => x.trim()).filter(x => ids.has(x));
    return ok.length ? `<!--produits:${ok.join(',')}-->` : '';
  });
  if (!/<!--produits:/.test(a.corps)) a.corps += `\n<!--produits:${a.produits.slice(0, 3).join(',')}-->`;
  if (!RUBRIQUES.includes(a.rubrique)) a.rubrique = 'Conseils';
  a.titre = a.titre.trim(); a.chapo = a.chapo.trim(); a.description = a.description.trim().slice(0, 165);
  return a;
}

async function appeler(modele, texte) {
  const corpsReq = { contents: [{ role: 'user', parts: [{ text: texte }] }],
    generationConfig: { temperature: 0.8, maxOutputTokens: 8192, responseMimeType: 'application/json' } };
  if (modele.startsWith('gemini-2.5')) corpsReq.generationConfig.thinkingConfig = { thinkingBudget: 0 };
  const ctrl = new AbortController(), t = setTimeout(() => ctrl.abort(), 120000);
  try {
    const r = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${modele}:generateContent`, {
      method: 'POST', signal: ctrl.signal, headers: { 'Content-Type': 'application/json', 'x-goog-api-key': CLE }, body: JSON.stringify(corpsReq) });
    const j = await r.json().catch(() => ({}));
    if (!r.ok) { const e = new Error(`${modele} HTTP ${r.status} ${j.error?.status || ''} ${(j.error?.details || []).map(d => d.reason || '').join(' ')}`.trim()); e.status = r.status;
      e.cle = r.status === 403 || /API_KEY/.test(JSON.stringify(j.error || ''));
      e.journalier = JSON.stringify(j.error?.details || '').includes('PerDay'); throw e; }
    const txt = (j.candidates?.[0]?.content?.parts || []).map(p => p.text || '').join('');
    if (!txt) throw new Error(`${modele} réponse vide (${j.candidates?.[0]?.finishReason || '?'})`);
    return JSON.parse(txt.replace(/^```(?:json)?\s*|\s*```$/g, ''));
  } finally { clearTimeout(t); }
}

let article = null, erreurs = [], cleRefusee = false;
for (const modele of MODELES) {
  if (cleRefusee) break;
  let retour = '';
  for (let essai = 1; essai <= 2 && !article; essai++) {
    try {
      const a = await appeler(modele, consigne + retour);
      const pb = controler(a);
      if (pb.length) { erreurs.push(`${modele} : ${pb.join(', ')}`); retour = `\n\nATTENTION, ta réponse précédente a été refusée : ${pb.join(', ')}. Corrige ces points.`; continue; }
      article = nettoyer(a); console.log('Article écrit par', modele);
    } catch (e) {
      erreurs.push(e.message);
      if (e.cle) { cleRefusee = true; break; }   // clé révoquée : inutile d'essayer les autres modèles
      if (e.status === 429 || e.status === 400 || e.status === 404) break; // quota ou modèle indisponible : modèle suivant
      await new Promise(r => setTimeout(r, 4000));
    }
  }
  if (article) break;
}
if (!article) {
  const msg = cleRefusee
    ?'Google refuse la clé Gemini (supprimée ou désactivée ?) : créez-en une nouvelle et collez-la à nouveau.'
    : 'Aucun article valable aujourd\'hui, nouvel essai demain.';
  console.error(erreurs.join('\n'));
  await noter({ erreur: msg });
  sortie('nouveau', 'non'); process.exit(1);
}

let slug = slugifier(article.titre); let n = 2;
while (existsSync(join(DOSSIER, slug + '.html'))) slug = slugifier(article.titre) + '-' + n++;
const image = PRODUITS.find(p => p.id === article.produits[0]).imgs[0];
const entete = { titre: article.titre, chapo: article.chapo, description: article.description, date: aujourdhui,
  rubrique: article.rubrique, image, produits: article.produits, auto: true };
writeFileSync(TEST || join(DOSSIER, slug + '.html'), `<!-- ${JSON.stringify(entete)} -->\n${article.corps.trim()}\n`);
await noter({ titre: article.titre, slug, date: aujourdhui, erreur: null });
console.log('Écrit : contenu/blog/' + slug + '.html');
sortie('nouveau', 'oui'); sortie('slug', slug);
