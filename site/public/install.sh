#!/usr/bin/env bash
set -euo pipefail

REPO="subho57/resume-tailor"
BASE_URL="${INSTALL_BASE_URL:-https://github.com/${REPO}/releases/latest/download}"
INSTALL_DIR="${INSTALL_DIR:-$HOME/.local/bin}"

os="$(uname -s)"
arch="$(uname -m)"

case "$os" in
  Darwin) platform="macos" ;;
  Linux) platform="linux" ;;
  *)
    echo "error: unsupported OS '$os'. Windows support is in Beta — download the .zip manually:" >&2
    echo "  https://github.com/${REPO}/releases/latest/download/tailor-resume-windows-x64.zip" >&2
    exit 1
    ;;
esac

case "$arch" in
  x86_64|amd64) cpu="x64" ;;
  arm64|aarch64) cpu="arm64" ;;
  *)
    echo "error: unsupported architecture '$arch'." >&2
    exit 1
    ;;
esac

asset="tailor-resume-${platform}-${cpu}.tar.gz"
url="${BASE_URL}/${asset}"

echo "Downloading ${url} ..."
tmp="$(mktemp -d)"
trap 'rm -rf "$tmp"' EXIT
curl -fsSL "$url" -o "$tmp/$asset"
tar -xzf "$tmp/$asset" -C "$tmp"

mkdir -p "$INSTALL_DIR"
mv "$tmp/tailor-resume" "$INSTALL_DIR/tailor-resume"
chmod +x "$INSTALL_DIR/tailor-resume"
echo "Installed tailor-resume to ${INSTALL_DIR}/tailor-resume"

case ":$PATH:" in
  *":$INSTALL_DIR:"*) ;;
  *)
    echo ""
    echo "NOTE: ${INSTALL_DIR} is not on your PATH. Add this to your shell profile:"
    echo "  export PATH=\"${INSTALL_DIR}:\$PATH\""
    ;;
esac

echo ""
echo "Installing Claude Code / Copilot skills (jd-tailored-resume, master-resume-builder) ..."
"$INSTALL_DIR/tailor-resume" --install-skill

echo ""
echo "Checking PDF/autofit prerequisites (LibreOffice + Poppler + Carlito font) ..."
missing=()
command -v soffice >/dev/null 2>&1 || missing+=("soffice (LibreOffice)")
command -v pdfinfo >/dev/null 2>&1 || missing+=("pdfinfo (Poppler)")

if [ ${#missing[@]} -eq 0 ]; then
  echo "All prerequisites present."
else
  echo "Missing: ${missing[*]}"
  if [ "$platform" = "macos" ]; then
    if command -v brew >/dev/null 2>&1; then
      echo "Installing via brew ..."
      brew install --cask libreoffice
      brew install poppler
      brew install --cask font-carlito
    else
      echo "Homebrew not found. Install it first (https://brew.sh), then run:"
      echo "  brew install --cask libreoffice && brew install poppler && brew install --cask font-carlito"
    fi
  else
    if command -v apt >/dev/null 2>&1; then
      echo "Installing via apt (may prompt for sudo) ..."
      sudo apt install -y libreoffice poppler-utils fonts-crosextra-carlito
    elif command -v dnf >/dev/null 2>&1; then
      echo "Installing via dnf (may prompt for sudo) ..."
      sudo dnf install -y libreoffice poppler-utils crosextra-carlito-fonts
    elif command -v brew >/dev/null 2>&1; then
      echo "No apt/dnf found; Homebrew is present but its Linux --cask support is limited for LibreOffice."
      echo "Try: brew install libreoffice poppler — if that fails, install LibreOffice via your distro's package manager instead."
    else
      echo "No apt, dnf, or brew found. Install LibreOffice, Poppler, and the Carlito font manually for your distro."
    fi
  fi
fi

echo ""
echo "Done. Run 'tailor-resume --version' to confirm."
