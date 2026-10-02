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

FluxGen is a small Bun-powered TypeScript CLI. It can improve your description with focused wallpaper skills, render through your Codex/ChatGPT subscription or DEAPI, save the image to your operating system's `Pictures/FluxGen` directory, and immediately set it as your wallpaper.

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

Linux x64 (local source build):

```sh
bun install --frozen-lockfile
bun run build:cli
./dist/flux local install
```

Linux stores settings under `${XDG_CONFIG_HOME:-~/.config}/flux-gen`. Its local model uses the checksum-pinned llama.cpp Vulkan runtime by default; use `local install --cpu` without a compatible GPU. Applying wallpapers requires a running Noctalia shell with `noctalia msg wallpaper-set`; other Linux desktops can use save-only mode. Linux releases and automatic binary installation are not available; update the source and rebuild manually.

## Quick start

### Daily enchanted forests

The forest recipe directs immersive Avatar-inspired elemental woodland scenes with fire, earth, golden-yellow lightning, violet-purple energy, water and air. It rotates 12 lighting palettes and 36 matching elemental phenomena while preserving the depth and atmosphere of moonlit and golden forests. Ferns, moss, oversized botanical objects and characters are excluded. This is persistent prompt guidance, not model-weight training. Connect a dedicated shared assets checkout, then generate today's forest without interactive prompts:

```sh
flux -pm codex
flux -im codex-image
flux forest init --assets /absolute/path/to/Global-Assets --remote https://github.com/YOUR_ACCOUNT/Global-Assets.git --timezone Asia/Kolkata
flux forest plan
flux forest daily --publish
```

`daily` generates once per calendar day, preserves the original PNG, creates a WebP with FFmpeg, and saves prompts, actual dimensions and SHA-256 metadata under `wallpapers/forests/daily/YYYY/MM/`. Re-running it reuses the saved image and retries incomplete conversion or publication. Palettes rotate without repetition; each elemental family rotates its six matching phenomena. Configure Git LFS in the assets repository to keep binary history manageable.

Publishing requires that dedicated checkout on `main` with the expected `origin`. Only today's PNG, WebP and manifest are committed. Unrelated staged changes, remote updates, or unrelated unpushed commits stop publication while preserving the generated image. Image generation uses the Codex subscription route and never silently falls back to a paid provider.

Schedule `flux forest daily --publish` in a Codex chat for a daily run. Local schedules require the computer on and the app running. Other repositories can consume Global Assets as a Git submodule, updating their pinned commit when they want new artwork.

On Noctalia, automatic login-greeter appearance synchronization can request administrator authentication after a wallpaper change. To keep unattended desktop changes unprivileged, set `auto_sync = false` in the user's `[shell.greeter_sync]` configuration and run `noctalia msg config-reload`. Manual greeter synchronization retains normal system authentication.

### Store every image in Paper

Create a Paper file and page, enable Paper's desktop MCP, and connect their IDs:

```sh
flux paper init --file YOUR_FILE_ID --page YOUR_PAGE_ID --daily-page YOUR_DAILY_PAGE_ID
flux paper sync
```

Once connected, ordinary generation and `forest daily` import each original PNG as a full-size image on its own artboard. Copies with the same SHA-256 share one entry. Paper receives the pixels, so the saved image does not depend on its original local path. If Paper is closed or an upload fails, Flux preserves pending pixels locally and continues the wallpaper workflow. The next generation or `flux paper sync` retries without regenerating or duplicating images, including interrupted imports.

Settings live in the user configuration directory's `paper.json`, outside the repository. Its `sources` array can include additional absolute image directories with optional `pageId` destinations; sync scans original PNGs recursively, excluding verification screenshots and WebP derivatives. The default source is the configured wallpaper output directory. Paper must be running for uploads; no additional API key is needed. Include `flux paper sync` in a daily Codex automation to catch up other image sources.

### General wallpaper generation

After installation, download the local prompt model and runtime, then run the guided setup for image generation:

```sh
flux local install
flux setup
```

Flux defaults to the frozen local Qwen prompt writer. It needs no prompt-provider API key. The default DEAPI renderer requires its own key, stored in your operating system credential store. Alternatively, select `codex-image` to render through your Codex/ChatGPT subscription without provider keys. Existing users keep their selected provider until they run `flux local install` or choose another model with `flux -pm`.

