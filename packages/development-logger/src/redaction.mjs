const SECRET_PATTERNS = [
  /-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----[\s\S]*?-----END (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/gi,
  /\bgh[opusr]_[A-Za-z0-9_]{20,}\b/g,
  /\b(?:sk|pk)-[A-Za-z0-9_-]{20,}\b/g,
  /\beyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\b/g,
  /(authorization\s*:\s*bearer\s+)[^\s"']+/gi,
  /((?:password|passwd|secret|token|api[_-]?key|access[_-]?key)\s*[=:]\s*)[^\s,;]+/gi,
];

export function redact(value) {
  let text = String(value ?? '');
  let redacted = false;
  for (const pattern of SECRET_PATTERNS) {
    text = text.replace(pattern, (...match) => {
      redacted = true;
      const prefix = typeof match[1] === 'string' ? match[1] : '';
      return `${prefix}[REDACTED]`;
    });
  }
  return { value: text, redacted };
}

