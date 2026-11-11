// Fallback router for edge-runtime (used only when the stack has no main/).
// Routes /<function-name>/... to /home/deno/functions/<function-name>.
// JWT is NOT verified here (VERIFY_JWT=false) — functions that need a logged-in
// user check the token themselves.

const FUNCTIONS_DIR = "/home/deno/functions";

function json(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      "Content-Type": "application/json",
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
    },
  });
}

Deno.serve(async (req: Request) => {
  const name = new URL(req.url).pathname.split("/")[1];
  if (!name || name === "main" || name.startsWith("_") || name.includes("..")) {
    return json(400, { msg: "missing or invalid function name in request" });
  }

  const servicePath = `${FUNCTIONS_DIR}/${name}`;
  try {
    await Deno.stat(`${servicePath}/index.ts`);
  } catch {
    return json(404, { msg: `function '${name}' not found` });
  }

  try {
    // deno-lint-ignore no-explicit-any
    const worker = await (globalThis as any).EdgeRuntime.userWorkers.create({
      servicePath,
      memoryLimitMb: 256,
      workerTimeoutMs: 5 * 60 * 1000,
      noModuleCache: false,
      importMapPath: null,
      envVars: Object.entries(Deno.env.toObject()),
    });
    return await worker.fetch(req);
  } catch (e) {
    console.error(`[main] ${name}:`, e);
    return json(500, { msg: String(e) });
  }
});
