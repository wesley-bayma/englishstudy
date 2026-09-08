export async function loadCanonicalSeed(): Promise<unknown[]> {
  // Tests run without a Next.js server, so load the fixture directly there.
  if (process.env.NODE_ENV === 'test') {
    const seedModule = await import('../data/seed-data.json');
    return seedModule.default as unknown[];
  }

  const response = await fetch('/api/seed', {
    credentials: 'same-origin',
    cache: 'force-cache'
  });
  if (!response.ok) throw new Error(`Não foi possível carregar o dataset (${response.status}).`);
  const data = await response.json() as unknown;
  if (!Array.isArray(data)) throw new Error('O dataset canônico tem formato inválido.');
  return data;
}
