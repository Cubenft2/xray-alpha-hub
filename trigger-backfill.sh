#!/bin/bash
# Temporary script to trigger backfill function

curl -X POST \
  'https://odncvfiuzliyohxrsigc.supabase.co/functions/v1/backfill-crypto-history' \
  -H 'Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im9kbmN2Zml1emxpeW9oeHJzaWdjIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTg3Mzk4MjEsImV4cCI6MjA3NDMxNTgyMX0.7cnRatKpHqsylletKVel7WAprIYdpP85AXtXLswMYXQ' \
  -H 'Content-Type: application/json' \
  -d '{}'
