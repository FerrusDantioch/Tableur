// Outils communs aux tests dans un vrai navigateur (Chromium, piloté par Playwright).
// Ces tests démarrent le serveur local (outils/serveur.mjs) sur un port libre.

import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';

const RACINE = fileURLToPath(new URL('../..', import.meta.url));

/**
 * Démarre le serveur local et renvoie son adresse et une fonction pour l'arrêter.
 * (PORT=0 : l'ordinateur choisit lui-même un port libre, jamais déjà occupé.)
 */
export async function demarrerServeur() {
  const processus = spawn(process.execPath, ['outils/serveur.mjs'], {
    cwd: RACINE,
    env: { ...process.env, PORT: '0' },
    stdio: ['ignore', 'pipe', 'inherit'],
  });
  const url = await new Promise((resoudre, rejeter) => {
    processus.stdout.on('data', (morceau) => {
      const adresse = /disponible sur (\S+)/.exec(String(morceau));
      if (adresse) resoudre(adresse[1]);
    });
    processus.on('exit', (code) => rejeter(new Error(`Serveur arrêté (code ${code})`)));
  });
  return { url, arreter: () => processus.kill() };
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
  await page.waitForFunction(() => window.omniTableur !== undefined);
  return { contexte, page };
}

/**
 * Texte affiché dans une cellule (ex. "B3"). La grille ne dessine que les
 * lignes visibles : on fait donc d'abord défiler jusqu'à la cellule.
 */
export function texteCellule(page, adresse) {
  return page.evaluate((adr) => {
    const { ligne, colonne } = (() => {
      const m = /^([A-Z]+)(\d+)$/.exec(adr);
      let c = 0;
      for (const l of m[1]) c = c * 26 + l.charCodeAt(0) - 64;
      return { ligne: Number(m[2]), colonne: c };
    })();
    window.omniTableur.grille.rendreVisible(ligne, colonne);
    return window.omniTableur.grille.td(ligne, colonne).textContent;
  }, adresse);
}

/** Adresse de la cellule active (ex. "A1"). */
export function celluleActive(page) {
  return page.evaluate(() => {
    const { ligne, colonne } = window.omniTableur.selection.active;
    return window.omniTableur.adresse(ligne, colonne);
  });
}

/**
 * Clique (ou appuie au doigt) sur un bouton de la barre d'outils, après avoir
 * ouvert l'onglet qui le contient (Édition, Mise en forme, Bordures, Données).
 */
export async function cliquerOutil(page, selecteur, { doigt = false } = {}) {
  const groupe = await page.evaluate((s) => document.querySelector(s)?.closest('[role="tabpanel"]')?.id.replace('groupe-', ''), selecteur);
  if (groupe) {
    const ouvert = await page.evaluate(
      (g) => !document.getElementById(`groupe-${g}`).hidden,
      groupe,
    );
    if (!ouvert) {
      if (doigt) await page.tap(`.onglet-outils[data-groupe="${groupe}"]`);
      else await page.click(`.onglet-outils[data-groupe="${groupe}"]`);
    }
  }
  if (doigt) await page.tap(selecteur);
  else await page.click(selecteur);
}
