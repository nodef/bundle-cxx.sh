#include <cstdio>
#include <clang-c/Index.h>
#pragma comment(lib, "libclang.lib")


// This will list all symbols in the given input C/C++ source file.
int listSymbols(const char *inputFile) {
  // Create index, and parse the input file.
  CXIndex           index = clang_createIndex(0, 0);
  CXTranslationUnit unit  = clang_parseTranslationUnit(
    index, inputFile,
    nullptr, 0, nullptr, 0,
    CXTranslationUnit_None);
  if (unit == nullptr) {
    fprintf(stderr, "Unable to parse translation unit. Quitting.\n");
    return 1;
  }
  // Lets first setup the column names of our output CSV.
  printf("filename_line,display_name,new_display_name\n");
  // Obtain a cursor at the root of the translation unit
  CXCursor   root = clang_getTranslationUnitCursor(unit);
  auto onVisit    = [](CXCursor curr, CXCursor par, CXClientData data) {
    // We want to only track top-level declarations in user files.
    CXSourceLocation locn = clang_getCursorLocation(curr);
    if (clang_Location_isInSystemHeader(locn)) return CXChildVisit_Continue;
    // We track both location and name of the cursor.
    CXFile file; unsigned line, column, offset;
    clang_getExpansionLocation(locn, &file, &line, &column, &offset);
    CXString fileName = clang_getFileName(file);
    CXString name = clang_getCursorDisplayName(curr);
    printf("\"%s:%d\",\"%s\",\n", clang_getCString(fileName), line, clang_getCString(name));
    clang_disposeString(fileName);
    clang_disposeString(name);
    return CXChildVisit_Continue; // CXChildVisit_Recurse;
  };
  clang_visitChildren(root, onVisit, nullptr);
  clang_disposeTranslationUnit(unit);
  clang_disposeIndex(index);
  return 0;
}


// We want to list all symbols in the given input file.
// This can then be used by a refactoring tool to generate
// new names for these symbols, and then to safely
// amalgamate multiple source files together.
int main(int argc, char **argv) {
  const char *inputFile = argc>1? argv[1] : nullptr;
  if (inputFile == nullptr) {
    fprintf(stderr, "Usage: %s <input-file>\n", argv[0]);
    return 1;
  }
  return listSymbols(inputFile);
}
