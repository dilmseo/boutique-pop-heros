"""Fabrique le logo et les favicons de Magique Boutique dans public/ :
logo-mark.svg (pastille seule), favicon.svg, favicon.ico, favicon-32.png, apple-touch-icon.png (180), icon-192.png, icon-512.png,
logo.png (pastille + nom, 1200x360, fond transparent), og-image.png (1200x630, partage réseaux sociaux), site.webmanifest.
Rendu des PNG par Chrome sans fenêtre (polices Google Fonts), réductions par PIL. Relancer : python scripts/logo.py"""
import json, math, subprocess, tempfile
from pathlib import Path
from PIL import Image

RACINE = Path(__file__).resolve().parent.parent
PUB = RACINE / "public"
CHROME = r"C:\Program Files\Google\Chrome\Application\chrome.exe"

def etoile(cx, cy, R, r, n=5):
    pts = []
    for k in range(2 * n):
        a = math.radians(-90 + k * 180 / n)
        rr = R if k % 2 == 0 else r
        pts.append(f"{cx + rr * math.cos(a):.2f},{cy + rr * math.sin(a):.2f}")
    return "M" + " L".join(pts) + " Z"

def paillette(cx, cy, s):
    return (f"M{cx},{cy - s} C{cx + s * .18},{cy - s * .18} {cx + s * .18},{cy - s * .18} {cx + s},{cy} "
            f"C{cx + s * .18},{cy + s * .18} {cx + s * .18},{cy + s * .18} {cx},{cy + s} "
            f"C{cx - s * .18},{cy + s * .18} {cx - s * .18},{cy + s * .18} {cx - s},{cy} "
            f"C{cx - s * .18},{cy - s * .18} {cx - s * .18},{cy - s * .18} {cx},{cy - s} Z")

MARK = f"""<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64" role="img" aria-label="Magique Boutique">
<defs>
<linearGradient id="mb-f" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#ff3ea5"/><stop offset=".55" stop-color="#8b5cf6"/><stop offset="1" stop-color="#3fb8ff"/></linearGradient>
<linearGradient id="mb-e" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#fff6b8"/><stop offset="1" stop-color="#ffb300"/></linearGradient>
<radialGradient id="mb-h" cx=".3" cy=".2" r=".9"><stop offset="0" stop-color="#fff" stop-opacity=".35"/><stop offset=".6" stop-color="#fff" stop-opacity="0"/></radialGradient>
</defs>
<rect width="64" height="64" rx="18" fill="url(#mb-f)"/>
<rect width="64" height="64" rx="18" fill="url(#mb-h)"/>
<path d="{etoile(31, 35, 21, 9.4)}" fill="url(#mb-e)" stroke="#fff" stroke-width="2.4" stroke-linejoin="round"/>
<circle cx="26.6" cy="34" r="2" fill="#3a1670"/><circle cx="35.4" cy="34" r="2" fill="#3a1670"/>
<path d="M27 38.6 Q31 42.2 35 38.6" fill="none" stroke="#3a1670" stroke-width="2" stroke-linecap="round"/>
<path d="{paillette(52, 13, 6.5)}" fill="#fff"/>
<path d="{paillette(12, 53, 4.2)}" fill="#fff" opacity=".9"/>
</svg>
"""

def rendre(html, largeur, hauteur, sortie):
    with tempfile.TemporaryDirectory() as d:
        f = Path(d) / "page.html"; f.write_text(html, encoding="utf-8")
        subprocess.run([CHROME, "--headless=new", "--disable-gpu", "--hide-scrollbars", "--default-background-color=00000000",
                        f"--window-size={largeur},{hauteur}", "--virtual-time-budget=4000", f"--screenshot={sortie}", f.as_uri()],
                       check=True, capture_output=True, timeout=60)

POLICE = '<link href="https://fonts.googleapis.com/css2?family=Fredoka:wght@600;700&family=Nunito:wght@700&display=block" rel="stylesheet">'
BASE = "<style>html,body{margin:0;background:transparent}</style>"

