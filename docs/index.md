# app/android — Documentação Técnica

Atualizado em 16/06/2026. App nativo Android para motoristas SUWAVE (Expo SDK 54, React Native 0.81.5, New Architecture).

---

## Stack

| Item | Versão |
|---|---|
| Expo SDK | 54.0.34 |
| React Native | 0.81.5 |
| Expo Router | 6.0.23 |
| TypeScript | strict mode |
| Zustand | 5.0.14 (AsyncStorage) |
| React Native Maps | Google Maps |
| Expo Notifications | push via Expo |
| Expo Local Authentication | biometria |
| expo-image | imagens otimizadas |
| expo-secure-store | JWT token |

Android mínimo: API 24 (Android 7.0). Target: API 36.

---

## Cobertura de fluxos implementados

### Autenticação
- [x] Login com e-mail/senha
- [x] Login com biometria (expo-local-authentication)
- [x] Cadastro em 4 passos (dados, documentos, veículo, revisão)
- [x] Vinculação de conta comprador → motorista
- [x] Token JWT no SecureStore com refresh automático
- [x] Expiração de sessão com redirect para login

### Corridas
- [x] Toggle online/offline com verificação de veículo aprovado
- [x] Polling de corridas disponíveis (4s → backoff até 30s)
- [x] Alerta visual de nova corrida
- [x] Aceitar corrida → tela ride-active com mapa
- [x] Recusar corrida → tela ride-declined
- [x] Rastreamento de localização durante corrida (GPS throttle 15s)
- [x] Rota desenhada no mapa (Polyline via Google Maps)
- [x] Concluir corrida → tela de pagamento
- [x] Pagamento dinheiro (valor destacado)
- [x] Pagamento PIX (QR code + código copiável via Share)
- [x] Tela de conclusão com confetti

### Entregas
- [x] Listagem de pedidos de entrega disponíveis
- [x] Aceitar entrega → tela delivery-active
- [x] Coletar pedido (pickup)
- [x] Concluir entrega → tela delivery-completed
- [x] Recusar/cancelar entrega

### Financeiro
- [x] Seletor de período (hoje, ontem, 7d, 15d, 30d)
- [x] Gráfico de barras animado (Reanimated 3)
- [x] Cards de estatística (online, viagens, pontos)
- [x] Histórico de corridas/entregas/rotas no período
- [x] Modal de detalhe da viagem (TripDetailModal)

### Avaliações
- [x] Tela de avaliações recebidas (`reviews.tsx`)
- [x] ReviewRing — anel circular com nota média
- [x] Avaliação do passageiro pelo motorista — `ride-completed.tsx` (16/06/2026)

### Push notifications
- [x] Registro do token Expo no backend (POST /driver/push-token)
- [x] Validação de response.ok e log de erros
- [x] Roteamento por tipo: new_ride → /ride-available
- [x] Roteamento por screen: delivery, status, notifications

### Cadastro de veículo
- [x] Seleção do modo de trabalho (carro, moto, bike, entrega)
- [x] Wizard 4 passos: marca, dados, fotos, revisão
- [x] Upload de 4 fotos (frente, traseira, lateral, interior)
- [x] Edição de veículo existente
- [x] Definição de veículo ativo

### Perfil e documentos
- [x] Edição de dados pessoais (CPF, CNPJ, PIX, gênero)
- [x] Upload de foto do rosto (face biometria)
- [x] Upload de CNH (frente + verso)
- [x] Envio para revisão + polling de status
- [x] Notificações em tempo real de status de aprovação

### Rotas planejadas (planned trips)
- [x] Cadastro de rota (origem, destino, data ida, data volta)
- [x] Listagem de rotas ativas
- [x] Concluir / cancelar rota

---

## Funções por módulo

### `services/driver-client.ts` — 40 funções exportadas

#### Auth
| Função | Rota | Retorno |
|---|---|---|
| `registerDriverAccount` | POST /auth/register | `DriverAuthSession` |
| `checkDriverAccountAvailability` | POST /auth/account/availability | `AccountAvailability` |
| `loginDriverAccount` | POST /auth/driver/login | `DriverAuthSession` |
| `linkDriverRole` | POST /auth/link-role | `DriverAuthSession` |
| `linkDriverCredential` | POST /auth/driver/link-credential | `DriverAuthSession` |
| `requestDriverPasswordReset` | POST /auth/password/forgot | `{ email }` |
| `resetDriverPassword` | POST /auth/password/reset | `{ email }` |
| `getDriverTerms` | GET /driver/terms | `DriverTerms` |

