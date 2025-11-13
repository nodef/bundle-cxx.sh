#!/usr/bin/env bash
dir="$(dirname "$(readlink -f "$0")")"
node "$dir/index.js" "$@"
