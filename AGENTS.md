# FluxGen repository contract

FluxGen is a minimal TypeScript wallpaper CLI and its public static website.

- Use Bun for the CLI, tests, dependency installation, and standalone executables.
- Keep `website/` framework-light: vanilla TypeScript and plain CSS.
- This project does not consume a UI design system. The self-hosted Strawn typeface is allowed only in the website's `.hero-copy` region. Keep the README, navigation, documentation, controls, gallery content, code, and body copy on FluxGen's existing type stack.
- Treat `skills/*/SKILL.md` as the portable prompt-expertise boundary. Bundled skills may be embedded, but user skills are read only from `.flux/skills` and `~/.flux/skills`.
- Never execute scripts or load assets/references from user skills.
- Never print or persist API-key values in configuration, logs, fixtures, or generated output.
- Keep provider-specific request code behind adapters and test it with mocked `fetch`.
- Native CLI releases originate from reviewed `main` through GitHub Actions.
- Website hosting, custom-domain management, and provider operations are owned outside this public repository. Do not add operational infrastructure, provider configuration, or credentials here.
