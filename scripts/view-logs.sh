#!/bin/bash

# VeriBuy Log Viewer
# A utility to view and filter logs from all services

set -eo pipefail

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
MAGENTA='\033[0;35m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color

# Default values
LOG_DIR="/tmp"
FOLLOW=false
SERVICE=""
LEVEL=""
TAIL_LINES=50
FORMAT="pretty"

# Usage function
usage() {
  cat << EOF
Usage: $0 [OPTIONS]

View and filter VeriBuy service logs

OPTIONS:
  -s, --service SERVICE    Filter by service name (auth, user, listing, transaction, etc.)
  -l, --level LEVEL        Filter by log level (error, warn, info, debug)
  -f, --follow             Follow log output (like tail -f)
  -n, --lines NUMBER       Number of lines to show (default: 50)
  --json                   Output in JSON format
  --list                   List available log files
  -h, --help               Show this help message

EXAMPLES:
  # View last 50 lines from transaction service
  $0 -s transaction

  # Follow error logs from all services
  $0 -l error -f

  # View last 100 lines in JSON format
  $0 -n 100 --json

  # List all available log files
  $0 --list

EOF
  exit 1
}

# Parse arguments
while [[ $# -gt 0 ]]; do
  case $1 in
    -s|--service)
      SERVICE="$2"
      shift 2
      ;;
    -l|--level)
      LEVEL="$2"
      shift 2
      ;;
    -f|--follow)
      FOLLOW=true
      shift
      ;;
    -n|--lines)
      TAIL_LINES="$2"
      shift 2
      ;;
    --json)
      FORMAT="json"
      shift
      ;;
    --list)
      echo -e "${CYAN}Available log files:${NC}"
      ls -lh ${LOG_DIR}/veribuy-*.json 2>/dev/null | awk '{print $9, "(" $5 ")"}' || echo "No log files found"
      echo ""
      echo -e "${CYAN}Plain text logs:${NC}"
      ls -lh ${LOG_DIR}/veribuy-*.log 2>/dev/null | awk '{print $9, "(" $5 ")"}' || echo "No log files found"
      exit 0
      ;;
    -h|--help)
      usage
      ;;
    *)
      echo "Unknown option: $1"
      usage
      ;;
  esac
done

# Build file pattern
if [ -n "$SERVICE" ]; then
  FILE_PATTERN="${LOG_DIR}/veribuy-${SERVICE}*.json"
else
  FILE_PATTERN="${LOG_DIR}/veribuy-*.json"
fi

# Check if files exist
if ! ls $FILE_PATTERN 1> /dev/null 2>&1; then
  echo -e "${RED}No log files found matching: $FILE_PATTERN${NC}"
  echo "Run with --list to see available log files"
  exit 1
fi

# Function to format JSON logs
format_log() {
  if [ "$FORMAT" = "json" ]; then
    cat
  else
    jq -r --arg level "$LEVEL" '
      select(
        ($level == "" or .level == $level)
      ) |
      "\(.timestamp) [\(.level | ascii_upcase)] [\(.service)] [\(.context // "App")] \(.message)"
    ' 2>/dev/null || cat
  fi
}

# Function to colorize output
colorize() {
  if [ "$FORMAT" = "json" ]; then
    cat
  else
    sed -E \
      -e "s/\[ERROR\]/${RED}[ERROR]${NC}/g" \
      -e "s/\[WARN\]/${YELLOW}[WARN]${NC}/g" \
      -e "s/\[INFO\]/${GREEN}[INFO]${NC}/g" \
      -e "s/\[DEBUG\]/${BLUE}[DEBUG]${NC}/g" \
      -e "s/\[VERBOSE\]/${MAGENTA}[VERBOSE]${NC}/g"
  fi
}

# View logs
if [ "$FOLLOW" = true ]; then
  echo -e "${CYAN}Following logs from: ${FILE_PATTERN}${NC}"
  echo -e "${CYAN}Press Ctrl+C to stop${NC}"
  echo ""
  tail -f $FILE_PATTERN | format_log | colorize
else
  cat $FILE_PATTERN | tail -n $TAIL_LINES | format_log | colorize
fi
