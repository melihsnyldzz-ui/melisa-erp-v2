# Metadata-only accelerator for the existing ancestor walk. Scope, hashes,
# inventory, open-file locks and owner/publication checks stay with the caller.
if (-not ('MelisaAncestorAttributes' -as [type])) {
 Add-Type -TypeDefinition @'
using System;
using System.IO;
public static class MelisaAncestorAttributes {
 public static bool NoReparse(string full) {
  for (string current = full; !String.IsNullOrEmpty(current); current = Path.GetDirectoryName(current)) {
   FileAttributes attributes;
   try { attributes = File.GetAttributes(current); }
   catch (FileNotFoundException) { continue; }
   catch (DirectoryNotFoundException) { continue; }
   // Access/IO errors deliberately propagate; a failed observation is not safe.
   if ((attributes & FileAttributes.ReparsePoint) != 0) return false;
  }
  return true;
 }
}
'@
}
function Assert-B5NoReparse([string]$full) {
 if (![MelisaAncestorAttributes]::NoReparse($full)) { B5Fail 'B5_REPARSE' }
}
