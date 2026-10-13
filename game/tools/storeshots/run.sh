#!/bin/bash
# run.sh <site dir holding the built game/dist/index.html> <out root>  -> <out>/en, <out>/el
set -e
here=$(cd "$(dirname "$0")" && pwd)
site=$1; out=$2
for lang in en el; do
  node "$here/capture.mjs" --site "$site" --lang $lang --out "$out/$lang" --quality 85
  ffmpeg -y -loglevel error -i "$out/$lang/feature-graphic-2x.jpg" -vf scale=1024:500:flags=lanczos -q:v 3 "$out/$lang/feature-graphic.jpg"
  rm "$out/$lang/feature-graphic-2x.jpg"
done
