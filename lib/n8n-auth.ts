/**
 * Machine-to-machine auth for n8n → internal API routes.
 * Send header: x-n8n-secret: <same value as N8N_SECRET in .env>
 */
export function validateN8nSecret(req: Request): boolean {
  const expected = process.env.N8N_SECRET;
  if (!expected || expected.trim() === "") {
    return false;
  }
  const got = req.headers.get("x-n8n-secret");
  return got === expected;
}
