#!/usr/bin/env bash
#
# Package each exercise for CodeInterview.io.
#
# For every app under apps/, this produces TWO artifacts in dist-candidate/<app>/:
#
#   1. <app>.zip          — a clean, candidate-only project archive (no _solution/,
#                           no node_modules, no dist). Use this for CodeInterview's
#                           "import project" flow.
#
#   2. PASTE_MANIFEST.md  — every candidate-facing file, in creation order, with its
#                           path as a heading and its full contents in a code block.
#                           Use this to recreate the project file-by-file in
#                           CodeInterview's React playground (the paste path).
#
# The _solution/ folder (clean reference + answer key) is NEVER included in either
# artifact. Re-run this any time you add or edit an app.
#
# Usage:  ./tools/package-for-codeinterview.sh
#
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
APPS_DIR="$ROOT/apps"
OUT_DIR="$ROOT/dist-candidate"

# Files/dirs that must never reach a candidate.
EXCLUDES=("_solution" "node_modules" "dist" "dist-ssr" ".git" "*.local" "*.log" "*.tsbuildinfo")

# Order in which to list files in the paste manifest (entry chain first, then the
# rest). Anything not matched here is appended alphabetically afterwards.
PASTE_ORDER=(
  "package.json"
  "index.html"
  "vite.config.ts"
  "tsconfig.json"
  "src/main.tsx"
  "src/App.tsx"
  "src/styles.css"
  "README.md"
)

rm -rf "$OUT_DIR"
mkdir -p "$OUT_DIR"

# Build the zip-exclude args once.
ZIP_EXCLUDES=()
for e in "${EXCLUDES[@]}"; do
  ZIP_EXCLUDES+=("-x" "*/$e/*" "-x" "$e/*" "-x" "*/$e" "-x" "$e")
done

# Map a file extension to a markdown code-fence language hint.
fence_lang() {
  case "$1" in
    *.tsx|*.ts) echo "tsx" ;;
    *.css)      echo "css" ;;
    *.html)     echo "html" ;;
    *.json)     echo "json" ;;
    *.md)       echo "markdown" ;;
    *)          echo "" ;;
  esac
}

for app_path in "$APPS_DIR"/*/; do
  app="$(basename "$app_path")"
  echo "==> packaging $app"
  app_out="$OUT_DIR/$app"
  mkdir -p "$app_out"

  # ---- 1. candidate zip ----------------------------------------------------
  (
    cd "$app_path"
    rm -f "$app_out/$app.zip"
    zip -r -q "$app_out/$app.zip" . "${ZIP_EXCLUDES[@]}"
  )

  # ---- 2. paste manifest ---------------------------------------------------
  manifest="$app_out/PASTE_MANIFEST.md"
  {
    echo "# $app — CodeInterview paste manifest"
    echo
    echo "Recreate these files (in this order) in CodeInterview's React playground."
    echo "The \`_solution/\` folder is intentionally omitted — never paste it."
    echo
  } > "$manifest"

  # Collect candidate files (exclude the private dirs/artifacts), relative paths.
  all_files=()
  while IFS= read -r line; do
    all_files+=("$line")
  done < <(
    cd "$app_path"
    find . -type f \
      -not -path "./_solution/*" \
      -not -path "./node_modules/*" \
      -not -path "./dist/*" \
      -not -name "*.log" \
      -not -name "*.tsbuildinfo" \
      -not -name "package-lock.json" \
      -not -name ".gitignore" \
      | sed 's|^\./||' | sort
  )

  emit_file() {
    local rel="$1"
    local lang
    lang="$(fence_lang "$rel")"
    {
      echo "## \`$rel\`"
      echo
      echo '```'"$lang"
      cat "$app_path/$rel"
      echo '```'
      echo
    } >> "$manifest"
  }

  # Emit ordered files first (track emitted as a newline-delimited string so this
  # works on bash 3.2, which lacks associative arrays).
  emitted=$'\n'
  for rel in "${PASTE_ORDER[@]}"; do
    if [[ -f "$app_path/$rel" ]]; then
      emit_file "$rel"
      emitted="${emitted}${rel}"$'\n'
    fi
  done
  # Then anything else not already emitted.
  for rel in "${all_files[@]}"; do
    case "$emitted" in
      *$'\n'"$rel"$'\n'*) ;;            # already emitted
      *) emit_file "$rel" ;;
    esac
  done

  echo "    -> $app_out/$app.zip"
  echo "    -> $manifest"
done

echo
echo "Done. Candidate-ready artifacts are in: $OUT_DIR"
echo "Reminder: dist-candidate/ contains ONLY candidate-facing files (no answers)."
