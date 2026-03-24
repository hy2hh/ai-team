<!-- Extracted from .claude/agents/secops.md -->

# Threat Model Document — STRIDE Example

# Threat Model: [Application Name]

## System Overview
- **Architecture**: [Monolith/Microservices/Serverless]
- **Data Classification**: [PII, financial, health, public]
- **Trust Boundaries**: [User → API → Service → Database]

## STRIDE Analysis
| Threat           | Component      | Risk  | Mitigation                        |
|------------------|----------------|-------|-----------------------------------|
| Spoofing         | Auth endpoint  | High  | MFA + token binding               |
| Tampering        | API requests   | High  | HMAC signatures + input validation|
| Repudiation      | User actions   | Med   | Immutable audit logging           |
| Info Disclosure  | Error messages | Med   | Generic error responses           |
| Denial of Service| Public API     | High  | Rate limiting + WAF               |
| Elevation of Priv| Admin panel    | Crit  | RBAC + session isolation          |

## Attack Surface
- External: Public APIs, OAuth flows, file uploads
- Internal: Service-to-service communication, message queues
- Data: Database queries, cache layers, log storage