#### Perfil e documentos
| Função | Rota | Retorno |
|---|---|---|
| `getDriverProfile` | GET /driver/me | `DriverProfile` |
| `saveDriverProfile` | POST /driver/profile | `DriverProfile` |
| `updateDriverProfile` | PUT /driver/profile | `DriverProfile` |
| `uploadDriverImage` | POST /uploads/images | `UploadResult` |
| `saveDriverFacePhoto` | POST /driver/photo/face | `void` |
| `saveDriverCnh` | POST /driver/documents/cnh | `void` |
| `submitDriverReview` | POST /driver/submit-review | `void` |
| `getDriverReviewStatus` | GET /driver/review-status | `DriverReviewStatus` |

#### Veículo
| Função | Rota | Retorno |
|---|---|---|
| `saveDriverVehicle` | POST /driver/vehicle | `void` |
| `updateDriverVehicle` | PUT /driver/vehicle/{id} | `void` |
| `setActiveVehicle` | POST /driver/vehicle/active | `DriverAvailability` |

#### Disponibilidade e localização
| Função | Rota | Retorno |
|---|---|---|
| `setDriverOnline` | POST /driver/availability/online | `DriverAvailability` |
| `setDriverOffline` | POST /driver/availability/offline | `DriverAvailability` |
| `pingDriverLocation` | POST /driver/location/ping | `void` |

#### Corridas
| Função | Rota | Retorno |
|---|---|---|
| `listDriverRideRequests` | GET /driver/ride-requests | `DriverRideRequest[]` |
| `acceptDriverRideRequest` | POST /driver/ride-requests/{id}/accept | `DriverRideRequest` |
| `declineDriverRideRequest` | POST /driver/ride-requests/{id}/decline | `DriverRideRequest` |
| `completeDriverRideRequest` | POST /driver/ride-requests/{id}/complete | `DriverRideRequest` |
| `rateDriverRide` | POST /driver/ride-requests/{id}/driver-rating | `DriverRideRating` |

#### Entregas
| Função | Rota | Retorno |
|---|---|---|
| `listAvailableDriverDeliveries` | GET /driver/deliveries/available | `DriverDelivery[]` |
| `acceptDriverDelivery` | POST /driver/deliveries/{id}/accept | `DriverDelivery` |
| `pickupDriverDelivery` | POST /driver/deliveries/{id}/pickup | `DriverDelivery` |
| `completeDriverDelivery` | POST /driver/deliveries/{id}/complete | `DriverDelivery` |

#### Rotas, ganhos e notificações
| Função | Rota | Retorno |
|---|---|---|
| `listDriverTrips` | GET /driver/trips | `DriverPlannedTrip[]` |
| `createDriverTrip` | POST /driver/trips | `DriverPlannedTrip` |
| `completeDriverTrip` | POST /driver/trips/{id}/complete | `DriverPlannedTrip` |
| `cancelDriverTrip` | POST /driver/trips/{id}/cancel | `DriverPlannedTrip` |
| `listDriverHistory` | GET /driver/history | `DriverHistoryItem[]` |
| `getDriverEarnings` | GET /driver/earnings | `DriverEarnings` |
| `listDriverNotifications` | GET /notifications | `DriverNotification[]` |
| `reportClientError` | POST /monitor/errors | `void` (best-effort) |
| `onDriverAuthExpired` | — | unsubscribe fn |

---

### `utils/rides.ts` — 4 funções

| Função | O que faz |
|---|---|
| `formatRideDistance(meters?)` | Formata distância: `1,5 km` ou `800 m` |
| `formatRideTime(isoString)` | Hora no formato `HH:mm` (pt-BR) |
| `formatRideFare(meters?, type?)` | Estima tarifa local por km (R$) — apenas exibição |
| `formatDriverEta(meters?)` | Tempo estimado de chegada: `~5 min` |

---

### `utils/finance.ts` — 11 funções + 3 constantes

