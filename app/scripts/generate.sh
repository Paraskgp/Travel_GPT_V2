#!/bin/bash
# Usage:
#   bash scripts/generate.sh "Big Island, Hawaii"
#   bash scripts/generate.sh "Kyoto" "March"
#   bash scripts/generate.sh "Paris" "June" '{"dietary":["vegetarian"],"interests":["food","culture"]}'

DESTINATION="${1}"
MONTH="${2}"
if [ -z "$3" ]; then
  PREFERENCES="{}"
else
  PREFERENCES="$3"
fi

if [ -z "$DESTINATION" ]; then
  echo "Usage: bash scripts/generate.sh \"Destination\" [\"Month\"] ['{\"preferences\":\"json\"}']"
  exit 1
fi

TIMESTAMP=$(date +"%Y-%m-%d_%H-%M-%S")
SLUG=$(printf '%s' "$DESTINATION" | tr '[:upper:]' '[:lower:]' | tr ' ,/' '-' | tr -s '-')
OUTPUT_DIR="$(cd "$(dirname "$0")/.." && pwd)/test_outputs"
OUTPUT_FILE="${OUTPUT_DIR}/${TIMESTAMP}_${SLUG}.json"

echo "Generating board for: $DESTINATION${MONTH:+ ($MONTH)}"
echo "Calling http://localhost:3000/api/generate ..."
echo ""

TMPFILE=$(mktemp)

if [ -n "$MONTH" ]; then
  printf '{"destination":%s,"month":%s,"preferences":%s}' \
    "$(printf '%s' "$DESTINATION" | jq -Rs .)" \
    "$(printf '%s' "$MONTH" | jq -Rs .)" \
    "$PREFERENCES" > "$TMPFILE"
else
  printf '{"destination":%s,"preferences":%s}' \
    "$(printf '%s' "$DESTINATION" | jq -Rs .)" \
    "$PREFERENCES" > "$TMPFILE"
fi

RESPONSE=$(curl -s -X POST http://localhost:3000/api/generate \
  -H "Content-Type: application/json" \
  -d @"$TMPFILE")
rm -f "$TMPFILE"

if [ -z "$RESPONSE" ]; then
  echo "Error: No response. Is 'npm run dev' running?"
  exit 1
fi

ERROR=$(echo "$RESPONSE" | jq -r '.error // empty')
if [ -n "$ERROR" ]; then
  echo "API error: $ERROR"
  exit 1
fi

echo "$RESPONSE" | jq '.' > "$OUTPUT_FILE"

# Summary
THEME_COUNT=$(echo "$RESPONSE" | jq '.board.themes | length')
TOTAL_EXP=$(echo "$RESPONSE" | jq '[.board.themes[].experiences | length] | add')
SEASON=$(echo "$RESPONSE" | jq -r '.board.weather_context.season_type // "n/a"')

MAPPABLE=$(echo "$RESPONSE" | jq '[.board.themes[].experiences[] | select(.is_mappable == true)] | length')

echo "Done."
echo ""
echo "Destination : $(echo "$RESPONSE" | jq -r '.board.destination')"
echo "Soul excerpt: $(echo "$RESPONSE" | jq -r '.board.destination_context.soul' | head -c 120)..."
echo "Season      : $SEASON"
echo "Themes      : $THEME_COUNT"
echo "Experiences : $TOTAL_EXP (mappable: $MAPPABLE)"
echo ""
echo "Per theme:"
echo "$RESPONSE" | jq -r '.board.themes[] | "  \(.name): \(.experiences | length) experiences (\([.experiences[] | select(.is_mappable)] | length) mappable)"'
echo ""
echo "Output file : $OUTPUT_FILE"
