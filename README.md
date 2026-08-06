# Hub de Funis — Café Capiau

Sistema para acompanhar visualizações, etapas e cliques no checkout das suas
landing pages, incluindo teste A/B e taxa de perda (drop-off) entre etapas.

Como funciona, em uma frase: cada landing page carrega um scriptzinho
(`track.js`) que manda eventos pra uma função na Vercel, que grava tudo no
Supabase; o `dashboard/` lê esses dados e mostra pra você e seu sócio.

---

## 1. Criar o banco (Supabase — grátis)

1. Crie uma conta em [supabase.com](https://supabase.com) e um novo projeto.
2. No painel do projeto, vá em **SQL Editor > New query**, cole o conteúdo
   de `sql/schema.sql` e clique em **Run**.
3. Vá em **Project Settings > API** e anote 3 coisas:
   - **Project URL** (ex: `https://xxxx.supabase.co`)
   - **service_role key** (fica em "Project API keys" — é secreta, nunca vai
     pro navegador, só é usada dentro das funções da Vercel)

## 2. Subir esse projeto no GitHub

Suba essa pasta inteira (`funnel-hub`) como um repositório novo no GitHub —
do jeito que você já faz com suas landing pages. Pode ser um repo separado
(recomendado, já que ele vai servir vários funis).

## 3. Conectar na Vercel

1. Importe o repositório na Vercel (igual você já faz).
2. Antes do primeiro deploy, vá em **Settings > Environment Variables** e
   adicione:

   | Nome | Valor |
   |---|---|
   | `SUPABASE_URL` | a Project URL do passo 1 |
   | `SUPABASE_SERVICE_ROLE_KEY` | a service_role key do passo 1 |
   | `HUB_PASSWORD` | uma senha sua, pra você e seu sócio entrarem no dashboard |

3. Faça o deploy. Sua URL vai ficar tipo `https://capiau-funnel-hub.vercel.app`.
4. O dashboard fica em `https://capiau-funnel-hub.vercel.app/dashboard` —
   entre com a senha que você definiu em `HUB_PASSWORD`.

## 4. Instalar o rastreamento em cada landing page

Em cada landing page (repositórios separados, tipo o do Kit Welcome), cole
isso antes do `</body>`:

```html
<script
  src="https://capiau-funnel-hub.vercel.app/track.js"
  data-funnel="kit-welcome"
  data-ab="true"
></script>
```

- `data-funnel`: um nome único pra esse funil. Cada landing page/produto usa
  um nome diferente (ex: `kit-welcome`, `kit-degustacao`).
- `data-ab="true"`: liga o teste A/B automático (separa os visitantes 50/50
  e lembra qual grupo cada um caiu). Se não estiver testando nada ainda,
  pode tirar essa linha.

### Marcar etapas da landing page (pra ver onde as pessoas somem)

Se a página tem seções tipo "etapa 1, 2, 3" (ex: apresentação → sabores →
oferta → botão final), marque cada seção assim:

```html
<section data-fh-step="1">...</section>
<section data-fh-step="2">...</section>
<section data-fh-step="3">...</section>
```

O script detecta sozinho quando cada seção aparece na tela e registra.

### Marcar o botão que vai pro checkout da Nuvemshop

```html
<a href="https://www.cafecapiau.com.br/checkout/..." data-fh-event="checkout_click">
  Comprar agora
</a>
```

Isso é o mais importante: é a sua métrica de conversão principal, já que o
checkout em si é da Nuvemshop e fica fora do seu controle direto.

### Eventos manuais (opcional, pra quando quiser adicionar algo novo)

Em qualquer lugar do seu JavaScript:

```js
window.fhTrack('nome_do_evento_que_voce_quiser');
```

---

## 5. Sobre pixels (Meta / Google) — pra fechar o funil até a compra real

Como o checkout roda na Nuvemshop, esse hub não enxerga a compra final por
padrão (só o clique que leva até lá). A própria Nuvemshop deixa você
configurar o **Pixel do Meta** e o **Google Analytics/Ads** direto no painel
dela (Configurações > Canais de Venda ou Marketing, dependendo do plano) —
isso captura a conversão de compra de verdade. Quando você tiver essas
contas criadas, me chama que eu te ajudo a configurar certinho e, se quiser,
a gente também soma esse dado como mais uma camada aqui no hub.

## 6. Adicionando novos funis depois

Não precisa mexer em nada aqui no hub. Só crie a nova landing page, coloque
o script com um `data-funnel` novo, e ela já aparece automaticamente como
um card novo no dashboard.

## Estrutura do projeto

```
funnel-hub/
├── track.js              # script que vai em cada landing page
├── api/
│   ├── track.js           # recebe os eventos e grava no Supabase
│   └── stats.js            # calcula as métricas pro dashboard
├── dashboard/
│   ├── index.html
│   ├── dashboard.js
│   └── style.css
├── sql/
│   └── schema.sql          # rodar uma vez no Supabase
└── package.json
```
