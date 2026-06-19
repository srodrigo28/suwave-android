# app/android — Fluxo de Qualidade de Código

Atualizado em 16/06/2026.

---

## Validação local (executar antes de qualquer commit)

```bash
# Na raiz de app/android
npx tsc --noEmit          # Verifica tipagem TypeScript (zero erros esperados)
npx eslint . --ext .ts,.tsx  # Lint (zero warnings esperados)
```

Não há Jest/Vitest configurado no android — testes manuais conforme checklist abaixo.

---

## Checklist por tipo de mudança

### Adição de nova tela

- [ ] Arquivo em `app/[nome-da-tela].tsx`
- [ ] Registrado no `_layout.tsx` se exigir autenticação
- [ ] Usa `SafeAreaView` com `edges={['top','bottom']}`
- [ ] Usa `SuwaveColors`, `SuwaveSpacing`, `SuwaveTypography` do design system
- [ ] Sem cores hexadecimais hardcoded fora de `suwave-theme.ts`
- [ ] Usa `ActionButton` ao invés de `<TouchableOpacity>` customizado para ações primárias
- [ ] `FormToast` para feedback de erro inline
- [ ] Animações de loading com `disabled={isBusy} loading={isBusy}` no `ActionButton`
- [ ] Navegação via `router.push` / `router.replace` do `expo-router`
- [ ] Testar em portrait e landscape

### Adição de novo endpoint no `driver-client.ts`

- [ ] Tipo de retorno definido em `export type X = { ... }`
- [ ] Usa `apiRequest(path, options)` interno (não `fetch` diretamente)
- [ ] Usa `parseResponse<T>()` para desempacotar `{ data: T }`
- [ ] Adicionar função à tabela de endpoints no [index.md](index.md)
- [ ] Testar token expirado (deve retornar 401 e redirecionar para login)

### Modificação no `driver-flow-store.ts`

- [ ] Campos novos adicionados ao tipo com `| null` se opcionais
- [ ] `setActiveRide(null)` chamado ao concluir/cancelar fluxo
- [ ] Verificar que o AsyncStorage não acumula estado obsoleto após logout

### Adição de componente em `components/motorista/`

- [ ] Props tipadas com interface TypeScript
- [ ] Sem lógica de negócio — componente só renderiza e emite callbacks
- [ ] Estilos em `StyleSheet.create({})`, nunca inline
- [ ] Variantes (primary/secondary) via prop, não via lógica condicional externa
- [ ] Adicionar à tabela de componentes no [index.md](index.md)

### Adição de hook em `hooks/`

- [ ] Prefixo `use-` no nome do arquivo
- [ ] Cleanup de efeitos (cancelar subscriptions no retorno do `useEffect`)
- [ ] Sem side effects fora de `useEffect`
- [ ] Não deve fazer `fetch` direto — delegar ao `driver-client.ts`

---

## Padrões obrigatórios

### Navegação
```typescript
// Correto: replace ao concluir fluxo (limpa histórico)
router.replace('/dashboard');

// Correto: push para telas de detalhe
router.push('/ride-active');

// Errado: href string incorreto → tela inexistente em silêncio
router.push('/ride_active');  // underscore não funciona
```

### Estilos
```typescript
// Correto: StyleSheet fora do componente
const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: SuwaveColors.background },
});

// Errado: objeto inline com cores hardcoded
<View style={{ backgroundColor: '#edf4f4' }} />
```

### Estado de loading
```typescript
// Padrão obrigatório para ações assíncronas
const [isBusy, setIsBusy] = useState(false);
async function handleAction() {
  setIsBusy(true);
  try { await ... } catch (err) { setMessage(...) } finally { setIsBusy(false); }
}
```

### Formatação de valores
```typescript
// Usar utils/ — nunca repetir lógica inline
import { formatRideFare, formatDriverEta } from '@/utils/rides';
import { formatCPF, formatPhone } from '@/utils/masks';
```

---

## Cenários de teste manual obrigatórios

### Corrida completa
- [ ] Login → Dashboard → Online → Receber corrida (push ou polling)
- [ ] Aceitar → mapa exibido com rota até passageiro
- [ ] Simular chegada → Concluir corrida
- [ ] Tela de pagamento: Dinheiro — valor exibido corretamente
- [ ] Tela de pagamento: PIX — QR code gerado e compartilhamento funciona
- [ ] Corrida aparece em `finance.tsx`

### Push notification
- [ ] Token salvo no backend após login (`expo_push_token` preenchido)
- [ ] Notificação recebida com app em background → abre `/ride-available`
- [ ] Notificação recebida com app fechado → abre `/ride-available`

### Cenários de erro
- [ ] Sem internet → erros exibidos no `FormToast` sem crash
- [ ] Token expirado → redirect para login automático
- [ ] Corrida já aceita por outro motorista → mensagem de erro clara
- [ ] Motorista offline ao tentar aceitar → erro `driver_offline`

