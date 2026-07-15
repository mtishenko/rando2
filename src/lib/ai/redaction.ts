/**
 * PII / secret redaction before evidence reaches the AI (SECURITY_REQUIREMENTS.md
 * "AI prompt redaction"; AI_GOVERNANCE "PII and secrets redacted before AI use").
 * Applied to every evidence string that leaves the deterministic layer, and — for
 * TV/customer-facing safety — usernames, hosts, IPs, and CVEs are stripped so the
 * model can never echo them into an output.
 */

const PATTERNS: { label: string; re: RegExp }[] = [
  { label: "email", re: /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}\b/g },
  { label: "ipv4", re: /\b(?:\d{1,3}\.){3}\d{1,3}\b/g },
  { label: "ipv6", re: /\b(?:[0-9A-Fa-f]{1,4}:){2,7}[0-9A-Fa-f]{1,4}\b/g },
  { label: "cve", re: /\bCVE-\d{4}-\d{4,7}\b/gi },
  { label: "url", re: /\bhttps?:\/\/[^\s]+/gi },
  { label: "unc", re: /\\\\[A-Za-z0-9._$-]+(?:\\[^\s]*)?/g },
  // DOMAIN\user or host\share style identifiers
  { label: "account", re: /\b[A-Za-z0-9._-]+\\[A-Za-z0-9._$-]+\b/g },
  // MAC addresses
  { label: "mac", re: /\b(?:[0-9A-Fa-f]{2}[:-]){5}[0-9A-Fa-f]{2}\b/g },
  // FQDN-like hostnames (a.b.tld) — excludes bare decimals (handled by ipv4 first)
  {
    label: "host",
    re: /\b(?=[A-Za-z0-9.-]*[A-Za-z])[A-Za-z0-9-]+(?:\.[A-Za-z0-9-]+)+\.[A-Za-z]{2,}\b/g,
  },
];

export function redactText(input: string): string {
  let out = input;
  for (const { label, re } of PATTERNS) {
    out = out.replace(re, `[redacted:${label}]`);
  }
  return out;
}

/** True if the string still contains anything that looks sensitive after redaction. */
export function hasSensitiveContent(input: string): boolean {
  return redactText(input) !== input;
}
