# Hub de Funis — Café Capiau

Sistema para acompanhar visitantes, cliques, origem de tráfego e o caminho
completo (jornada) de cada pessoa nas suas landing pages — com teste A/B e
suporte a múltiplos sites ao mesmo tempo.

Como funciona, em uma frase: cada landing page carrega o `capiau.js`, que
manda todo evento (visualização, clique em qualquer botão/link, visualização
de seção) pra uma função na Vercel, que grava no Supabase; o `dashboard/` lê
esses dados e mostra tudo organizado, com um seletor pra filtrar por site.

---

## 1. Criar o banco (Supabase — grátis)

1. Crie uma conta em [supabase.com](https://supabase.com) e um novo projeto.
2. No painel do projeto, vá em **SQL Editor > New query**, cole o conteúdo
   de `sql/schema.sql` e clique em **Run**.
3. Vá em **Project Settings > API Keys**, aba **"Publishable and secret API
   keys"**, e anote:
   - **Project URL** (em Project Settings > General ou API)
   - A chave em **Secret keys** (clique no ícone de olho pra revelar) —
     começa com `sb_secret_...`. Não use a "Publishable key".

## 2. Subir o projeto no GitHub

**Importante — leia antes de subir:** pra manter a estrutura de pastas
correta (`api/`, `dashboard/`, `sql/`), você precisa **arrastar a pasta
`funnel-hub` inteira e fechada** direto pro campo de upload do GitHub — não
abra ela antes nem arraste o conteúdo de dentro solto. O Chrome/Edge
preservam a estrutura de pastas quando você solta a pasta assim.

1. Crie um repositório novo no GitHub (ex: `HUB-Capiau`)
2. Clica em **"Add file" → "Upload files"**
3. Arraste a pasta `funnel-hub` (a pasta em si, fechada) pro campo de upload
4. Confirme o commit — o GitHub deve mostrar `api/`, `dashboard/` e `sql/`
   como pastas na lista, não como arquivos soltos

## 3. Conectar na Vercel

1. Importe o repositório na Vercel.
2. Antes do primeiro deploy, vá em **Settings → Environments → Production**
   e adicione:

   | Nome | Valor |
   |---|---|
   | `SUPABASE_URL` | a Project URL do Supabase |
   | `SUPABASE_SERVICE_ROLE_KEY` | a chave `sb_secret_...` do Supabase |
   | `HUB_PASSWORD` | uma senha sua, pra você e seu sócio entrarem no dashboard |

3. Faça o deploy. O dashboard fica em `https://SEU-HUB.vercel.app/dashboard/`.

## 4. Instalar o rastreamento em uma landing page

Em cada landing page, cole isso antes do `</body>`:

```html
<script
  src="https://SEU-HUB.vercel.app/capiau.js"
  data-funnel="nome-unico-do-site"
  data-ab="true"
></script>
```

- `data-funnel`: nome único desse site (ex: `kit-welcome`, `kit-2`). É esse
  nome que aparece no seletor "Site" do dashboard.
- `data-ab="true"`: opcional, liga teste A/B automático (50/50).

**A partir daí, todo botão e link da página já é rastreado sozinho** —
não precisa marcar nada manualmente. O rótulo salvo é o texto visível do
botão/link.

### Marcar etapas da página (opcional, pra ver o funil por seção)

Se a página tem seções (ex: apresentação → sabores → oferta), marque:

```html
<section data-fh-step="1">...</section>
<section data-fh-step="2">...</section>
```

O script detecta sozinho quando cada seção aparece na tela.

### Marcar qual clique é a conversão principal

Por padrão todo clique vira um evento `click` genérico. Pra destacar um
botão específico como a conversão (ex: o que leva ao checkout/Instagram),
adicione:

```html
<a href="..." data-fh-event="checkout_click">Comprar agora</a>
```

Isso faz esse clique aparecer marcado como "conversão" no dashboard e contar
na taxa de conversão dos KPIs e das origens.

---

## Adicionando um novo site ao hub (checklist rápido)

Não precisa mexer em nada aqui no hub — é só na landing page nova:

1. Escolhe um nome único, tipo `kit-2` ou `natal-2026`
2. Cola o `<script>` do passo 4 acima, com esse `data-funnel`
3. (Opcional) marca as seções com `data-fh-step`
4. (Opcional) marca o botão de conversão com `data-fh-event="checkout_click"`
5. Publica normalmente

Pronto — assim que alguém visitar, o site já aparece sozinho no seletor
"Site" do dashboard, com funil, cliques, origens e jornadas próprios.

## Sobre pixels (Meta / Google) e Facebook Ads

Quando o checkout for direto pela Nuvemshop, ela deixa configurar o **Pixel
do Meta** e o **Google Analytics/Ads** no painel dela — isso captura a
compra de verdade. E quando você tiver uma conta de anúncios ativa
(Business Manager), dá pra puxar os gastos de campanha pra dentro do hub e
calcular custo por conversão automaticamente — é só me chamar quando
estiver pronto pra isso.

## Estrutura do projeto

```
funnel-hub/
├── capiau.js               # script que vai em cada landing page
├── api/
│   ├── evento.js            # recebe os eventos e grava no Supabase
│   └── resumo.js            # calcula funil, cliques, origens e jornadas
├── dashboard/
│   ├── index.html
│   ├── dashboard.js
│   └── style.css
├── sql/
│   └── schema.sql           # rodar uma vez no Supabase
└── package.json
```
