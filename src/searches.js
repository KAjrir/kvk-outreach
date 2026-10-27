// Alle branches en steden — pipeline roteert hier automatisch doorheen
// Elke dag wordt een ander subset gedaan zodat één run niet te lang duurt

export const BRANCHES = [
  // Ambacht / technisch
  'loodgieter',
  'elektricien',
  'schilder',
  'stukadoor',
  'dakdekker',
  'glaszetter',
  'installateur',
  'metselaar',
  // Auto / transport
  'autogarage',
  'autoschadehersteller',
  'taxibedrijf',
  'rijschool',
  // Persoonlijke verzorging
  'kapsalon',
  'schoonheidssalon',
  'nagelstudio',
  'tattooshop',
  'massagesalon',
  // Horeca / food
  'restaurant',
  'cafetaria',
  'snackbar',
  'bakkerij',
  'slager',
  'catering',
  // Overig MKB
  'dierenarts',
  'fysiotherapeut',
  'tandarts',
  'accountant',
  'makelaar',
  'schoonmaakbedrijf',
  'hoveniersbedrijf',
  'verhuisbedrijf',
  'drukkerij',
  'fietsenmaker',
  'glazenwasser',
  'slotenmaker',
];

export const STEDEN = [
  'Amsterdam',
  'Rotterdam',
  'Den-Haag',
  'Utrecht',
  'Eindhoven',
  'Groningen',
  'Tilburg',
  'Almere',
  'Breda',
  'Nijmegen',
  'Enschede',
  'Haarlem',
  'Arnhem',
  'Zaandam',
  'Amersfoort',
  'Apeldoorn',
  'Den-Bosch',
  'Hoofddorp',
  'Maastricht',
  'Leiden',
  'Dordrecht',
  'Zoetermeer',
  'Zwolle',
  'Deventer',
  'Delft',
  'Alkmaar',
  'Venlo',
  'Leeuwarden',
  'Middelburg',
  'Lelystad',
];

// Genereer alle combinaties — 35 branches × 30 steden = 1050 totaal
export const ALL_COMBINATIONS = BRANCHES.flatMap(branche =>
  STEDEN.map(stad => ({ branche, stad }))
);

// Hoeveel combinaties per dag draaien we
const PER_DAY = parseInt(process.env.SEARCHES_PER_DAY || '5');

// Geeft de combinaties voor vandaag op basis van dag van het jaar
// Gemengd zodat je elke dag verschillende branches én steden ziet
export function getTodaysSearches() {
  const now = new Date();
  const dayOfYear = Math.floor(
    (now - new Date(now.getFullYear(), 0, 0)) / (1000 * 60 * 60 * 24)
  );

  const searches = [];
  for (let i = 0; i < PER_DAY; i++) {
    // Elke slot pakt een andere branche en stad via aparte offsets
    const branche = BRANCHES[(dayOfYear + i) % BRANCHES.length];
    const stad = STEDEN[(dayOfYear * 3 + i) % STEDEN.length];
    const combo = { branche, stad };

    // Voorkom duplicaten binnen dezelfde dag
    if (!searches.some(s => s.branche === combo.branche && s.stad === combo.stad)) {
      searches.push(combo);
    }
  }

  return searches;
}