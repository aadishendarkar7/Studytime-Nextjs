import fs from 'node:fs';
import path from 'node:path';
import { MemoryStorage } from './memory';

/**
 * Local development storage: in memory, saved to a JSON file so data
 * survives restarts. Not for serverless hosting (no shared disk) — use Redis there.
 */
export class FileStorage extends MemoryStorage {
  private timer: NodeJS.Timeout | null = null;

  constructor(private file: string) {
    super();
    try {
      const raw = JSON.parse(fs.readFileSync(file, 'utf8')) as Record<string, { value: unknown; expiresAt?: number }>;
      for (const [key, entry] of Object.entries(raw)) this.data.set(key, entry);
    } catch {
      /* first run */
    }
  }

  protected onChange() {
    if (this.timer) return;
    this.timer = setTimeout(() => {
      this.timer = null;
      try {
        fs.mkdirSync(path.dirname(this.file), { recursive: true });
        const now = Date.now();
        const out: Record<string, unknown> = {};
        for (const [key, entry] of this.data) if (!entry.expiresAt || entry.expiresAt > now) out[key] = entry;
        fs.writeFileSync(this.file, JSON.stringify(out));
      } catch (error) {
        console.error('Could not save Studytime data:', error);
      }
    }, 250);
  }
}
