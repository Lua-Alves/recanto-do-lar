# Recanto do Lar

> Cuidado que acolhe, tranquilidade que conecta.

Aplicativo para celular (PWA) com inteligência artificial para **casas de repouso**. Ele aproxima as famílias da rotina dos residentes e reduz o trabalho repetitivo da equipe de cuidadores.

> Todos os nomes, e-mails, telefones e dados de saúde do projeto são **fictícios**. Para uso com dados reais, é necessário adequar o sistema à LGPD.

## O problema

- Famílias têm dificuldade de obter informações rápidas sobre rotina, visitas e medicamentos.
- Cuidadores repetem as mesmas respostas durante o dia e gastam tempo escrevendo relatórios.
- Os registros ficam dispersos em papel e mensagens soltas.

## Como funciona

Três perfis de acesso. Cada pessoa vê apenas o que é da sua função.

| Perfil | O que faz |
|---|---|
| **Familiar** | Conversa com a assistente de IA, acompanha os últimos 7 dias do residente (resumo, medicamentos, rotina e fotos), pede videochamadas e fala com a equipe. |
| **Cuidador** | Registra medicamentos, rotina e atividades, publica fotos, confirma videochamadas e revisa o relatório de plantão gerado por IA antes de enviar. |
| **Administração** | Gerencia cadastros de residentes, cuidadores e famílias, autorizações de uso de imagem, horários da casa e alertas. Não edita registros de saúde. |

## Destaques

- **Assistente de IA** que responde somente com dados cadastrados pela equipe e não dá orientação médica. Quando não sabe, encaminha para a equipe.
- **Resumos gerados por IA** (dia e semana), sempre como rascunho aprovado pelo cuidador.
- **Privacidade:** a família só vê o residente vinculado a ela. Fotos só são publicadas com autorização de imagem vigente. A administração não vê o nome do residente em medicação ainda não administrada.
- **Rastreabilidade:** cada registro mostra quem lançou e quando, e as alterações de cadastro ficam em histórico.
- **Acessibilidade:** tema claro e escuro, ajuste de tamanho de texto, contraste revisado e respeito à preferência de reduzir animações.

## Tecnologias

React 19 · TypeScript · Vite · Tailwind CSS 4 · Supabase (PostgreSQL, autenticação e Row Level Security) · Supabase Edge Functions (IA) · PWA

## Como rodar

Requisitos: Node.js 20+ e pnpm.

```bash
git clone https://github.com/Lua-Alves/recanto-do-lar.git
cd recanto-do-lar
pnpm install
pnpm dev
```

Abra http://localhost:5173. Sem configuração, o app roda em **modo demonstração**, com dados simulados e escolha de perfil na tela de login.

### Com banco de dados

1. Crie um projeto no [Supabase](https://supabase.com).
2. No SQL Editor, rode `supabase/schema.sql` e depois `supabase/seed.sql`.
3. Copie `.env.example` para `.env.local` e preencha `VITE_SUPABASE_URL` e `VITE_SUPABASE_ANON_KEY`.

Nunca versione o `.env.local` nem use a chave `service_role` no app. A chave da IA fica como *secret* da função em `supabase/functions/assistant`.

## Estrutura

```
public/       ícones e manifest do PWA
src/          telas e lógica dos três perfis
supabase/     schema.sql, seed.sql e função da assistente
```

## Status

- [x] Protótipo funcional dos três perfis
- [x] Esquema do banco, regras de acesso e função da IA
- [ ] Integração do app com o Supabase
- [ ] Publicação e instalação no celular

**Ideias futuras:** notificações, ditado por voz, videochamada real, agendamento de visitas e verificação em duas etapas para a administração.

## Autoria

Luna da Silva Alves 