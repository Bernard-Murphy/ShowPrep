import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import axios from 'axios';

const ELEVENLABS_BASE = 'https://api.elevenlabs.io/v1';

@Injectable()
export class ElevenLabsService {
  private readonly apiKey: string;

  constructor(private readonly config: ConfigService) {
    this.apiKey = this.config.get<string>('ELEVENLABS_API_KEY', '');
  }

  private headers() {
    return {
      'xi-api-key': this.apiKey,
      'Content-Type': 'application/json',
    };
  }

  async createVoice(name: string, audioBuffer: Buffer): Promise<{ voiceId: string }> {
    const FormData = (await import('form-data')).default;
    const form = new FormData();
    form.append('name', name);
    form.append('files', audioBuffer, { filename: 'sample.mp3', contentType: 'audio/mpeg' });
    const res = await axios.post(`${ELEVENLABS_BASE}/voices/add`, form, {
      headers: form.getHeaders(),
      maxBodyLength: Infinity,
    });
    return { voiceId: res.data.voice_id };
  }

  async textToSpeech(text: string, voiceId: string): Promise<Buffer> {
    const res = await axios.post(
      `${ELEVENLABS_BASE}/text-to-speech/${voiceId}`,
      { text: text.slice(0, 5000), model_id: 'eleven_monolingual_v1' },
      {
        headers: this.headers(),
        responseType: 'arraybuffer',
      },
    );
    return Buffer.from(res.data);
  }
}
