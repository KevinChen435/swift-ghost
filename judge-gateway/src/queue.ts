import { deliverCallback } from "./callback";
import { judgeSubmission } from "./core";
import { parsePositiveInt, parseSubmission } from "./schema";
import type { Env, JudgeQueueMessage, QueueBatch, SandboxFactory } from "./types";

export async function processQueueBatch(
  batch: QueueBatch<JudgeQueueMessage>,
  env: Env,
  sandboxFactory: SandboxFactory,
): Promise<void> {
  for (const message of batch.messages) {
    try {
      const body = message.body;
      if (!body || typeof body !== "object" || !("kind" in body)) {
        console.error("discarding malformed queue message", { messageId: message.id });
        message.ack();
        continue;
      }
      if (body.kind === "submission") {
        const request = parseSubmission(body.request, env.CALLBACK_ALLOWED_ORIGINS);
        const result = await judgeSubmission(request, sandboxFactory, {
          timeoutMs: parsePositiveInt(env.TEST_TIMEOUT_MS, 4_000, 100, 30_000),
          compileTimeoutMs: parsePositiveInt(env.COMPILE_TIMEOUT_MS, 20_000, 1_000, 60_000),
          outputLimitBytes: parsePositiveInt(env.OUTPUT_LIMIT_BYTES, 65_536, 1_024, 262_144),
        });
        // Decouple the exact result from execution retries. From here onward,
        // only this immutable callback message is redelivered.
        await env.JUDGE_QUEUE.send(
          { kind: "callback", callbackUrl: request.callbackUrl, result },
          { contentType: "json" },
        );
        message.ack();
        continue;
      }
      if (body.kind === "callback") {
        await deliverCallback(body, env);
        message.ack();
        continue;
      }
      console.error("discarding queue message with unknown kind", { messageId: message.id });
      message.ack();
    } catch (caught) {
      console.error("queue message processing failed", { messageId: message.id, attempts: message.attempts, caught });
      message.retry({ delaySeconds: Math.min(300, 2 ** Math.min(message.attempts, 8)) });
    }
  }
}
