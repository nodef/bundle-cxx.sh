<!-- Copyright (C) 2025 Subhajit Sahu -->
<!-- SPDX-License-Identifier: AGPL-3.0-or-later -->
<!-- See LICENSE for full terms -->

A CLI tool to bundle / amagamate C/C++ files into a single file.

This tool helps in renaming symbols (functions, variables, types) in C/C++ source files to avoid name collisions when bundling / amalgamating multiple source files into one. It uses `libclang` to parse the source files and generate a CSV file listing all symbols, which can then be edited to specify new names for the symbols. Finally, it produces a bundled source file with the renamed symbols. It currently works on Windows, and requires `amalgamate.exe` (from [rindeal/Amalgamate](https://github.com/rindeal/Amalgamate)) to be installed.

<br>


### Installation

```bash
$ npm i -g bundle-cxx.sh
```

<br>


## Usage

```bash
$ bundle-cxx [options] <command> [args]

Commands:
  list-symbols <source-file>         Generate a Symbols CSV file from the source file.
  bundle <source-file>               Bundle the source file by renaming symbols and amalgamating.

Options:
  --help                             Show this help information.
  -c, --csv <symbols-file>           Specify the Symbols CSV file path.
  -o, --output <output-file>         Specify the output file path.
  <args>                             Additional arguments for libclang or amalgamate.
```

```bash
# Generate a Symbols CSV file from a source file.
$ bundle-cxx list-symbols mysource.cxx --csv mysource_symbols.csv -DMYSOURCE_IMPLEMENTATION

# Now edit `mysource_symbols.csv` to rename symbols as needed.
# The `filename_line` in the CSV indicates where each symbol is defined.
# The `display_name` is the original symbol name.
# The `new_display_name` is where you can specify the new name for the symbol.

# Finally, bundle the source file using the edited Symbols CSV file.
$ bundle-cxx bundle mysource.cxx -c mysource_symbols.csv -o mysource_bundled.cxx
```

<br>
<br>


[![](https://raw.githubusercontent.com/qb40/designs/gh-pages/0/image/11.png)](https://wolfram77.github.io)<br>
[![ORG](https://img.shields.io/badge/org-nodef-green?logo=Org)](https://nodef.github.io)
![](https://ga-beacon.deno.dev/G-RC63DPBH3P:SH3Eq-NoQ9mwgYeHWxu7cw/github.com/nodef/bundle-cxx.sh)
