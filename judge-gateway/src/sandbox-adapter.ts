import { getSandbox } from "@cloudflare/sandbox";
import type { Env, SandboxFactory, SandboxHandle } from "./types";

/**
 * The rest of the service depends only on SandboxFactory. Keeping the vendor
 * SDK at this boundary makes API upgrades reviewable and the judge core testable.
 */
export function cloudflareSandboxFactory(env: Env): SandboxFactory {
  return {
    create(sandboxId: string): SandboxHandle {
      const sandbox = getSandbox(env.JUDGE_SANDBOX as Parameters<typeof getSandbox>[0], sandboxId, {
        transport: "rpc",
        enableDefaultSession: false,
        keepAlive: false,
      });
      return {
        writeFile: (path, content) => sandbox.writeFile(path, content).then(() => undefined),
        exec: async (command, options) => {
          const result = await sandbox.exec(command, options);
          return {
            success: result.success,
            exitCode: result.exitCode,
            stdout: result.stdout,
            stderr: result.stderr,
          };
        },
        destroy: () => sandbox.destroy(),
      };
    },
  };
}
