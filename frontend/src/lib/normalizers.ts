/**
 * Normaliseurs de réponse API — adaptent les DTOs Java (champs plats)
 * en objets avec la structure imbriquée attendue par le frontend.
 *
 * Les DTOs aplatissent les relations EAGER pour éviter la sérialisation
 * récursive (ex. LotSemencier.lotParent sur 7 niveaux). Ces fonctions
 * reconstruisent la structure imbriquée à partir des champs scalaires.
 *
 * Compatibles avec les réponses tableau (List<T>) ET paginées (Page<T>).
 */

/** Métadonnées de pagination Spring Data (VIA_DTO) */
export interface SpringPageMeta {
  totalElements: number
  totalPages: number
  size: number
  number: number
}

/** Type Spring Page<T> renvoyé par les endpoints paginés (@EnableSpringDataWebSupport VIA_DTO) */
export interface SpringPage<T> {
  content: T[]
  page: SpringPageMeta
}

/** Extrait le contenu d'une réponse Spring Page<T> ou d'un tableau direct */
export function extractList(data: any): any[] {
  if (Array.isArray(data)) return data
  if (data?.content && Array.isArray(data.content)) return data.content
  return []
}

export function normalizeLot(l: any): any {
  return {
    ...l,
    generation: l.generation ?? (l.generationCode != null
      ? { id: l.generationId, codeGeneration: l.generationCode, ordreGeneration: l.generationOrdre }
      : undefined),
    lotParent: l.lotParent ?? (l.lotParentId != null
      ? { id: l.lotParentId, codeLot: l.lotParentCode }
      : undefined),
  }
}

export function normalizeVariete(v: any): any {
  return {
    ...v,
    espece: v.espece ?? (v.especeCode != null
      ? { id: v.especeId, codeEspece: v.especeCode, nomCommun: v.especeNomCommun, nomEspece: v.especeNomCommun }
      : undefined),
  }
}

export function normalizeStock(s: any): any {
  return {
    ...s,
    site: s.site ?? (s.codeSite != null
      ? { id: s.siteId, codeSite: s.codeSite, nomSite: s.nomSite, typeSite: s.typeSite, localite: s.localite, region: s.region }
      : undefined),
  }
}
