/**
 * Normalise une partie du code lot : majuscules, sans accents, sans espaces/tirets/underscores.
 * Ex: "Gawane" → "GAWANE", "28-206" → "28206", "Arachide" → "ARACHIDE"
 */
export function normalizeLotPart(s: string): string {
  return s.toUpperCase()
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .replace(/[\s\-_]+/g, '')
}

/**
 * Génère un code lot au format {GEN}-{ESPECE}-{VARIETE}-{codeCampagne}-{NN}.
 * Retourne '' si l'un des paramètres est absent.
 * NN = entier simple (1, 2, … 10, 100) sans zéro devant, calculé
 * en cherchant le max existant parmi les lots portant le même préfixe.
 *
 * Ex: generateLotCode('G3','MIL','Gawane','CSF-2026', lots) → 'G3-MIL-GAWANE-CSF-2026-1'
 */
export function generateLotCode(
  gen: string,
  codeEspece: string,
  nomVariete: string,
  codeCampagne: string,
  existingLots: { codeLot?: string }[],
): string {
  if (!gen || !codeEspece || !nomVariete || !codeCampagne) return ''
  const prefix = `${gen}-${normalizeLotPart(codeEspece)}-${normalizeLotPart(nomVariete)}-${codeCampagne}-`
  const maxNN = existingLots.reduce((max: number, l) => {
    if (!l.codeLot?.startsWith(prefix)) return max
    const n = parseInt(l.codeLot.slice(prefix.length), 10)
    return isNaN(n) ? max : Math.max(max, n)
  }, 0)
  return `${prefix}${maxNN + 1}`
}
