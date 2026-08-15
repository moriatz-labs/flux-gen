# Security policy

## Reporting a vulnerability

Please do not report security vulnerabilities in a public issue.

Use GitHub's private vulnerability reporting for this repository:

https://github.com/moriatz-labs/flux-gen/security/advisories/new

Include the affected version, reproduction steps, impact, and any suggested mitigation. Do not include real API keys or other credentials.

## Credential handling

FluxGen stores keys entered through the CLI in the operating system's native credential store. Environment variables override stored credentials for automation use. The project does not load keys from project-local environment files and must never log, display, or include them in generated output.
