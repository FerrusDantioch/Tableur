// Outils communs aux exports : nom de fichier propre et téléchargement.

/** Transforme le titre du classeur en nom de fichier valable partout. */
export function nomDeFichier(titre) {
  const propre = String(titre ?? '')
    .replace(/[\\/:*?"<>|\u0000-\u001f]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 120);
  return propre || 'Sans titre';
}

/** Fait télécharger un fichier créé dans le navigateur (aucun serveur). */
export function telecharger(nom, contenu, type) {
  const lien = document.createElement('a');
  lien.href = URL.createObjectURL(new Blob([contenu], { type }));
  lien.download = nom;
  lien.hidden = true;
  document.body.append(lien);
  lien.click();
  lien.remove();
  // Le fichier est libéré un peu plus tard, une fois le téléchargement lancé.
  setTimeout(() => URL.revokeObjectURL(lien.href), 60_000);
}
