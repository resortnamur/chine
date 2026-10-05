"""Génère photos/carte-groupe.svg et photos/carte-belgique.svg (fond Natural Earth 1:10m).
Données (≈ 3,6 Mo, non versionnées) : https://cdn.jsdelivr.net/npm/world-atlas@2/countries-10m.json
à déposer à côté de ce script. Lancer : python outils/cartes.py
Après modification d'une carte : passer son adresse à « photos/carte-xxx.svg?v=N » dans data.json
et recopier outils/points.json dans le champ « points » de la diapositive."""
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

# Les noms des lieux ne sont PAS écrits sur la carte (illisibles sur téléphone) : pastilles numérotées,
# la liste « numéro → nom » est affichée en texte HTML sous la carte (champ « points » de la diapositive).
COULEURS = {"resort": "#6e0b0b", "casino": "#c41a1a", "club": "#c98a00", "ville": "#555555"}
POINTS = {}

def pastille(x, y, n, type_, r=30):
    c = COULEURS[type_]
    if type_ == "club":
        forme = f'<polygon points="{x:.1f},{y - r * 1.25:.1f} {x + r * 1.25:.1f},{y:.1f} {x:.1f},{y + r * 1.25:.1f} {x - r * 1.25:.1f},{y:.1f}" fill="{c}" stroke="#fff" stroke-width="4"/>'
    elif type_ == "ville":
        forme = f'<rect x="{x - r:.1f}" y="{y - r:.1f}" width="{2 * r}" height="{2 * r}" rx="6" fill="{c}" stroke="#fff" stroke-width="4"/>'
    else:
        anneau = f'<circle cx="{x:.1f}" cy="{y:.1f}" r="{r + 7}" fill="#f2b705"/>' if type_ == "resort" else ""
        forme = anneau + f'<circle cx="{x:.1f}" cy="{y:.1f}" r="{r}" fill="{c}" stroke="#fff" stroke-width="4"/>'
    return forme + f'<text x="{x:.1f}" y="{y + r * 0.42:.1f}" font-size="{round(r * 1.25)}" font-weight="700" text-anchor="middle" fill="#fff">{n}</text>'

def nom_pays(P, lon, lat, t, taille, couleur="#8a7f76"):
    x, y = P(lon, lat)
    return f'<text x="{x:.0f}" y="{y:.0f}" font-size="{taille}" font-weight="700" text-anchor="middle" fill="{couleur}" letter-spacing="4">{t}</text>'

def salles(P, r, trait):
    return "".join(f'<circle cx="{P(lon, lat)[0]:.1f}" cy="{P(lon, lat)[1]:.1f}" r="{r}" fill="#e0701b" stroke="#fff" stroke-width="{trait}"/>' for lat, lon in SALLES)

# ---------- Carte 1 : le groupe (Belgique, France, Suisse) ----------
LIEUX_GROUPE = [  # n, type, lat, lon, zh, fr
    (1, "resort", 50.460, 4.860, "那慕尔度假村", "Namur — Resort"),
    (2, "casino", 50.492, 5.864, "斯帕", "Spa"),
    (3, "club", 48.857, 2.352, "巴黎俱乐部", "Paris — Club"),
    (4, "casino", 47.584, -3.078, "卡尔纳克", "Carnac"),
    (5, "casino", 43.948, -0.042, "巴尔博唐", "Barbotan"),
    (6, "casino", 42.850, 3.040, "勒卡特港", "Port-Leucate"),
    (7, "casino", 43.441, 3.678, "巴拉吕克", "Balaruc"),
    (8, "casino", 44.665, 4.366, "瓦尔莱班", "Vals-les-Bains"),
    (9, "casino", 45.394, 6.075, "阿勒瓦尔", "Allevard"),
    (10, "casino", 44.897, 6.635, "布里扬松", "Briançon"),
    (11, "casino", 46.311, 7.481, "克朗-蒙塔纳", "Crans-Montana"),
    (12, "casino", 46.802, 9.836, "达沃斯", "Davos"),
]
def contenu_groupe(P, W, H):
    s = [nom_pays(P, 2.0, 46.7, "法国", 76), nom_pays(P, 8.3, 47.25, "瑞士", 56), nom_pays(P, 3.0, 51.08, "比利时", 46),
         nom_pays(P, 9.6, 50.0, "德国", 52, "#aaa59e"), nom_pays(P, 9.3, 44.4, "意大利", 52, "#aaa59e"),
         nom_pays(P, -3.4, 45.2, "大西洋", 50, "#6d97b8"), nom_pays(P, 5.6, 42.5, "地中海", 50, "#6d97b8"), salles(P, 7, 2)]
    for n, t, lat, lon, zh, fr in LIEUX_GROUPE:
        x, y = P(lon, lat); s.append(pastille(x, y, n, t, 36 if t == "resort" else 30))
    POINTS["carte-groupe.svg"] = [{"n": n, "type": t, "zh": zh, "fr": fr} for n, t, _, _, zh, fr in LIEUX_GROUPE] +         [{"n": "•", "type": "salle", "zh": "30多家Circus游戏厅（比利时）", "fr": "30+ salles Circus (Belgique)"}]
    return s

carte("carte-groupe.svg", -5.0, 11.0, 42.2, 51.75, 1200, contenu_groupe, "Gaming1 · Circus — Belgique, France, Suisse")

# ---------- Carte 2 : Belgique ----------
LIEUX_BELGIQUE = [
    (1, "resort", 50.460, 4.860, "那慕尔度假村", "Namur — Resort"),
    (2, "casino", 50.492, 5.864, "斯帕娱乐场", "Spa — Casino"),
    (3, "ville", 50.6326, 5.5797, "列日 · 总部", "Liège (siège du groupe)"),
    (4, "ville", 50.8466, 4.3528, "布鲁塞尔 · 首都", "Bruxelles (capitale)"),
    (5, "ville", 51.2194, 4.4025, "安特卫普", "Anvers"),
]
def contenu_belgique(P, W, H):
    s = [nom_pays(P, 6.3, 50.95, "德国", 60, "#aaa59e"), nom_pays(P, 5.65, 51.36, "荷兰", 56, "#aaa59e"), nom_pays(P, 3.5, 49.75, "法国", 64, "#aaa59e"),
         nom_pays(P, 2.85, 51.42, "北海", 56, "#6d97b8"), nom_pays(P, 4.2, 50.15, "比利时", 72), salles(P, 13, 3)]
    for n, t, lat, lon, zh, fr in LIEUX_BELGIQUE:
        x, y = P(lon, lat); s.append(pastille(x, y, n, t, 44 if t == "resort" else 36))
    POINTS["carte-belgique.svg"] = [{"n": n, "type": t, "zh": zh, "fr": fr} for n, t, _, _, zh, fr in LIEUX_BELGIQUE] +         [{"n": "•", "type": "salle", "zh": "Circus游戏厅（27家）", "fr": "Salles Circus (27)"}]
    return s

carte("carte-belgique.svg", 2.45, 6.55, 49.42, 51.56, 1300, contenu_belgique, "Circus en Belgique")
json.dump(POINTS, open(os.path.join(ICI, "points.json"), "w", encoding="utf-8"), ensure_ascii=False, indent=1)