(PUB / "logo-mark.svg").write_text(MARK, encoding="utf-8")
(PUB / "favicon.svg").write_text(MARK, encoding="utf-8")

# pastille 512 -> réductions
p512 = PUB / "icon-512.png"
rendre(f"{BASE}<body>{MARK.replace('<svg ', '<svg width=512 height=512 ', 1)}</body>", 512, 512, p512)
im = Image.open(p512).convert("RGBA")
for taille, nom in [(192, "icon-192.png"), (180, "apple-touch-icon.png"), (32, "favicon-32.png")]:
    im.resize((taille, taille), Image.LANCZOS).save(PUB / nom)
im.save(PUB / "favicon.ico", sizes=[(16, 16), (32, 32), (48, 48)])

# logo complet (pastille + nom) fond transparent
rendre(f"""{POLICE}{BASE}<style>
body{{width:1200px;height:360px;display:flex;align-items:center;gap:40px;padding:0 60px;box-sizing:border-box;font-family:Fredoka}}
.t{{font-weight:700;font-size:118px;line-height:1;background:linear-gradient(90deg,#ffb300,#ff3ea5 40%,#8b5cf6 75%,#3fb8ff);
-webkit-background-clip:text;background-clip:text;color:transparent}}
.s{{font-family:Nunito;font-weight:700;font-size:34px;color:#8b5cf6;margin-top:10px;letter-spacing:.02em}}
</style><body>{MARK.replace('<svg ', '<svg width=240 height=240 ', 1)}<div><div class="t">Magique Boutique</div>
<div class="s">Jouets · déco · accessoires de vos héros</div></div></body>""", 1200, 360, PUB / "logo.png")

# image de partage
rendre(f"""{POLICE}<style>html,body{{margin:0}}
body{{width:1200px;height:630px;overflow:hidden;font-family:Fredoka;color:#f6f2ff;display:flex;align-items:center;gap:56px;padding:0 90px;box-sizing:border-box;
background:radial-gradient(circle at 85% 15%,rgba(255,62,165,.55),transparent 45%),radial-gradient(circle at 10% 95%,rgba(63,184,255,.45),transparent 45%),#140b2e}}
.t{{font-weight:700;font-size:96px;line-height:1;background:linear-gradient(90deg,#ffd23f,#ff7ac6,#c08bff,#3fb8ff);-webkit-background-clip:text;background-clip:text;color:transparent}}
.s{{font-family:Nunito;font-weight:700;font-size:38px;color:#c9bdf0;margin-top:22px;line-height:1.35}}
.b{{display:inline-block;margin-top:30px;font-family:Nunito;font-weight:700;font-size:28px;background:#ffd23f;color:#140b2e;padding:12px 26px;border-radius:999px}}
</style><body>{MARK.replace('<svg ', '<svg width=300 height=300 ', 1)}<div><div class="t">Magique<br>Boutique</div>
<div class="s">KPop Demon Hunters, Stitch,<br>Spider-Man, Disney…</div><span class="b">Livraison offerte dès 49 €</span></div></body>""", 1200, 630, PUB / "og-image.png")

(PUB / "site.webmanifest").write_text(json.dumps({
    "name": "Magique Boutique", "short_name": "Magique Boutique", "start_url": "/", "display": "standalone",
    "background_color": "#140b2e", "theme_color": "#140b2e",
    "icons": [{"src": "/icon-192.png", "sizes": "192x192", "type": "image/png"}, {"src": "/icon-512.png", "sizes": "512x512", "type": "image/png"}],
}, ensure_ascii=False, indent=1), encoding="utf-8")
for n in ["logo-mark.svg", "favicon.svg", "favicon.ico", "favicon-32.png", "apple-touch-icon.png", "icon-192.png", "icon-512.png", "logo.png", "og-image.png", "site.webmanifest"]:
    print(n, (PUB / n).stat().st_size, "o")