Run `flux local start` in a separate terminal and leave it open. Preview text with `flux prompt "a quiet embroidered coastline"`, or generate an image with the command below. The model download is about 2.50 GB; allow at least 6 GB free disk space. Windows defaults to NVIDIA CUDA; use `flux local install --cpu` on Windows without NVIDIA. macOS uses native Intel/Apple Silicon runtimes. CPU inference can be considerably slower; laptop measurements are not a guarantee for other hardware.

Then generate:

```sh
flux a quiet observatory above the clouds at blue hour
```

After saving a wallpaper in an interactive terminal, Flux asks whether you want to create another. Choose **Yes** to enter the next description without restarting the command, or **No** to exit. Redirected and automated commands always generate once and exit.

Use `flux config` to confirm the selected models, output directory, enhancement setting, update mode, masked key status, and whether each active key comes from the environment or operating-system keychain.

## API key setup

### Images through your ChatGPT subscription

For an entirely subscription-backed workflow, sign in to Codex and select both the prompt writer and image renderer:

```sh
codex login
flux -pm codex
flux -im codex-image
flux "a magical forest with silver moonlight, turquoise pools and softly glowing mushrooms"
```

`codex` explicitly uses GPT-6 Astra with high reasoning for art direction. `codex-image` invokes the built-in GPT Image 2 renderer through that same CLI login. This route requires neither `DEAPI_API_KEY` nor `OPENAI_API_KEY` and makes no DEAPI requests. The image call uses only the built-in generation tool, with shells, plugins, browsers, and project instructions disabled. Flux validates that the returned PNG is a new file inside Codex's `generated_images` directory before copying it to Pictures/FluxGen. The original generated file is preserved.

