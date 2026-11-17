# Recanto do Lar

> Cuidado que acolhe, tranquilidade que conecta.

Aplicativo para celular (PWA) com inteligência artificial para **casas de repouso**. Ele aproxima as famílias da rotina dos residentes e reduz a carga de trabalho da equipe de cuidadores.

**Demonstração:** https://recanto-do-lar.vercel.app

> Todos os nomes, e-mails, telefones e dados de saúde do projeto são **fictícios**, criados apenas para demonstração.

## O problema

- As famílias têm dificuldade de obter informações rápidas sobre rotina, visitas e medicamentos dos residentes.
- Os cuidadores repetem as mesmas respostas várias vezes ao dia e gastam tempo escrevendo relatórios.
- Os registros ficam dispersos em papel ou mensagens soltas.

## A solução

Um app com **três perfis de acesso**, em que cada pessoa vê apenas o que é da sua função:

| Perfil | O que faz |
|---|---|
| **Familiar** | Conversa com a assistente de IA, acompanha o residente vinculado (medicamentos, rotina, atividades e fotos), pede videochamadas e fala com a equipe. |
| **Cuidador (equipe)** | Registra a administração de medicamentos e as atividades, publica fotos, confirma ou recusa videochamadas, responde às famílias e revisa o relatório de plantão gerado por IA antes de enviar. |
| **Administração da casa** | Acompanha pendências e alertas (medicamentos atrasados, mensagens sem resposta), responde perguntas que a assistente não soube responder e define os horários de videochamada. Não edita registros de saúde. |

## Funcionalidades

- Login real com Supabase Auth; o perfil (familiar, cuidador ou administração) vem da conta.
- **Assistente de IA (Gemini)** para famílias: responde apenas ao que foi perguntado, usando somente dados cadastrados pela equipe, sem orientação médica. Dúvidas de saúde ou sem resposta são encaminhadas à equipe.
- Medicamentos: a equipe marca cada dose como administrada (quem e quando ficam registrados) e a família acompanha.
- Atividades do dia: a equipe registra "participou" ou "não quis" e confirma o envio à família.
- Relatório de plantão gerado por IA, sempre como **rascunho aprovado pelo cuidador**.
- Fotos das atividades: só podem ser publicadas com residentes que têm autorização de uso de imagem válida; a família só vê as fotos do seu residente (armazenamento privado, links temporários).
- Mensagens entre família e equipe, com avisos de novidade nos botões de navegação.
- Videochamada: a administração define os horários livres, a família solicita e o cuidador confirma ou recusa (com motivo). No protótipo a chamada é simulada.
- A administração vê os remédios pendentes **sem o nome do residente** (só remédio, dose e horário), como decisão de privacidade.
- Controle de tamanho do texto, tema claro, escuro ou automático e estados de carregamento, vazio e erro.

**Ainda em modo demonstração (dados de exemplo):** a aba Cadastros da administração (no banco, residentes, equipe e autorizações de imagem vêm do `seed.sql` ou são criados direto no Supabase), o resumo da semana e os dias anteriores do histórico, e os textos de horário de visitas e telefone da casa.

## Tecnologias

- **Front-end:** React 19, TypeScript, Vite e Tailwind CSS 4 (PWA instalável)
- **Banco de dados e autenticação:** Supabase (PostgreSQL com Row Level Security, Auth e Storage)
- **IA:** Gemini, chamado por uma Edge Function do Supabase (a chave nunca fica no app)
- **Hospedagem:** Vercel

## Como rodar localmente

