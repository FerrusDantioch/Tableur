// Outils communs aux tests dans un vrai navigateur (Chromium, piloté par Playwright).
// Ces tests démarrent le serveur local (outils/serveur.mjs) sur un port libre.

import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';

const RACINE = fileURLToPath(new URL('../..', import.meta.url));

/** Démarre le serveur local et renvoie son adresse et une fonction pour l'arrêter. */
export async function demarrerServeur() {
  const port = 20000 + Math.floor(Math.random() * 20000);
  const processus = spawn(process.execPath, ['outils/serveur.mjs'], {
    cwd: RACINE,
    env: { ...process.env, PORT: String(port) },
    stdio: ['ignore', 'pipe', 'inherit'],
  });
  await new Promise((resoudre, rejeter) => {
    processus.stdout.on('data', (morceau) => {
      if (String(morceau).includes('disponible')) resoudre();
    });
    processus.on('exit', (code) => rejeter(new Error(`Serveur arrêté (code ${code})`)));
  });
  return { url: `http://localhost:${port}/Tableur/`, arreter: () => processus.kill() };
}

/** Lance Chromium (sans fenêtre). */
export async function lancerNavigateur() {
  const executablePath = process.env.CHROMIUM_PATH || undefined;
  return chromium.launch({ executablePath });
}

/**
 * Ouvre l'application dans une nouvelle page et attend qu'elle soit prête.
 * Les erreurs JavaScript de la page sont rassemblées dans `page.erreurs`.
 */
export async function ouvrirApplication(navigateur, url, options = {}) {
  const contexte = await navigateur.newContext({ locale: 'fr-FR', ...options });
  const page = await contexte.newPage();
  page.erreurs = [];
  page.on('pageerror', (erreur) => page.erreurs.push(erreur.message));
  page.on('console', (message) => {
    if (message.type() === 'error') page.erreurs.push(message.text());
  });
  await page.goto(url);
  await page.waitForFunction(() => window.tableur !== undefined);
  return { contexte, page };
}

/** Texte affiché dans une cellule (ex. "B3"). */
export function texteCellule(page, adresse) {
  return page.evaluate((adr) => {
    const { ligne, colonne } = (() => {
      const m = /^([A-Z]+)(\d+)$/.exec(adr);
      let c = 0;
      for (const l of m[1]) c = c * 26 + l.charCodeAt(0) - 64;
      return { ligne: Number(m[2]), colonne: c };
    })();
    return window.tableur.grille.td(ligne, colonne).textContent;
  }, adresse);
}

/** Adresse de la cellule active (ex. "A1"). */
export function celluleActive(page) {
  return page.evaluate(() => {
    const { ligne, colonne } = window.tableur.selection.active;
    return window.tableur.adresse(ligne, colonne);
  });
}
