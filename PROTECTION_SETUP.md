# PROTECTION_SETUP — Como ativar as 2 proteções que dependem de você

Os 5 sistemas de proteção foram implementados em código. **3 já estão ativos automaticamente:**

- ✅ Health endpoint expandido (valida token Meta live a cada hit)
- ✅ Suíte de testes Meta (roda em `npm test`, ~1s)
- ✅ Smoke test pós-deploy (GitHub Actions, a cada 15min)
- ✅ Synthetic test diário (GitHub Actions, 09h GMT-3)

**2 dependem de configuração manual sua** (5-10 minutos no total):

---

## 1. Sentry — detector de erro em produção

### Por que ativar
Quando algo quebrar pra você ou pra Cris usando o sistema, Sentry te manda email com:
- Arquivo e linha exata do erro
- O que o usuário fez antes (clicou onde, em qual tela)
- Stack trace
- Replay da sessão (vídeo do que aconteceu)

Sem isso, você só descobre que quebrou quando alguém te conta.

### Passo a passo (5 minutos)

1. **Criar conta Sentry**
   - Acesse https://sentry.io/signup/
   - Login com GitHub (mais rápido)
   - Plano: **Developer (Free)** — 5k erros/mês, sobra muito

2. **Criar 2 projetos:**
   - Click em "Create Project"
   - **Projeto 1:** Platform = `React`, nome = `traffic-manager-frontend`
   - **Projeto 2:** Platform = `Node.js`, nome = `traffic-manager-backend`

3. **Copiar os 2 DSNs:**
   - Cada projeto tem uma URL DSN tipo `https://abc123@o456.ingest.sentry.io/789`
   - Copie de cada projeto: Settings → Projects → [nome] → Client Keys (DSN)

4. **Adicionar como env vars na Vercel:**
   - Acesse https://vercel.com/rafaelrac25-7792s-projects/criscosta/settings/environment-variables
   - Add `VITE_SENTRY_DSN` = DSN do projeto frontend (Production + Preview + Development)
   - Add `SENTRY_DSN` = DSN do projeto backend (Production + Preview + Development)

5. **Redeploy automático cobre.** Em 2 minutos, Sentry está ativo.

### Como saber que tá funcionando
Acesse https://sentry.io e abra qualquer um dos projetos. Force um erro no app (ex: aperte um botão quando o backend tá fora do ar). Em até 1min o erro aparece no dashboard Sentry.

---

## 2. Vercel Email Alerts — aviso quando algo muda

### Por que ativar
Te avisa por email se:
- Deploy falha (build error)
- Função tá retornando muito 5xx
- Env var foi alterada por alguém

### Passo a passo (3 minutos)

1. Acesse https://vercel.com/account/notifications
2. **Ative os toggles:**
   - ✅ Deployment Failed
   - ✅ Deployment Errored
   - ✅ Domain Configuration Updated
   - ✅ Environment Variable Updated (se disponível no plano)
3. **Project-level alerts** (opcional, mais granular):
   - Vá em https://vercel.com/rafaelrac25-7792s-projects/criscosta/settings/notifications
   - Configure por projeto se quiser thresholds específicos

---

## Como me precaver na prática (resumo)

Quando algo der errado, você tem 4 fontes pra pesquisar a causa, em ordem:

| Sintoma | Onde olhar primeiro |
|---|---|
| App quebra na tela | **Sentry** → te diz arquivo:linha |
| App não carrega | **`/api/health/full`** → te diz qual integração caiu |
| Deploy quebrou | **Email Vercel** + dashboard Vercel |
| Suspeita de regressão | **Issue automática** criada por GitHub Actions (label `synthetic-test`) |
| Algo muda silenciosamente | **GitHub Action smoke-test** abre issue se health virar vermelho |

**Em 99% dos casos, uma dessas 5 fontes vai te dizer onde olhar antes mesmo de você precisar pesquisar manualmente.**
