# Tabela de compatibilidade Android - app motorista

Atualizado em 15/06/2026.

## Base tecnica revisada

Esta tabela foi montada a partir da configuracao real do projeto em `app/android`:

- `app.json`: Expo SDK 54, React Native Maps, biometria, localizacao e notificacoes habilitados.
- `package.json`: Expo `~54.0.34`, React Native `0.81.5`, React `19.1.0`.
- `android/app/build.gradle`: usa `minSdkVersion`, `targetSdkVersion` e `compileSdkVersion` vindos do root Expo.
- Gradle resolvido no ambiente atual: `minSdk 24`, `targetSdk 36`, `compileSdk 36`, `buildTools 36.0.0`.

## Corte oficial de suporte

| Item | Valor atual | Leitura pratica |
| --- | --- | --- |
| Minimo instalado (`minSdk`) | API 24 | Android 7.0 ou superior |
| Alvo de publicacao (`targetSdk`) | API 36 | Base preparada para Android 16 |
| SDK de compilacao (`compileSdk`) | API 36 | Build alinhada com API moderna |
| Arquitetura RN/Expo | RN 0.81 + Expo 54 + New Architecture | Melhor em aparelhos com Google Play Services atualizados |

## Compatibilidade por versao e ano

Observacao importante: "ano do aparelho" e aproximado. O que manda tecnicamente e a versao real do Android instalada no aparelho, nao apenas o ano de lancamento do hardware.

| Android | API | Status no app | Faixa comum de aparelhos | Exemplos de linhas/modelos que entram |
| --- | --- | --- | --- | --- |
| Android 9  | 28 | Suporta | 2018-2020 | Galaxy A10/A20/A30, Moto G7, Redmi Note 7 |
| Android 10 | 29 | Suporta e recomendado | 2019-2021 | Galaxy A11/A21s/A31, Moto G8/G9, Redmi Note 8/9 |
| Android 11 | 30 | Suporta e recomendado | 2020-2022 | Galaxy A12/A22/A32, Moto G10/G20/G30, Redmi Note 10 |
| Android 12 / 12L | 31 / 32 | Suporta e recomendado | 2021-2023 | Galaxy A13/A23/A33, Moto G22/G52/G62, Poco M4 |
| Android 13 | 33 | Suporta e recomendado | 2022-2024 | Galaxy A14/A24/A34/A54, Moto G53/G73, Redmi Note 12 |
| Android 14 | 34 | Suporta e recomendado | 2023-2025 | Galaxy A15/A25/A35/A55, Moto G54/G84, Redmi Note 13 |
| Android 15 | 35 | Suporta | 2024-2026 | Linhas mais novas com update recente |
| Android 16 | 36 | Alvo atual | 2025-2026+ | Novos aparelhos e beta/rollout mais novo |

## Faixa de cobertura para o lancamento

| Faixa | O que significa | Recomendacao |
| --- | --- | --- |
| Cobertura tecnica maxima | Android 7.0+ (API 24+) | Pode ser divulgado como suporte minimo oficial |
| Cobertura operacional segura | Android 10+ (API 29+) | Melhor faixa para lancamento inicial e QA principal |
| Cobertura premium | Android 12+ (API 31+) | Onde biometria, mapas e performance tendem a ficar mais consistentes |

## Recomendacao pratica para o release

- Comunicar suporte oficial minimo como `Android 7.0+`.
- Concentrar QA de lancamento em `Android 10, 11, 12, 13 e 14`.
- Se houver pouco tempo de teste, priorizar aparelhos de entrada/intermediarios de `2020+`, porque eles representam melhor a realidade operacional do motorista.
- Evitar prometer compatibilidade por "ano do aparelho" sem checar a versao do Android instalada.

## Riscos e observacoes da revisao

- O app depende de Google Maps, localizacao, notificacoes e biometria; aparelhos sem Google Play Services atualizado podem ter experiencia degradada mesmo com Android suportado.
- `app.json` tem permissoes Android repetidas (`USE_BIOMETRIC`, `USE_FINGERPRINT`, `ACCESS_COARSE_LOCATION`, `ACCESS_FINE_LOCATION`). Isso nao muda a compatibilidade, mas vale limpar antes do release.
- Ja existe um APK anterior em `app/android/tests/motorista-suwave.apk`.
- Para gerar um novo `app-motorista-v2.apk`, o ambiente atual ainda precisa do Android SDK configurado via `ANDROID_HOME` ou `app/android/android/local.properties`.
