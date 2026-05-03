import { Injectable, Logger } from '@nestjs/common';
import * as os from 'os';
import { PrismaService } from '../prisma/prisma.service';

export type ComponentStatus = 'success' | 'warning' | 'danger';

export interface HealthComponent {
  name: string;
  status: ComponentStatus;
  label: string;        // short display value, e.g. 'Healthy', 'Degraded'
  latencyMs?: number;
  message?: string;     // populated only on degraded/down
}

export interface HealthCheck {
  overall: ComponentStatus;
  components: HealthComponent[];
  timestamp: string;
}

export interface HealthMetrics {
  // The Node process running the API. Always accurate, even in containers.
  app: {
    cpuPercent: number;       // % of all cores combined
    memoryRssBytes: number;   // resident set size
  };
  // Whole-host metrics from the kernel. May overstate available memory or
  // CPU inside a container — the host is what gets reported, not the cgroup.
  system: {
    cpuPercent: number;
    memoryUsedBytes: number;
    memoryTotalBytes: number;
  };
  cores: number;
  loadAvg1m: number;
  databaseSizeBytes: number;
  timestamp: string;
}

@Injectable()
export class HealthService {
  private readonly logger = new Logger(HealthService.name);

  constructor(private readonly prisma: PrismaService) {}

  async check(): Promise<HealthCheck> {
    // API Gateway: if you're inside this method, the controller responded —
    // by definition the gateway is operational from the caller's view.
    const apiGateway: HealthComponent = {
      name: 'API Gateway',
      status: 'success',
      label: 'Operational',
    };

    const database = await this.checkDatabase();

    const components = [apiGateway, database];
    const overall = this.rollup(components);

    return {
      overall,
      components,
      timestamp: new Date().toISOString(),
    };
  }

  private async checkDatabase(): Promise<HealthComponent> {
    const start = Date.now();
    try {
      await this.prisma.$queryRaw`SELECT 1`;
      return {
        name: 'Database',
        status: 'success',
        label: 'Healthy',
        latencyMs: Date.now() - start,
      };
    } catch (e) {
      const err = e as Error;
      this.logger.warn(`Database health probe failed: ${err.message}`);
      return {
        name: 'Database',
        status: 'danger',
        label: 'Unreachable',
        latencyMs: Date.now() - start,
        message: err.message,
      };
    }
  }

  // success > warning > danger — overall is the worst component status.
  private rollup(components: HealthComponent[]): ComponentStatus {
    if (components.some((c) => c.status === 'danger')) return 'danger';
    if (components.some((c) => c.status === 'warning')) return 'warning';
    return 'success';
  }

  async metrics(): Promise<HealthMetrics> {
    // Run CPU sampling and DB size query in parallel so the request overhead
    // is dominated by whichever is slower (typically the 100ms CPU sample).
    const [cpu, databaseSizeBytes] = await Promise.all([
      this.sampleCpu(),
      this.getDbSize(),
    ]);

    const memTotal = os.totalmem();
    const memFree = os.freemem();

    return {
      app: {
        cpuPercent: round1(cpu.appPercent),
        memoryRssBytes: process.memoryUsage().rss,
      },
      system: {
        cpuPercent: round1(cpu.systemPercent),
        memoryUsedBytes: memTotal - memFree,
        memoryTotalBytes: memTotal,
      },
      cores: os.cpus().length,
      loadAvg1m: round2(os.loadavg()[0]),
      databaseSizeBytes,
      timestamp: new Date().toISOString(),
    };
  }

  // Two snapshots ~100ms apart. Computes per-process CPU as a % of all cores
  // (so 100% means "saturating every core"; a single hot core on an 8-core
  // box reads ~12.5%). System CPU is derived from `os.cpus()` user/sys/idle
  // ticks deltas summed across cores.
  private async sampleCpu(): Promise<{ appPercent: number; systemPercent: number }> {
    const sampleMs = 100;
    const cores = os.cpus().length;

    const appStart = process.cpuUsage();
    const wallStart = Date.now();
    const cpusStart = os.cpus();

    await new Promise((resolve) => setTimeout(resolve, sampleMs));

    const appDelta = process.cpuUsage(appStart);
    const wallMs = Math.max(1, Date.now() - wallStart);
    const cpusEnd = os.cpus();

    // appDelta.user/system are microseconds. Convert to ms, divide by wall ms
    // to get fraction-of-one-core-busy, then divide by cores for fraction-
    // of-all-cores-busy. ×100 for %.
    const appCpuMs = (appDelta.user + appDelta.system) / 1000;
    const appPercent = (appCpuMs / wallMs / cores) * 100;

    let idleDelta = 0;
    let totalDelta = 0;
    for (let i = 0; i < cpusStart.length; i++) {
      const a = cpusStart[i].times;
      const b = cpusEnd[i].times;
      const idle = b.idle - a.idle;
      const total = (b.user - a.user) + (b.nice - a.nice) + (b.sys - a.sys) + (b.idle - a.idle) + (b.irq - a.irq);
      idleDelta += idle;
      totalDelta += total;
    }
    const systemPercent = totalDelta > 0 ? (1 - idleDelta / totalDelta) * 100 : 0;

    return {
      appPercent: clampPercent(appPercent),
      systemPercent: clampPercent(systemPercent),
    };
  }

  private async getDbSize(): Promise<number> {
    try {
      const rows = await this.prisma.$queryRaw<{ size: bigint }[]>`
        SELECT pg_database_size(current_database())::bigint AS size
      `;
      const raw = rows[0]?.size ?? BigInt(0);
      return Number(raw);
    } catch (e) {
      this.logger.warn(`pg_database_size probe failed: ${(e as Error).message}`);
      return 0;
    }
  }
}

function clampPercent(n: number): number {
  if (!isFinite(n) || n < 0) return 0;
  if (n > 100) return 100;
  return n;
}

function round1(n: number): number {
  return Math.round(n * 10) / 10;
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}
