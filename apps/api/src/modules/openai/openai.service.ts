import { Injectable } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import OpenAI from "openai";

type VideoClassification = {
  isInformational: boolean;
  confidence: number;
  reason: string;
};

@Injectable()
export class OpenAiService {
  private readonly client: OpenAI;
  private readonly model: string;

  constructor(private readonly config: ConfigService) {
    this.model = this.config.get<string>("OPENAI_MODEL", "gpt-5.4-mini");
    this.client = new OpenAI({
      apiKey: this.config.get<string>("OPENAI_API_KEY", ""),
    });
  }

  async generateArticleSummary(
    transcript: string,
    channelTitle: string,
    videoTitle: string,
  ): Promise<string> {
    const systemPrompt = `You are a writer who turns podcast/video transcripts into short, engaging news-article-style summaries.
Preserve the speaker's personality and style. Write in third person. Output only markdown article body (no headline).`;

    const res = await this.client.chat.completions.create({
      model: this.model,
      messages: [
        { role: "system", content: systemPrompt },
        {
          role: "user",
          content: `Channel: ${channelTitle}\nVideo: ${videoTitle}\n\nTranscript:\n${transcript.slice(0, 120000)}`,
        },
      ],
    });
    return res.choices[0]?.message?.content?.trim() ?? "";
  }

  async generateGencastScript(articleSummaries: string[]): Promise<string> {
    const combined = articleSummaries
      .map((summary, index) => `[Article ${index + 1}]\n${summary}`)
      .join("\n\n");

    const res = await this.client.chat.completions.create({
      model: this.model,
      messages: [
        {
          role: "system",
          content:
            "You write daily podcast recap scripts. Combine summaries into one cohesive, conversational script with short intro and outro. Output script text only.",
        },
        { role: "user", content: combined.slice(0, 100000) },
      ],
    });
    return res.choices[0]?.message?.content?.trim() ?? "";
  }

  async generateHarvestOutline(articleSummaries: string[]): Promise<string> {
    const combined = articleSummaries
      .map((summary, index) => `[Topic ${index + 1}]\n${summary}`)
      .join("\n\n");
    const res = await this.client.chat.completions.create({
      model: this.model,
      messages: [
        {
          role: "system",
          content:
            "Create a concise outline summarizing the harvested content. Return markdown with sections and bullet points.",
        },
        { role: "user", content: combined.slice(0, 100000) },
      ],
    });
    return res.choices[0]?.message?.content?.trim() ?? "";
  }

  async classifyVideoInformational(input: {
    title: string;
    description: string | null;
    channelTitle: string;
  }): Promise<VideoClassification> {
    const res = await this.client.chat.completions.create({
      model: this.model,
      messages: [
        {
          role: "system",
          content:
            "Classify whether a YouTube video is informational (news, education, analysis, explainers, commentary) versus primarily entertainment (music videos, gameplay streams, pure reaction content). Respond as JSON with keys: isInformational (boolean), confidence (0..1), reason (string).",
        },
        {
          role: "user",
          content: JSON.stringify(input),
        },
      ],
      response_format: { type: "json_object" },
    });

    const raw = res.choices[0]?.message?.content?.trim() ?? "{}";
    try {
      const parsed = JSON.parse(raw) as Partial<VideoClassification>;
      return {
        isInformational: Boolean(parsed.isInformational),
        confidence: Math.max(0, Math.min(1, Number(parsed.confidence ?? 0))),
        reason: String(parsed.reason ?? "No reason provided"),
      };
    } catch {
      return {
        isInformational: true,
        confidence: 0.51,
        reason: "Classifier parse failed; defaulted to informational",
      };
    }
  }
}
