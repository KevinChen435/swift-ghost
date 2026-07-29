// The root Next.js tsconfig includes every nested TypeScript file but the root
// package intentionally does not own this independently deployed service's SDK.
// This declaration keeps root-only typechecks hermetic. judge-gateway/tsconfig.json
// excludes it and checks against the real pinned @cloudflare/sandbox types.
declare module "@cloudflare/sandbox";

interface ExportedHandler<Env = unknown, QueueBody = unknown> {
  fetch?: (request: Request, env: Env, context: unknown) => Response | Promise<Response>;
  queue?: (batch: any, env: Env, context: unknown) => void | Promise<void>;
}