| Função / Constante | O que faz |
|---|---|
| `PERIOD_OPTIONS` | Array `['today','yesterday','7d','15d','30d','custom']` |
| `PERIOD_LABELS` | Mapa de chaves → rótulo PT-BR |
| `HISTORY_FILTERS` | Array de filtros com ícone (all, ride, delivery…) |
| `toISODate(date)` | `Date` → string `YYYY-MM-DD` sem fuso |
| `dateToLocalInputValue(date)` | Alias de `toISODate` para inputs |
| `addDaysToInputDate(value, days)` | Soma dias a uma string YYYY-MM-DD |
| `getPeriodRange(period, custom)` | Retorna `{ start, end }` para o período selecionado |
| `formatISODateLabel(value)` | `YYYY-MM-DD` → `DD/MM/YYYY` |
| `formatPeriodRangeLabel(start, end)` | Rótulo de período: `01/06/2026 - 16/06/2026` |
| `getWeekdayLabel(isoDate)` | Dia da semana abreviado: `S`, `T`, `Q`… |
| `formatFinanceCurrency(cents)` | Centavos → `R$ 12,50` |
| `formatFinanceDate(isoString)` | ISO → `DD/MM/YYYY` |
| `formatOnlineDuration(seconds?)` | Duração online: `2h 30m` |
| `formatTripDistanceKm(km?)` | Km formatado com vírgula decimal |
| `formatTripDuration(seconds?)` | Duração de viagem: `45 min` ou `1h 30m` |

---

### `utils/format.ts` — 1 função

| Função | O que faz |
|---|---|
| `formatCurrency(value)` | Número → `R$ 12,50` (Intl.NumberFormat pt-BR) |

---

### `utils/vehicles.ts` — 6 funções + 2 constantes

| Função / Constante | O que faz |
|---|---|
| `isVehicleApproved(vehicle?)` | `status === 'APROVADO'` — compartilhado entre dashboard e profile |
| `fallbackBrands` | Lista de marcas padrão quando API não responde |
| `vehicleSteps` | Passos do wizard: `['1','2','3','4']` |
| `normalizeBrandName(value)` | Remove acentos + lowercase para comparação |
| `getBrandInitials(name)` | `Volkswagen` → `VW` |
| `getWorkModeUi(mode)` | Retorna config de UI por modo de trabalho (labels, slots de foto, etc.) |
| `workModeToVehicleType(mode)` | `'moto_delivery'` → `'moto'` |
| `getVehicleStatusLabel(status?)` | `'APROVADO'` → `'Ativo'`, `'PENDENTE'` → `'Em análise'` |
| `formatVehicleYear(value?)` | Ano do veículo formatado ou `'Não informado'` |

---

### `utils/masks.ts` — 5 funções

| Função | Máscara aplicada |
|---|---|
| `maskCpf(value)` | `000.000.000-00` |
| `maskCnpj(value)` | `00.000.000/0000-00` |
| `maskPhone(value)` | `(00) 00000-0000` |
| `maskDate(value)` | `DD/MM/YYYY` |
| `onlyDigits(value)` | Remove tudo que não é dígito |

---

### `utils/review.ts` — 1 função + 2 constantes

| Item | O que faz |
|---|---|
| `reviewApprovalWindowSeconds` | Janela de análise: 600s (10 min) |
| `reviewMissingLabels` | Mapa de campo pendente → rótulo PT-BR |
| `formatReviewTime(seconds)` | `MM:SS` para contagem regressiva de análise |

---

### `utils/time.ts` — 1 função

| Função | O que faz |
|---|---|
| `formatRelativeTime(isoDate)` | Tempo relativo: `agora`, `5 min atrás`, `2h atrás`, `ontem`, `12 mai` |

---

### `stores/driver-flow-store.ts` — Estado global

Persistido no AsyncStorage com chave `suwave-driver-flow`.  
Apenas `activeRide` e `activeDelivery` são persistidos entre sessões.

#### Fatias de estado
| Campo | Tipo | Persistido |
|---|---|---|
| `signupForm` | `DriverSignupForm` | não |
| `signupStep` | `number` | não |
| `isLinkingExistingAccount` | `boolean` | não |
| `faceImage / cnhFront / cnhBack` | `DriverFlowImage?` | não |
| `selectedWorkMode` | `DriverWorkMode?` | não |
| `selectedBrand` | `VehicleBrandOption?` | não |
| `vehicleForm` | `VehicleForm` | não |
| `vehicleUploads` | `VehicleUploads` | não |
| `pendingRide` | `DriverRideRequest?` | não |
| `pendingDelivery` | `DriverDelivery?` | não |
| `activeRide` | `DriverRideRequest?` | **sim** |
| `activeDelivery` | `DriverDelivery?` | **sim** |

