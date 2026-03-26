/* ══════════════════════════════════════════════════════════════
   Types métier — Plateforme de gestion des semences agricoles
   Basés sur schema_semences.sql
   ══════════════════════════════════════════════════════════════ */

// ── Référentiels ──

export interface Role {
  id: number
  codeRole: string
  libelle: string
}

export interface TypeOrganisation {
  id: number
  codeType: string
  libelle: string
}

export interface Organisation {
  id: number
  nom: string
  sigle?: string
  typeOrganisation?: TypeOrganisation
  idTypeOrg?: number
  telephone?: string
  email?: string
  adresse?: string
  statutActif: boolean
}

export interface Utilisateur {
  id: number
  nom: string
  prenom: string
  email: string
  telephone?: string
  role?: Role
  idRole?: number
  organisation?: Organisation
  idOrganisation?: number
  actif: boolean
  dateCreation: string
}

// ── Catalogue ──

export interface Espece {
  id: number
  codeEspece: string
  nomCommun: string
  nomScientifique?: string
}

export interface GenerationSemence {
  id: number
  codeGeneration: string
  ordreGeneration: number
  description?: string
}

export interface ClasseSemence {
  id: number
  codeClasse: string
  libelle: string
  description?: string
}

export interface Variete {
  id: number
  codeVariete: string
  nomVariete: string
  espece?: Espece
  idEspece?: number
  origine?: string
  selectionneurPrincipal?: string
  anneeCreation?: number
  cycleJours?: number
  descriptionMorphologique?: string
  caracteristiquesAgronomiques?: string
  zoneRecommandee?: string
  statutVariete: 'DIFFUSEE' | 'EN_TEST' | 'RETIREE'
  dateCreation?: string
}

// ── Campagne ──

export interface Campagne {
  id: number
  codeCampagne: string
  libelle: string
  dateDebut: string
  dateFin: string
  typeCampagne?: string
  statut?: string
}

// ── Sites ──

export interface Site {
  id: number
  codeSite: string
  nomSite: string
  typeSite: string
  localite?: string
  region?: string
  latitude?: number
  longitude?: number
  organisation?: Organisation
  idOrganisation?: number
}

// ── Lots ──

export interface LotSemencier {
  id: number
  codeLot: string
  idVariete?: number
  variete?: Variete
  generation?: GenerationSemence
  classe?: ClasseSemence
  lotParent?: LotSemencier
  campagne?: string
  organisationResponsable?: Organisation
  siteOrigine?: Site
  dateProduction?: string
  dateRecolte?: string
  quantiteInitiale?: number
  unite: string
  quantiteNette?: number
  stockDisponible?: number
  tauxGermination?: number
  tauxHumidite?: number
  puretePhysique?: number
  conformiteVarietale?: string
  statutLot: string
  observations?: string
  dateCreation?: string
}

// ── Programme de multiplication ──

export interface ProgrammeMultiplication {
  id: number
  codeProgramme: string
  lotSource?: LotSemencier
  idLotSource?: number
  generationCible?: GenerationSemence
  idGenerationCible?: number
  multiplicateur?: Organisation
  idMultiplicateur?: number
  campagne?: Campagne
  idCampagne?: number
  surfacePrevueHa?: number
  quantiteSemenceAllouee?: number
  dateAttribution?: string
  statutProgramme: string
  observations?: string
  lotProduit?: LotSemencier
}

export interface ParcelleMultiplication {
  id: number
  idProgramme: number
  codeParcelle?: string
  localisation?: string
  superficieHa?: number
  dateSemis?: string
  dateRecoltePrevue?: string
  dateRecolteReelle?: string
  observations?: string
}

export interface RendementProduction {
  id: number
  idProgramme: number
  rendementPrevuKgHa?: number
  rendementReelKgHa?: number
  quantiteRecolteeTotale?: number
  pertesEstimees?: number
  dateSaisie?: string
  observations?: string
}

// ── Qualité & Certification ──

export interface ControleQualite {
  id: number
  idLot: number
  lot?: LotSemencier
  typeControle: string
  dateControle: string
  tauxGermination?: number
  tauxHumidite?: number
  puretePhysique?: number
  pureteSpecifique?: number
  conformiteVarietale?: string
  resultat: string
  observations?: string
  controleur?: string
}

export interface Certification {
  id: number
  idLot: number
  lot?: LotSemencier
  organismeCertificateur: string
  numeroCertificat: string
  dateDemande?: string
  dateInspection?: string
  dateCertification?: string
  resultatCertification: string
  motifRejet?: string
  dateExpiration?: string
}

// ── Stock ──

