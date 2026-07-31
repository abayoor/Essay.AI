import { readFile } from 'node:fs/promises';

function parseEnv(source) {
  return Object.fromEntries(source
    .split(/\r?\n/)
    .filter((line) => /^[A-Za-z_][A-Za-z0-9_]*=/.test(line))
    .map((line) => {
      const separator = line.indexOf('=');
      const name = line.slice(0, separator);
      const rawValue = line.slice(separator + 1).trim();
      const quoted = rawValue.length > 1
        && ((rawValue.startsWith('"') && rawValue.endsWith('"'))
          || (rawValue.startsWith("'") && rawValue.endsWith("'")));
      return [name, quoted ? rawValue.slice(1, -1) : rawValue];
    }));
}

const fileEnv = parseEnv(await readFile('.env', 'utf8').catch(() => ''));
const apiKey = process.env.GEMINI_API_KEY ?? process.env.GOOGLE_API_KEY
  ?? fileEnv.GEMINI_API_KEY ?? fileEnv.GOOGLE_API_KEY;
const model = process.env.GEMINI_MODEL ?? fileEnv.GEMINI_MODEL ?? 'gemini-3.6-flash';

if (!apiKey) {
  console.error('Gemini: переменная GEMINI_API_KEY не найдена.');
  process.exitCode = 1;
} else {
  try {
    const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-goog-api-key': apiKey },
      body: JSON.stringify({
        contents: [{ role: 'user', parts: [{ text: 'Reply with OK.' }] }],
        generationConfig: { maxOutputTokens: 16 },
      }),
    });
    const payload = await response.json().catch(() => null);
    if (!response.ok) {
      const apiError = payload && typeof payload === 'object' && 'error' in payload ? payload.error : null;
      const message = apiError && typeof apiError === 'object' && 'message' in apiError ? apiError.message : 'Нет описания ошибки.';
      console.error(`Gemini: ошибка ${response.status} для модели ${model}: ${message}`);
      process.exitCode = 1;
    } else {
      console.log(`Gemini: ключ и модель ${model} работают.`);
    }
  } catch (error) {
    console.error(`Gemini: не удалось подключиться к API: ${error instanceof Error ? error.message : 'неизвестная ошибка'}`);
    process.exitCode = 1;
  }
}
