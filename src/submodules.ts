import { z } from 'zod';

export const SubmoduleConfig = z.object({
  repo: z.string(),
  branch: z.string()
});

export async function execForSubmodule(submodPath: string, config: z.infer<typeof SubmoduleConfig>) {
  // If missing, clone
  // If branch mismatch, display warning
  // 
}