Image generation counts toward your [included Codex usage limits](https://learn.chatgpt.com/docs/pricing#image-generation-usage-limits), using them faster than text-only requests. This is subscription access through Codex; direct Images API calls are separately billed. The [built-in image-generation docs](https://learn.chatgpt.com/docs/image-generation) currently specify GPT Image 2. The tool controls final resolution and quality; a requested size is not guaranteed. Generation can take several minutes. Failures stop the command without switching to a paid provider.

`flux -pm codex-sol` selects GPT-6.1 Sol if that model is available to your Codex login. Account availability can differ from the API catalogue. Use `codex` when Sol is unavailable. `flux config` shows the actual selected prompt model, reasoning level, and image route.

### 1. Create a DEAPI key

A DEAPI key is required only when you choose a DEAPI image model rather than `codex-image`.

1. Open the [DEAPI API Keys page](https://app.deapi.ai/settings/api-keys) and sign up or sign in.
2. Open **Dashboard → Settings → API Keys**.
3. Select **Create new secret key**.
4. Confirm that the account has sufficient credits.
5. Run `flux setup` and paste the key at the hidden prompt.

Follow the official [DEAPI quickstart](https://docs.deapi.ai/quickstart) for the current dashboard and billing flow.

### 2. Optionally choose a prompt provider

Local prompt enhancement is enabled by default and needs no provider key. Cloud prompt models are optional compatibility choices. Add only the key belonging to a cloud model you explicitly select. If a selected cloud provider has no key, Flux can use built-in wallpaper heuristics; this is separate from the local language model.

Choose a model during `flux setup` or change it later with `flux -pm`:

| Provider | Prompt models |
| --- | --- |
| Local (default) | `flux-local` — frozen Qwen3-4B positive-v2 |
| Codex CLI | `codex` — GPT-6 Astra; `codex-sol` — GPT-6.1 Sol; both use high reasoning and your existing CLI login |
| OpenAI | `gpt-5.6-luna`, `gpt-5.6-terra`, `gpt-5.6-sol` |
| Google | `gemini-3.6-flash` |
| Anthropic | `claude-haiku-4-5`, `claude-sonnet-5`, `claude-opus-5` |

Luna and Haiku favor cost and speed, Terra and Sonnet balance quality with cost, and Sol and Opus favor maximum prompt quality. Provider access and billing still determine which models an API key can use. Run `flux models` to see the complete prompt roster and the live DEAPI image-model catalogue.

When a cloud prompt model is selected without its key, interactive generation asks four quick visual questions:

1. Visual style — for example photographic, illustrated, pixel art, abstract, or cinematic.
2. Lighting — for example soft daylight, golden hour, blue hour, dramatic, or neon.
3. Composition — centered, off-center, minimal, or layered panorama.
4. Color mood — warm, cool, dark, vibrant, or earthy.

Every question defaults to **Auto**. Press Enter to skip any individual question and let Flux infer that answer. Automated and redirected commands skip all four questions and infer these decisions from the original sentence. In both cases Flux adds a full-bleed 16:9 composition, desktop-safe calm edges, atmospheric depth, controlled color, tactile detail, and a clean image-only field before sending the prompt to DEAPI.

| Provider | How to create the key | Store it under |
| --- | --- | --- |
| OpenAI | Create a project API key using the [OpenAI developer quickstart](https://developers.openai.com/api/docs/quickstart). Configure API billing if the account requires it. | **OpenAI** |
| Google Gemini | Create the current restricted/auth key in Google AI Studio using the [Gemini API key guide](https://ai.google.dev/gemini-api/docs/api-key). | **Google Gemini** |
| Anthropic | Open Claude Console **Settings → API keys**, create a key, and choose an appropriate expiration as described in [Anthropic authentication](https://platform.claude.com/docs/en/manage-claude/authentication). | **Anthropic** |

Run `flux config key` after creating the key, choose the matching provider, and select **Add or replace**. Flux stores entered keys in the native operating-system credential store rather than a project file.

### Use your Codex account for prompt writing

Install the Codex CLI and run `codex login`, then run `flux -pm codex` for GPT-6 Astra or `flux -pm codex-sol` for GPT-6.1 Sol. Flux invokes `codex exec` with an explicit model and high reasoning for each wallpaper prompt, using the CLI's existing authentication. It requires no prompt-provider key in FluxGen and no local model server. Model availability and Codex account usage limits still apply. With a DEAPI image model, rendering uses its own key; with `codex-image`, rendering uses your Codex subscription. An unavailable selected model fails before image submission; Flux never silently changes models.

The prompt writer runs in an empty temporary directory with a read-only sandbox, tools and plugins disabled, and no project instructions. Only the wallpaper request and relevant prompt skills are sent as input. Image-provider API keys are excluded from the child environment. Failed Codex requests stop generation rather than falling back silently.

To replace or remove a stored key, run the same command and choose the appropriate action. `flux config` reports only whether each key is configured; it never prints the secret.

### Use FluxGen without prompt enhancement

If you want your original description sent directly to DEAPI, turn enhancement off:

```sh
flux config enhancement
```

Choose **No**. In this mode, wallpaper skills are not applied. A DEAPI image model still requires its key; `codex-image` uses your Codex login.

### Environment variables

For automation or CI, these environment variables override keys stored in the operating-system credential store:

| Variable | Provider |
| --- | --- |
| `DEAPI_API_KEY` | DEAPI |
| `OPENAI_API_KEY` | OpenAI |
| `GEMINI_API_KEY` | Google Gemini |
| `ANTHROPIC_API_KEY` | Anthropic |

The standalone FluxGen binary does not load project `.env` files. Bun source invocations can explicitly load a local file with `bun --env-file=.env.local run src/index.ts`. If using this development option, keep the file git-ignored and readable only by your user. Store automation credentials in the secret manager provided by your CI or operating system. Never put a real key in source code, commits, issues, screenshots, command examples, or shell history.

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
| `flux image-model`, `flux -im` | Select subscription or DEAPI image generation; `flux -im codex-image` selects your Codex login |
| `flux models` | List prompt models, subscription rendering, and current DEAPI image models |
| `flux skills` | List bundled, personal, and project skills |
| `flux wallpaper next` | Immediately rotate to another saved Flux wallpaper |
| `flux update --check` | Check for a newer release |
| `flux update` | Install the latest checksum-verified release |
| `flux --help` | Show command help |

## Desktop wallpaper

Each generated image is saved in `Pictures/FluxGen` and immediately applied as the current wallpaper.

- **Windows:** Flux applies the image through the native desktop API.
- **macOS:** Flux applies the image through System Events. macOS may ask for Automation permission the first time.
- **Linux with Noctalia:** Flux applies the image through the shell's wallpaper IPC command.

Flux does not create a scheduled task or background process. Run `flux config wallpaper` if you prefer to save new images without applying them.

## Wallpaper skills

FluxGen bundles nine focused skills for composition, lighting, photography, illustration, abstraction, environments, color direction, and vivid tactile art direction. The foundation and art-direction rules are always applied when enhancement is enabled—even without a prompt-model key, where equivalent deterministic heuristics run locally.

Add your own skills at:

- Personal: `~/.flux/skills/<name>/SKILL.md`
- Project: `.flux/skills/<name>/SKILL.md`

Project skills override personal skills, which override bundled skills with the same name. FluxGen reads only `SKILL.md`; it never executes skill scripts or loads their assets and references.

## Troubleshooting

- **DEAPI key missing:** run `flux config key` and add the DEAPI key, or configure `DEAPI_API_KEY` in your automation environment.
- **DEAPI returns 401:** the key may have been pasted incorrectly. Flux offers to configure it again immediately, trims surrounding whitespace, and validates the replacement before accepting it. `flux config` shows whether the active value comes from the environment or keychain.
- **DEAPI returns 403:** Flux offers the same recovery prompt. If the replacement is accepted but 403 continues, verify that the key can use the requested model and that the account has sufficient credits.
- **Prompt-provider key missing or rejected:** Flux uses its local wallpaper director and continues with DEAPI. In an interactive terminal it asks about style, lighting, composition, and color; automation uses inferred defaults.
- **No image models appear:** check the DEAPI key and account balance, then run `flux models` again.
- **A key still shows as environment:** environment variables take precedence. Remove or update that variable outside FluxGen.
- **Command not found after installation:** open a new terminal so the installer's PATH update is loaded.

## Development

Requires [Bun](https://bun.sh/) 1.3.5 or newer.

Clone the public repository and install its locked dependencies:

```sh
git clone https://github.com/moriatz-labs/flux-gen.git
cd flux-gen
bun install --frozen-lockfile
```

Run the CLI, website, and full verification suite:

```sh
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

### Local prompt writer

`flux-local` is the default for new configurations. `flux local install` downloads checksum-pinned model shards and the official llama.cpp b10819 runtime, then selects local prompt writing. `flux local start` serves it only at `127.0.0.1:8080`. Leave that terminal open; Ctrl+C stops the server. Initial CUDA compilation may take several minutes; wait until the server is ready before sending requests.

```sh
flux prompt a quiet embroidered coastline
```

This command prints only an expanded prompt and does not require DEAPI or generate an image. Local refinement needs no provider API key, makes no cloud selection calls, and never falls back to a remote provider. If the local server is unavailable, Flux reports how to start it. Existing cloud model choices remain available.

Prompts normally contain 80–180 words and may contain up to 250. The writer is instructed to preserve explicit orientations and constraints, but can make mistakes; review the output when those details matter. The image renderer still controls supported dimensions. The model is distributed as separate release assets, not embedded in the executable. Training data and checkpoints remain outside this repository.

The frozen positive-v2 model is experimental: its 30-case blind Codex editorial comparison scored 36.7% against the stronger base-model baseline (ties counted as half), below the 60% target, with one explicit color violation. Format checks passed and no complete-prompt copying was flagged. It is released by maintainer choice, not as a proven quality improvement. Windows RTX 5070 Laptop testing measured a 1.55-second median across ten warm CLI requests and 3949 MiB peak total GPU usage. macOS and CPU quality/performance have not been measured. See [MODEL_CARD.md](MODEL_CARD.md).

### Add a prompt model

Flux keeps its selectable prompt models deliberately explicit:

1. Add the provider's exact API model ID to `promptModelIds` in `src/types.ts`.
2. Add its label and provider mapping to `promptModels` in `src/constants.ts`.
3. If it uses OpenAI, Google, or Anthropic, the existing adapter in `src/prompt-providers.ts` handles the request. A new provider also needs a provider ID, key URL, environment-variable mapping, credential-store option, and request adapter.
4. Add provider mapping and response-shape coverage in `tests/providers.test.ts`.
5. Update the model roster in `website/index.html` and run `bun run check`.

Use only model IDs documented by the provider. DEAPI image models do not need to be hard-coded: `flux -im` discovers its current text-to-image catalogue dynamically.

Native Windows x64, macOS x64, and macOS arm64 binaries are published with SHA-256 checksums for tagged releases. Linux x64 can be built from source with the local Vulkan or CPU prompt runtime; applying wallpapers currently supports Noctalia.

## Security

See [SECURITY.md](SECURITY.md) for private vulnerability reporting. API keys and generated wallpapers remain local except when sent to the selected API providers to perform generation.

## License

FluxGen is available under the [MIT License](LICENSE).
