#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
BACKUP_ROOT="${BACKUP_ROOT:-$ROOT_DIR/backups}"
STATE_DIR="$BACKUP_ROOT/.state"
LATEST_MANIFEST="$STATE_DIR/latest-manifest.tsv"

usage() {
  cat <<'EOF'
Usage: scripts/backup.sh [--full|--incremental|--auto]

Creates timestamped backups under ./backups.

Modes:
  --auto         Full backup if no previous manifest exists; otherwise changed files only. Default.
  --full         Copy every included project file.
  --incremental  Copy only files changed since the previous backup manifest.

Included files exclude .git, backups, and .DS_Store metadata.
EOF
}

mode="auto"
case "${1:-}" in
  ""|--auto) mode="auto" ;;
  --full) mode="full" ;;
  --incremental) mode="incremental" ;;
  -h|--help) usage; exit 0 ;;
  *) usage >&2; exit 2 ;;
esac

if [[ "$mode" == "auto" && ! -f "$LATEST_MANIFEST" ]]; then
  mode="full"
elif [[ "$mode" == "auto" ]]; then
  mode="incremental"
fi

if [[ "$mode" == "incremental" && ! -f "$LATEST_MANIFEST" ]]; then
  echo "No previous backup manifest found. Run --full first, or use --auto." >&2
  exit 1
fi

timestamp="$(date '+%Y-%m-%d_%H-%M-%S')"
backup_dir="$BACKUP_ROOT/${timestamp}_${mode}"
manifest_file="$backup_dir/manifest.tsv"
changed_file="$backup_dir/changed-files.txt"
deleted_file="$backup_dir/deleted-files.txt"

mkdir -p "$backup_dir" "$STATE_DIR"

tmp_manifest="$(mktemp)"
tmp_changed="$(mktemp)"
tmp_deleted="$(mktemp)"
cleanup() {
  rm -f "$tmp_manifest" "$tmp_changed" "$tmp_deleted"
}
trap cleanup EXIT

cd "$ROOT_DIR"

find . \
  -path './.git' -prune -o \
  -path './backups' -prune -o \
  -name '.DS_Store' -prune -o \
  -type f -print0 |
while IFS= read -r -d '' file; do
  rel="${file#./}"
  hash="$(shasum -a 256 "$rel" | awk '{print $1}')"
  printf '%s\t%s\n' "$hash" "$rel"
done | LC_ALL=C sort -k2,2 > "$tmp_manifest"

if [[ "$mode" == "full" ]]; then
  cut -f2 "$tmp_manifest" > "$tmp_changed"
  : > "$tmp_deleted"
else
  awk -F '\t' '
    NR == FNR {
      old[$2] = $1
      seen_old[$2] = 1
      next
    }
    {
      seen_new[$2] = 1
      if (!($2 in old) || old[$2] != $1) print $2
    }
    END {
      for (path in seen_old) {
        if (!(path in seen_new)) print path > deleted_out
      }
    }
  ' deleted_out="$tmp_deleted" "$LATEST_MANIFEST" "$tmp_manifest" > "$tmp_changed"
fi

while IFS= read -r rel; do
  [[ -z "$rel" ]] && continue
  mkdir -p "$backup_dir/files/$(dirname "$rel")"
  cp -p "$rel" "$backup_dir/files/$rel"
done < "$tmp_changed"

cp "$tmp_manifest" "$manifest_file"
cp "$tmp_changed" "$changed_file"
cp "$tmp_deleted" "$deleted_file"
cp "$tmp_manifest" "$LATEST_MANIFEST"

file_count="$(wc -l < "$tmp_changed" | tr -d ' ')"
deleted_count="$(wc -l < "$tmp_deleted" | tr -d ' ')"

cat > "$backup_dir/README.txt" <<EOF
Backup created: $timestamp
Mode: $mode
Root: $ROOT_DIR
Changed or included files copied: $file_count
Deleted files recorded: $deleted_count

Files are stored under:
  files/

Manifest:
  manifest.tsv

Changed files:
  changed-files.txt

Deleted files since previous manifest:
  deleted-files.txt
EOF

echo "Backup created: $backup_dir"
echo "Mode: $mode"
echo "Files copied: $file_count"
echo "Deleted files recorded: $deleted_count"
