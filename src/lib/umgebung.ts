/** Liest Umgebungsvariablen zur Laufzeit (lokal aus .env, auf Vercel aus den Projekteinstellungen). */
export function env(name: string): string | undefined {
  return process.env[name] ?? (import.meta.env as Record<string, string | undefined>)[name];
}

export function pflichtEnv(name: string): string {
  const v = env(name);
  if (!v) throw new Error(`Umgebungsvariable ${name} fehlt (siehe .env.example).`);
  return v;
}