export interface Stock {
  id: number
  idLot: number
  lot?: LotSemencier
  site?: Site
  idSite?: number
  quantiteDisponible: number
  unite: string
  dateMiseAJour?: string
  statutStock?: string
}

export interface MouvementStock {
  id: number
  idLot: number
  typeMouvement: 'IN' | 'OUT' | 'TRANSFER'
  siteSource?: Site
  siteDestination?: Site
  quantite: number
  unite: string
  dateMouvement?: string
  referenceOperation?: string
  utilisateur?: Utilisateur
  observations?: string
}

// ── Transferts ──

export interface Transfert {
  id: number
  codeTransfert: string
  idLot: number
  lot?: LotSemencier
  organisationSource?: Organisation
  organisationDestination?: Organisation
  siteSource?: Site
  siteDestination?: Site
  quantiteTransferee: number
  dateDemande: string
  dateValidation?: string
  dateReception?: string
  statutTransfert: string
  validePar?: Utilisateur
  receptionnePar?: Utilisateur
  observations?: string
}

// ── Commandes ──

export interface Commande {
  id: number
  codeCommande: string
  clientOrg?: Organisation
  idClientOrg?: number
  client?: string
  dateCommande?: string
  statut: string
  montantEstime?: number
  observations?: string
  lignes?: LigneCommande[]
  createdAt?: string
}

export interface LigneCommande {
  id: number
  idCommande: number
  idVariete: number
  variete?: Variete
  idGeneration?: number
  generation?: GenerationSemence
  quantiteDemandee: number
  unite: string
  quantiteValidee?: number
  quantiteLivree?: number
  observations?: string
}

export interface AttributionCommande {
  id: number
  idLigneCommande: number
  idLot: number
  lot?: LotSemencier
  quantiteAttribuee: number
  dateAttribution: string
  observations?: string
}

export interface Distribution {
  id: number
  idCommande: number
  dateDistribution?: string
  modeDistribution?: string
  recepteur?: string
  referenceBonLivraison?: string
  statutDistribution?: string
  observations?: string
}

// ── Documents ──

export interface DocumentJoint {
  id: number
  typeObjet: string
  idObjet: number
  nomFichier: string
  cheminFichier: string
  typeDocument?: string
  dateUpload?: string
}

// ── Historique ──

export interface HistoriqueStatutLot {
  id: number
  idLot: number
  ancienStatut?: string
  nouveauStatut: string
  dateChangement: string
  utilisateur?: Utilisateur
  motif?: string
}

// ── Helpers ──

export type StatutLot = 'EN_PRODUCTION' | 'DISPONIBLE' | 'TRANSFERE' | 'EPUISE' | 'CERTIFIE' | 'REJETE'
export type StatutCommande = 'PENDING' | 'EN_ATTENTE' | 'CONFIRMED' | 'CONFIRMEE' | 'ALLOCATED' | 'ALLOUEE' | 'CANCELLED' | 'ANNULEE'
export type StatutTransfert = 'DEMANDE' | 'VALIDE' | 'EXPEDIE' | 'RECEPTIONNE' | 'ANNULE'
export type StatutCertification = 'EN_COURS' | 'CERTIFIE' | 'REJETE' | 'EXPIRE'
export type StatutProgramme = 'PLANIFIE' | 'EN_COURS' | 'TERMINE' | 'ANNULE'

export const GEN_ORDER = ['G0', 'G1', 'G2', 'G3', 'G4', 'R1', 'R2'] as const
export type GenerationCode = typeof GEN_ORDER[number]

export const GEN_LABELS: Record<string, string> = {
  G0: 'Noyau génétique',
  G1: 'Pré-base',
  G2: 'Base',
  G3: 'Certifiée C1',
  G4: 'Certifiée C2',
  R1: 'R1',
  R2: 'Commerciale R2',
}

export const GEN_COLORS: Record<string, { bg: string; border: string; text: string; badge: string }> = {
  G0: { bg: '#eff6ff', border: '#bfdbfe', text: '#1d4ed8', badge: 'badge-blue' },
  G1: { bg: '#f0fdf4', border: '#bbf7d0', text: '#15803d', badge: 'badge-green' },
  G2: { bg: '#fef9ed', border: '#fde68a', text: '#92660a', badge: 'badge-gold' },
  G3: { bg: '#faf5ff', border: '#e9d5ff', text: '#6d28d9', badge: 'badge-violet' },
  G4: { bg: '#f9fafb', border: '#e5e7eb', text: '#374151', badge: 'badge-gray' },
  R1: { bg: '#f0fdfa', border: '#99f6e4', text: '#0f766e', badge: 'badge-teal' },
  R2: { bg: '#dcfce7', border: '#86efac', text: '#15803d', badge: 'badge-green' },
}
