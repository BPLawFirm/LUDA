import assert from "node:assert/strict";
import test from "node:test";
import { onRequest } from "../functions/api/contact.ts";
import mailer from "../workers/contact-mailer/index.ts";

const submission = { name: "Test visitor", email: "visitor@example.com", message: "Test contact message" };
const config = { TURNSTILE_SECRET: "fixture-secret", TURNSTILE_HOSTNAMES: "ludasolutions.ai", CONTACT_TO: "owner@example.com" };

function formRequest(fields = {}) {
  const body = new FormData();
  for (const [key, value] of Object.entries({ ...submission, "cf-turnstile-response": "fixture-token", ...fields })) {
    body.set(key, value);
  }
  return new Request("https://ludasolutions.ai/api/contact", { method: "POST", body });
}

function turnstile(t, overrides = {}) {
  return t.mock.method(globalThis, "fetch", async () => Response.json({
    success: true, action: "contact", hostname: "ludasolutions.ai", ...overrides,
  }));
}

test("Pages and mailer compose: recipient comes from config, sender is fixed, reply goes to visitor", async (t) => {
  turnstile(t);
  const sent = [];
  const env = { ...config, CONTACT_MAILER: {
    fetch: (request) => mailer.fetch(request, {
      CONTACT_FROM: "forms@ludasolutions.ai",
      EMAIL: { send: async (message) => { sent.push(message); return { messageId: "fixture-message" }; } },
    }),
  } };
  const response = await onRequest({ request: formRequest({ to: "attacker@example.com", from: "spoof@example.com" }), env });
  assert.equal(response.status, 200);
  assert.equal(sent.length, 1);
  assert.equal(sent[0].to, "owner@example.com");
  assert.deepEqual(sent[0].from, { email: "forms@ludasolutions.ai", name: "LUDA.AI" });
  assert.equal(sent[0].replyTo, submission.email);
  assert.ok(sent[0].text.includes(submission.message));

  env.CONTACT_TO = "other-owner@example.com";
  assert.equal((await onRequest({ request: formRequest(), env })).status, 200);
  assert.equal(sent[1].to, "other-owner@example.com");
});

test("invalid fields and method never reach Turnstile or email", async (t) => {
  const verify = turnstile(t);
  const env = { ...config, CONTACT_MAILER: { fetch: () => assert.fail("Email must not be called") } };
  for (const fields of [{ name: " " }, { email: "invalid" }, { email: "a@example.com\r\nBcc: b@example.com" }, { message: "x".repeat(5001) }]) {
    assert.equal((await onRequest({ request: formRequest(fields), env })).status, 400);
  }
  const response = await onRequest({ request: new Request("https://ludasolutions.ai/api/contact"), env });
  assert.equal(response.status, 405);
  assert.equal(response.headers.get("Allow"), "POST");
  assert.equal(verify.mock.callCount(), 0);
});

test("failed Turnstile and missing configuration never send email", async (t) => {
  const verify = turnstile(t, { success: false });
  const env = { ...config, CONTACT_MAILER: { fetch: () => assert.fail("Email must not be called") } };
  assert.equal((await onRequest({ request: formRequest(), env })).status, 403);
  verify.mock.mockImplementation(async () => Response.json({ success: true, action: "contact", hostname: "wrong.example.com" }));
  assert.equal((await onRequest({ request: formRequest(), env })).status, 403);
  verify.mock.mockImplementation(async () => { throw new Error("Unavailable"); });
  assert.equal((await onRequest({ request: formRequest(), env })).status, 503);
  verify.mock.mockImplementation(async () => Response.json({ success: true, action: "contact", hostname: "ludasolutions.ai" }));
  assert.equal((await onRequest({ request: formRequest(), env: { ...env, CONTACT_TO: "" } })).status, 503);
  assert.equal((await onRequest({ request: formRequest(), env: { ...env, CONTACT_MAILER: undefined } })).status, 503);
});

test("provider or binding failure cannot produce a successful submission", async (t) => {
  turnstile(t);
  t.mock.method(console, "error", () => {});
  for (const binding of [
    { fetch: async () => { throw new Error("Binding unavailable"); } },
    { fetch: async () => Response.json({ accepted: false }) },
    { fetch: (request) => mailer.fetch(request, { CONTACT_FROM: "forms@ludasolutions.ai", EMAIL: { send: async () => { throw new Error("Provider rejected"); } } }) },
    { fetch: (request) => mailer.fetch(request, { CONTACT_FROM: "forms@ludasolutions.ai", EMAIL: { send: async () => ({}) } }) },
  ]) {
    assert.equal((await onRequest({ request: formRequest(), env: { ...config, CONTACT_MAILER: binding } })).status, 503);
  }
});

test("mailer checks its boundary before accessing the email binding", async () => {
  const env = { CONTACT_FROM: "forms@ludasolutions.ai", EMAIL: { send: () => assert.fail("Email must not be called") } };
  assert.equal((await mailer.fetch(new Request("https://internal/send"), env)).status, 404);
  const request = new Request("https://internal/send", { method: "POST", body: JSON.stringify({ ...submission, to: "not-an-email" }) });
  assert.equal((await mailer.fetch(request, env)).status, 400);
});
