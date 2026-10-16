// Petit serveur web local pour essayer l'application sur son ordinateur.
//
// Utilisation (dans le dossier du projet) :   node outils/serveur.mjs
// puis ouvrir http://localhost:8000/Tableur/ dans le navigateur.
//
// L'application est servie dans le sous-dossier /Tableur/, exactement comme
// sur GitHub Pages (https://ferrusdantioch.github.io/Tableur/) : on vérifie
// ainsi que tous les chemins fonctionnent une fois publiée.
// Aucune bibliothèque n'est nécessaire, seulement Node.js.

import { createServer } from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import { extname, join, normalize, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const DOSSIER = fileURLToPath(new URL('..', import.meta.url));
const PREFIXE = '/Tableur/';
const PORT = Number(process.env.PORT) || 8000;

const TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.webmanifest': 'application/manifest+json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.webp': 'image/webp',
  '.ico': 'image/x-icon',
  '.woff2': 'font/woff2',
  '.txt': 'text/plain; charset=utf-8',
  '.md': 'text/plain; charset=utf-8',
};

const serveur = createServer(async (requete, reponse) => {
  const url = new URL(requete.url, 'http://localhost');
  if (url.pathname === '/' || url.pathname === '/Tableur') {
    reponse.writeHead(302, { Location: PREFIXE });
    reponse.end();
    return;
  }
  if (!url.pathname.startsWith(PREFIXE)) {
    reponse.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
    reponse.end('Introuvable. L’application est à l’adresse /Tableur/');
    return;
  }
  // Chemin du fichier demandé, sans jamais sortir du dossier du projet.
  const relatif = normalize(decodeURIComponent(url.pathname.slice(PREFIXE.length)) || 'index.html');
  let chemin = join(DOSSIER, relatif);
  if (!chemin.startsWith(DOSSIER) || relatif.split(sep).includes('..')) {
    reponse.writeHead(403);
    reponse.end();
    return;
  }
  try {
    if ((await stat(chemin)).isDirectory()) chemin = join(chemin, 'index.html');
    const contenu = await readFile(chemin);
    reponse.writeHead(200, {
      'Content-Type': TYPES[extname(chemin)] ?? 'application/octet-stream',
      // Pas de cache côté navigateur : on voit toujours la dernière modification.
      'Cache-Control': 'no-cache',
    });
    reponse.end(contenu);
  } catch {
    reponse.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
    reponse.end('Fichier introuvable.');
  }
});

serveur.listen(PORT, () => {
  console.log(`Application disponible sur http://localhost:${PORT}/Tableur/`);
  console.log('Pour arrêter : Ctrl+C');
});
