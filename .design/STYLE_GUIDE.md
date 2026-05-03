# STYLE_GUIDE — Redesign visual AdManager (Dark Glass)

**Aplicar APENAS no dark mode.** Light mode continua intocado nesta fase (Fase 3 trata).

Referência visual: `.design/mockups/dashboard.html` + `.design/refs/ref geral GLASS.webp` + `.design/refs/Sidebar ref.png`.

---

## 1. Tokens (já em `frontend/src/index.css`)

Use sempre `var(--c-XXX)`, nunca hardcode. Tokens do dark já definidos:

| Token | Valor | Uso |
|---|---|---|
| `--c-page-bg` | `#06080B` | Fundo geral |
| `--c-card-bg` | `rgba(18,24,30,.45)` | Glass dark fumê (cards) |
| `--c-surface` | `rgba(28,34,42,.55)` | Inputs, botões secundários, sub-cards |
| `--c-hover` | `rgba(255,255,255,.04)` | Hover sutil |
| `--c-active-bg` | `rgba(193,53,132,.18)` | Item ativo |
| `--c-border` | `rgba(255,255,255,.09)` | Bordas glass sutis |
| `--c-glass-border-2` | `rgba(255,255,255,.16)` | Bordas em hover |
| `--c-glass-shine` | `rgba(255,255,255,.07)` | Reflexo top inset |
| `--c-text-1` | `#F2F2F2` | Texto principal |
| `--c-text-2` | `#C2C2C2` | Texto secundário |
| `--c-text-3` | `#8A8A8A` | Subtítulos / metadata |
| `--c-text-4` | `#595959` | Texto auxiliar |
| `--c-accent` | `#C13584` | **Cor principal** (botões, links, ativos, glow) |
| `--c-accent-dk` | `#7D4A5E` | Vinho — detalhes secundários |
| `--c-accent-soft` | `rgba(193,53,132,.18)` | Backgrounds tintados, halos |
| `--c-accent-glow` | `rgba(193,53,132,.55)` | Glow externo accent |
| `--c-blur-strong` | `blur(28px)` (mobile: 12px) | Backdrop filter forte |
| `--c-blur-soft` | `blur(14px)` (mobile: 8px) | Backdrop filter suave |

**Cores semânticas (preservar):** verde `#22C55E`/`#34D399` aprovado, vermelho `#EF4444`/`#F87171` rejeitado, amarelo `#F59E0B`/`#FBBF24` pending, azul `#3B82F6`/`#60A5FA` info.

---

## 2. Padrão de card glass

`.ccb-card` global já aplica glass dark no dark via `[data-theme="dark"]`. **Use sempre essa classe** para cards:

```jsx
<div className="ccb-card" style={{ padding: '18px 20px', borderRadius: '18px' }}>
  ...
</div>
```

Se precisar inline (não usar `.ccb-card`):
```js
{
  background: 'var(--c-card-bg)',
  backdropFilter: 'blur(28px)',
  WebkitBackdropFilter: 'blur(28px)',
  border: '1px solid var(--c-border)',
  borderRadius: '18px',
  boxShadow: '0 8px 24px rgba(0,0,0,.35), inset 0 1px 0 var(--c-glass-shine)',
  position: 'relative',
  overflow: 'hidden',
}
```

**NÃO use:** `background: '#FFFFFF'`, `background: '#1A1A1A'`, `background: 'var(--c-card-bg)'` direto sem blur. O `.ccb-card` no dark já faz a coisa certa.

**Card com destaque rosa** (relatório, alerta crítico):
```js
{
  borderColor: 'rgba(193,53,132,.55)',
  boxShadow: '0 8px 30px rgba(0,0,0,.4), 0 0 36px rgba(193,53,132,.16), inset 0 1px 0 rgba(255,194,228,.18), inset 0 0 18px rgba(193,53,132,.08)',
}
```

---

## 3. Tipografia

| Elemento | Tamanho | Peso | Cor |
|---|---|---|---|
| H1 / Página | 22-24px | 800 | `var(--c-text-1)` |
| H2 / Seção | 15-17px | 700-800 | `var(--c-text-1)` |
| Métrica grande | 28-32px | 800, `tnum` | `var(--c-text-1)` |
| Texto corpo | 13px | 400-500 | `var(--c-text-2)` |
| Subtítulo / metadata | 11.5-12px | **400** | `var(--c-text-3)` |
| Label uppercase | 10-11px | 500-700, letter-spacing 1.2px | `var(--c-text-3)` |
| Number small ("mensagens") | 10.5px | 400 | `var(--c-text-3)` |

**Regra crítica:** subtítulos/labels/metadata usam **font-weight 400**, NÃO 500/700. Hierarquia respira melhor.

**Números (saldo, métricas):** sempre `font-feature-settings: 'tnum'` pra alinhar dígitos.

