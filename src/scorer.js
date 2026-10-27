import dotenv from 'dotenv';
dotenv.config();

const SYSTEM_PROMPT = `
Je bent een expert webdesign beoordelaar. Je krijgt een screenshot van een bedrijfswebsite.
Beoordeel de website op kwaliteit vanuit het perspectief van een potentiële klant.

Let op:
- Visueel design (modern vs verouderd)
- Professionele uitstraling
- Leesbaarheid en structuur
- Mobielvriendelijkheid (inschatten op basis van layout)
- Vertrouwenswaardigheid

Geef een score van 1 t/m 10 waarbij:
1-3 = zeer slecht, dringend verbetering nodig
4-5 = matig, duidelijke verbeterpunten
6-7 = redelijk, maar ruimte voor verbetering
8-10 = goed tot uitstekend, geen actie nodig

Reageer ALLEEN met geldig JSON, geen uitleg erbuiten:
{
  "score": <getal 1-10>,
  "reason": "<één zin waarom deze score, in het Nederlands>",
  "issues": ["issue 1", "issue 2"],
  "worth_contacting": <true als score <= 6, anders false>
}
`.trim();

export async function scoreWebsite({ screenshot, checks, url }) {
  try {
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`,
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        model: 'gpt-4o',
        max_tokens: 500,
        messages: [
          {
            role: 'system',
            content: SYSTEM_PROMPT,
          },
          {
            role: 'user',
            content: [
              {
                type: 'image_url',
                image_url: { url: `data:image/jpeg;base64,${screenshot}` },
              },
              {
                type: 'text',
                text: `Website: ${url}\nMeta viewport aanwezig: ${checks.hasMetaViewport}\nPaginatitel: ${checks.title || 'onbekend'}`,
              },
            ],
          },
        ],
      }),
    });

    if (!response.ok) throw new Error(`OpenAI API ${response.status}`);
    const data = await response.json();
    const text = data.choices[0].message.content;
    const clean = text.replace(/```json|```/g, '').trim();
    return JSON.parse(clean);
  } catch (err) {
    console.error('❌ Scoring fout:', err.message);
    return null;
  }
}