$ErrorActionPreference = 'Stop'

Add-Type -TypeDefinition @'
using System;
using System.Runtime.InteropServices;
using System.Text;

public static class WindowsCredentialReader
{
    [StructLayout(LayoutKind.Sequential, CharSet = CharSet.Unicode)]
    private struct Credential
    {
        public uint Flags;
        public uint Type;
        public IntPtr TargetName;
        public IntPtr Comment;
        public System.Runtime.InteropServices.ComTypes.FILETIME LastWritten;
        public uint CredentialBlobSize;
        public IntPtr CredentialBlob;
        public uint Persist;
        public uint AttributeCount;
        public IntPtr Attributes;
        public IntPtr TargetAlias;
        public IntPtr UserName;
    }

    [DllImport("advapi32.dll", EntryPoint = "CredReadW", CharSet = CharSet.Unicode, SetLastError = true)]
    private static extern bool CredRead(string target, uint type, int flags, out IntPtr credential);

    [DllImport("advapi32.dll", SetLastError = true)]
    private static extern void CredFree(IntPtr credential);

    public static string Read(string target)
    {
        IntPtr pointer;
        if (!CredRead(target, 1, 0, out pointer))
            throw new InvalidOperationException("Supabase CLI credential was not found.");

        try
        {
            Credential credential = (Credential)Marshal.PtrToStructure(pointer, typeof(Credential));
            byte[] bytes = new byte[credential.CredentialBlobSize];
            Marshal.Copy(credential.CredentialBlob, bytes, 0, bytes.Length);
            string utf8 = Encoding.UTF8.GetString(bytes).TrimEnd('\0');
            if (utf8.StartsWith("sbp_")) return utf8;
            return Encoding.Unicode.GetString(bytes).TrimEnd('\0');
        }
        finally
        {
            CredFree(pointer);
        }
    }
}
'@

$projectRoot = Split-Path -Parent $PSScriptRoot
$projectRefPath = Join-Path $projectRoot 'supabase\.temp\project-ref'
$functionPath = Join-Path $projectRoot 'supabase\functions\ai\index.ts'
$envPath = Join-Path $projectRoot '.env'

if (-not (Test-Path -LiteralPath $projectRefPath)) {
    throw 'Supabase project is not linked.'
}
if (-not (Test-Path -LiteralPath $functionPath)) {
    throw 'The ai Edge Function source was not found.'
}

$projectRef = (Get-Content -Raw -LiteralPath $projectRefPath).Trim()
$accessToken = [WindowsCredentialReader]::Read('Supabase CLI:supabase')
$endpoint = "https://api.supabase.com/v1/projects/$projectRef/functions/deploy?slug=ai"
$geminiModel = 'gemini-2.5-flash'

Add-Type -AssemblyName System.Net.Http
$client = [System.Net.Http.HttpClient]::new()
$client.DefaultRequestHeaders.Authorization = [System.Net.Http.Headers.AuthenticationHeaderValue]::new('Bearer', $accessToken)
$form = [System.Net.Http.MultipartFormDataContent]::new()

