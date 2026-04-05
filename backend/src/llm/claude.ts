import Anthropic from '@anthropic-ai/sdk';

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
const MODEL = 'claude-sonnet-4-5';

export async function callClaude(prompt: string, maxTokens = 2048): Promise<string> {
  const response = await client.messages.create({
    model: MODEL,
    max_tokens: maxTokens,
    messages: [{ role: 'user', content: prompt }],
  });
  const firstBlock = response.content[0];
  if (firstBlock.type !== 'text') {
    throw new Error('Unexpected Claude response type');
  }
  return firstBlock.text;
}

export function extractJson(raw: string): string {
  const trimmed = raw.trim();
  if (trimmed.startsWith('```')) {
    const match = trimmed.match(/```(?:json)?\n?([\s\S]*?)\n?```/);
    if (match) return match[1].trim();
  }
  return trimmed;
}
