import { ContainerProxy, Sandbox } from "@cloudflare/sandbox";
import { fetchHandler } from "./ingress";
import { processQueueBatch } from "./queue";
import { cloudflareSandboxFactory } from "./sandbox-adapter";
import type { Env, JudgeQueueMessage, QueueBatch } from "./types";

export { ContainerProxy };

export class JudgeSandbox extends Sandbox {
  enableInternet = false;
}

async function queueHandler(batch: QueueBatch<JudgeQueueMessage>, env: Env): Promise<void> {
  return processQueueBatch(batch, env, cloudflareSandboxFactory(env));
}

export { fetchHandler, queueHandler };

export default {
  fetch: fetchHandler,
  queue: queueHandler,
} satisfies ExportedHandler<Env, JudgeQueueMessage>;
