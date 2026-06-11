param(
  [string]$RepoName = "readme-doctor",
  [ValidateSet("public", "private")]
  [string]$Visibility = "public"
)

$ErrorActionPreference = "Stop"

$Gh = "C:\Program Files\GitHub CLI\gh.exe"
if (-not (Test-Path $Gh)) {
  Write-Host "GitHub CLI was not found at $Gh"
  Write-Host "Install it with: winget install --id GitHub.cli"
  exit 1
}

function ConvertFrom-SecureStringToPlainText {
  param([Security.SecureString]$Secure)
  $ptr = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($Secure)
  try {
    [Runtime.InteropServices.Marshal]::PtrToStringBSTR($ptr)
  } finally {
    [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($ptr)
  }
}

Write-Host "Checking GitHub login..."
$authOk = $false
try {
  & $Gh auth status *> $null
  $authOk = $LASTEXITCODE -eq 0
} catch {
  $authOk = $false
}

if (-not $authOk) {
  Write-Host ""
  Write-Host "GitHub login is required."
  Write-Host "Create a token here:"
  Write-Host "https://github.com/settings/tokens/new?description=Readme%20Doctor%20local%20publish&scopes=repo,read:org,gist"
  Write-Host ""
  Write-Host "Paste the token below. It will not be shown on screen."
  $secureToken = Read-Host "GitHub token" -AsSecureString
  $plainToken = ConvertFrom-SecureStringToPlainText $secureToken
  $plainToken | & $Gh auth login --with-token
}

Write-Host "Reading GitHub account..."
$userJson = & $Gh api user
$user = $userJson | ConvertFrom-Json

if (-not (Test-Path ".git")) {
  Write-Host "Initializing local Git repository..."
  git init
}

$name = git config user.name
if (-not $name) {
  git config user.name $user.login
}

$email = git config user.email
if (-not $email) {
  git config user.email "$($user.id)+$($user.login)@users.noreply.github.com"
}

Write-Host "Running project checks..."
npm test

Write-Host "Preparing commit..."
git add -A
$hasChanges = git status --porcelain
if ($hasChanges) {
  git commit -m "Prepare Readme Doctor release"
} else {
  Write-Host "No local changes to commit."
}

$repoFullName = "$($user.login)/$RepoName"
$repoExists = $true
try {
  & $Gh repo view $repoFullName *> $null
  $repoExists = $LASTEXITCODE -eq 0
} catch {
  $repoExists = $false
}

if (-not $repoExists) {
  Write-Host "Creating GitHub repository $repoFullName..."
  & $Gh repo create $repoFullName "--$Visibility" --source . --remote origin --push
} else {
  Write-Host "Repository exists. Connecting remote and pushing..."
  $remoteUrl = "https://github.com/$repoFullName.git"
  if (-not (git remote | Where-Object { $_ -eq "origin" })) {
    git remote add origin $remoteUrl
  } else {
    git remote set-url origin $remoteUrl
  }

  $branch = git branch --show-current
  if (-not $branch) {
    $branch = "main"
    git checkout -B $branch
  }
  git push -u origin $branch
}

Write-Host ""
Write-Host "Done:"
Write-Host "https://github.com/$repoFullName"
