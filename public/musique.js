// Musique féerique douce, composée en direct (Web Audio) : aucun fichier, aucun droit d'auteur.
// Les navigateurs interdisent le son avant une action du visiteur : elle démarre au premier clic / toucher / touche.
// Bouton 🎵 dans l'en-tête pour couper ; le choix est mémorisé.
(function () {
  const btn = document.getElementById('btn-musique');
  const AC = window.AudioContext || window.webkitAudioContext;
  if (!btn || !AC) { if (btn) btn.hidden = true; return; }

  const lire = () => { try { return localStorage.getItem('musique-magique'); } catch (e) { return null; } };
  const ecrire = v => { try { localStorage.setItem('musique-magique', v); } catch (e) {} };

  let ctx = null, maitre = null, mesure = null, minuterie = 0, enCours = false, pas = 0, prochain = 0;
  const VOLUME = 0.9, TEMPO = 0.42; // secondes par note

  // Progression douce (Do maj7 – La m7 – Fa maj7 – Sol 6), arpèges de boîte à musique
  const ACCORDS = [
    [60, 64, 67, 71, 72, 76], [57, 60, 64, 67, 69, 72],
    [53, 57, 60, 64, 65, 69], [55, 59, 62, 64, 67, 71]];
  const MOTIF = [0, 2, 4, 5, 3, 1, 4, 2]; // ordre des notes dans l'accord
  const hz = m => 440 * Math.pow(2, (m - 69) / 12);

  function reverb() {
    const n = ctx.sampleRate * 3.2, b = ctx.createBuffer(2, n, ctx.sampleRate);
    for (let c = 0; c < 2; c++) { const d = b.getChannelData(c); for (let i = 0; i < n; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / n, 2.6); }
    const r = ctx.createConvolver(); r.buffer = b; return r;
  }

  function init() {
    ctx = new AC();
    maitre = ctx.createGain(); maitre.gain.value = 0;
    const sec = ctx.createGain(); sec.gain.value = 0.55;
    const humide = ctx.createGain(); humide.gain.value = 0.7;
    const r = reverb();
    const echo = ctx.createDelay(1); echo.delayTime.value = TEMPO * 1.5;
    const retour = ctx.createGain(); retour.gain.value = 0.32;
    const comp = ctx.createDynamicsCompressor(); comp.threshold.value = -18; comp.ratio.value = 4;
    mesure = ctx.createAnalyser(); mesure.fftSize = 2048;
    comp.connect(mesure).connect(ctx.destination);
    maitre.connect(sec).connect(comp);
    maitre.connect(r).connect(humide).connect(comp);
    maitre.connect(echo); echo.connect(retour).connect(echo); retour.connect(r);
  }

  // clochette : sinus + harmonique aiguë, attaque nette, longue extinction
  function clochette(t, f, v) {
    [[1, 1], [2.76, 0.18], [5.4, 0.05]].forEach(([k, a]) => {
      const o = ctx.createOscillator(), g = ctx.createGain();
      o.type = 'sine'; o.frequency.value = f * k;
      g.gain.setValueAtTime(0.0001, t);
      g.gain.exponentialRampToValueAtTime(v * a, t + 0.008);
      g.gain.exponentialRampToValueAtTime(0.0001, t + (k === 1 ? 2.6 : 0.9));
      o.connect(g).connect(maitre); o.start(t); o.stop(t + 2.7);
    });
  }
  // nappe : deux triangles légèrement désaccordés, très douce
  function nappe(t, notes, duree) {
    notes.slice(0, 3).forEach((m, i) => [-4, 4].forEach(cents => {
      const o = ctx.createOscillator(), g = ctx.createGain(), fl = ctx.createBiquadFilter();
      o.type = 'triangle'; o.frequency.value = hz(m - 12); o.detune.value = cents;
      fl.type = 'lowpass'; fl.frequency.value = 900;
      g.gain.setValueAtTime(0.0001, t);
      g.gain.linearRampToValueAtTime(0.07, t + 1.4);
      g.gain.linearRampToValueAtTime(0.0001, t + duree + 0.8);
      o.connect(fl).connect(g).connect(maitre); o.start(t); o.stop(t + duree + 1);
    }));
  }

  function planifier() {
    while (prochain < ctx.currentTime + 0.6) {
      const mesure = Math.floor(pas / 8), acc = ACCORDS[mesure % 4], i = pas % 8;
      if (i === 0) nappe(prochain, acc, TEMPO * 8);
      if (!(i === 7 && mesure % 2)) clochette(prochain, hz(acc[MOTIF[i]] + 12), i === 0 ? 0.42 : 0.28 + Math.random() * 0.08);
      if (Math.random() < 0.12) clochette(prochain + TEMPO / 2, hz(acc[MOTIF[(i + 3) % 8]] + 24), 0.1); // paillette
      prochain += TEMPO; pas++;
    }
  }

  // iPhone : sans ça, l'interrupteur « silencieux » coupe le Web Audio. Un <audio> muet en boucle + audioSession
  // fait passer Safari en mode « lecture média », comme une vidéo.
  let muet = null;
  function deverrouillerIOS() {
    try { if (navigator.audioSession) navigator.audioSession.type = 'playback'; } catch (e) {}
    if (!muet) {
      const n = 4000, b = new Uint8Array(44 + n), v = new DataView(b.buffer), s = (o, x) => [...x].forEach((c, i) => b[o + i] = c.charCodeAt(0));
      s(0, 'RIFF'); v.setUint32(4, 36 + n, true); s(8, 'WAVEfmt '); v.setUint32(16, 16, true); v.setUint16(20, 1, true); v.setUint16(22, 1, true);
      v.setUint32(24, 8000, true); v.setUint32(28, 8000, true); v.setUint16(32, 1, true); v.setUint16(34, 8, true); s(36, 'data'); v.setUint32(40, n, true);
      b.fill(128, 44);
      muet = new Audio(URL.createObjectURL(new Blob([b], { type: 'audio/wav' })));
      muet.loop = true; muet.setAttribute('playsinline', '');
    }
    const pr = muet.play(); if (pr && pr.catch) pr.catch(() => {});
  }

  function jouer() {
    if (!ctx) init();
    deverrouillerIOS();
    ctx.resume();
    if (!enCours) {
      enCours = true; prochain = ctx.currentTime + 0.1;
      maitre.gain.cancelScheduledValues(ctx.currentTime);
      maitre.gain.setValueAtTime(maitre.gain.value, ctx.currentTime);
      maitre.gain.linearRampToValueAtTime(VOLUME, ctx.currentTime + 3);
      planifier(); minuterie = setInterval(planifier, 200);
    }
    maj(true);
  }
  function couper() {
    if (ctx && enCours) {
      enCours = false; clearInterval(minuterie);
      maitre.gain.cancelScheduledValues(ctx.currentTime);
      maitre.gain.setValueAtTime(maitre.gain.value, ctx.currentTime);
      maitre.gain.linearRampToValueAtTime(0, ctx.currentTime + 0.6);
    }
    if (muet) muet.pause();
    maj(false);
  }
  function maj(on) {
    btn.classList.toggle('on', on);
    if (on) btn.classList.remove('attente');
    btn.setAttribute('aria-pressed', on);
    btn.setAttribute('aria-label', on ? 'Couper la musique' : 'Mettre la musique');
    btn.title = on ? 'Couper la musique' : 'Mettre la musique féerique';
  }

  btn.addEventListener('click', () => {
    if (enCours) { couper(); ecrire('off'); } else { jouer(); ecrire('on'); }
  });

  // démarrage au premier geste du visiteur (sauf s'il a coupé la musique auparavant)
  // on réessaie à chaque geste tant que le son n'est pas réellement lancé (Safari iOS n'accepte que touchend/click)
  const GESTES = ['pointerdown', 'touchend', 'click', 'keydown'];
  const premier = e => {
    if (e.target.closest && e.target.closest('#btn-musique')) return; // le bouton gère lui-même
    if (lire() === 'off') { GESTES.forEach(t => removeEventListener(t, premier, true)); return; }
    if (!enCours) jouer(); else { deverrouillerIOS(); ctx.resume(); }
    if (ctx && ctx.state === 'running') GESTES.forEach(t => removeEventListener(t, premier, true));
  };
  maj(false);
  if (lire() !== 'off') {
    btn.classList.add('attente');
    GESTES.forEach(t => addEventListener(t, premier, true));
    // visiteur qui avait laissé la musique : on tente de reprendre tout de suite (le navigateur l'autorise souvent après une 1re visite)
    if (lire() === 'on') {
      try {
        init();
        ctx.resume().then(() => { if (ctx.state === 'running') { GESTES.forEach(t => removeEventListener(t, premier, true)); jouer(); } });
      } catch (e) {}
    }
  }

  window.musiqueEtat = () => { let crete = 0; if (mesure) { const d = new Float32Array(mesure.fftSize); mesure.getFloatTimeDomainData(d); d.forEach(v => { if (Math.abs(v) > crete) crete = Math.abs(v); }); } return (ctx ? ctx.state : 'aucun') + (enCours ? ' · joue' : '') + ' · crête ' + crete.toFixed(2); };

  // silence quand l'onglet est caché
  document.addEventListener('visibilitychange', () => {
    if (!ctx || !enCours) return;
    if (document.hidden) { ctx.suspend(); if (muet) muet.pause(); } else { ctx.resume(); deverrouillerIOS(); }
  });
})();
