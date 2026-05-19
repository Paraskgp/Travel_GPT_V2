#!/bin/bash
# Takes a generated board JSON file, enriches all mappable experiences, and saves the result.
# Usage: bash scripts/enrich.sh test_outputs/2026-05-18_14-47-18_kyoto-japan.json

INPUT_FILE="${1}"

if [ -z "$INPUT_FILE" ] || [ ! -f "$INPUT_FILE" ]; then
  echo "Usage: bash scripts/enrich.sh <path-to-board-json>"
  exit 1
fi

DESTINATION=$(jq -r '.board.destination' "$INPUT_FILE")
MAPPABLE_COUNT=$(jq '[.board.themes[].experiences[] | select(.is_mappable == true)] | length' "$INPUT_FILE")

echo "Enriching: $DESTINATION"
echo "Mappable experiences: $MAPPABLE_COUNT"
echo "Calling http://localhost:3000/api/enrich ..."
echo ""

# Build enrich request from the board JSON
TMPFILE=$(mktemp)
jq '{
  destination: .board.destination,
  experiences: [.board.themes[].experiences[] | select(.is_mappable == true) | {id, name, location_hint, is_mappable}]
}' "$INPUT_FILE" > "$TMPFILE"

RESPONSE=$(curl -s -X POST http://localhost:3000/api/enrich \
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

# Merge enrichment back into the original board
TIMESTAMP=$(date +"%Y-%m-%d_%H-%M-%S")
SLUG=$(printf '%s' "$DESTINATION" | tr '[:upper:]' '[:lower:]' | tr ' ,/' '-' | tr -s '-')
OUTPUT_DIR="$(cd "$(dirname "$0")/.." && pwd)/test_outputs"
OUTPUT_FILE="${OUTPUT_DIR}/${TIMESTAMP}_${SLUG}_enriched.json"

# Merge: for each experience in the board, look up its enrichment by id and attach it
jq --argjson enriched "$RESPONSE" '
  .board.themes[].experiences[] |= (
    . as $exp |
    ($enriched.enriched[] | select(.id == $exp.id)) as $match |
    if $match then . + {places_enrichment: $match.places_enrichment} else . end
  )
' "$INPUT_FILE" > "$OUTPUT_FILE"

# Summary
ENRICHED_COUNT=$(jq '[.board.themes[].experiences[] | select(.places_enrichment != null)] | length' "$OUTPUT_FILE")
WITH_PHOTO=$(jq '[.board.themes[].experiences[] | select(.places_enrichment.photo_url != null)] | length' "$OUTPUT_FILE")
WITH_RATING=$(jq '[.board.themes[].experiences[] | select(.places_enrichment.rating != null)] | length' "$OUTPUT_FILE")

echo "Done."
echo ""
echo "Enriched    : $ENRICHED_COUNT / $MAPPABLE_COUNT experiences"
echo "With photo  : $WITH_PHOTO"
echo "With rating : $WITH_RATING"
echo ""
echo "Sample enriched object:"
jq '[.board.themes[].experiences[] | select(.places_enrichment != null)] | first | {name, location_hint, places_enrichment}' "$OUTPUT_FILE"
echo ""
echo "Output file : $OUTPUT_FILE"
