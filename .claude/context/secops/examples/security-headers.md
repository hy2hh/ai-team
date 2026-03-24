<!-- Extracted from .claude/agents/secops.md -->

# Security Headers — Nginx Configuration Example

```nginx
# Nginx security headers
server {
    # Prevent MIME type sniffing
    add_header X-Content-Type-Options "nosniff" always;
    # Clickjacking protection
    add_header X-Frame-Options "DENY" always;
    # XSS filter (legacy browsers)
    add_header X-XSS-Protection "1; mode=block" always;
    # Strict Transport Security (1 year + subdomains)
    add_header Strict-Transport-Security "max-age=31536000; includeSubDomains; preload" always;
    # Content Security Policy
    add_header Content-Security-Policy "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data: https:; font-src 'self'; connect-src 'self'; frame-ancestors 'none'; base-uri 'self'; form-action 'self';" always;
    # Referrer Policy
    add_header Referrer-Policy "strict-origin-when-cross-origin" always;
    # Permissions Policy
    add_header Permissions-Policy "camera=(), microphone=(), geolocation=(), payment=()" always;

    # Remove server version disclosure
    server_tokens off;
}
```
