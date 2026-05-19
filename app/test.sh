#!/bin/bash
# Quick smoke test for the generate endpoint
# Run: npm run dev (in another terminal), then: bash test.sh

curl -s -X POST http://localhost:3000/api/generate \
  -H "Content-Type: application/json" \
  -d '{
    "destination": "Big Island, Hawaii",
    "preferences": {
      "dietary": ["vegetarian"],
      "interests": ["hiking", "food", "nature"],
      "party_type": "couple",
      "pace": "moderate",
      "duration_days": 7
    }
  }' | jq '{
    destination: .board.destination,
    themes: [.board.themes[] | {name: .name, count: (.experiences | length)}]
  }'
