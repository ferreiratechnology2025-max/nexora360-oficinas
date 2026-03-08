import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

const MODEL = 'mistralai/mistral-nemo';
const OPENROUTER_API_URL = 'https://openrouter.ai/api/v1/chat/completions';

export interface ChatMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

@Injectable()
export class AiService {
  private readonly logger = new Logger(AiService.name);

  constructor(private configService: ConfigService) {}

  async chat(messages: ChatMessage[]): Promise<string> {
    const apiKey = this.configService.get<string>('OPENROUTER_API_KEY') ?? '';
    return this.callOpenRouter(apiKey, MODEL, messages);
  }

  private async callOpenRouter(
    apiKey: string,
    model: string,
    messages: ChatMessage[],
  ): Promise<string> {
    const response = await fetch(OPENROUTER_API_URL, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
        'HTTP-Referer': 'https://nexora360oficina.com',
        'X-Title': 'Nexora360 Oficina',
      },
      body: JSON.stringify({ model, messages }),
    });

    if (!response.ok) {
      const err = await response.json().catch(() => ({}));
      throw new Error(`OpenRouter error (${model}): ${response.statusText} — ${JSON.stringify(err)}`);
    }

    const data = await response.json();
    const content = data?.choices?.[0]?.message?.content;
    if (!content) {
      throw new Error('Empty response from OpenRouter');
    }
    return content;
  }
}
