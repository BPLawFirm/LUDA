export interface ContactSubmission {
  name: string;
  email: string;
  message: string;
}

export function isEmailAddress(value: unknown): value is string {
  return typeof value === "string" && value.length <= 254 &&
    /^[^\s@<>]+@[^\s@<>]+\.[^\s@<>]+$/.test(value);
}

export function parseContactSubmission(value: unknown):
  { submission: ContactSubmission; error?: never } | { error: string; submission?: never } {
  if (!value || typeof value !== "object") return { error: "Invalid form data" };
  const input = value as Record<string, unknown>;
  const read = (key: string) => typeof input[key] === "string" ? input[key].trim() : "";
  const submission = { name: read("name"), email: read("email"), message: read("message") };
  if (!submission.name || !submission.email || !submission.message) {
    return { error: "All fields are required" };
  }
  if (submission.name.length > 100 || submission.email.length > 254 || submission.message.length > 5000) {
    return { error: "Field is too long" };
  }
  if (!isEmailAddress(submission.email)) return { error: "Invalid email" };
  return { submission };
}
