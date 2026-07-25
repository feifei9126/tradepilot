import { randomUUID } from "node:crypto";
import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";

import type { StoredProductVideoJob } from "../store";

export class ProductVideoJobRepository {
  private mutationQueue: Promise<unknown> = Promise.resolve();

  constructor(private readonly filePath: string) {}

  private async readJobs(): Promise<StoredProductVideoJob[]> {
    try {
      const parsed: unknown = JSON.parse(
        await readFile(/* turbopackIgnore: true */ this.filePath, "utf8"),
      );
      return Array.isArray(parsed) ? parsed as StoredProductVideoJob[] : [];
    } catch (error: unknown) {
      if ((error as NodeJS.ErrnoException).code === "ENOENT") return [];
      throw error;
    }
  }

  private async writeJobs(jobs: StoredProductVideoJob[]) {
    const directory = dirname(this.filePath);
    const temporaryPath = join(directory, `.product-video-jobs-${process.pid}-${randomUUID()}.tmp`);
    await mkdir(directory, { recursive: true });
    await writeFile(temporaryPath, JSON.stringify(jobs, null, 2), { encoding: "utf8", mode: 0o600 });
    await rename(temporaryPath, this.filePath);
  }

  private enqueue<T>(operation: () => Promise<T>): Promise<T> {
    const next = this.mutationQueue.then(operation, operation);
    this.mutationQueue = next.then(() => undefined, () => undefined);
    return next;
  }

  async list() {
    await this.mutationQueue;
    return this.readJobs();
  }

  async get(id: string) {
    return (await this.list()).find((job) => job.id === id);
  }

  add(job: StoredProductVideoJob) {
    return this.enqueue(async () => {
      const jobs = await this.readJobs();
      jobs.unshift(job);
      await this.writeJobs(jobs);
      return job;
    });
  }

  update(id: string, data: Partial<StoredProductVideoJob>) {
    return this.enqueue(async () => {
      const jobs = await this.readJobs();
      const index = jobs.findIndex((job) => job.id === id);
      if (index < 0) return null;

      jobs[index] = {
        ...jobs[index],
        ...data,
        updatedAt: new Date().toISOString(),
      };
      await this.writeJobs(jobs);
      return jobs[index];
    });
  }

  delete(id: string) {
    return this.enqueue(async () => {
      const jobs = await this.readJobs();
      const filtered = jobs.filter((job) => job.id !== id);
      if (filtered.length === jobs.length) return false;
      await this.writeJobs(filtered);
      return true;
    });
  }
}

const dataDirectory = process.env.TRADEPILOT_DATA_DIR || "data";
export const productVideoJobs = new ProductVideoJobRepository(
  join(dataDirectory, "product-video-jobs.json"),
);
