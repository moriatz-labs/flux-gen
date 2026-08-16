#!/bin/sh
set -eu

repo="moriatz-labs/flux-gen"
install_dir="${FLUX_INSTALL_DIR:-$HOME/.local/bin}"
os="$(uname -s)"
arch="$(uname -m)"

case "$os" in
  Darwin) platform="darwin" ;;
  *) echo "Flux supports macOS and Windows. Use install.ps1.txt on Windows." >&2; exit 1 ;;
esac

case "$arch" in
  x86_64|amd64) machine="x64" ;;
  arm64|aarch64) machine="arm64" ;;
  *) echo "Flux does not support $arch yet." >&2; exit 1 ;;
esac

asset="flux-$platform-$machine"
base="https://github.com/$repo/releases/latest/download"
tmp_dir="$(mktemp -d)"
trap 'rm -rf "$tmp_dir"' EXIT INT TERM

curl -fsSL "$base/$asset" -o "$tmp_dir/flux"
curl -fsSL "$base/checksums.txt" -o "$tmp_dir/checksums.txt"
expected="$(awk -v file="$asset" '$2 == file { print $1 }' "$tmp_dir/checksums.txt")"
[ -n "$expected" ] || { echo "No checksum published for $asset." >&2; exit 1; }

if command -v sha256sum >/dev/null 2>&1; then
  actual="$(sha256sum "$tmp_dir/flux" | awk '{print $1}')"
else
  actual="$(shasum -a 256 "$tmp_dir/flux" | awk '{print $1}')"
fi
[ "$actual" = "$expected" ] || { echo "Flux checksum verification failed." >&2; exit 1; }

mkdir -p "$install_dir"
install -m 755 "$tmp_dir/flux" "$install_dir/flux"

case ":$PATH:" in
  *":$install_dir:"*) ;;
  *)
    profile="$HOME/.profile"
    [ "${SHELL:-}" = "/bin/zsh" ] && profile="$HOME/.zshrc"
    line="export PATH=\"$install_dir:\$PATH\""
    grep -F "$line" "$profile" >/dev/null 2>&1 || printf '\n%s\n' "$line" >> "$profile"
    echo "Added $install_dir to PATH in $profile. Open a new terminal to use flux."
    ;;
esac

echo "Flux installed at $install_dir/flux"
echo "Run 'flux setup' in a new terminal to get started."
