import { isEmailAddress, parseContactSubmission } from "../../src/lib/contact.ts";

interface Env {
  CONTACT_FROM?: string;
  EMAIL?: {
    send(message: {
      to: string;
      from: { email: string; name: string };
      replyTo: string;
      subject: string;
      text: string;
    }): Promise<{ messageId: string }>;
  };
}

// This Worker is reachable only through a Pages service binding.
export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    if (request.method !== "POST" || new URL(request.url).pathname !== "/send") {
      return new Response("Not found", { status: 404 });
    }
    let payload: unknown;
    try {
      payload = await request.json();
    } catch {
      return Response.json({ error: "Invalid request" }, { status: 400 });
    }
    const parsed = parseContactSubmission(payload);
    const recipient = payload && typeof payload === "object" ? (payload as Record<string, unknown>).to : null;
    if ("error" in parsed || !isEmailAddress(recipient)) {
      return Response.json({ error: "Invalid request" }, { status: 400 });
    }
    const sender = env.CONTACT_FROM?.trim();
    if (!isEmailAddress(sender) || !env.EMAIL) {
      return Response.json({ error: "Email is not configured" }, { status: 503 });
    }

    const { name, email, message } = parsed.submission;
    try {
      const result = await env.EMAIL.send({
        to: recipient,
        from: { email: sender, name: "LUDA.AI" },
        replyTo: email,
        subject: "LUDA.AI - website contact request",
        text: `Name: ${name}\nEmail: ${email}\n\nMessage:\n${message}`,
      });
      if (!result || typeof result.messageId !== "string" || !result.messageId) {
        throw new Error("Email service did not acknowledge the message");
      }
      return Response.json({ accepted: true });
    } catch (error) {
      const code = error && typeof error === "object" && "code" in error ? error.code : null;
      console.error("contact_email_failed", typeof code === "string" && /^[A-Z0-9_]+$/.test(code) ? code : "SEND_FAILED");
      return Response.json({ error: "Email delivery is unavailable" }, { status: 503 });
    }
  },
};
