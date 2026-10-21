import { isEmailAddress, parseContactSubmission } from "../../src/lib/contact.ts";

interface Env {
  TURNSTILE_SECRET?: string;
  TURNSTILE_HOSTNAMES?: string;
  CONTACT_TO?: string;
  CONTACT_MAILER?: { fetch(request: Request): Promise<Response> };
}

interface SiteverifyResult {
  success: boolean;
  action?: string;
  hostname?: string;
}

type TurnstileVerification = "valid" | "invalid" | "unavailable";

const TURNSTILE_SITEVERIFY_URL =
  "https://challenges.cloudflare.com/turnstile/v0/siteverify";
const TURNSTILE_ACTION = "contact";

async function verifyTurnstile(
  request: Request,
  formData: FormData,
  env: Env,
): Promise<TurnstileVerification> {
  const secret = env.TURNSTILE_SECRET?.trim();
  const expectedHostnames = new Set(
    (env.TURNSTILE_HOSTNAMES ?? "")
      .split(",")
      .map((hostname) => hostname.trim().toLowerCase())
      .filter(Boolean),
  );
  const token = formData.get("cf-turnstile-response");

  if (
    typeof token !== "string" ||
    token.length === 0 ||
    token.length > 2048 ||
    expectedHostnames.size === 0
  ) {
    return "invalid";
  }

  if (!secret) {
    return "unavailable";
  }

  const body = new URLSearchParams({ secret, response: token });
  const clientIp = request.headers.get("CF-Connecting-IP");
  if (clientIp) {
    body.set("remoteip", clientIp);
  }

  try {
    const response = await fetch(TURNSTILE_SITEVERIFY_URL, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body,
      signal: AbortSignal.timeout(10_000),
    });

    if (!response.ok) {
      return "unavailable";
    }

    const result = (await response.json()) as SiteverifyResult;
    if (
      result.success === true &&
      result.action === TURNSTILE_ACTION &&
      typeof result.hostname === "string" &&
      expectedHostnames.has(result.hostname.toLowerCase())
    ) {
      return "valid";
    }

    return "invalid";
  } catch {
    return "unavailable";
  }
}

export async function onRequest({ request, env }: { request: Request; env: Env }) {
  if (request.method !== "POST") {
    return new Response("Method not allowed", {
      status: 405,
      headers: { Allow: "POST" },
    });
  }

  let data: FormData;
  try {
    data = await request.formData();
  } catch {
    return Response.json({ error: "Invalid form data" }, { status: 400 });
  }

  const parsed = parseContactSubmission({
    name: data.get("name"),
    email: data.get("email"),
    message: data.get("message"),
  });
  if ("error" in parsed) {
    return Response.json({ error: parsed.error }, { status: 400 });
  }

  const verification = await verifyTurnstile(request, data, env);
  if (verification === "invalid") {
    return Response.json({ error: "Unable to verify request" }, { status: 403 });
  }
  if (verification === "unavailable") {
    return Response.json(
      { error: "Submission verification is unavailable" },
      { status: 503 },
    );
  }

  const recipient = env.CONTACT_TO?.trim();
  if (!isEmailAddress(recipient) || !env.CONTACT_MAILER) {
    return Response.json({ error: "Message delivery is unavailable" }, { status: 503 });
  }

  try {
    const response = await env.CONTACT_MAILER.fetch(new Request("https://contact-mailer.internal/send", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...parsed.submission, to: recipient }),
    }));
    const result = response.ok ? await response.json() as { accepted?: unknown } : null;
    if (!response.ok || result?.accepted !== true) {
      return Response.json({ error: "Message delivery is unavailable" }, { status: 503 });
    }
  } catch {
    return Response.json({ error: "Message delivery is unavailable" }, { status: 503 });
  }

  return Response.json({ message: "Message accepted for delivery." });
}
