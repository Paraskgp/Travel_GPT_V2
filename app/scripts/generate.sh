#!/bin/bash
# Usage:
#   bash scripts/generate.sh "Yellowstone National Park" "2026-05-20" "2026-05-26"
#   bash scripts/generate.sh "Kyoto" "2026-03-10" "2026-03-17" "14:00" "11:00"
#   bash scripts/generate.sh "Paris" "2026-06-01" "2026-06-07" "" "" '{"dietary":["vegetarian"],"interests":["food","culture"]}'
#   bash scripts/generate.sh "Zion" "2026-11-15" "2026-11-19" "09:00" "15:00" '{}' "claude"
#
# Provider: "openai" (default) or "claude" — pass as 7th argument.
# Switch to "claude" if OpenAI quota is exhausted: add ANTHROPIC_API_KEY to .env.local first.

DESTINATION="${1}"
START_DATE="${2}"
END_DATE="${3}"
ARRIVAL_TIME="${4:-}"
DEPARTURE_TIME="${5:-}"
PREFERENCES="${6:-{}}"
PROVIDER="${7:-openai}"

if [ -z "$DESTINATION" ]; then
  echo "Usage: bash scripts/generate.sh \"Destination\" [start_date] [end_date] [arrival_time] [departure_time] [preferences_json] [provider]"
  exit 1
fi

TIMESTAMP=$(date +"%Y-%m-%d_%H-%M-%S")
SLUG=$(printf '%s' "$DESTINATION" | tr '[:upper:]' '[:lower:]' | tr ' ,/' '-' | tr -s '-')
OUTPUT_DIR="$(cd "$(dirname "$0")/.." && pwd)/test_outputs"
mkdir -p "$OUTPUT_DIR"
OUTPUT_FILE="${OUTPUT_DIR}/${TIMESTAMP}_${SLUG}.json"

echo "Generating board for: $DESTINATION"
[ -n "$START_DATE" ] && echo "Dates: $START_DATE → $END_DATE"
[ -n "$ARRIVAL_TIME" ] && echo "Arrival: $ARRIVAL_TIME  Departure: $DEPARTURE_TIME"
echo "Calling http://localhost:3000/api/generate ..."
echo ""

# Validate preferences JSON — write to temp file to avoid shell quoting issues
PREFS_FILE=$(mktemp)
if echo "$PREFERENCES" | jq '.' > "$PREFS_FILE" 2>/dev/null; then
  PARSED_PREFS=$(cat "$PREFS_FILE")
else
  echo "Warning: preferences JSON is invalid — ignoring. Got: $PREFERENCES"
  PARSED_PREFS="{}"
fi
rm -f "$PREFS_FILE"

# Build JSON body
BODY=$(jq -n \
  --arg dest "$DESTINATION" \
  --arg sd "$START_DATE" \
  --arg ed "$END_DATE" \
  --arg at "$ARRIVAL_TIME" \
  --arg dt "$DEPARTURE_TIME" \
  --arg prov "$PROVIDER" \
  --argjson prefs "$PARSED_PREFS" \
  '{
    destination: $dest,
    preferences: $prefs,
    provider: $prov
  }
  | if $sd != "" then . + {start_date: $sd} else . end
  | if $ed != "" then . + {end_date: $ed} else . end
  | if $at != "" then . + {arrival_time: $at} else . end
  | if $dt != "" then . + {departure_time: $dt} else . end
  ')

RESPONSE=$(curl -s -X POST http://localhost:3000/api/generate \
  -H "Content-Type: application/json" \
  -d "$BODY")

if [ -z "$RESPONSE" ]; then
  echo "Error: No response. Is 'npm run dev' running?"
  exit 1
fi

ERROR=$(echo "$RESPONSE" | jq -r '.error // empty')
if [ -n "$ERROR" ]; then
  echo "API error: $ERROR"
  exit 1
fi

# Merge trip metadata (dates, preferences) into the saved file so plan.sh can pick them up
echo "$RESPONSE" | jq \
  --arg sd "$START_DATE" \
  --arg ed "$END_DATE" \
  --arg at "$ARRIVAL_TIME" \
  --arg dt "$DEPARTURE_TIME" \
  --argjson prefs "$PARSED_PREFS" \
  '. + {
    start_date: (if $sd != "" then $sd else null end),
    end_date:   (if $ed != "" then $ed else null end),
    arrival_time:   (if $at != "" then $at else null end),
    departure_time: (if $dt != "" then $dt else null end),
    preferences: $prefs
  }' > "$OUTPUT_FILE"

# Summary
THEME_COUNT=$(echo "$RESPONSE" | jq '.board.themes | length')
TOTAL_EXP=$(echo "$RESPONSE" | jq '[.board.themes[].experiences | length] | add')
MAPPABLE=$(echo "$RESPONSE" | jq '[.board.themes[].experiences[] | select(.is_mappable == true)] | length')
STAY_AREA=$(echo "$RESPONSE" | jq -r '.board.destination_context.recommended_stay_area // "n/a"')
STAY_REASON=$(echo "$RESPONSE" | jq -r '.board.destination_context.recommended_stay_reason // ""' | head -c 100)

echo "Done."
echo ""
echo "Destination : $(echo "$RESPONSE" | jq -r '.board.destination')"
echo "Stay area   : $STAY_AREA"
echo "Stay reason : ${STAY_REASON}..."
echo "Themes      : $THEME_COUNT"
echo "Experiences : $TOTAL_EXP (mappable: $MAPPABLE)"
echo ""
echo "Per theme:"
echo "$RESPONSE" | jq -r '.board.themes[] | "  \(.name): \(.experiences | length) experiences"'
echo ""
echo "Output file : $OUTPUT_FILE"
echo "BOARD_FILE=$OUTPUT_FILE"
