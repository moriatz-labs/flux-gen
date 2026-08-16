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

FluxGen is a small Bun-powered TypeScript CLI. It can improve your description with focused wallpaper skills, render the image through DEAPI, save it to your operating system's `Pictures/FluxGen` directory, and immediately set it as your wallpaper.

![An aurora wallpaper generated with FluxGen](website/public/wallpapers/aurora-borealis.webp)

## Install

macOS:

```sh
curl -fsSL https://flux-gen.moriatz.com/install.sh | sh
```

Windows PowerShell:

```powershell
irm https://flux-gen.moriatz.com/install.ps1.txt | iex
```

The installers download the latest native binary from GitHub Releases and verify its SHA-256 checksum before installing it.

## Quick start

After installation, run the guided setup:

```sh
flux setup
```

Flux links you directly to the DEAPI key page, stores the pasted key in your operating system credential store, validates it with DEAPI, and applies each newly generated image as your current wallpaper. Prompt enhancement can use one additional key from OpenAI, Google, or Anthropic. If that provider key is missing or rejected, Flux sends your original description directly to DEAPI instead of blocking generation.

Then generate:

```sh
flux a quiet observatory above the clouds at blue hour
```

After saving a wallpaper in an interactive terminal, Flux asks whether you want to create another. Choose **Yes** to enter the next description without restarting the command, or **No** to exit. Redirected and automated commands always generate once and exit.

Use `flux config` to confirm the selected models, output directory, enhancement setting, update mode, masked key status, and whether each active key comes from the environment or operating-system keychain.

## API key setup

### 1. Create a DEAPI key

DEAPI is always required because it renders the wallpaper.

1. Open the [DEAPI API Keys page](https://app.deapi.ai/settings/api-keys) and sign up or sign in.
2. Open **Dashboard → Settings → API Keys**.
3. Select **Create new secret key**.
4. Confirm that the account has sufficient credits.
5. Run `flux setup` and paste the key at the hidden prompt.

Follow the official [DEAPI quickstart](https://docs.deapi.ai/quickstart) for the current dashboard and billing flow.

### 2. Optionally choose a prompt provider

Prompt enhancement is enabled by default, but its provider key is optional. Add only the key belonging to the prompt model you select. If it is missing or rejected, Flux safely uses your original description with DEAPI.

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

## Updates

Check for a newer release without changing anything:

```sh
flux update --check
```

Download, checksum-verify, and install the latest release:

```sh
flux update
```

Choose automatic installation, notification-only checks, or disable update checks:

```sh
flux config updates
```

Update checks run at most once every 24 hours. Automatic updates use the same public, checksum-verifying installers as first-time installation. Windows finishes replacing the executable after the current Flux command exits; macOS updates it immediately.

## Commands

| Command | Purpose |
| --- | --- |
| `flux <description>` | Generate and save a wallpaper |
| `flux` | Open the interactive description prompt |
| `flux setup` | Set up keys, models, and wallpaper behavior |
| `flux config` | View nonsecret configuration and key status |
| `flux config key` | Add, replace, or remove an API key |
| `flux config enhancement` | Turn prompt enhancement on or off |
| `flux config wallpaper` | Apply new wallpapers immediately or save them only |
| `flux config updates` | Choose automatic, notification-only, or disabled update checks |
| `flux prompt-model`, `flux -pm` | Select the prompt model |
| `flux image-model`, `flux -im` | Select a live DEAPI image model |
| `flux models` | List prompt models and live DEAPI image models |
| `flux skills` | List bundled, personal, and project skills |
| `flux wallpaper next` | Immediately rotate to another saved Flux wallpaper |
| `flux update --check` | Check for a newer release |
| `flux update` | Install the latest checksum-verified release |
| `flux --help` | Show command help |

## Desktop wallpaper

Each generated image is saved in `Pictures/FluxGen` and immediately applied as the current wallpaper.

- **Windows:** Flux applies the image through the native desktop API.
- **macOS:** Flux applies the image through System Events. macOS may ask for Automation permission the first time.

Flux does not create a scheduled task or background process. Run `flux config wallpaper` if you prefer to save new images without applying them.

## Wallpaper skills

FluxGen bundles nine focused skills for composition, lighting, photography, illustration, abstraction, environments, color direction, and vivid tactile art direction. The foundation and art-direction skills are always active when enhancement is enabled.

Add your own skills at:

- Personal: `~/.flux/skills/<name>/SKILL.md`
- Project: `.flux/skills/<name>/SKILL.md`

Project skills override personal skills, which override bundled skills with the same name. FluxGen reads only `SKILL.md`; it never executes skill scripts or loads their assets and references.

## Troubleshooting

- **DEAPI key missing:** run `flux config key` and add the DEAPI key, or configure `DEAPI_API_KEY` in your automation environment.
- **DEAPI returns 401:** the key may have been pasted incorrectly. Flux offers to configure it again immediately, trims surrounding whitespace, and validates the replacement before accepting it. `flux config` shows whether the active value comes from the environment or keychain.
- **DEAPI returns 403:** Flux offers the same recovery prompt. If the replacement is accepted but 403 continues, verify that the key can use the requested model and that the account has sufficient credits.
- **Prompt-provider key missing or rejected:** Flux now continues with the original description and DEAPI. Add a valid key if you want wallpaper-skill prompt enhancement.
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

Native Windows x64, macOS x64, and macOS arm64 binaries are published with SHA-256 checksums for tagged releases. Linux is not currently supported.

## Security

See [SECURITY.md](SECURITY.md) for private vulnerability reporting. API keys and generated wallpapers remain local except when sent to the selected API providers to perform generation.

## License

FluxGen is available under the [MIT License](LICENSE).
