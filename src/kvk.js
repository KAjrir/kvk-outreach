import { fetchFromGoudenGids } from './goudengids.js';

// Mock data voor snel testen
const MOCK_LEADS = [
  { ggId: 'L000001', kvkNumber: '12345678', companyName: 'Bakkerij De Gouden Korst', email: 'info@bakkerij.example', phone: '+31101234567', website: 'http://bakkerij.example', sourceUrl: 'https://www.goudengids.nl/nl/bedrijf/Rotterdam/L000001/Bakkerij/' },
  { ggId: 'L000002', kvkNumber: '87654321', companyName: 'Loodgietersbedrijf Janssen', email: 'contact@janssen.example', phone: null, website: 'http://loodgieterjanssen.example', sourceUrl: 'https://www.goudengids.nl/nl/bedrijf/Rotterdam/L000002/Janssen/' },
  { ggId: 'L000003', kvkNumber: null, companyName: 'Kapsalon Mooie Dag', email: 'mooiedag@kapsalon.example', phone: '+31612345678', website: null, sourceUrl: 'https://www.goudengids.nl/nl/bedrijf/Rotterdam/L000003/Kapsalon/' },
  { ggId: 'L000004', kvkNumber: '55667788', companyName: 'Autorijschool Verkeersvrij', email: 'info@verkeersvrij.example', phone: null, website: 'http://verkeersvrij.example', sourceUrl: 'https://www.goudengids.nl/nl/bedrijf/Rotterdam/L000004/Verkeersvrij/' },
];

export async function fetchNewCompanies() {
  if (process.env.USE_MOCK === 'true') {
    console.log('⚠️  Mock data wordt gebruikt');
    return MOCK_LEADS;
  }

  console.log('🕷️  Scraping Goudengids...');
  // Haal alles op — 3 paginas per branche, pipeline filtert tot MAX_LEADS_PER_DAY eligible
  return await fetchFromGoudenGids();
}