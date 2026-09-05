import { WorkflowEntrypoint, type WorkflowEvent, type WorkflowStep } from "cloudflare:workers";

import { handleSecAnalysisRequest, runSecMemorySweep, runSecRefresh, type SecMemoryWorkflowParams, type SecWorkflowParams } from "./core.ts";
import { executeSecMemoryWorkflow } from "./memory-workflow.ts";
import { createSecPipelineOperations, type SecPipelineEnv } from "./operations.ts";
import { retryDelayForAttempt } from "./retry-policy.ts";
import { executeSecAnalysisWorkflow, type WorkflowStepContextLike, type WorkflowStepLike } from "./workflow-core.ts";
import { runIbkrFlexSync, type IbkrSyncEnv } from "./ibkr-sync.ts";

const WORKFLOW_RETRY = {
  retries: {
    limit: 3,
    delay: ({ ctx }: { ctx: WorkflowStepContextLike }) => retryDelayForAttempt(ctx.attempt),
  },
  timeout: "5 minutes",
};

function durableSteps(step: WorkflowStep): WorkflowStepLike {
  const dynamicStep = step as unknown as {
    do<T>(name: string, config: typeof WORKFLOW_RETRY, callback: (context?: WorkflowStepContextLike) => Promise<T>): Promise<T>;
  };
  return {
    do<T>(name: string, callback: (context?: WorkflowStepContextLike) => Promise<T>): Promise<T> {
      return dynamicStep.do(name, WORKFLOW_RETRY, callback);
    },
  };
}

export class SecAnalysisWorkflow extends WorkflowEntrypoint<SecPipelineEnv, SecWorkflowParams> {
  async run(event: WorkflowEvent<SecWorkflowParams>, step: WorkflowStep) {
    return executeSecAnalysisWorkflow(event.payload, event.instanceId, durableSteps(step), createSecPipelineOperations(this.env));
  }
}

export class SecMemoryWorkflow extends WorkflowEntrypoint<SecPipelineEnv, SecMemoryWorkflowParams> {
  async run(event: WorkflowEvent<SecMemoryWorkflowParams>, step: WorkflowStep) {
    return executeSecMemoryWorkflow(event.payload, event.instanceId, durableSteps(step), this.env);
  }
}

const worker = {
  async fetch(request: Request, env: SecPipelineEnv) {
    if (new URL(request.url).pathname === "/health") {
      return Response.json({ status: "ok", executor: "workflow", modelConfigured: Boolean(env.AI_API_KEY || env.SEC_BOOTSTRAP_PRIVATE_KEY) }, { headers: { "cache-control": "no-store" } });
    }
    return handleSecAnalysisRequest(request, env);
  },

  async scheduled(controller: ScheduledController, env: SecPipelineEnv & IbkrSyncEnv, context: ExecutionContext) {
    if (controller.cron === "0 6 * * 2-6") {
      context.waitUntil(runIbkrFlexSync(env).then((result) => {
        console.log(JSON.stringify({ event: "ibkr-flex-sync", ...result }));
      }));
      return;
    }
    context.waitUntil(Promise.allSettled([runSecRefresh(env), runSecMemorySweep(env)]).then((results) => {
      console.log(JSON.stringify({ event: "sec-workflows", analysis: results[0], memory: results[1] }));
    }));
  },
} satisfies ExportedHandler<SecPipelineEnv>;

export default worker;
