try {
  $r = Invoke-WebRequest -Uri 'http://127.0.0.1:9876/refresh' -TimeoutSec 120 -UseBasicParsing
  Write-Host "Status: $($r.StatusCode)"
  Write-Host "Body: $($r.Content)"
} catch {
  Write-Host "Error: $($_.Exception.Message)"
  if ($_.Exception.Response) {
    $stream = $_.Exception.Response.GetResponseStream()
    $reader = New-Object System.IO.StreamReader($stream)
    $body = $reader.ReadToEnd()
    Write-Host "Response Body: $body"
  }
}
