# FluxGen

<p align="center">
  <img src="website/public/flux-logo-light-cropped.png" alt="FluxGen" width="128" />
</p>

<p align="center"><strong>Turn a plain-English idea into a desktop wallpaper from your terminal.</strong></p>

<p align="center">
  <a href="https://flux-gen.moriatz.com">Website</a> ·
  <a href="#install">Install</a> ·
  <a href="#api-key-setup">API key setup</a> ·
  <a href="#commands">Commands</a>
</p>

FluxGen is a small Bun-powered TypeScript CLI. It can improve your description with focused wallpaper skills, render the image through DEAPI, and save the result to your operating system's `Pictures/FluxGen` directory.

![An aurora wallpaper generated with FluxGen](website/public/wallpapers/aurora-borealis.webp)

## Install

macOS and Linux:

```sh
curl -fsSL https://flux-gen.moriatz.com/install.sh | sh
```

Windows PowerShell:

```powershell
irm https://flux-gen.moriatz.com/install.ps1.txt | iex
```

The installers download the latest native binary from GitHub Releases and verify its SHA-256 checksum before installing it.

## Quick start

FluxGen needs a DEAPI key to create images. Prompt enhancement also needs one key from OpenAI, Google, or Anthropic.

```sh
flux config key
```

Choose **DEAPI**, select **Add or replace**, and paste the key at the hidden prompt. Run the command again and add the key for your preferred prompt model.

Then select models and generate:

```sh
flux -pm
flux -im
flux a quiet observatory above the clouds at blue hour
```

Use `flux config` to confirm the selected models, output directory, enhancement setting, and masked key status.

## API key setup

### 1. Create a DEAPI key

DEAPI is always required because it renders the wallpaper.

1. Sign up or sign in to DEAPI.
2. Open **Dashboard → Settings → API Keys**.
3. Select **Create new secret key**.
4. Confirm that the account has sufficient credits.
5. Run `flux config key` and store the key under **DEAPI**.

Follow the official [DEAPI quickstart](https://docs.deapi.ai/quickstart) for the current dashboard and billing flow.

### 2. Choose one prompt provider

Prompt enhancement is enabled by default. You need only the key belonging to the prompt model you select.

| Provider | How to create the key | Store it under |
| --- | --- | --- |
| OpenAI | Create a project API key using the [OpenAI developer quickstart](https://developers.openai.com/api/docs/quickstart). Configure API billing if the account requires it. | **OpenAI** |
| Google Gemini | Create the current restricted/auth key in Google AI Studio using the [Gemini API key guide](https://ai.google.dev/gemini-api/docs/api-key). | **Google Gemini** |
| Anthropic | Open Claude Console **Settings → API keys**, create a key, and choose an appropriate expiration as described in [Anthropic authentication](https://platform.claude.com/docs/en/manage-claude/authentication). | **Anthropic** |

Run `flux config key` after creating the key, choose the matching provider, and select **Add or replace**. Flux stores entered keys in the native operating-system credential store rather than a project file.

To replace or remove a stored key, run the same command and choose the appropriate action. `flux config` reports only whether each key is configured; it never prints the secret.

### Use FluxGen without prompt enhancement

If you want your original description sent directly to DEAPI, turn enhancement off:

```sh
flux config enhancement
```

Choose **No**. In this mode, only the DEAPI key is required and wallpaper skills are not applied.

### Environment variables

For automation or CI, these environment variables override keys stored in the operating-system credential store:

| Variable | Provider |
| --- | --- |
| `DEAPI_API_KEY` | DEAPI |
| `OPENAI_API_KEY` | OpenAI |
| `GEMINI_API_KEY` | Google Gemini |
| `ANTHROPIC_API_KEY` | Anthropic |

FluxGen does not load project `.env` files. Store automation credentials in the secret manager provided by your CI or operating system. Never put a real key in source code, commits, issues, screenshots, command examples, or shell history.

## Commands

| Command | Purpose |
| --- | --- |
| `flux <description>` | Generate and save a wallpaper |
| `flux` | Open the interactive description prompt |
| `flux config` | View nonsecret configuration and key status |
| `flux config key` | Add, replace, or remove an API key |
| `flux config enhancement` | Turn prompt enhancement on or off |
| `flux prompt-model`, `flux -pm` | Select the prompt model |
| `flux image-model`, `flux -im` | Select a live DEAPI image model |
| `flux models` | List prompt models and live DEAPI image models |
| `flux skills` | List bundled, personal, and project skills |
| `flux --help` | Show command help |

## Wallpaper skills

FluxGen bundles eight focused skills for composition, lighting, photography, illustration, abstraction, environments, and color direction. The foundation skill is always active when enhancement is enabled.

Add your own skills at:

- Personal: `~/.flux/skills/<name>/SKILL.md`
- Project: `.flux/skills/<name>/SKILL.md`

Project skills override personal skills, which override bundled skills with the same name. FluxGen reads only `SKILL.md`; it never executes skill scripts or loads their assets and references.

## Troubleshooting

- **DEAPI key missing:** run `flux config key` and add the DEAPI key, or configure `DEAPI_API_KEY` in your automation environment.
- **Prompt-provider key missing:** add the key for the model selected by `flux -pm`, select a different model, or disable enhancement.
- **No image models appear:** check the DEAPI key and account balance, then run `flux models` again.
- **A key still shows as environment:** environment variables take precedence. Remove or update that variable outside FluxGen.
- **Command not found after installation:** open a new terminal so the installer's PATH update is loaded.

## Development

Requires [Bun](https://bun.sh/) 1.3.5 or newer.

```sh
bun install --frozen-lockfile
bun run dev -- a misty forest at dawn
bun run dev:website
bun run check
```

Build the native CLI and static website:

```sh
bun run build
```

Regenerate the website demo video with FFmpeg available on `PATH`:

```sh
bun run video
```

Native Windows x64, Linux x64, macOS x64, and macOS arm64 binaries are published with SHA-256 checksums for tagged releases.

## Security

See [SECURITY.md](SECURITY.md) for private vulnerability reporting. API keys and generated wallpapers remain local except when sent to the selected API providers to perform generation.

## License

FluxGen is available under the [MIT License](LICENSE).
