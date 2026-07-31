param(
    [Parameter(Mandatory = $true)]
    [string]$MigrationFile,

    [switch]$DryRun
)

$ErrorActionPreference = "Stop"

Add-Type -AssemblyName System.Net.Http

Add-Type -TypeDefinition @"
using System;
using System.Runtime.InteropServices;
using System.Text;

public static class SupabaseMigrationCredentialReader
{
    [StructLayout(LayoutKind.Sequential, CharSet = CharSet.Unicode)]
    private struct CREDENTIAL
    {
        public uint Flags;
        public uint Type;
        public string TargetName;
        public string Comment;
        public System.Runtime.InteropServices.ComTypes.FILETIME LastWritten;
        public uint CredentialBlobSize;
        public IntPtr CredentialBlob;
        public uint Persist;
        public uint AttributeCount;
        public IntPtr Attributes;
        public string TargetAlias;
        public string UserName;
    }

    [DllImport("Advapi32.dll", EntryPoint = "CredReadW", CharSet = CharSet.Unicode, SetLastError = true)]
    private static extern bool CredRead(string target, uint type, uint reservedFlag, out IntPtr credentialPtr);

    [DllImport("Advapi32.dll", SetLastError = true)]
    private static extern void CredFree(IntPtr credentialPtr);

    public static string Read(string target)
    {
        IntPtr credentialPtr;
        if (!CredRead(target, 1, 0, out credentialPtr))
        {
            throw new InvalidOperationException("Supabase CLI credential was not found in Windows Credential Manager.");
        }

        try
        {
            var credential = (CREDENTIAL)Marshal.PtrToStructure(credentialPtr, typeof(CREDENTIAL));
            if (credential.CredentialBlob == IntPtr.Zero || credential.CredentialBlobSize == 0)
            {
                throw new InvalidOperationException("Supabase CLI credential is empty.");
            }

            var bytes = new byte[credential.CredentialBlobSize];
            Marshal.Copy(credential.CredentialBlob, bytes, 0, bytes.Length);
            var utf8 = Encoding.UTF8.GetString(bytes).TrimEnd('\0');
            if (utf8.StartsWith("sbp_"))
            {
                return utf8;
            }

            return Encoding.Unicode.GetString(bytes).TrimEnd('\0');
        }
        finally
        {
            CredFree(credentialPtr);
        }
    }
}
"@

$projectRoot = Split-Path -Parent $PSScriptRoot
$migrationsRoot = [System.IO.Path]::GetFullPath((Join-Path $projectRoot "supabase\migrations"))
$resolvedMigration = [System.IO.Path]::GetFullPath((Resolve-Path -LiteralPath $MigrationFile).Path)
$migrationsPrefix = $migrationsRoot.TrimEnd('\') + '\'

if (-not $resolvedMigration.StartsWith($migrationsPrefix, [System.StringComparison]::OrdinalIgnoreCase)) {
    throw "Migration file must be inside supabase/migrations."
}

$migrationName = [System.IO.Path]::GetFileName($resolvedMigration)
$match = [regex]::Match($migrationName, '^(?<version>\d{14})_(?<name>[a-z0-9_-]+)\.sql$')
if (-not $match.Success) {
    throw "Migration filename must use the format YYYYMMDDHHMMSS_name.sql."
}

$version = $match.Groups["version"].Value
$name = $match.Groups["name"].Value
$migrationSql = [System.IO.File]::ReadAllText($resolvedMigration)
$recordDelimiter = '$migration_record$'

if ($migrationSql.Contains($recordDelimiter)) {
    throw "Migration contains the reserved history delimiter."
}

$projectRefPath = Join-Path $projectRoot "supabase\.temp\project-ref"
if (-not (Test-Path -LiteralPath $projectRefPath)) {
    throw "Supabase project reference is missing. Link the project with the Supabase CLI first."
}

$projectRef = [System.IO.File]::ReadAllText($projectRefPath).Trim()
if ($projectRef -notmatch '^[a-z0-9]+$') {
    throw "Supabase project reference has an unexpected format."
}

$accessToken = [SupabaseMigrationCredentialReader]::Read("Supabase CLI:supabase")
$endpoint = "https://api.supabase.com/v1/projects/$projectRef/database/query"

if ($DryRun) {
    $query = "begin;`n$migrationSql`nrollback;"
}
else {
    $historySql = @"
insert into supabase_migrations.schema_migrations (version, statements, name)
values (
    '$version',
    array[$recordDelimiter$migrationSql$recordDelimiter],
    '$name'
)
on conflict (version) do nothing;
"@
    $query = "begin;`n$migrationSql`n$historySql`ncommit;"
}

$payload = @{ query = $query } | ConvertTo-Json -Compress
$client = [System.Net.Http.HttpClient]::new()

try {
    $client.DefaultRequestHeaders.Authorization =
        [System.Net.Http.Headers.AuthenticationHeaderValue]::new("Bearer", $accessToken)
    $content = [System.Net.Http.StringContent]::new(
        $payload,
        [System.Text.Encoding]::UTF8,
        "application/json"
    )
    $response = $client.PostAsync($endpoint, $content).GetAwaiter().GetResult()
    $responseBody = $response.Content.ReadAsStringAsync().GetAwaiter().GetResult()

    if (-not $response.IsSuccessStatusCode) {
        throw "Supabase Management API returned HTTP $([int]$response.StatusCode): $responseBody"
    }

    if ($DryRun) {
        Write-Output "Migration $migrationName dry run succeeded."
    }
    else {
        Write-Output "Migration $migrationName was applied and recorded."
    }
}
finally {
    $client.Dispose()
}
