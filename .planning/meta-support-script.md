# Script para suporte Meta — desbloquear cadastro WhatsApp Business na Page

**Última atualização:** 2026-05-02
**Caso:** Page `criscosta_sobrancelhas` (ID 108033148885275) com número antigo pré-Anatel 2014 travado, sem permissão pra deletar/cadastrar novo mesmo sendo admin total.

---

## 🔗 Links pra abrir o suporte (em ordem de prioridade)

### 1. Chat dentro do Business Suite (RECOMENDADO — atende em PT-BR)

```
https://business.facebook.com/latest/help/contact
```

Caminho alternativo (se o link acima redirecionar):
1. Logar em https://business.facebook.com com a conta admin da Cris
2. Canto inferior direito → ícone **"?" / Ajuda**
3. **"Obter suporte"** ou **"Contatar suporte"**
4. Tópico: **"Páginas"** ou **"WhatsApp Business"**
5. Se aparecer menu autoatendimento, escolher **"Outro" / "Não encontrei"** pra forçar humano

### 2. Formulário direto (gera ticket rastreável)

```
https://www.facebook.com/business/help
```
→ rolar até "Entre em contato com o suporte" no rodapé

### 3. Suporte WhatsApp Business (alternativa secundária)

```
https://business.whatsapp.com/contact-us
```

---

## 📋 Texto pra colar (copiar TUDO entre as linhas)

---

Olá, preciso escalar um caso técnico de número legado pré-Anatel (2014) travado no cadastro da minha Página. Não é dúvida básica — já tentei todos os caminhos de autoatendimento.

**DADOS:**
- Página: Cris Costa Beauty (criscosta_sobrancelhas)
- ID da Página: 108033148885275
- Conta de anúncios: act_1330468201431069
- Cidade: Joinville/SC

**PROBLEMA:**
A Página tem cadastrado no campo de telefone/WhatsApp um número ANTIGO no formato pré-2014 (8 dígitos, SEM o 9 inicial obrigatório). Esse número está marcado como INATIVO no sistema. Quando tento:

1. DELETAR esse número antigo → erro "Você não tem permissão"
2. CADASTRAR o número correto (atual, com 9 inicial — formato pós-Anatel) → erro "Você não tem permissão"
3. EDITAR/SUBSTITUIR pelo número correto → mesmo erro

Sou ADMIN com acesso TOTAL da Página no Business Manager. Já confirmei isso na aba "Funções da Página". O número correto (com 9 inicial) é o que está cadastrado no app WhatsApp Business oficial da Cris e está ativo no Portfólio Empresarial.

Já confirmei com a agência anterior de gestão de tráfego que eles NÃO têm nenhum cadastro residual nessa página. O bloqueio é interno do sistema do Facebook.

**CONSEQUÊNCIA:**
- API retorna `can_run_click_to_whatsapp: false`
- Tentativas de criar anúncio com `destination_type: WHATSAPP` retornam erro 100 / subcode 2446885
- Não consigo rodar campanhas com objetivo Mensagens / Click-to-WhatsApp

**PRECISO QUE VOCÊS:**
1. Escalem pro time técnico de "Page Phone Migration" ou equivalente
2. Removam manualmente o número antigo (8 dígitos pré-Anatel) que está travado/inativo no backend da Página
3. Liberem o cadastro do número correto +55 47 99707-1161 (9 dígitos pós-Anatel, ativo no WhatsApp Business)
4. Confirmem disponibilidade do objetivo Mensagens pra `act_1330468201431069` após migração

Por favor gerem número de ticket. Esse caso provavelmente vai precisar de mais de uma interação porque envolve modificação manual no backend de Page metadata.

---

## 💡 O que esperar

- **Resposta inicial:** vão pedir prints. Tirar 3 prints — um pra cada erro acima
- **24-72h:** investigação
- **2-3 semanas:** resolução completa (caso técnico complexo)
- Se passar **7 dias** sem sair do nível 1, abrir caso paralelo no link 2

## 🎯 Frase mágica pra escalar se o agente travar

> *"Preciso que esse caso seja escalado pro time de Page Phone Migration ou equivalente — é um bug de número legado pré-Anatel 2014 que não tem solução via autoatendimento. Por favor gere ticket pra acompanhamento."*
