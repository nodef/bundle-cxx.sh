#!/usr/bin/env bash
I="D:/Program Files/LLVM/include"
L="D:/Program Files/LLVM/lib"
clang -I"$I" -L"$L" -o list-symbols.exe list-symbols.cxx

if [[ "$1" == "run" ]]; then
  ./list-symbols test.c
fi
