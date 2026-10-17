# Crée les icônes de l'application (dossier icons/) : un petit tableau violet
# sur fond sombre, aux couleurs de l'Omni-système.
#
# Utilisation (dans le dossier du projet) :   python3 outils/creer-icones.py
# Il faut Python 3 et la bibliothèque Pillow (pip install pillow).
#
# Les dessins sont faits 4 fois plus grands puis réduits : les bords sont
# ainsi bien lisses.

from pathlib import Path

from PIL import Image, ImageDraw

DOSSIER = Path(__file__).resolve().parent.parent / "icons"

NUIT = (20, 17, 29)  # #14111d, fond
TABLE = (29, 25, 41)  # #1d1929, surface
VIOLET = (167, 119, 255)  # #a777ff, violet du logo
HALO = (214, 194, 255)  # #d6c2ff
VIOLET_DOUX = (59, 46, 88)  # #3b2e58


def dessiner(taille, masquable=False):
    """Dessine l'icône. `masquable` : fond sur toute la surface et dessin
    plus petit, car Android découpe ces icônes en cercle ou en goutte."""
    echelle = 4
    grand = taille * echelle
    image = Image.new("RGBA", (grand, grand), (0, 0, 0, 0))
    d = ImageDraw.Draw(image)

    if masquable:
        d.rectangle([0, 0, grand, grand], fill=NUIT)
        marge = grand * 0.24
    else:
        d.rounded_rectangle([0, 0, grand - 1, grand - 1], radius=grand * 0.22, fill=NUIT)
        marge = grand * 0.17

    # Le tableau : 3 colonnes, 4 lignes (la première est l'en-tête).
    gauche, haut = marge, marge * 1.08
    droite, bas = grand - marge, grand - marge * 1.08
    trait = max(echelle, round(grand * 0.022))
    rayon = grand * 0.05
    d.rounded_rectangle([gauche, haut, droite, bas], radius=rayon, fill=TABLE)

    hauteur_ligne = (bas - haut) / 4
    largeur_colonne = (droite - gauche) / 3
    # En-tête coloré.
    d.rounded_rectangle([gauche, haut, droite, haut + hauteur_ligne], radius=rayon, fill=VIOLET_DOUX)
    d.rectangle([gauche, haut + hauteur_ligne - rayon, droite, haut + hauteur_ligne], fill=VIOLET_DOUX)
    # Cellule active, comme dans la grille de l'application.
    x0 = gauche + largeur_colonne
    y0 = haut + hauteur_ligne * 2
    d.rectangle([x0, y0, x0 + largeur_colonne, y0 + hauteur_ligne], fill=(58, 44, 94))

    # Quadrillage.
    for i in range(1, 4):
        y = haut + hauteur_ligne * i
        d.line([gauche, y, droite, y], fill=VIOLET, width=trait)
    for i in range(1, 3):
        x = gauche + largeur_colonne * i
        d.line([x, haut, x, bas], fill=VIOLET, width=trait)
    d.rounded_rectangle([gauche, haut, droite, bas], radius=rayon, outline=VIOLET, width=trait)
    # Cadre de la cellule active.
    d.rectangle([x0, y0, x0 + largeur_colonne, y0 + hauteur_ligne], outline=HALO, width=round(trait * 1.3))

    return image.resize((taille, taille), Image.LANCZOS)


def main():
    DOSSIER.mkdir(exist_ok=True)
    fichiers = {
        "favicon-32.png": dessiner(32),
        "apple-touch-icon.png": dessiner(180, masquable=True).convert("RGB"),
        "icone-192.png": dessiner(192),
        "icone-512.png": dessiner(512),
        "icone-masquable-192.png": dessiner(192, masquable=True),
        "icone-masquable-512.png": dessiner(512, masquable=True),
    }
    for nom, image in fichiers.items():
        image.save(DOSSIER / nom, optimize=True)
        print("créé :", DOSSIER / nom)


if __name__ == "__main__":
    main()
