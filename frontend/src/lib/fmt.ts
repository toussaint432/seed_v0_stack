/**
 * Règle d'affichage des quantités — Sen Jiwu
 *
 * Graphiques (axes, légendes, tooltips, barres, donuts) → fmtT  (tonnes)
 * Tableaux de données (listes, inventaires)              → fmtKgTable (kg)
 */

/** Graphiques uniquement — conversion kg → tonnes, max 3 décimales, zéros finaux masqués. */
export function fmtT(kg: number, maxDec = 3): string {
  const t = kg / 1000
  return t.toLocaleString('fr-FR', { maximumFractionDigits: maxDec }) + ' t'
}

/** Donut / pie chart centre — tonnes avec précision adaptée à la magnitude. */
export function fmtTCentre(kg: number): string {
  const t = kg / 1000
  const dec = t >= 1000 ? 0 : t >= 100 ? 0 : t >= 10 ? 1 : 2
  return t.toLocaleString('fr-FR', { maximumFractionDigits: dec }) + ' t'
}

/** Tableaux de données — kg avec séparateur milliers (espace, fr-FR). */
export function fmtKgTable(kg: number): string {
  return kg.toLocaleString('fr-FR', { maximumFractionDigits: 0 }) + ' kg'
}
