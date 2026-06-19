# SUWAVE Android

App nativo do motorista SUWAVE.

Atualizado em 19/06/2026.

## Estado atual

- Expo SDK 54 / React Native.
- Fluxos amplos de login, cadastro, documentos, veiculo, dashboard, corridas, entregas, notificacoes, financeiro e perfil.
- Funciona como frente nativa complementar ao `app/motorista`.

## Comandos

```powershell
npm install
npx expo start
npx tsc --noEmit
npx eslint . --ext .ts,.tsx
```

## Documentacao importante

- `docs/index.md`
- `docs/qualidade.md`
- `..\..\docs\MAPA-COMMIT-PUSH-QUALIDADE-MODULOS.md`

## Commit e push

Situacao atual:

- o repositorio local existe
- no momento desta leitura nao ha `origin` configurado

Fluxo recomendado apos centralizar no GitHub:

```powershell
git status --short --branch
npx tsc --noEmit
npx eslint . --ext .ts,.tsx
git add <arquivos-do-android>
git commit -m "feat(android): descricao"
git push origin main
```

## Regra importante

Antes de qualquer push do Android:

- confirmar qual sera o repositorio oficial no GitHub
- configurar `origin`
- validar o fluxo com tipagem e lint