---

## 4. Botões

### Primary (CTA principal)
```js
{
  padding: '11px 18px',
  borderRadius: '12px',
  border: 0,
  background: 'linear-gradient(135deg, var(--c-accent), var(--c-accent-dk))',
  color: '#fff',
  fontWeight: 700,
  fontSize: '13px',
  boxShadow: '0 8px 24px rgba(193,53,132,.4), inset 0 1px 0 rgba(255,255,255,.18)',
}
```

### Glass rosa (CTA secundário, "Criar campanha" estilo mockup)
```js
{
  padding: '11px 14px',
  borderRadius: '11px',
  background: 'rgba(193,53,132,.10)',
  border: '1.5px solid rgba(193,53,132,.65)',
  color: 'var(--c-accent)',
  fontWeight: 700,
  fontSize: '13px',
  textShadow: '0 0 12px rgba(193,53,132,.4)',
  boxShadow: '0 0 22px rgba(193,53,132,.18), inset 0 0 14px rgba(193,53,132,.08)',
}
```

### Ghost (terciário)
```js
{
  padding: '8px 14px',
  borderRadius: '10px',
  background: 'var(--c-surface)',
  border: '1px solid var(--c-border)',
  color: 'var(--c-text-2)',
  fontWeight: 600,
}
```

### Icon button (theme, sino)
```js
{ width: 40, height: 40, borderRadius: '50%', border: '1px solid var(--c-border)', background: 'var(--c-surface)' }
```

---

## 5. Inputs

```js
{
  padding: '11px 14px',
  background: 'var(--c-surface)',
  border: '1px solid var(--c-border)',
  borderRadius: '10px',
  color: 'var(--c-text-1)',
  fontSize: '13px',
}
/* :focus → borderColor accent + boxShadow accent-soft 3px */
```

---

## 6. Badges / Pills

| Tipo | Background | Border | Color |
|---|---|---|---|
| Default (rosa) | `var(--c-accent-soft)` | `rgba(193,53,132,.4)` | `var(--c-accent)` |
| OK / Aprovado | `rgba(52,211,153,.16)` | `rgba(52,211,153,.3)` | `#34D399` |
| Pending | `rgba(251,191,36,.16)` | `rgba(251,191,36,.3)` | `#FBBF24` |
| Bad / Rejeitado | `rgba(248,113,113,.16)` | `rgba(248,113,113,.3)` | `#F87171` |

Sempre: `padding: 4px 9px`, `borderRadius: 999px`, `fontSize: 10.5px`, `fontWeight: 700`, `letterSpacing: .3px`.

---

## 7. Spacing

- Padding card: **18-20px**
- Gap entre seções (no `.main`): **22px**
- Border-radius card: **18px**
- Border-radius button: **10-12px**
- Border-radius pill: **999px** (fully rounded)

---

## 8. NÃO fazer

- ❌ Não usar `#d68d8f` em nada — sempre `var(--c-accent)`
- ❌ Não usar `#FFFFFF` ou `#1A1A1A` em backgrounds — sempre tokens
- ❌ Não criar componentes novos sem necessidade — reaproveitar `.ccb-card`, classes existentes
- ❌ Não tocar em **light mode** nesta fase (a Fase 3 cuida)
- ❌ Não mexer em **lógica/estado/hooks** — só visual (style, className, JSX layout)
- ❌ Não remover features funcionais (seletor de campanha, dropdowns, busca, etc)
- ❌ Não tocar em **`Sidebar.jsx` estrutural**, **`App.jsx` topbar**, **`SplashScreen.jsx`** — já estão prontos
- ❌ Não rodar `npm run build` nem fazer `git commit` — eu (orchestrator) faço ao final

---

## 9. Como aplicar em uma página

1. **Ler o arquivo todo** primeiro pra mapear componentes
2. Localizar wrappers de cards (geralmente `<div style={{ background: ..., border: ... }}>`)
3. Trocar por `<div className="ccb-card" style={{ padding, borderRadius }}>`
4. Tipografia: ajustar `fontWeight` de subtítulos pra 400 (eram 500/700)
5. Hardcodes `#d68d8f` → `var(--c-accent)`. Hardcodes `rgba(214,141,143,X)` → `rgba(193,53,132,X)`
6. Inputs: aplicar padrão (item 5)
7. Botões CTA: aplicar gradient accent (item 4)
8. Confirmar light mode preservado (verificar via inline condicional `useTheme().isDark` quando necessário)

---

## 10. Verificação rápida

Antes de finalizar:
- [ ] Sem `#d68d8f` ou `rgba(214,141,143,X)` no arquivo
- [ ] Cards usam `.ccb-card` ou padrão glass dark
- [ ] Subtítulos peso 400
- [ ] Light mode não regrediu (testar abrindo no light)
- [ ] Lógica/handlers/hooks intactos
