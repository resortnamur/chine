"""Génère photos/carte-groupe.svg et photos/carte-belgique.svg (fond Natural Earth 1:10m).
Données (≈ 3,6 Mo, non versionnées) : https://cdn.jsdelivr.net/npm/world-atlas@2/countries-10m.json
à déposer à côté de ce script. Lancer : python outils/cartes.py
Après modification d'une carte : passer son adresse à « photos/carte-xxx.svg?v=N » dans data.json."""
import json, math, os

ICI = os.path.dirname(os.path.abspath(__file__))
SORTIE = os.path.join(ICI, "..", "photos")
topo = json.load(open(os.path.join(ICI, "countries-10m.json"), encoding="utf-8"))
sx, sy = topo["transform"]["scale"]; tx, ty = topo["transform"]["translate"]

arcs = []
for arc in topo["arcs"]:
    x = y = 0; pts = []
    for dx, dy in arc:
        x += dx; y += dy
        pts.append((x * sx + tx, y * sy + ty))
    arcs.append(pts)

def anneau(idx):
    pts = []
    for i in idx:
        a = arcs[i] if i >= 0 else arcs[~i][::-1]
        pts.extend(a if not pts else a[1:])
    return pts

pays = {}
for g in topo["objects"]["countries"]["geometries"]:
    polys = g["arcs"] if g["type"] == "MultiPolygon" else [g["arcs"]] if g["type"] == "Polygon" else []
    pays[g.get("id")] = [[anneau(r) for r in p] for p in polys]

GROUPE = {"056", "250", "756"}  # Belgique, France, Suisse
VOISINS = ["276", "528", "442", "380", "724", "826", "040", "438", "020", "492", "372", "208", "203", "705", "191", "470", "674"]

