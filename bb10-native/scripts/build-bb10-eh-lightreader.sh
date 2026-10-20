#!/bin/sh
# Independent Cascades-native EH app; does not replace Berry Books.
set -eu
ROOT=$(CDPATH= cd "$(dirname "$0")/.." && pwd)
SOURCE="$ROOT/clients/bb10/eh-lightreader-native"
WORK="$ROOT/clients/bb10/.eh-native-build"
IMAGE="${BB10_BUILDER_IMAGE:-ghcr.io/xiazy/blackberry10-toolchain@sha256:e56e8572589d46d86f7be108d6d14cfe20a5097c46ac9c655edd042eecd437be}"
OUT="$ROOT/dist/EH_LightReader_BB10_0.1.0.4.bar"
mkdir -p "$ROOT/dist"
rm -rf "$WORK"
mkdir -p "$WORK/src" "$WORK/assets"
cp "$SOURCE/CMakeLists.txt" "$WORK/CMakeLists.txt"
cp "$SOURCE/bar-descriptor.xml" "$WORK/bar-descriptor.xml"
cp "$SOURCE/src/"*.cpp "$SOURCE/src/"*.h "$WORK/src/"
cp "$SOURCE/assets/"*.qml "$WORK/assets/"
python3 "$ROOT/scripts/generate_q20_icon.py" reader "$WORK/icon.png"
python3 "$ROOT/scripts/validate_png.py" "$WORK/icon.png" 114 114
docker pull "$IMAGE"
docker run --rm -v "$WORK:/src:ro" "$IMAGE" bb10-check-project /src
docker run --rm --user "$(id -u):$(id -g)" -e HOME=/tmp/bb10-home -v "$WORK:/src" "$IMAGE" bb10-build /src
BAR=$(find "$WORK/build" -maxdepth 2 -type f -name "*.bar" | head -n 1)
[ -n "$BAR" ] || { echo "FAIL: no EH BAR built" >&2; exit 1; }
cp "$BAR" "$OUT"
unzip -t "$OUT" >/dev/null
unzip -l "$OUT" | grep -q "native/eh_lightreader"
unzip -l "$OUT" | grep -q "native/assets/main.qml"
unzip -p "$OUT" META-INF/MANIFEST.MF | grep -q "^Package-Name: com.heberry.ehlightreader$"
sha256sum "$OUT" > "$OUT.sha256"
echo "PASS: $OUT"
