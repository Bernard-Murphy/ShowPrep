import { Injectable } from "@nestjs/common";
import { InjectQueue } from "@nestjs/bullmq";
import { Queue } from "bullmq";

@Injectable()
export class ProcessingService {
  constructor(
    @InjectQueue("video-processing") private readonly videoQueue: Queue,
    @InjectQueue("gencast-generation") private readonly gencastQueue: Queue,
  ) {}

  async enqueueVideoProcessing(userId: string, type: "INITIAL" | "RECURRING") {
    await this.videoQueue.add("process", { userId, type });
    return true;
  }
}
