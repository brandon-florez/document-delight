import { execFile } from "node:child_process";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);

/** URL del remoto `origin` tal como la tiene Git. El servidor la normaliza. */
export async function originUrl(folder: string): Promise<string | undefined> {
  try {
    const { stdout } = await execFileAsync("git", ["remote", "get-url", "origin"], {
      cwd: folder,
      timeout: 5000,
      windowsHide: true,
    });
    const url = stdout.trim();
    return url || undefined;
  } catch {
    return undefined;
  }
}
