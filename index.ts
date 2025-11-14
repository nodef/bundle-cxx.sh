import * as os   from "os";
import * as fs   from "fs";
import * as cp   from "child_process";
import * as path from "path";
import * as csv  from "fast-csv";
import * as which from "which";


/** Represents command-line options. */
type Options = {
  /** Show help information. */
  help: boolean;
  /** The command to execute (e.g., "list-symbols", "bundle"). */
  command: string;
  /** Arguments for the command. */
  args: string[];
  /** Symbols file path (optional). */
  symbolsPath?: string;
  /** Output file path (optional). */
  outputPath?: string;
};


/** Represents a symbol entry in the Symbols CSV file. */
type SymbolEntry = {
  /** The filename and line number of the symbol definition. */
  filename_line: string;
  /** The original symbol kind and name, including function signature. */
  kind_display_name: string;
  /** The new symbol name after renaming (optional). */
  new_display_name: string;
};


// Read a text file and normalize line endings to LF.
function readTextFileSync(pth: string): string {
  var txt = fs.readFileSync(pth, "utf-8");
  return txt.replace(/\r?\n/g, "\n");
}


// Write a text file, converting line endings to the OS-specific EOL.
function writeTextFileSync(pth: string, txt: string) {
  txt = txt.replace(/\r?\n/g, os.EOL);
  fs.writeFileSync(pth, txt, "utf-8");
}


// Escape special characters in a string for use in a regular expression.
function escapeRegExp(string: string) {
  return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); // $& means the whole matched string
}


// Read the Symbols CSV file, which contains symbol renaming information.
async function readSymbolsCsv(pth: string) {
  const symbols: SymbolEntry[] = [];
  return new Promise<SymbolEntry[]>((resolve, reject) => {
    fs.createReadStream(pth)
      .pipe(csv.parse({headers: true}))
      .on("error", (error) => reject(error))
      .on("data", (row) => symbols.push(row))
      .on("end", () => resolve(symbols));
  });
}


// Group symbols by their source file, so we can process each file once.
function groupSymbolsByFile(symbols: SymbolEntry[]) {
  const map: Map<string, SymbolEntry[]> = new Map();
  for (const symbol of symbols) {
    const filename = symbol.filename_line.split(":")[0];
    if (!map.has(filename)) map.set(filename, []);
    map.get(filename)!.push(symbol);
  }
  return map;
}


// Create backup copies of the original files before modifying them.
function backupFiles(filePaths: string[]) {
  for (const pth of filePaths) {
    const backupPath = pth + ".bak";
    fs.copyFileSync(pth, backupPath);
  }
}


// Restore original files from their backup copies.
function restoreFiles(filePaths: string[]) {
  for (const pth of filePaths) {
    const backupPath = pth + ".bak";
    if (!fs.existsSync(pth)) continue;
    fs.copyFileSync(backupPath, pth);
    fs.unlinkSync(backupPath);
  }
}


// Rename symbols in a source file based on the provided symbol entries.
function renameSymbolsInFile(pth: string, symbols: SymbolEntry[]) {
  let content = readTextFileSync(pth);
  for (const symbol of symbols) {
    const new_display_name = (symbol.new_display_name || "").trim();
    if  (!new_display_name) continue;
    const kind_display_name = symbol.kind_display_name.replace(/\W.*/, "");
    const display_name = kind_display_name.replace(/^.*:/, "");
    const regex = new RegExp(`\\b${escapeRegExp(display_name)}\\b`, "g");
    content = content.replace(regex, new_display_name);
  }
  writeTextFileSync(pth, content);
}


// Generate a Symbols CSV file from a source file using our libclang-based tool.
function invokeListSymbols(sourcePath: string, csvPath: string, args: string[]=[]) {
  if (!csvPath) csvPath = path.basename(sourcePath, path.extname(sourcePath)) + "_symbols.csv";
  console.log(`Reading symbols from ${sourcePath} ...`);
  const argv    = [sourcePath, csvPath, ...args];
  const exePath = path.join(__dirname, "list-symbols.exe");
  const result  = cp.execFileSync(exePath, argv);
  writeTextFileSync(csvPath, result.toString());
  console.log(`Symbols written to ${csvPath}`);
}


// Generate an amalgamated source file from a source file using the amalgamate tool.
function invokeAmalgamate(sourcePath: string, outputPath: string, args: string[]=[]) {
  console.log(`Amalgamating source file ${sourcePath} ...`);
  const argv = [...args, sourcePath, outputPath];
  cp.execFileSync("amalgamate", argv);
}


