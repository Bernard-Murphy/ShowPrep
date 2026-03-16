import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import OpenAI from 'openai';
import axios from 'axios';

const VENICE_BASE = 'https://api.venice.ai/api/v1';

@Injectable()
export class VeniceService {
  private readonly client: OpenAI;
  private readonly apiKey: string;

  constructor(private readonly config: ConfigService) {
    this.apiKey = this.config.get<string>('VENICE_API_KEY', '');
    this.client = new OpenAI({
      apiKey: this.apiKey,
      baseURL: VENICE_BASE,
    });
  }

  async generateArticleSummary(transcript: string, channelTitle: string, videoTitle: string): Promise<string> {
    const systemPrompt = `You are a writer who turns podcast/video transcripts into short, engaging news-article-style summaries.
Preserve the speaker's personality, tone, crassness (if any), and style. Write in third person. Output only the article body (no headline). Use markdown for formatting.`;

    const res = await this.client.chat.completions.create({
      model: 'venice-uncensored',
      messages: [
        { role: 'system', content: systemPrompt },
        {
          role: 'user',
          content: `Channel: ${channelTitle}\nVideo: ${videoTitle}\n\nTranscript:\n${transcript.slice(0, 120000)}`,
        },
      ],
      max_tokens: 2000,
    });
    return res.choices[0]?.message?.content?.trim() ?? '';
  }

  async generateHeadlineImage(prompt: string): Promise<Buffer> {
    const res = await axios.post(
      `${VENICE_BASE}/image/generate`,
      {
        model: 'z-image-turbo',
        prompt: prompt.slice(0, 2000),
        width: 1024,
        height: 576,
        format: 'webp',
        return_binary: true,
      },
      {
        headers: {
          Authorization: `Bearer ${this.apiKey}`,
          'Content-Type': 'application/json',
        },
        responseType: 'arraybuffer',
      },
    );
    return Buffer.from(res.data);
  }

  async generateGencastScript(articleSummaries: string[]): Promise<string> {
    const combined = articleSummaries.map((a, i) => `[Article ${i + 1}]\n${a}`).join('\n\n');
    const systemPrompt = `You write daily podcast recap scripts. Combine the following article summaries into one cohesive podcast script.
Use a conversational tone. Add brief intros/outros. Output only the script text.`;

    const res = await this.client.chat.completions.create({
      model: 'venice-uncensored',
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: combined.slice(0, 100000) },
      ],
      max_tokens: 4000,
    });
    return res.choices[0]?.message?.content?.trim() ?? '';
  }

  async textToSpeech(text: string, voiceId: string): Promise<Buffer> {
    const res = await axios.post(
      `${VENICE_BASE}/audio/speech`,
      {
        model: 'tts-kokoro',
        input: text.slice(0, 4096),
        voice: voiceId,
        response_format: 'mp3',
      },
      {
        headers: {
          Authorization: `Bearer ${this.apiKey}`,
          'Content-Type': 'application/json',
        },
        responseType: 'arraybuffer',
      },
    );
    return Buffer.from(res.data);
  }
}
