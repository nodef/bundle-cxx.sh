#!/usr/bin/env bash
I="D:/Program Files/LLVM/include"
L="D:/Program Files/LLVM/lib"
clang -I"$I" -L"$L" -o list-symbols.exe list-symbols.cxx
tsc index.ts --outDir . --target es2022 --module commonjs

if [[ "$1" == "publish" ]]; then
  npm publish
fi