#### Actions
| Action | O que faz |
|---|---|
| `setSignupForm(form)` | Substitui o form inteiro |
| `setSignupStep(step)` | Avança/retrocede no wizard |
| `setIsLinkingExistingAccount(v)` | Controla fluxo de vinculação |
| `setFaceImage / setCnhFront / setCnhBack` | Armazena imagens do cadastro |
| `setEditingVehicleId(id?)` | Inicia edição de veículo existente |
| `setSelectedWorkMode / setSelectedBrand` | Seleções do wizard de veículo |
| `setVehicleForm(form)` | Substitui dados do veículo |
| `updateVehicleForm(patch)` | Patch parcial do veículo |
| `setVehicleUploads(uploads)` | Fotos do veículo (frente/traseira/lateral/interior) |
| `setPendingRide(ride?)` | Corrida aguardando decisão |
| `setPendingDelivery(delivery?)` | Entrega aguardando decisão |
| `setActiveRide(ride?)` | Corrida em andamento (inclui fare data pós-complete) |
| `setActiveDelivery(delivery?)` | Entrega em andamento |
| `resetFlow()` | Limpa todo o estado de cadastro (preserva corridas ativas) |

---

### `hooks/`

| Hook | Responsabilidade |
|---|---|
| `usePushNotifications()` | Solicita permissão, obtém token Expo, salva via POST /driver/push-token, roteia notificações recebidas |
| `useBiometrics()` | Verifica disponibilidade e autentica via biometria nativa |
| `useColorScheme()` | Dark/light mode (reservado para futura implementação de tema) |

---

### `contexts/auth-context.tsx`

| Export | O que faz |
|---|---|
| `AuthProvider` | Envolve o app, carrega token do SecureStore, ouve `onDriverAuthExpired` |
| `useAuth()` | Retorna `{ token, logout, refreshProfile, isReady }` |

---

## Estrutura de diretórios

```
app/android/
├── app/                    # Rotas Expo Router (35 telas)
│   ├── _layout.tsx         # Root layout — AuthContext + PushNotifications
│   ├── index.tsx           # Splash / redirect guard
│   ├── login.tsx           # Login (email/senha + biometria)
│   ├── signup.tsx          # Cadastro multistep
│   ├── dashboard.tsx       # Painel principal — FlatList de corridas/entregas
│   ├── ride-available.tsx  # Corrida pendente de aceite
│   ├── ride-active.tsx     # Corrida em andamento (mapa + ping throttled 15s)
│   ├── ride-payment.tsx    # Pagamento (dinheiro / PIX QR code)
│   ├── ride-completed.tsx  # Conclusão com confetti
│   ├── ride-declined.tsx   # Corrida recusada
│   ├── delivery-*.tsx      # Fluxo de entregas (4 telas)
│   ├── vehicle-*.tsx       # Wizard de veículo (6 telas)
│   ├── finance.tsx         # Ganhos, extrato, horas online
│   ├── reviews.tsx         # Avaliações recebidas
│   └── ...                 # profile, settings, notifications, terms, face, cnh
├── components/motorista/   # 17 componentes UI específicos
├── contexts/               # auth-context.tsx
├── hooks/                  # push-notifications, biometrics, color-scheme
├── services/               # driver-client.ts, maps-client.ts
├── stores/                 # driver-flow-store.ts
├── constants/              # suwave-theme.ts (design system)
├── types/                  # enums.ts (DriverStatus, VehicleStatus, RideStatus…)
└── utils/
    ├── rides.ts            # formatDriverEta, formatRideFare, formatRideDistance
    ├── finance.ts          # getPeriodRange, formatOnlineDuration, formatFinanceCurrency
    ├── format.ts           # formatCurrency (compartilhado)
    ├── masks.ts            # CPF, CNPJ, telefone, data
    ├── deliveries.ts       # Helpers de status de entrega
    ├── review.ts           # formatReviewTime, reviewMissingLabels
    ├── time.ts             # Helpers de data/hora
    └── vehicles.ts         # isVehicleApproved, getWorkModeUi, workModeToVehicleType
```

---

## Fluxo de autenticação

```
index.tsx
  └── auth-context.tsx (SecureStore)
        ├── token presente → dashboard.tsx
        └── sem token      → login.tsx
                                ├── email/senha → loginDriverAccount()
                                ├── biometria  → useBiometrics()
                                └── sucesso    → dashboard.tsx
```

---

## Fluxo de corrida (motorista)