try {
    $metadataJson = @{
        entrypoint_path = 'index.ts'
        name = 'ai'
        # Authentication is validated inside the function through Supabase Auth.
        # The legacy gateway verifier can reject newer asymmetric user JWTs.
        verify_jwt = $false
    } | ConvertTo-Json -Compress
    $metadata = [System.Net.Http.StringContent]::new($metadataJson, [System.Text.Encoding]::UTF8, 'application/json')
    $form.Add($metadata, 'metadata')

    $source = [System.Net.Http.ByteArrayContent]::new([System.IO.File]::ReadAllBytes($functionPath))
    $source.Headers.ContentType = [System.Net.Http.Headers.MediaTypeHeaderValue]::new('application/typescript')
    $form.Add($source, 'file', 'index.ts')

    $response = $client.PostAsync($endpoint, $form).GetAwaiter().GetResult()
    $body = $response.Content.ReadAsStringAsync().GetAwaiter().GetResult()
    if (-not $response.IsSuccessStatusCode) {
        throw "Supabase deploy failed with HTTP $([int]$response.StatusCode): $body"
    }

    $functionResponse = $client.GetAsync("https://api.supabase.com/v1/projects/$projectRef/functions/ai").GetAwaiter().GetResult()
    $functionBody = $functionResponse.Content.ReadAsStringAsync().GetAwaiter().GetResult()
    if (-not $functionResponse.IsSuccessStatusCode) {
        throw "Could not verify the deployed AI function (HTTP $([int]$functionResponse.StatusCode))."
    }
    $functionInfo = $functionBody | ConvertFrom-Json
    if ($functionInfo.status -ne 'ACTIVE' -or $functionInfo.verify_jwt -ne $false) {
        throw 'The AI function was deployed with an unexpected status or authentication configuration.'
    }

    $secretsResponse = $client.GetAsync("https://api.supabase.com/v1/projects/$projectRef/secrets").GetAwaiter().GetResult()
    $secretsBody = $secretsResponse.Content.ReadAsStringAsync().GetAwaiter().GetResult()
    if (-not $secretsResponse.IsSuccessStatusCode) {
        throw "Could not verify Supabase secrets (HTTP $([int]$secretsResponse.StatusCode))."
    }
    $secretNames = @($secretsBody | ConvertFrom-Json | ForEach-Object { $_.name })
    if ($secretNames -notcontains 'GEMINI_API_KEY' -and $secretNames -notcontains 'GOOGLE_API_KEY') {
        if (-not (Test-Path -LiteralPath $envPath)) {
            throw 'Gemini API key is not present in Supabase Secrets or the local .env file.'
        }
        $keyLine = Get-Content -LiteralPath $envPath | Where-Object { $_ -match '^GEMINI_API_KEY=' } | Select-Object -First 1
        if (-not $keyLine) {
            throw 'Gemini API key is not present in Supabase Secrets or the local .env file.'
        }
        $geminiKey = ($keyLine -split '=', 2)[1].Trim().Trim('"').Trim("'")
        if (-not $geminiKey) {
            throw 'The local GEMINI_API_KEY is empty.'
        }
        $secretPayload = ConvertTo-Json -InputObject @(@{ name = 'GEMINI_API_KEY'; value = $geminiKey }) -Compress
        $secretContent = [System.Net.Http.StringContent]::new($secretPayload, [System.Text.Encoding]::UTF8, 'application/json')
        $setSecretResponse = $client.PostAsync("https://api.supabase.com/v1/projects/$projectRef/secrets", $secretContent).GetAwaiter().GetResult()
        if (-not $setSecretResponse.IsSuccessStatusCode) {
            throw "Could not add GEMINI_API_KEY to Supabase Secrets (HTTP $([int]$setSecretResponse.StatusCode))."
        }
        $geminiKey = $null
        $secretPayload = $null
        $secretContent.Dispose()
    }

    $modelSecretPayload = ConvertTo-Json -InputObject @(
        @{ name = 'GEMINI_MODEL'; value = $geminiModel }
    ) -Compress
    $modelSecretContent = [System.Net.Http.StringContent]::new(
        $modelSecretPayload,
        [System.Text.Encoding]::UTF8,
        'application/json'
    )
    try {
        $setModelResponse = $client.PostAsync(
            "https://api.supabase.com/v1/projects/$projectRef/secrets",
            $modelSecretContent
        ).GetAwaiter().GetResult()
        if (-not $setModelResponse.IsSuccessStatusCode) {
            throw "Could not set GEMINI_MODEL in Supabase Secrets (HTTP $([int]$setModelResponse.StatusCode))."
        }
    }
    finally {
        $modelSecretContent.Dispose()
        $modelSecretPayload = $null
    }

    Write-Output "Supabase Edge Function ai deployed with model $geminiModel; Gemini API key is present."
}
finally {
    $form.Dispose()
    $client.Dispose()
    $accessToken = $null
}