def carte(nom, lon0, lon1, lat0, lat1, largeur, contenu, titre):
    k = math.cos(math.radians((lat0 + lat1) / 2))
    hauteur = round(largeur * (lat1 - lat0) / ((lon1 - lon0) * k))
    def P(lon, lat):
        return ((lon - lon0) / (lon1 - lon0) * largeur, (lat1 - lat) / (lat1 - lat0) * hauteur)
    def chemin(ids):
        d = []
        for i in ids:
            for poly in pays.get(i, []):
                for r in poly:
                    xs = [P(*p) for p in r]
                    if max(x for x, _ in xs) < -50 or min(x for x, _ in xs) > largeur + 50 or \
                       max(y for _, y in xs) < -50 or min(y for _, y in xs) > hauteur + 50:
                        continue
                    out = [xs[0]]
                    for p in xs[1:]:
                        if abs(p[0] - out[-1][0]) + abs(p[1] - out[-1][1]) > 1.3: out.append(p)
                    if len(out) < 3: continue
                    d.append("M" + "L".join(f"{x:.1f},{y:.1f}" for x, y in out) + "Z")
        return "".join(d)
    svg = [f'<svg xmlns="http://www.w3.org/2000/svg" width="{largeur}" height="{hauteur}" viewBox="0 0 {largeur} {hauteur}" font-family="sans-serif">',
           f'<title>{titre}</title>',
           '<style>.h{paint-order:stroke;stroke:#fff;stroke-width:6px;stroke-linejoin:round}.pays{fill:#9a8f86;font-weight:700;letter-spacing:2px}.mer{fill:#5d8fb3;font-style:italic}</style>',
           f'<rect width="{largeur}" height="{hauteur}" fill="#cfe3f1"/>',
           f'<path d="{chemin(VOISINS)}" fill="#ecebe7" stroke="#b9b5ae" stroke-width="1.2"/>',
           f'<path d="{chemin(sorted(GROUPE))}" fill="#fff6e8" stroke="#a11212" stroke-width="2.2"/>']
    svg += contenu(P, largeur, hauteur)
    svg.append("</svg>")
    open(os.path.join(SORTIE, nom), "w", encoding="utf-8", newline="\n").write("\n".join(svg))
    print(nom, largeur, "x", hauteur, os.path.getsize(os.path.join(SORTIE, nom)) // 1024, "Ko")

def texte(x, y, t, taille, ancre="start", cls="h", gras=True, couleur="#222"):
    return f'<text x="{x:.0f}" y="{y:.0f}" font-size="{taille}" text-anchor="{ancre}" class="{cls}" fill="{couleur}"{" font-weight=\"700\"" if gras else ""}>{t}</text>'

def etoile(x, y, r, couleur="#a11212"):
    pts = []
    for i in range(10):
        a = math.pi / 2 + i * math.pi / 5
        rr = r if i % 2 == 0 else r * 0.45
        pts.append(f"{x + rr * math.cos(a):.1f},{y - rr * math.sin(a):.1f}")
    return f'<polygon points="{" ".join(pts)}" fill="{couleur}" stroke="#fff" stroke-width="3"/>'

def rond(x, y, r, couleur="#a11212"):
    return f'<circle cx="{x:.1f}" cy="{y:.1f}" r="{r}" fill="{couleur}" stroke="#fff" stroke-width="3"/>'

def losange(x, y, r, couleur="#d79a00"):
    return f'<polygon points="{x:.1f},{y - r:.1f} {x + r:.1f},{y:.1f} {x:.1f},{y + r:.1f} {x - r:.1f},{y:.1f}" fill="{couleur}" stroke="#fff" stroke-width="3"/>'

SALLES = [(50.592026, 5.849207), (50.6711765, 5.5495454), (50.4037431, 3.6755447), (50.7184837, 3.332707), (51.1695814, 5.1061208),
          (50.786963, 3.1264612), (50.2365531, 5.3006002), (50.6356059, 5.5797473), (51.1511564, 4.5286644), (50.708618164062, 2.882999420166),
          (50.9581899, 4.8384627), (50.6556961, 5.6174074), (50.350551605225, 3.9680948257446), (50.62554, 5.567187), (51.1665293, 4.7155286),
          (50.4751758, 4.4421649), (50.4891427, 4.5617272), (50.727747, 3.3299463), (49.963164, 4.532085), (50.7664947, 3.0039334),
          (50.4675927, 4.268752), (50.686943267282, 4.4050463231539), (50.8474921, 4.8209039), (50.5632731, 5.5486348),
          (49.5489311, 5.8124628), (49.653655, 5.819157), (51.2187395, 4.4198051)]

# ---------- Carte 1 : le groupe (Belgique, France, Suisse) ----------
F = 40  # taille des étiquettes (viewBox ≈ 1200 px de large, affiché ≈ 375-800 px sur téléphone)
CASINOS_FR = [  # (lat, lon, zh, latin, dx, dy, ancre)
    (45.394, 6.075, "阿勒瓦尔", "Allevard", -20, -8, "end"),
    (43.441, 3.678, "巴拉吕克", "Balaruc", 20, 4, "start"),
    (43.948, -0.042, "巴尔博唐", "Barbotan", 20, 14, "start"),
    (44.897, 6.635, "布里扬松", "Briançon", 0, 58, "middle"),
    (47.584, -3.078, "卡尔纳克", "Carnac", 6, 56, "middle"),
    (42.850, 3.040, "勒卡特港", "Leucate", 20, 26, "start"),
    (44.665, 4.366, "瓦尔莱班", "Vals", -20, 14, "end"),
]
def contenu_groupe(P, W, H):
    s = []
    for lon, lat, t, cls, ta in [(1.6, 46.4, "法国 FRANCE", "pays", 48), (7.75, 47.0, "瑞士", "pays", 38), (9.7, 50.3, "德国", "pays", 38),
                                 (-3.0, 45.6, "大西洋", "mer", 38), (5.3, 42.35, "地中海", "mer", 38), (9.4, 44.6, "意大利", "pays", 38)]:
        x, y = P(lon, lat); s.append(texte(x, y, t, ta, "middle", "h " + cls, False))
    for lat, lon in SALLES:
        x, y = P(lon, lat); s.append(f'<circle cx="{x:.1f}" cy="{y:.1f}" r="6" fill="#e0701b" stroke="#fff" stroke-width="2"/>')
    for lat, lon, zh, lat_, dx, dy, a in CASINOS_FR:
        x, y = P(lon, lat); s.append(rond(x, y, 14))
        s.append(texte(x + dx, y + dy, f"{zh} {lat_}", F, a))
    x, y = P(2.3522, 48.8566); s.append(losange(x, y, 19)); s.append(texte(x + 26, y + 14, "巴黎 Paris", F))
    for lat, lon, zh, la, dx, dy, a in [(46.311, 7.481, "克朗-蒙塔纳", "Crans-Montana", -6, 56, "middle"), (46.802, 9.836, "达沃斯", "Davos", 10, -28, "end")]:
        x, y = P(lon, lat); s.append(rond(x, y, 14)); s.append(texte(x + dx, y + dy, f"{zh} {la}", F, a))
    x, y = P(4.86, 50.46); s.append(etoile(x, y, 26)); s.append(texte(x - 32, y + 14, "那慕尔 Namur", F + 4, "end"))
    x, y = P(5.864, 50.492); s.append(rond(x, y, 14)); s.append(texte(x + 22, y + 14, "斯帕 Spa", F))
    x, y = P(4.5, 51.35); s.append(texte(x, y - 20, "比利时 BELGIQUE", 38, "middle", "h pays", False))
    # Légende en bas à gauche (océan et Espagne : aucun établissement)
    lx, ly = 30, H - 196; L = 34
    s.append(f'<rect x="{lx - 14}" y="{ly - 46}" width="330" height="236" rx="16" fill="#fff" fill-opacity=".94" stroke="#bbb"/>')
    s.append(etoile(lx + 18, ly - 10, 20)); s.append(texte(lx + 50, ly, "度假村 Resort", L, gras=False))
    s.append(rond(lx + 18, ly + 46, 13)); s.append(texte(lx + 50, ly + 58, "娱乐场 Casino", L, gras=False))
    s.append(losange(lx + 18, ly + 102, 17)); s.append(texte(lx + 50, ly + 114, "俱乐部 Club", L, gras=False))
    s.append(f'<circle cx="{lx + 18}" cy="{ly + 158}" r="8" fill="#e0701b" stroke="#fff" stroke-width="2"/>')
    s.append(texte(lx + 50, ly + 170, "游戏厅 Salles", L, gras=False))
    return s

carte("carte-groupe.svg", -5.3, 11.2, 41.9, 51.75, 1200, contenu_groupe, "Gaming1 · Circus — Belgique, France, Suisse")

# ---------- Carte 2 : Belgique ----------
def contenu_belgique(P, W, H):
    s = []
    for lon, lat, t, cls, ta in [(6.4, 50.9, "德国", "pays", 40), (4.75, 51.47, "荷兰", "pays", 40), (3.6, 49.7, "法国 France", "pays", 42),
                                 (6.2, 49.62, "卢森堡", "pays", 34), (2.85, 51.42, "北海", "mer", 40)]:
        x, y = P(lon, lat); s.append(texte(x, y, t, ta, "middle", "h " + cls, False))
    for lat, lon in SALLES:
        x, y = P(lon, lat); s.append(f'<circle cx="{x:.1f}" cy="{y:.1f}" r="12" fill="#e0701b" stroke="#fff" stroke-width="3"/>')
    for lat, lon, t, dx, dy, a in [(50.8466, 4.3528, "布鲁塞尔 Bruxelles", 0, -24, "middle"), (51.2194, 4.4025, "安特卫普 Anvers", 0, -26, "middle"),
                                   (50.6326, 5.5797, "列日 Liège（总部 HQ）", -10, -30, "middle")]:
        x, y = P(lon, lat)
        s.append(f'<rect x="{x - 9:.1f}" y="{y - 9:.1f}" width="18" height="18" fill="#555" stroke="#fff" stroke-width="2.5"/>')
        s.append(texte(x + dx, y + dy, t, 40, a, couleur="#333"))
    x, y = P(4.86, 50.46); s.append(etoile(x, y, 36)); s.append(texte(x, y + 76, "那慕尔 Namur", 48, "middle"))
    x, y = P(5.864, 50.492); s.append(rond(x, y, 19)); s.append(texte(x + 28, y + 14, "斯帕 Spa", 44))
    lx, ly = W - 470, 64; L = 34
    s.append(f'<rect x="{lx - 16}" y="{ly - 48}" width="474" height="236" rx="16" fill="#fff" fill-opacity=".94" stroke="#bbb"/>')
    s.append(etoile(lx + 18, ly - 10, 20)); s.append(texte(lx + 50, ly, "度假村 Resort", L, gras=False))
    s.append(rond(lx + 18, ly + 46, 14)); s.append(texte(lx + 50, ly + 58, "娱乐场 Casino", L, gras=False))
    s.append(f'<circle cx="{lx + 18}" cy="{ly + 102}" r="12" fill="#e0701b" stroke="#fff" stroke-width="3"/>')
    s.append(texte(lx + 50, ly + 114, "Circus游戏厅 Salles", L, gras=False))
    s.append(f'<rect x="{lx + 9}" y="{ly + 149}" width="18" height="18" fill="#555"/>'); s.append(texte(lx + 50, ly + 170, "城市 Ville", L, gras=False))
    return s

carte("carte-belgique.svg", 2.45, 6.55, 49.42, 51.56, 1300, contenu_belgique, "Circus en Belgique")
