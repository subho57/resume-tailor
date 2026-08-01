#!/usr/bin/env bash
set -euo pipefail

REPO="subho57/resume-tailor"
BASE_URL="${INSTALL_BASE_URL:-https://github.com/${REPO}/releases/latest/download}"
INSTALL_DIR="${INSTALL_DIR:-$HOME/.local/bin}"

os="$(uname -s)"
arch="$(uname -m)"

# Detect CPU arch first so any OS-specific messaging below (e.g. the Windows
# manual-download link) can point at the correct -x64/-arm64 asset.
case "$arch" in
  x86_64|amd64) cpu="x64" ;;
  arm64|aarch64) cpu="arm64" ;;
  *) cpu="" ;;
esac

case "$os" in
  Darwin) platform="macos" ;;
  Linux) platform="linux" ;;
  MINGW*|MSYS*|CYGWIN*)
    # Plain POSIX `uname -s` on real Windows environments (Git Bash/MSYS,
    # Cygwin) reports something like MINGW64_NT-... or CYGWIN_NT-..., never
    # literally "Windows".
    win_cpu="${cpu:-x64}"
    echo "error: unsupported OS '$os'. Windows support is in Beta — download the .zip manually:" >&2
    echo "  https://github.com/${REPO}/releases/latest/download/tailor-resume-windows-${win_cpu}.zip" >&2
    exit 1
    ;;
  *)
    echo "error: unsupported OS '$os'." >&2
    exit 1
    ;;
esac

if [ -z "$cpu" ]; then
  echo "error: unsupported architecture '$arch'." >&2
  exit 1
fi

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

# Best-effort Carlito font check. Neither soffice nor pdfinfo presence implies
# the font is installed, so check it independently.
carlito_found=0
if command -v fc-list >/dev/null 2>&1; then
  if fc-list 2>/dev/null | grep -qi carlito; then
    carlito_found=1
  fi
elif [ "$platform" = "macos" ]; then
  # fc-list isn't a default macOS tool; look directly in the standard font
  # directories for a Carlito filename instead.
  if find /Library/Fonts "$HOME/Library/Fonts" -maxdepth 1 -iname '*arlito*' 2>/dev/null | grep -q .; then
    carlito_found=1
  fi
fi
if [ "$carlito_found" -ne 1 ]; then
  missing+=("Carlito font")
fi

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
