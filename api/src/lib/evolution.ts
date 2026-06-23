export async function evolutionFetch(path: string, options: RequestInit = {}) {
  const base = process.env.EVOLUTION_API_URL?.replace(/\/$/, "")
  if (!base) throw new Error("EVOLUTION_API_URL not set")
  return fetch(`${base}${path}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      apikey: process.env.EVOLUTION_API_KEY || "",
      ...(options.headers || {}),
    },
  })
}
