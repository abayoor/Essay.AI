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

function responseText(payload) {
  if (!payload || typeof payload !== 'object' || !Array.isArray(payload.candidates)) return null;
  for (const candidate of payload.candidates) {
    const parts = candidate?.content?.parts;
    if (!Array.isArray(parts)) continue;
    const textPart = parts.find((part) => typeof part?.text === 'string');
    if (textPart) return textPart.text;
  }
  return null;
}

const fileEnv = parseEnv(await readFile('.env', 'utf8').catch(() => ''));
const apiKey = process.env.GEMINI_API_KEY ?? process.env.GOOGLE_API_KEY
  ?? fileEnv.GEMINI_API_KEY ?? fileEnv.GOOGLE_API_KEY;
const model = process.env.GEMINI_MODEL ?? fileEnv.GEMINI_MODEL ?? 'gemini-2.5-flash';

if (!apiKey) {
  console.error('Gemini: переменная GEMINI_API_KEY не найдена.');
  process.exitCode = 1;
} else {
  try {
    const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-goog-api-key': apiKey },
      body: JSON.stringify({
        systemInstruction: {
          parts: [{ text: 'Return only JSON matching the supplied schema. Use concise cycling-related test text.' }],
        },
        contents: [{ role: 'user', parts: [{ text: 'Prepare a short test cycling insight.' }] }],
        generationConfig: {
          maxOutputTokens: 500,
          thinkingConfig: { thinkingLevel: 'minimal' },
          responseMimeType: 'application/json',
          responseSchema: {
            type: 'object',
            properties: {
              title: { type: 'string' },
              text: { type: 'string' },
              highlights: {
                type: 'array',
                minItems: 0,
                maxItems: 3,
                items: { type: 'string' },
              },
            },
            required: ['title', 'text', 'highlights'],
          },
        },
      }),
    });
    const payload = await response.json().catch(() => null);
    if (!response.ok) {
      const apiError = payload && typeof payload === 'object' && 'error' in payload ? payload.error : null;
      const message = apiError && typeof apiError === 'object' && 'message' in apiError
        ? apiError.message
        : 'Нет описания ошибки.';
      console.error(`Gemini: ошибка ${response.status} для модели ${model}: ${message}`);
      process.exitCode = 1;
    } else {
      const text = responseText(payload);
      const result = text ? JSON.parse(text) : null;
      if (!result
        || typeof result.title !== 'string'
        || typeof result.text !== 'string'
        || !Array.isArray(result.highlights)
        || !result.highlights.every((item) => typeof item === 'string')) {
        throw new Error('структурированный ответ не прошёл проверку');
      }
      console.log(`Gemini: ключ, модель ${model} и структурированные ответы работают.`);
    }
  } catch (error) {
    console.error(`Gemini: не удалось выполнить рабочий API-запрос: ${error instanceof Error ? error.message : 'неизвестная ошибка'}`);
    process.exitCode = 1;
  }
}