```
dashboard.tsx           # online/offline toggle
  └── polling listDriverRideRequests (4s, backoff até 30s)
        └── corrida nova → FlatList de cards
              └── ride-available.tsx (setPendingRide)
                    ├── aceitar → acceptDriverRideRequest
                    │     └── ride-active.tsx (setActiveRide)
                    │           ├── GPS watchPosition → pingDriverLocation (min 15s)
                    │           ├── Polyline da rota no mapa
                    │           └── concluir → completeDriverRideRequest
                    │                 └── ride-payment.tsx (fare data no activeRide)
                    │                       ├── dinheiro: valor líquido destacado
                    │                       └── pix: buildPixCode + QR + Share
                    │                             └── confirmar → ride-completed.tsx
                    └── recusar → declineDriverRideRequest
                          └── ride-declined.tsx
```

---

## Fluxo de push notification

```
_layout.tsx
  └── usePushNotifications()
        ├── requestPermissionsAsync()
        ├── getExpoPushTokenAsync()
        │     └── POST /driver/push-token
        │           ├── response.ok → ok
        │           └── !response.ok → warn no console
        └── addNotificationResponseReceivedListener()
              ├── type=new_ride     → /ride-available
              ├── screen=delivery   → /delivery-available
              ├── screen=status     → /status
              └── screen=notifications → /notifications
```

---

## Componentes reutilizáveis (`components/motorista/`)

| Componente | Responsabilidade |
|---|---|
| `action-button.tsx` | Botão principal com loading, disabled, ícone |
| `app-header.tsx` | Header nativo com título e back |
| `brand-lockup.tsx` | Logo + tagline em telas de boas-vindas |
| `suwave-wordmark.tsx` | Wordmark isolado da marca |
| `field.tsx` | Input controlado com label e erro |
| `labeled-field.tsx` | Campo com label externo |
| `radio-group-field.tsx` | Grupo de radio buttons |
| `select-field.tsx` | Dropdown nativo |
| `password-strength-bar.tsx` | Barra de força de senha |
| `form-toast.tsx` | Toast de erro/sucesso inline |
| `progress-steps.tsx` | Indicador de progresso (wizard) |
| `confetti.tsx` | Animação de confetti pós-corrida |
| `review-ring.tsx` | Anel circular de avaliação (nota média) |
| `success-check.tsx` | Ícone de sucesso animado |
| `skeleton-box.tsx` | Placeholder de carregamento |
| `native-map.tsx` | MapView com fallback web |

---

## Design system (`constants/suwave-theme.ts`)

```typescript
SuwaveColors.ink         // #243949 — texto principal
SuwaveColors.muted       // #607381 — texto secundário
SuwaveColors.background  // #edf4f4 — fundo padrão
SuwaveColors.line        // borda sutil
SuwaveColors.brand       // cor primária SUWAVE
SuwaveColors.yellow      // #ffc61a — destaque/alerta

SuwaveTypography.heroTitleFontSize   // título grande
SuwaveTypography.heroTextFontSize    // texto de apoio

SuwaveSpacing.screenHorizontal       // padding lateral padrão
SuwaveSpacing.screenVerticalTop      // padding topo
SuwaveSpacing.screenVerticalBottom   // padding rodapé
```

---

## Tipos principais (`types/enums.ts`)

```typescript
DriverStatus   // RASCUNHO | EM_ANALISE | APROVADO | RECUSADO | BLOQUEADO | SUSPENSO
VehicleStatus  // EM_ANALISE | APROVADO | BLOQUEADO
RideStatus     // PROCURANDO | SEM_MOTORISTA | ACEITA | RECUSADA | CONCLUIDA
TripStatus     // ATIVA | CANCELADA | CONCLUIDA
DeliveryStatus // paid | preparing | on_route | delivered
PixKeyType     // email | phone | cpf | cnpj | random
```

---

## Pendências documentadas

| Funcionalidade | Módulo | Prioridade | Status |
|---|---|---|---|
| G9 — Referral/indicação | app/android + API | Baixa | Aguarda endpoint backend |
| Fase F — WebSocket real-time | app/android + API | Média | Bloqueado — Flask sem socketio |
| Chat in-ride com passageiro | app/android + API | Média | Aguarda backend |
| Revisão visual dos ícones gerados | android/assets | Baixa | Gerados programaticamente — ver [android-icone-tela.md](../../docs/android-icone-tela.md) |
| Publicação na Google Play Store | android | Baixa | APK pronto em `tests/app-motorista-v1.0.0.apk` |

---

## Docs relacionados

- [Qualidade de código](qualidade.md)
- [Fluxo pedido → motorista](../../docs/pedido-motorista.md)
- [Sequência de testes manuais](../../docs/pedido-motorista-sequencia.md)
- [API motorista](../../api/docs/index.md)