// Bundle a source file by renaming symbols and invoking the amalgamate tool.
async function bundleSourceFile(sourcePath: string, symbolsPath: string, outputPath: string, args: string[]=[]) {
  const psymbolsPath = path.basename(symbolsPath, path.extname(symbolsPath)) + "_symbols.csv";
  if (!symbolsPath && !fs.existsSync(psymbolsPath)) {
    invokeAmalgamate(sourcePath, outputPath, args);
    console.log(`Bundled source written to ${outputPath}`);
    return;
  }
  console.log(`Reading symbols from ${symbolsPath} ...`);
  const symbols = await readSymbolsCsv(symbolsPath);
  console.log(`Grouping symbols by file ...`);
  const symbolsByFile = groupSymbolsByFile(symbols);
  const filePaths = [...symbolsByFile.keys()];
  console.log(`Backing up ${filePaths.length} original files ...`);
  backupFiles(filePaths);
  for (const [filePath, symbols] of symbolsByFile.entries()) {
    console.log(`Renaming symbols in file ${filePath} ...`);
    renameSymbolsInFile(filePath, symbols);
  }
  invokeAmalgamate(sourcePath, outputPath, args);
  console.log(`Restoring ${filePaths.length} original files ...`);
  restoreFiles(filePaths);
  console.log(`Bundled source written to ${outputPath}`);
}


// Parse command-line options and populate the options object.
function parseOptions(o: Options, k: string, a: string[], i: number) {
  if (k==="--help") o.help = true;
  else if (k=="-c" || k=="--csv")    o.symbolsPath = a[++i];
  else if (k=="-o" || k=="--output") o.outputPath  = a[++i];
  else if (!o.command) o.command = k;
  else o.args.push(a[i]);
  return i+1;
}


// Show help information.
function showHelp(name: string) {
  const helpText = `Usage: ${name} [options] <command> [args]\n` +
    `\n` +
    `Commands:\n` +
    `  list-symbols <source-file>         Generate a Symbols CSV file from the source file.\n` +
    `  bundle <source-file>               Bundle the source file by renaming symbols and amalgamating.\n\n` +
    `Options:\n` +
    `  --help                             Show this help information.\n` +
    `  -c, --csv <symbols-file>           Specify the Symbols CSV file path.\n` +
    `  -o, --output <output-file>         Specify the output file path.\n` +
    `  <args>                             Additional arguments for libclang or amalgamate.\n` +
    `\n` +
    `Example:\n` +
    `  # Generate a Symbols CSV file from a source file.\n` +
    `  $ ${name} list-symbols mysource.cxx --csv mysource_symbols.csv -DMYSOURCE_IMPLEMENTATION\n\n` +
    `  # Now edit \`mysource_symbols.csv\` to rename symbols as needed.\n` +
    `  # The \`filename_line\` in the CSV indicates where each symbol is defined.\n` +
    `  # The \`kind_display_name\` is the original symbol kind and name.\n` +
    `  # The \`new_display_name\` is where you can specify the new name for the symbol.\n` +
    `\n` +
    `  # Finally, bundle the source file using the edited Symbols CSV file.\n` +
    `  $ ${name} bundle mysource.cxx -c mysource_symbols.csv -o mysource_bundled.cxx\n`;
    `\n`;
  console.log(helpText);
}


// Main entry point.
// Here we provide two commands:
// - list-symbols: Generates a Symbols CSV file from a source file.
// - bundle: Bundles a source file by renaming symbols and amalgamating.
function main() {
  const o: Options = {help: false, command: "", args: []};
  const args = process.argv.slice(2);
  for (let i=0; i < args.length;)
    i = parseOptions(o, args[i], args, i);
  if (o.help || !o.command) { showHelp("bundle-cxx"); return; }
  const sourcePath = o.args[0];
  if  (!sourcePath) { console.error(`Source file path is required.`); return; }
  if  (!fs.existsSync(sourcePath)) { console.error(`Source file not found: ${sourcePath}`); return; }
  if (!fs.existsSync(path.join(__dirname, "list-symbols.exe")))
  { console.error(`Required tool, "list-symbols.exe", is not present.`); return; }
  try { which.sync("amalgamate"); }
  catch { console.error(`Required tool, "amalgamate.exe", is not present.`); return; }
  const symbolsPath = o.symbolsPath || "";
  const outputPath  = o.outputPath  || "";
  switch (o.command) {
    default:
      console.error(`Unknown command: ${o.command}`);
      return;
    case "list-symbols":
      invokeListSymbols(sourcePath, symbolsPath, o.args.slice(1));
      break;
    case "bundle":
      bundleSourceFile(sourcePath, symbolsPath, outputPath, o.args.slice(1));
      break;
  }
}
main();
