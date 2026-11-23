// Clé Gemini du marchand : chiffrée RSA-OAEP avec la clé publique (le serveur Netlify ne peut PAS la relire).
// Seul le robot GitHub Actions « blog-du-jour » détient la clé privée et la déchiffre pour écrire l'article quotidien.
import { getStore } from '@netlify/blobs';
import { publicEncrypt, constants } from 'node:crypto';
import { PEM } from './gemini-publique.mjs';

export async function verifierCleGemini(cle) {
  const r = await fetch('https://generativelanguage.googleapis.com/v1beta/models?pageSize=1&key=' + encodeURIComponent(cle));
  if (r.ok) return true;
  const e = new Error('Gemini ' + r.status); e.status = r.status; throw e;
}
export async function ecrireCleGemini(cle) {
  const data = publicEncrypt({ key: PEM, padding: constants.RSA_PKCS1_OAEP_PADDING, oaepHash: 'sha256' }, Buffer.from(cle, 'utf8'));
  await getStore('secret').setJSON('gemini', { rsa: data.toString('base64') });
  const info = { actif: true, date: new Date().toISOString(), fin: cle.slice(-4) };
  await getStore('reglages').setJSON('gemini', info);
  return info;
}
export async function retirerCleGemini() {
  await getStore('secret').delete('gemini');
  await getStore('reglages').setJSON('gemini', { actif: false });
}
export async function infoGemini() {
  const g = getStore('reglages');
  return { ...((await g.get('gemini', { type: 'json' })) || { actif: false }), blog: (await g.get('blog', { type: 'json' })) || null };
}
