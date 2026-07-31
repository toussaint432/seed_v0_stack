/* ══════════════════════════════════════════════════════════════
   Types métier — Plateforme Sen Jiwu (ISRA/CNRA)
   Synchronisés avec le schéma PostgreSQL (V1→V23) et les DTOs
   Java de chaque micro-service.
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
  statutVariete: StatutVariete
  dateCreation?: string
}

// ── Zones agro-écologiques ──

export interface ZoneAgro {
  id: number
  codeZae: string
  nomZae: string
  description?: string
  superficieKm2?: number
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
  createdAt?: string
}

// ── Lots ──

export interface LotSemencier {
  id: number
  codeLot: string
  idVariete?: number
  variete?: Variete
  idGeneration?: number
  generation?: GenerationSemence
  classe?: ClasseSemence
  lotParent?: LotSemencier
  campagne?: string
  organisationResponsable?: Organisation
  idOrgProducteur?: number
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
  statutLot: StatutLot
  observations?: string
  createdAt?: string
  // Champs dénormalisés pour performance (évite jointures répétées)
  codeEspece?: string
  // Champs PCAE — suivi de production sur parcelle
  superficieHa?: number
  productionBruteKg?: number
  quantiteSemenceSrcKg?: number
  rendementKgHa?: number
  cycle?: string
  niveauSemence?: string
  // Traçabilité acteur
  usernameCreateur?: string
  responsableNom?: string
  responsableRole?: string
}

// ── Transferts de lots inter-acteurs (lot-service) ──

export interface TransfertLot {
  id: number
  codeTransfert: string
  idLot: number
  usernameEmetteur: string
  roleEmetteur: string
  usernameDestinataire: string
  roleDestinataire: string
  generationTransferee: string
  quantite: number
  statut: 'EN_ATTENTE' | 'ACCEPTE' | 'REFUSE'
  observations?: string
  createdAt?: string
  acceptedAt?: string
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
  statutProgramme: StatutProgramme
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
  updatedAt?: string
  createdAt?: string
}

export interface MouvementStock {
  id: number
  idLot: number
  typeMouvement: 'IN' | 'OUT' | 'TRANSFER'
  siteSource?: Site
  siteDestination?: Site
  quantite: number
  unite: string
  createdAt?: string
  referenceOperation?: string
  observations?: string
}

// ── Transferts de stock entre sites (stock-service) ──

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
  statutTransfert: StatutTransfert
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
  statut: StatutCommande
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
  createdAt?: string
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

// ── Messagerie ──

export interface Conversation {
  id: number
  sujet: string
  participants: string[]
  dernierMessageAt?: string
  createdAt?: string
  nombreNonLus?: number
}

export interface Message {
  id: number
  idConversation: number
  expediteur: string
  contenu: string
  lu: boolean
  createdAt: string
  pieceJointe?: string
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
  ancienStatut?: StatutLot
  nouveauStatut: StatutLot
  dateChangement: string
  utilisateur?: string
  motif?: string
}

// ── Membre organisation (lien Keycloak ↔ org) ──

export interface MembreOrganisation {
  id: number
  username: string
  email?: string
  nomComplet?: string
  role: string
  organisation?: Organisation
  idOrganisation?: number
  actif: boolean
  createdAt?: string
  updatedAt?: string
}

// ── Helpers — types union stricts (synchronisés avec les enums Java) ──

// lot-service : StatutLot.java
export type StatutLot =
  | 'DISPONIBLE'
  | 'EN_PRODUCTION'
  | 'CERTIFIE'
  | 'TRANSFERE'
  | 'EPUISE'
  | 'RETIRE'
  | 'DECLASS'
  | 'EN_COURS_CERT'
  | 'SOUCHE'
  | 'PERDU'

// order-service : StatutCommande.java
export type StatutCommande =
  | 'SOUMISE'
  | 'ACCEPTEE'
  | 'EN_PREPARATION'
  | 'LIVREE'
  | 'ANNULEE'
  | 'REJETEE'

// lot-service & stock-service : StatutTransfert.java
export type StatutTransfert = 'EN_ATTENTE' | 'ACCEPTE' | 'REJETE' | 'ANNULE'

// lot-service : StatutTransfertLot (TransfertLot.statut)
export type StatutTransfertLot = 'EN_ATTENTE' | 'ACCEPTE' | 'REFUSE'

// lot-service : StatutProgramme.java
export type StatutProgramme = 'PLANIFIE' | 'EN_COURS' | 'TERMINE' | 'SUSPENDU' | 'ANNULE'

// catalog-service : StatutVariete.java
export type StatutVariete = 'DIFFUSEE' | 'EN_TEST' | 'RETIREE' | 'ARCHIVEE'

// ── Générations — ordre canonique et helpers visuels ──

export const GEN_ORDER = ['G0', 'G1', 'G2', 'G3', 'R1', 'R2'] as const
export type GenerationCode = typeof GEN_ORDER[number]

export const GEN_LABELS: Record<string, string> = {
  G0: 'Noyau génétique',
  G1: 'Pré-base',
  G2: 'Base',
  G3: 'Certifiée C1',
  R1: 'R1',
  R2: 'Commerciale R2',
}

export const GEN_COLORS: Record<string, { bg: string; border: string; text: string; badge: string }> = {
  G0: { bg: '#eff6ff', border: '#bfdbfe', text: '#1d4ed8', badge: 'badge-blue' },
  G1: { bg: '#f0fdf4', border: '#bbf7d0', text: '#15803d', badge: 'badge-green' },
  G2: { bg: '#fef9ed', border: '#fde68a', text: '#92660a', badge: 'badge-gold' },
  G3: { bg: '#faf5ff', border: '#e9d5ff', text: '#6d28d9', badge: 'badge-violet' },
  R1: { bg: '#f0fdfa', border: '#99f6e4', text: '#0f766e', badge: 'badge-teal' },
  R2: { bg: '#dcfce7', border: '#86efac', text: '#15803d', badge: 'badge-green' },
}

// ── Statuts lot — couleurs cohérentes avec GEN_COLORS ──

export const STATUT_LOT_COLORS: Record<StatutLot, { bg: string; border: string; text: string }> = {
  DISPONIBLE:    { bg: '#dcfce7', border: '#86efac', text: '#15803d' },
  EN_PRODUCTION: { bg: '#fef3c7', border: '#fde68a', text: '#92660a' },
  CERTIFIE:      { bg: '#f0fdf4', border: '#bbf7d0', text: '#166534' },
  TRANSFERE:     { bg: '#eff6ff', border: '#bfdbfe', text: '#1d4ed8' },
  EPUISE:        { bg: '#f9fafb', border: '#e5e7eb', text: '#6b7280' },
  RETIRE:        { bg: '#fef2f2', border: '#fecaca', text: '#dc2626' },
  DECLASS:       { bg: '#fff7ed', border: '#fed7aa', text: '#c2410c' },
  EN_COURS_CERT: { bg: '#f5f3ff', border: '#ddd6fe', text: '#6d28d9' },
  SOUCHE:        { bg: '#ecfdf5', border: '#a7f3d0', text: '#047857' },
  PERDU:         { bg: '#fdf2f8', border: '#f9a8d4', text: '#9d174d' },
}

export const STATUT_LOT_LABELS: Record<StatutLot, string> = {
  DISPONIBLE:    'Disponible',
  EN_PRODUCTION: 'En production',
  CERTIFIE:      'Certifié',
  TRANSFERE:     'Transféré',
  EPUISE:        'Épuisé',
  RETIRE:        'Retiré',
  DECLASS:       'Déclassé',
  EN_COURS_CERT: 'En certification',
  SOUCHE:        'Souche conservatoire',
  PERDU:         'Perdu',
}

export const STATUT_COMMANDE_LABELS: Record<StatutCommande, string> = {
  SOUMISE:        'Soumise',
  ACCEPTEE:       'Acceptée',
  EN_PREPARATION: 'En préparation',
  LIVREE:         'Livrée',
  ANNULEE:        'Annulée',
  REJETEE:        'Rejetée',
}

export const STATUT_COMMANDE_COLORS: Record<StatutCommande, { bg: string; border: string; text: string }> = {
  SOUMISE:        { bg: '#eff6ff', border: '#bfdbfe', text: '#1d4ed8' },
  ACCEPTEE:       { bg: '#f0fdf4', border: '#bbf7d0', text: '#15803d' },
  EN_PREPARATION: { bg: '#fef3c7', border: '#fde68a', text: '#92660a' },
  LIVREE:         { bg: '#dcfce7', border: '#86efac', text: '#166534' },
  ANNULEE:        { bg: '#f9fafb', border: '#e5e7eb', text: '#6b7280' },
  REJETEE:        { bg: '#fef2f2', border: '#fecaca', text: '#dc2626' },
}
