(function () {
  const q = new URLSearchParams(location.search), $ = s => document.querySelector(s);
  const ecrire = (ico, titre, texte) => { $('#m-ico').textContent = ico; $('#m-titre').innerHTML = titre; $('#m-texte').textContent = texte; };
  if (q.get('paiement') === 'plus-tard')
    ecrire('📝', 'Commande <span class="neon">bien reçue</span>', "Le paiement en ligne n'a pas pu s'ouvrir, mais votre commande est enregistrée : nous vous recontactons pour le règlement.");
  const s = q.get('session_id');
  if (!s) return;
  ecrire('⏳', 'Vérification du <span class="neon">paiement…</span>', 'Un instant, nous confirmons votre paiement auprès de Stripe.');
  fetch('/api/paiement?session=' + encodeURIComponent(s)).then(r => r.json()).then(j => {
    if (j.paye) ecrire('🎉', 'Merci, paiement <span class="neon">confirmé !</span>',
      'Votre paiement de ' + j.montant.toFixed(2).replace('.', ',') + ' € est bien reçu. Vous allez recevoir un reçu par e-mail, et nous préparons votre colis.');
    else ecrire('📝', 'Commande <span class="neon">enregistrée</span>', "Votre paiement n'est pas encore confirmé. Si vous avez été débité, pas d'inquiétude : nous vérifions et revenons vers vous.");
  }).catch(() => ecrire('📝', 'Commande <span class="neon">enregistrée</span>', 'Nous vérifions votre paiement et revenons vers vous très vite.'));
})();