### Veículo ativo
- [ ] Motorista com 2 veículos aprovados: obrigado a selecionar ativo antes de ficar online
- [ ] `missing: ["active_vehicle"]` → UI mostra instrução de seleção

---

## Armadilhas críticas — erros que já pararam o app (16/06/2026)

As seções abaixo documentam cada crash ou erro grave que aconteceu em produção/desenvolvimento. Antes de alterar qualquer um dos arquivos listados, leia o fix e o motivo.

---

### 1. `import.meta` crash ao iniciar o app no emulador

**Sintoma:** App abre e crasha imediatamente com erro de `import.meta` no bundle Metro.

**Causa:** `zustand/middleware` (especificamente `persist`) usa `import.meta.env` internamente. O Metro bundler do React Native não suporta `import.meta` — essa é uma sintaxe de ESM nativa do navegador/Node.

**Fix aplicado em** `app/android/metro.config.js`:
```js
config.resolver.sourceExts = ['cjs', ...config.resolver.sourceExts];
config.resolver.resolveRequest = (context, moduleName, platform) => {
  if (moduleName === 'zustand/middleware') {
    return {
      filePath: require.resolve('zustand/middleware'),
      type: 'sourceFile',
    };
  }
  return context.resolveRequest(context, moduleName, platform);
};
```
Força o zustand/middleware a ser resolvido como CJS eliminando o `import.meta`.

**Regra:** nunca remover ou simplificar o `metro.config.js` achando que é desnecessário. Sem ele o app não inicia.

---

### 2. `expo-secure-store` crasha na web (emulador Expo Go Web)

**Sintoma:** App crasha ao tentar fazer login ou ao restaurar sessão. Erro contém `expo-secure-store` ou `getItemAsync is not a function`.

**Causa:** `expo-secure-store` não existe no runtime da web. O emulador Android rodando via Expo Go pode usar um runtime web internamente. Qualquer import direto de `expo-secure-store` em código que roda no boot crasha instantaneamente.

**Fix aplicado em** `app/android/utils/secure-storage.ts` (wrapper platform-aware):
```typescript
import { Platform } from 'react-native';
import * as SecureStore from 'expo-secure-store';

export async function getSecureItem(key: string): Promise<string | null> {
  if (Platform.OS === 'web') return localStorage.getItem(key);
  return SecureStore.getItemAsync(key);
}
export async function setSecureItem(key: string, value: string): Promise<void> {
  if (Platform.OS === 'web') { localStorage.setItem(key, value); return; }
  return SecureStore.setItemAsync(key, value);
}
export async function deleteSecureItem(key: string): Promise<void> {
  if (Platform.OS === 'web') { localStorage.removeItem(key); return; }
  return SecureStore.deleteItemAsync(key);
}
```

**Fix aplicado em** `app/android/contexts/auth-context.tsx`: usa `getSecureItem`/`setSecureItem`/`deleteSecureItem` — nunca `SecureStore.*` diretamente.

**Regra:** nunca importar `expo-secure-store` diretamente em nenhum arquivo fora de `secure-storage.ts`. Sempre usar o wrapper.

---

### 3. `expo-local-authentication` crasha na web

**Sintoma:** App crasha ao tentar verificar biometria. Erro em `LocalAuthentication.hasHardwareAsync`.

**Causa:** `expo-local-authentication` não existe no runtime web. Qualquer chamada sem guard de plataforma crasha.

**Fix aplicado em** `app/android/hooks/use-biometrics.ts` — guards em todas as funções:
```typescript
import { Platform } from 'react-native';
import * as LocalAuthentication from 'expo-local-authentication';

export async function checkBiometricAvailability() {
  if (Platform.OS === 'web') return { available: false };
  const compatible = await LocalAuthentication.hasHardwareAsync();
  // ...
}
```

**Regra:** qualquer uso de `expo-local-authentication` DEVE ter `if (Platform.OS === 'web') return ...` na primeira linha da função. Nunca chamar diretamente no render ou sem guard.

---

### 4. Auth context usando expo-secure-store diretamente

**Sintoma:** Mesma tela de crash do item 2, mas em `auth-context.tsx`.

**Causa:** versão anterior do `contexts/auth-context.tsx` importava `SecureStore` diretamente do `expo-secure-store` para salvar/ler o token JWT.

**Fix:** substituído por chamadas ao wrapper `secure-storage.ts` (ver item 2).

**Regra:** `auth-context.tsx` usa exclusivamente `getSecureItem`/`setSecureItem`/`deleteSecureItem` do wrapper. Nunca regredir para import direto.

---

### 5. "Something went wrong" no emulador — causa ainda desconhecida

**Sintoma:** Tela branca com "Something went wrong" no emulador Android.