Pré-requisitos: [Node.js 22](https://nodejs.org) e [pnpm](https://pnpm.io).

```bash
git clone https://github.com/Lua-Alves/recanto-do-lar.git
cd recanto-do-lar
pnpm install
pnpm dev
```

O app abre em `http://localhost:5173`. Sem o arquivo `.env.local`, ele roda em **modo demonstração**, com dados em memória e botões para escolher o perfil. Para ver como no celular, use o modo de dispositivo do navegador (F12).

## Com banco de dados (Supabase)

1. Crie um projeto gratuito em [supabase.com](https://supabase.com).
2. Em **SQL Editor**, cole e rode o `supabase/schema.sql` inteiro, uma única vez.
3. Em **Authentication > Users > Add user**, crie `familiar@teste.com`, `cuidador@teste.com` e `admin@teste.com` (marque *Auto Confirm User*).
4. Rode o `supabase/seed.sql` (define os papéis e cria os dados fictícios).
5. Copie `.env.example` para `.env.local` e preencha com a URL e a chave `anon` (**Project Settings > API**):

   ```
   VITE_SUPABASE_URL=https://SEU-PROJETO.supabase.co
   VITE_SUPABASE_ANON_KEY=sua-chave-publica
   ```

6. Reinicie o `pnpm dev`. A tela de login deixa de mostrar os botões de demonstração.

Toda conta nova nasce como **familiar**; só a administração altera o papel. A medicação separa **prescrição** (o que toma) de **administração** (o que já foi dado, por quem e quando).

### Assistente de IA (Edge Function + Gemini)

1. Gere uma chave gratuita no [Google AI Studio](https://aistudio.google.com/apikey).
2. No Supabase, abra **Edge Functions > Deploy a new function > Via Editor**, dê o nome `assistant` e cole o conteúdo de `supabase/functions/assistant/index.ts`. Clique em **Deploy**.
3. Em **Edge Functions > Secrets**, crie o segredo `GEMINI_API_KEY` com a sua chave. (Opcional: `GEMINI_MODEL` para escolher o modelo; a função já tenta uma lista de modelos em ordem.)

Se preferir a linha de comando: `supabase functions deploy assistant` e `supabase secrets set GEMINI_API_KEY=...`.

> **Nunca** coloque no código ou no repositório a chave `service_role` do Supabase nem a chave do Gemini. A chave do Gemini fica apenas como segredo da função.

## Implantação (Vercel)

1. Em [vercel.com/new](https://vercel.com/new), importe o repositório.
2. Em **Environment Variables**, adicione `VITE_SUPABASE_URL` e `VITE_SUPABASE_ANON_KEY` e clique em **Deploy**. A cada `git push` na `main`, o site é publicado de novo.
3. No Supabase, em **Authentication > URL Configuration**, coloque o endereço da Vercel em **Site URL** e adicione-o em **Redirect URLs** (mantenha também `http://localhost:5173`).
4. Para instalar no celular: no Android, Chrome > ⋮ > **Instalar app**; no iPhone, Safari > Compartilhar > **Adicionar à Tela de Início**.

Pontos de atenção para uso real:

- **E-mails de acesso:** o envio padrão do Supabase tem limite baixo e é só para testes. Para uso real, configure um SMTP próprio em **Authentication > Emails > SMTP Settings**.
- **Vercel Hobby:** o plano gratuito é para uso pessoal e não comercial. Uso comercial exige plano pago ou outra hospedagem.
- **Gemini:** nos serviços gratuitos, o Google pode usar os dados enviados para melhorar seus produtos. Para dados reais de residentes, use um plano pago e confira os termos.

## Estrutura do projeto

```
├── public/                 # Logos, ícones e manifest.webmanifest (PWA)
├── src/
│   ├── App.tsx             # Telas e lógica dos três perfis
│   ├── index.css           # Estilos globais e tema
│   ├── lib/supabase.ts     # Cliente do Supabase (modo demonstração se sem .env.local)
│   ├── lib/auth.ts         # Login, perfil e troca de senha
│   ├── lib/data.ts         # Leitura e gravação de dados no Supabase
│   └── main.tsx            # Ponto de entrada
├── supabase/
│   ├── schema.sql          # Tabelas, regras de acesso (RLS) e armazenamento
│   ├── seed.sql            # Dados fictícios de teste
│   └── functions/assistant # Edge Function da assistente de IA
├── .env.example            # Modelo das variáveis de ambiente
└── package.json
```

## Segurança e privacidade

- O projeto usa apenas dados fictícios. Em uso real, dados de saúde são sensíveis e exigem adequação à LGPD.
- Cada família enxerga somente o residente vinculado ao seu acesso; as regras são aplicadas no banco (Row Level Security), e não só na interface.
- A assistente não dá orientação médica e encaminha dúvidas clínicas para a equipe.
- As contas são criadas pela administração da casa; não existe cadastro aberto ao público.

## Status

- [x] Três perfis com login real e permissões no banco
- [x] Medicamentos, atividades, fotos, mensagens e videochamada ligados ao Supabase
- [x] Assistente de IA com Gemini e relatório de plantão
- [x] Publicação na Vercel e instalação como app no celular (PWA)
- [x] Testes de permissões, perguntas de exemplo e acessibilidade (texto grande, contraste)
- [ ] Aba Cadastros da administração ligada ao banco

**Trabalhos futuros:** notificações push, ditado por voz, chamada de vídeo real (por exemplo, Jitsi, com link único e sem gravação), agendamento de visitas presenciais, relatório aprovado e resumo da semana gravados no banco, assistente de companhia para os idosos e verificação em duas etapas para a administração.

## Autoria

Luna da Silva Alves 