# PowerShell script to delete all test files from the repository (excluding important dirs)
# Excludes: node_modules, .git, .gemini, dist, build
$excludeDirs = @('node_modules', '.git', '.gemini', 'dist', 'build')

function Should-Exclude($path) {
  foreach ($ex in $excludeDirs) {
    if ($path -like "*$ex*") { return $true }
  }
  return $false
}

Get-ChildItem -Path . -Recurse -File -Filter "*.test.*" |
  Where-Object { -not (Should-Exclude $_.FullName) } |
  ForEach-Object {
    Write-Host "Deleting $($_.FullName)"
    Remove-Item -Force -Path $_.FullName
  }

Write-Host "Test files cleanup completed."
