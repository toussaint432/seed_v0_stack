/* ═══════════════════════════════════════════════════════════════
   Données géographiques — Zones Agro-Écologiques du Sénégal
   Polygones GeoJSON simplifiés + centroids + mappings site→ZAE
   Source : ISRA/CNRA, Division Environnement DAPSA
   ═══════════════════════════════════════════════════════════════ */

/* ── Coordonnées réelles des sites [lat, lng] ── */
export const SITE_COORDS: Record<string, [number, number]> = {
  'CNRA-BAMBEY':    [14.703, -16.449],
  'FERME-MULTI-01': [14.695, -16.441],
  'MAG-BAMBEY':     [14.710, -16.460],
  'ISRA-KAOLACK':   [14.151, -16.072],
  'FERME-MULTI-02': [14.145, -16.060],
  'MAG-THIES':      [14.790, -16.925],
  'MAG-STLOUIS':    [16.027, -16.496],
  'MAG-ZIGUINCHOR': [12.558, -16.271],
  'FERME-MULTI-03': [14.115, -15.902],
}

/* ── Labels et types de sites ── */
export const SITE_META: Record<string, { nom: string; type: string; region: string }> = {
  'CNRA-BAMBEY':    { nom: 'CNRA Bambey',             type: 'Station recherche', region: 'Diourbel'    },
  'FERME-MULTI-01': { nom: 'Station de Bambey',       type: 'Station recherche', region: 'Diourbel'    },
  'MAG-BAMBEY':     { nom: 'Magasin central Bambey',  type: 'Magasin',           region: 'Diourbel'    },
  'ISRA-KAOLACK':   { nom: 'Station ISRA Kaolack',    type: 'Station recherche', region: 'Kaolack'     },
  'FERME-MULTI-02': { nom: 'Station de Kaolack',      type: 'Ferme',             region: 'Kaolack'     },
  'MAG-THIES':      { nom: 'Magasin central Thiès',   type: 'Magasin',           region: 'Thiès'       },
  'MAG-STLOUIS':    { nom: 'Magasin Saint-Louis',     type: 'Magasin',           region: 'Saint-Louis' },
  'MAG-ZIGUINCHOR': { nom: 'Magasin Ziguinchor',      type: 'Magasin',           region: 'Ziguinchor'  },
  'FERME-MULTI-03': { nom: 'Ferme Multiplicateur 03', type: 'Ferme',             region: 'Kaolack'     },
}

/* ── Centroids ZAE [lat, lng] pour les bulles d'activité ── */
export const ZAE_CENTROIDS: Record<string, [number, number]> = {
  'ZSP': [15.20, -14.50],
  'BA':  [14.00, -15.60],
  'VF':  [16.25, -14.90],
  'NAY': [15.00, -17.10],
  'SO':  [13.50, -12.80],
  'HC':  [12.45, -14.20],
  'MC':  [12.75, -15.80],
  'BC':  [12.30, -16.40],
}

/* ── Noms d'affichage courts des ZAE ── */
export const ZAE_DISPLAY: Record<string, string> = {
  'ZSP': 'Sylvo-pastorale',
  'BA':  'Bassin Arachidier',
  'VF':  'Vallée du Fleuve',
  'NAY': 'Niayes',
  'SO':  'Sénégal Oriental',
  'HC':  'Haute Casamance',
  'MC':  'Moy. Casamance',
  'BC':  'Basse Casamance',
}

/* ── Couleurs par ZAE ── */
export const ZAE_COLORS: Record<string, string> = {
  'ZSP': '#f59e0b',
  'BA':  '#22c55e',
  'VF':  '#6366f1',
  'NAY': '#3b82f6',
  'SO':  '#0ea5e9',
  'HC':  '#10b981',
  'MC':  '#84cc16',
  'BC':  '#14b8a6',
}

/* ── Mapping site → code ZAE ── */
export const SITE_TO_ZAE: Record<string, string> = {
  'CNRA-BAMBEY':    'BA',
  'FERME-MULTI-01': 'BA',
  'MAG-BAMBEY':     'BA',
  'ISRA-KAOLACK':   'BA',
  'FERME-MULTI-02': 'BA',
  'MAG-THIES':      'NAY',
  'MAG-STLOUIS':    'VF',
  'MAG-ZIGUINCHOR': 'BC',
  'FERME-MULTI-03': 'BA',
}

