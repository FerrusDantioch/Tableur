// Accès à la bibliothèque de formules fast-formula-parser (licence MIT).
//
// Elle est chargée par index.html comme un script classique
// (vendor/fast-formula-parser/parser.min.js), qui crée la variable globale
// « FormulaParser ». Les tests automatiques la chargent de la même façon.

export function bibliothequeFormules() {
  const FormulaParser = globalThis.FormulaParser;
  if (!FormulaParser) {
    throw new Error('La bibliothèque de formules (vendor/fast-formula-parser/parser.min.js) n’est pas chargée.');
  }
  return FormulaParser;
}
