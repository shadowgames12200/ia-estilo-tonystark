export type JobStatus = "queued" | "running" | "completed" | "failed";

export type Job<TPayload = unknown, TResult = unknown> = {
  id: string;
  type: string;
  title: string;
  payload: TPayload;
  status: JobStatus;
  progress: number;
  result?: TResult;
  error?: string;
  createdAt: Date;
  startedAt?: Date;
  completedAt?: Date;
};

type JobHandler<TPayload, TResult> = (job: Job<TPayload, TResult>) => Promise<TResult>;

const jobs = new Map<string, Job>();

function createJobId(): string {
  return `job_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
}

/**
 * Agenda um trabalho de curta duração em memória. A função é adequada para o
 * ambiente de desenvolvimento e mantém o estado acessível enquanto a instância
 * serverless estiver ativa. Processos duráveis precisam ser migrados para uma
 * fila externa antes de serem usados em produção crítica.
 */
export function enqueueJob<TPayload, TResult>(
  type: string,
  title: string,
  handler: JobHandler<TPayload, TResult>,
  payload: TPayload,
): Job<TPayload, TResult> {
  const job: Job<TPayload, TResult> = {
    id: createJobId(),
    type,
    title,
    payload,
    status: "queued",
    progress: 0,
    createdAt: new Date(),
  };

  jobs.set(job.id, job);

  queueMicrotask(async () => {
    job.status = "running";
    job.startedAt = new Date();

    try {
      job.result = await handler(job);
      job.status = "completed";
      job.progress = 100;
    } catch (error) {
      job.status = "failed";
      job.error = error instanceof Error ? error.message : "Erro desconhecido na execução do trabalho.";
    } finally {
      job.completedAt = new Date();
    }
  });

  return job;
}

export function getJob(jobId: string): Job | undefined {
  return jobs.get(jobId);
}