**Status:** Não diagnosticado. O usuário não forneceu o log de erro.

**Para diagnosticar:**
1. Abrir o emulador Android
2. Clicar em "View error log" na tela de crash
3. Copiar e colar o texto completo do erro no chat

**Suspeitas mais prováveis após análise:**
- `expo-secure-store` ou `expo-local-authentication` chamado sem guard de plataforma (ver itens 2 e 3)
- `zustand/middleware` resolvido como ESM ao invés de CJS (ver item 1)
- Erro em `_layout.tsx` no boot (AuthProvider, OfflineBanner, usePushNotifications)

Até o log ser fornecido, não alterar os arquivos dos itens 1–4 pois eles já foram corrigidos.

---

### 8. `expo-location` watchPositionAsync crasha ao desmontar na web

**Sintoma:** `TypeError: _LocationEventEmitter.LocationEventEmitter.removeSubscription is not a function` ao navegar para fora do dashboard. Crash acontece no desmonte do `useEffect` de localização.

**Causa:** `Location.watchPositionAsync()` retorna uma `LocationSubscription` cujo `.remove()` chama `LocationEventEmitter.removeSubscription()` internamente. Essa API não existe no runtime web do Expo.

**Fix aplicado em** `app/android/app/dashboard.tsx` — primeira linha de `startLocationTracking`:
```typescript
async function startLocationTracking() {
  if (Platform.OS === 'web') return;  // guard obrigatório
  const { status } = await Location.requestForegroundPermissionsAsync();
  // ...
}
```

**Regra:** qualquer função que use `Location.watchPositionAsync`, `Location.getCurrentPositionAsync` ou `Location.requestForegroundPermissionsAsync` DEVE ter `if (Platform.OS === 'web') return;` na primeira linha. Sem este guard, o app crasha ao desmontar o componente no emulador web.

---

### 6. Neon DB SSL drops causam 500 na API (afeta login do app)

**Sintoma:** App trava na tela de login; API retorna 500. Log do container mostra `OperationalError: consuming input failed: SSL connection has been closed unexpectedly`.

**Causa:** Neon PostgreSQL (free tier) fecha conexões SSL ociosas. SQLAlchemy tenta reusar uma conexão morta.

**Fix aplicado em** `app/api/app/config.py`:
```python
SQLALCHEMY_ENGINE_OPTIONS = {
    "pool_pre_ping": True,   # testa a conexão antes de usar
    "pool_recycle": 300,     # recicla conexões após 5 min
}
```

**Regra:** não remover `SQLALCHEMY_ENGINE_OPTIONS` do config por achar que é desnecessário. Sem ele a API cai sozinha após período ocioso.

---

### 7. `payload.pop()` esquecido antes de `Model(**payload)` causa 500 em registro

**Sintoma:** `POST /auth/register` retorna 500 com `TypeError: __init__() got an unexpected keyword argument`.

**Causa:** campo aceito pelo Schema mas inexistente como coluna no Model é passado diretamente para o construtor. Exemplo real: `role_password` estava no schema mas não no `User`.

**Fix:** em qualquer service ou controller que faz `Model(**payload)`, sempre remover campos extras antes:
```python
payload.pop('campo_extra', None)
user = User(**payload)
```

**Regra:** ao adicionar campo novo ao Schema, verificar se o Model tem coluna correspondente. Se não tiver, adicionar `payload.pop('campo', None)` no service antes de instanciar.

---

## Evolução planejada

| Feature | Prioridade | Status |
|---|---|---|
| Avaliação mútua (motorista avalia passageiro) | Alta | **Concluído 16/06/2026** — `ride-completed.tsx` + endpoint `POST /driver/ride-requests/{id}/driver-rating` |
| Foto de comprovante de entrega | Alta | **Concluído 16/06/2026** — `delivery-active.tsx` |
| Banner modo offline | Alta | **Concluído 16/06/2026** — `_layout.tsx` (netinfo) |
| Metadados produção (package, scheme, ícones) | Média | **Concluído 16/06/2026** — `app.json` + ícones gerados + APK assinado `com.suwave.motorista` |
| APK release assinado | Alta | **Concluído 16/06/2026** — `tests/app-motorista-v1.0.0.apk` (93MB) |
| Chat in-ride com passageiro | Média | Pendente — aguarda backend |
| Modo offline com fila local de pings | Baixa | Pendente |
| Dark mode via `use-color-scheme.ts` | Baixa | Pendente |
| Indicação/referral (G9) | Baixa | Pendente — aguarda endpoint backend |
| WebSocket real-time (Fase F) | Média | Bloqueado — Flask sem socketio/eventlet |
| Publicação Google Play Store | Alta | Aguardando — APK pronto, falta conta de dev + assets da Store |
| Internacionalização (i18n) | Baixa | Não planejado |
