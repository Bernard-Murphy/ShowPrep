import { Injectable, ForbiddenException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { VeniceService } from '../venice/venice.service';
import { ElevenLabsService } from '../elevenlabs/elevenlabs.service';
import { VoiceProvider } from '@prisma/client';

@Injectable()
export class VoicesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly venice: VeniceService,
    private readonly elevenlabs: ElevenLabsService,
  ) {}

  async listVoices(userId?: string | null) {
    const where = userId
      ? { OR: [{ userId: null }, { userId }] }
      : { userId: null };
    return this.prisma.voice.findMany({
      where,
      orderBy: [{ isDefault: 'desc' }, { name: 'asc' }],
    });
  }

  async getVoice(id: string) {
    return this.prisma.voice.findUnique({ where: { id } });
  }

  async getDefaultVoiceId(): Promise<string> {
    const v = await this.prisma.voice.findFirst({
      where: { isDefault: true, provider: 'VENICE' },
    });
    if (!v) throw new ForbiddenException('No default voice configured');
    return v.id;
  }

  async createCustomVoice(userId: string, name: string, audioBuffer: Buffer) {
    const { voiceId } = await this.elevenlabs.createVoice(name, audioBuffer);
    return this.prisma.voice.create({
      data: {
        name,
        userId,
        provider: 'ELEVENLABS',
        providerVoiceId: voiceId,
        isDefault: false,
      },
    });
  }

  async deleteVoice(id: string, userId: string) {
    const voice = await this.prisma.voice.findUnique({ where: { id } });
    if (!voice) throw new ForbiddenException('Voice not found');
    if (voice.userId !== userId) throw new ForbiddenException('Not your voice');
    await this.prisma.voice.delete({ where: { id } });
    return true;
  }

  async textToSpeech(text: string, voiceId: string): Promise<Buffer> {
    const voice = await this.prisma.voice.findUnique({ where: { id: voiceId } });
    if (!voice) throw new ForbiddenException('Voice not found');
    if (voice.provider === 'VENICE') {
      return this.venice.textToSpeech(text, voice.providerVoiceId);
    }
    return this.elevenlabs.textToSpeech(text, voice.providerVoiceId);
  }
}
