// Ciel féerique animé de l'accueil : étoiles scintillantes, étoiles filantes, feux d'artifice (23/11)
(function () {
  var cv = document.getElementById('h3-feerie');
  if (!cv || !cv.getContext) return;
  if (window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  var ctx = cv.getContext('2d'), W = 0, H = 0, dpr = Math.min(window.devicePixelRatio || 1, 2);
  var etoiles = [], filantes = [], fusees = [], eclats = [], visible = true;
  var COULEURS = ['#ffd23f', '#ff7ac6', '#7fd6ff', '#c9a7ff', '#fff6c4', '#ff9f43', '#7dffb2'];

  function taille() {
    var r = cv.getBoundingClientRect();
    W = r.width; H = r.height;
    cv.width = Math.round(W * dpr); cv.height = Math.round(H * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    var n = Math.round(W * H / 5200);
    etoiles = [];
    for (var i = 0; i < n; i++) etoiles.push({ x: Math.random() * W, y: Math.random() * H * .72, r: Math.random() * 1.4 + .3,
      p: Math.random() * 6.28, v: Math.random() * 2 + .8 });
  }

  function fusee() {
    var x = W * (.15 + Math.random() * .8);
    fusees.push({ x: x, y: H, vx: (Math.random() - .5) * 1.2, vy: -(H * .011 + Math.random() * H * .004),
      cible: H * (.1 + Math.random() * .3), c: COULEURS[Math.random() * COULEURS.length | 0] });
  }

  function exploser(f) {
    var n = 60 + (Math.random() * 40 | 0), deux = Math.random() < .35 ? COULEURS[Math.random() * COULEURS.length | 0] : null;
    var forme = Math.random();
    for (var i = 0; i < n; i++) {
      var a = Math.PI * 2 * i / n, s = forme < .25 ? 3.2 : (Math.random() * 3 + 1);
      if (forme >= .25 && forme < .4) s = 3 * Math.abs(Math.sin(a * 2.5)) + .8; // fleur
      eclats.push({ x: f.x, y: f.y, vx: Math.cos(a) * s, vy: Math.sin(a) * s, vie: 1,
        d: .010 + Math.random() * .008, c: deux && i % 2 ? deux : f.c, scint: Math.random() < .4 });
    }
  }

  function filante() {
    filantes.push({ x: W * (.2 + Math.random() * .8), y: H * Math.random() * .3, l: 80 + Math.random() * 90,
      vx: -(6 + Math.random() * 4), vy: 2.5 + Math.random() * 2, vie: 1 });
  }

  var t0 = 0, prochaineFusee = 0, prochaineFilante = 1500;
  function boucle(t) {
    requestAnimationFrame(boucle);
    if (!visible) return;
    var dt = Math.min(t - t0, 50); t0 = t;
    ctx.clearRect(0, 0, W, H);

    // étoiles
    for (var i = 0; i < etoiles.length; i++) {
      var e = etoiles[i], a = .35 + .65 * Math.abs(Math.sin(e.p + t / 1000 * e.v));
      ctx.globalAlpha = a; ctx.fillStyle = '#fff';
      ctx.beginPath(); ctx.arc(e.x, e.y, e.r, 0, 6.283); ctx.fill();
      if (e.r > 1.45 && a > .9) { ctx.fillRect(e.x - 4, e.y - .4, 8, .8); ctx.fillRect(e.x - .4, e.y - 4, .8, 8); }
    }

    // étoiles filantes
    prochaineFilante -= dt;
    if (prochaineFilante <= 0) { filante(); prochaineFilante = 2500 + Math.random() * 3500; }
    for (i = filantes.length - 1; i >= 0; i--) {
      var s = filantes[i]; s.x += s.vx; s.y += s.vy; s.vie -= .012;
      var qx = s.x - s.vx * s.l / 9, qy = s.y - s.vy * s.l / 9, g = ctx.createLinearGradient(s.x, s.y, qx, qy);
      ctx.globalAlpha = Math.max(s.vie, 0);
      g.addColorStop(0, 'rgba(255,255,255,1)'); g.addColorStop(1, 'rgba(255,255,255,0)');
      ctx.strokeStyle = g; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(s.x, s.y);
      ctx.lineTo(qx, qy); ctx.stroke();
      if (s.vie <= 0 || s.x < -200) filantes.splice(i, 1);
    }

    // fusées
    prochaineFusee -= dt;
    if (prochaineFusee <= 0) { fusee(); if (Math.random() < .3) fusee(); prochaineFusee = 700 + Math.random() * 1300; }
    ctx.globalCompositeOperation = 'lighter';
    for (i = fusees.length - 1; i >= 0; i--) {
      var f = fusees[i]; f.x += f.vx; f.y += f.vy; f.vy *= .985;
      ctx.globalAlpha = .9; ctx.fillStyle = f.c;
      ctx.beginPath(); ctx.arc(f.x, f.y, 2, 0, 6.283); ctx.fill();
      ctx.globalAlpha = .35; ctx.fillRect(f.x - 1, f.y, 2, 14);
      if (f.y <= f.cible || f.vy > -1) { exploser(f); fusees.splice(i, 1); }
    }
    // éclats
    for (i = eclats.length - 1; i >= 0; i--) {
      var p = eclats[i]; p.x += p.vx; p.y += p.vy; p.vx *= .975; p.vy = p.vy * .975 + .035; p.vie -= p.d;
      if (p.vie <= 0) { eclats.splice(i, 1); continue; }
      ctx.globalAlpha = p.scint ? p.vie * (Math.random() * .6 + .4) : p.vie;
      ctx.fillStyle = p.c; ctx.beginPath(); ctx.arc(p.x, p.y, 1.8, 0, 6.283); ctx.fill();
    }
    ctx.globalCompositeOperation = 'source-over'; ctx.globalAlpha = 1;
  }

  taille();
  window.addEventListener('resize', taille);
  if ('IntersectionObserver' in window) new IntersectionObserver(function (en) { visible = en[0].isIntersecting; }).observe(cv);
  document.addEventListener('visibilitychange', function () { visible = !document.hidden; });
  requestAnimationFrame(boucle);
})();