/* ── Couleur du marqueur selon le type de site ── */
export const SITE_TYPE_COLOR: Record<string, string> = {
  'Station recherche': '#6366f1',
  'Ferme':             '#22c55e',
  'Magasin':           '#f59e0b',
}

/* ═══════════════════════════════════════════════════════════════
   GeoJSON simplifié des 8 ZAE du Sénégal
   Polygones approximatifs pour visualisation dashboard.
   Coordonnées GeoJSON : [longitude, latitude]
   ═══════════════════════════════════════════════════════════════ */
export const SENEGAL_ZAE_GEOJSON = {
  type: 'FeatureCollection' as const,
  features: [
    {
      type: 'Feature' as const,
      properties: {
        code: 'VF',
        nom: 'Vallée du Fleuve Sénégal',
        pluv: 'Périmètres irrigués',
        cultures: 'Riz irrigué, oignon, tomate',
      },
      geometry: {
        type: 'Polygon' as const,
        coordinates: [[
          [-16.70, 15.80], [-11.50, 15.80], [-11.50, 16.70],
          [-16.70, 16.70], [-16.70, 15.80],
        ]],
      },
    },
    {
      type: 'Feature' as const,
      properties: {
        code: 'NAY',
        nom: 'Niayes',
        pluv: '400–600 mm (côte)',
        cultures: 'Maraîchage, arachide de bouche, mil hâtif',
      },
      geometry: {
        type: 'Polygon' as const,
        coordinates: [[
          [-17.50, 14.50], [-16.70, 14.50], [-16.70, 15.80],
          [-17.50, 15.80], [-17.50, 14.50],
        ]],
      },
    },
    {
      type: 'Feature' as const,
      properties: {
        code: 'ZSP',
        nom: 'Zone Sylvo-pastorale (Ferlo)',
        pluv: '200–500 mm',
        cultures: 'Mil, sorgho, élevage pastoral',
      },
      geometry: {
        type: 'Polygon' as const,
        coordinates: [[
          [-16.50, 14.20], [-13.00, 14.20], [-13.00, 15.80],
          [-16.50, 15.80], [-16.50, 14.20],
        ]],
      },
    },
    {
      type: 'Feature' as const,
      properties: {
        code: 'BA',
        nom: 'Bassin Arachidier',
        pluv: '400–800 mm',
        cultures: 'Arachide, mil, niébé, sorgho',
      },
      geometry: {
        type: 'Polygon' as const,
        coordinates: [[
          [-16.80, 13.20], [-14.50, 13.20], [-14.50, 14.50],
          [-16.80, 14.50], [-16.80, 13.20],
        ]],
      },
    },
    {
      type: 'Feature' as const,
      properties: {
        code: 'SO',
        nom: 'Sénégal Oriental',
        pluv: '800–1 200 mm',
        cultures: 'Maïs, sorgho, coton, riz',
      },
      geometry: {
        type: 'Polygon' as const,
        coordinates: [[
          [-14.50, 12.30], [-11.40, 12.30], [-11.40, 15.50],
          [-14.50, 15.50], [-14.50, 12.30],
        ]],
      },
    },
    {
      type: 'Feature' as const,
      properties: {
        code: 'HC',
        nom: 'Haute Casamance',
        pluv: '800–1 000 mm',
        cultures: 'Maïs, arachide, niébé, coton',
      },
      geometry: {
        type: 'Polygon' as const,
        coordinates: [[
          [-15.50, 12.00], [-13.50, 12.00], [-13.50, 13.30],
          [-15.50, 13.30], [-15.50, 12.00],
        ]],
      },
    },
    {
      type: 'Feature' as const,
      properties: {
        code: 'MC',
        nom: 'Moyenne Casamance',
        pluv: '1 000–1 300 mm',
        cultures: 'Riz pluvial, maïs, palmier à huile, manioc',
      },
      geometry: {
        type: 'Polygon' as const,
        coordinates: [[
          [-16.30, 12.20], [-15.20, 12.20], [-15.20, 13.10],
          [-16.30, 13.10], [-16.30, 12.20],
        ]],
      },
    },
    {
      type: 'Feature' as const,
      properties: {
        code: 'BC',
        nom: 'Basse Casamance',
        pluv: '> 1 300 mm',
        cultures: 'Riz de plateau, coton, arachide, arboriculture',
      },
      geometry: {
        type: 'Polygon' as const,
        coordinates: [[
          [-17.20, 11.80], [-15.50, 11.80], [-15.50, 12.70],
          [-17.20, 12.70], [-17.20, 11.80],
        ]],
      },
    },
  ],
}
