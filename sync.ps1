$git = "C:\Users\Jhones Moreira\AppData\Local\GitHubDesktop\app-3.5.5\resources\app\git\cmd\git.exe"

function Sync-GitHub {
    param (
        [string]$Message = "Auto-commit: $(Get-Date -Format 'yyyy-MM-dd HH:mm:ss')"
    )

    Write-Host "--- Iniciando Sincronização GitHub ---" -ForegroundColor Cyan
    
    # Adicionar alterações
    & $git add .
    
    # Commit
    $status = & $git status --porcelain
    if (-not $status) {
        Write-Host "Nenhuma alteração para commitar." -ForegroundColor Yellow
        return
    }
    
    & $git commit -m $Message
    
    # Push
    Write-Host "Enviando para o GitHub..." -ForegroundColor Cyan
    & $git push origin main
    
    if ($LASTEXITCODE -eq 0) {
        Write-Host "Sucesso! Site atualizado." -ForegroundColor Green
    } else {
        Write-Host "Erro ao enviar. Tentando forçar sincronização..." -ForegroundColor Red
        & $git push origin main --force
    }
}

# Executa a função se chamado diretamente
Sync-GitHub
