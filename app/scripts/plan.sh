#!/bin/bash
# Usage:
#   bash scripts/plan.sh <board_json_file>
#   bash scripts/plan.sh test_outputs/2026-05-27_12-00-00_yellowstone.json
#
# Or pass a slug to auto-find the latest board for that destination:
#   bash scripts/plan.sh yellowstone

INPUT="${1}"

if [ -z "$INPUT" ]; then
  echo "Usage: bash scripts/plan.sh <board_json_file_or_slug>"
  exit 1
fi

OUTPUT_DIR="$(cd "$(dirname "$0")/.." && pwd)/test_outputs"

# If input is not a file path, treat as slug and find latest match
if [ ! -f "$INPUT" ]; then
  SLUG=$(printf '%s' "$INPUT" | tr '[:upper:]' '[:lower:]' | tr ' ,/' '-' | tr -s '-')
  BOARD_FILE=$(ls -t "$OUTPUT_DIR"/*"${SLUG}"*.json 2>/dev/null | grep -v "_itinerary\|_eval" | head -1)
  if [ -z "$BOARD_FILE" ]; then
    echo "No board file found for slug: $SLUG"
    echo "Available files:"
    ls "$OUTPUT_DIR"/*.json 2>/dev/null | grep -v "_itinerary\|_eval" | tail -10
    exit 1
  fi
  echo "Using latest board: $BOARD_FILE"
else
  BOARD_FILE="$INPUT"
fi

# Derive output filename
BASE=$(basename "$BOARD_FILE" .json)
ITINERARY_FILE="${OUTPUT_DIR}/${BASE}_itinerary.json"

# Extract dates + times from the board file — generate.sh stores them at root level
START_DATE=$(jq -r '.start_date // empty' "$BOARD_FILE" 2>/dev/null)
END_DATE=$(jq -r '.end_date // empty' "$BOARD_FILE" 2>/dev/null)
ARRIVAL_TIME=$(jq -r '.arrival_time // empty' "$BOARD_FILE" 2>/dev/null)
DEPARTURE_TIME=$(jq -r '.departure_time // empty' "$BOARD_FILE" 2>/dev/null)

# If dates not in board (older format), use defaults from the Yellowstone test trip
if [ -z "$START_DATE" ]; then
  START_DATE="2026-05-20"
  END_DATE="2026-05-25"
  ARRIVAL_TIME="16:00"
  DEPARTURE_TIME="11:00"
  echo "Dates not found in board — using defaults: $START_DATE → $END_DATE"
fi

DESTINATION=$(jq -r '.board.destination' "$BOARD_FILE")
echo "Planning itinerary for: $DESTINATION"
echo "Dates: $START_DATE → $END_DATE  (arrive $ARRIVAL_TIME, depart $DEPARTURE_TIME)"
echo "Calling http://localhost:3000/api/plan ..."
echo ""

BOARD_JSON_FILE=$(mktemp)
PREFS_JSON_FILE=$(mktemp)
BODY_FILE=$(mktemp)
trap 'rm -f "$BOARD_JSON_FILE" "$PREFS_JSON_FILE" "$BODY_FILE"' EXIT

jq '.board' "$BOARD_FILE" > "$BOARD_JSON_FILE"

# Extract preferences from root level (generate.sh stores them there)
# Fall back to board.preferences for backwards compat
jq '.preferences // .board.preferences // {}' "$BOARD_FILE" > "$PREFS_JSON_FILE" 2>/dev/null
PARTY_TYPE=$(jq -r '.party_type // empty' "$PREFS_JSON_FILE" 2>/dev/null)
[ -n "$PARTY_TYPE" ] && echo "Party type  : $PARTY_TYPE"

jq -n \
  --slurpfile board "$BOARD_JSON_FILE" \
  --slurpfile prefs "$PREFS_JSON_FILE" \
  --arg sd "$START_DATE" \
  --arg ed "$END_DATE" \
  --arg at "$ARRIVAL_TIME" \
  --arg dt "$DEPARTURE_TIME" \
  '{
    board: $board[0],
    preferences: $prefs[0],
    start_date: $sd,
    end_date: $ed,
    arrival_time: $at,
    departure_time: $dt,
    forced_ids: [],
    skipped_ids: []
  }' > "$BODY_FILE"

RESPONSE=$(curl -s -X POST http://localhost:3000/api/plan \
  -H "Content-Type: application/json" \
  --data-binary "@$BODY_FILE")

if [ -z "$RESPONSE" ]; then
  echo "Error: No response. Is 'npm run dev' running?"
  exit 1
fi

ERROR=$(echo "$RESPONSE" | jq -r '.error // empty')
if [ -n "$ERROR" ]; then
  echo "API error: $ERROR"
  exit 1
fi

echo "$RESPONSE" | jq '.' > "$ITINERARY_FILE"

# Summary
DAY_COUNT=$(echo "$RESPONSE" | jq '.itinerary.days | length')
TOTAL_ROWS=$(echo "$RESPONSE" | jq '[.itinerary.days[].rows | length] | add')
ACTIVITY_COUNT=$(echo "$RESPONSE" | jq '[.itinerary.days[].rows[] | select(.type == "activity")] | length')

echo "Done."
echo ""
echo "Days         : $DAY_COUNT"
echo "Total rows   : $TOTAL_ROWS"
echo "Activities   : $ACTIVITY_COUNT"
echo ""
echo "Day titles:"
echo "$RESPONSE" | jq -r '.itinerary.days[] | "  Day \(.day_number) (\(.date)): \(.day_title)"'
echo ""
echo "Output file  : $ITINERARY_FILE"
echo "ITINERARY_FILE=$ITINERARY_FILE"
