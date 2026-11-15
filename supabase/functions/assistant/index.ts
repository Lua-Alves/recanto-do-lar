// Edge Function "assistant": responde perguntas da família usando SOMENTE
// dados cadastrados. A chave da IA fica em secret do Supabase, nunca no app.
//
// Deploy:  supabase functions deploy assistant
// Secret:  supabase secrets set ANTHROPIC_API_KEY=...
import { createClient } from "npm:@supabase/supabase-js@2"

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, content-type, apikey",
}

const SYSTEM = `Você é a Assistente do Recanto do Lar, uma casa de repouso.
Responda em português do Brasil, de forma curta, calorosa e clara.
Use SOMENTE os dados fornecidos em <dados>. Se a informação não estiver lá,
diga que não há registro e sugira o botão "Falar com a equipe".
Nunca dê orientação médica (diagnóstico, troca, dose, combinação ou
suspensão de medicamento). Para isso, encaminhe à equipe.
Separe sempre o que JÁ FOI ADMINISTRADO do que está AGUARDANDO administração.`

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors })

  const auth = req.headers.get("Authorization") ?? ""
  // Cliente com o token da pessoa: as regras RLS limitam o que ela enxerga.
  const db = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_ANON_KEY")!,
    { global: { headers: { Authorization: auth } } },
  )
  const { data: userData } = await db.auth.getUser()
  if (!userData.user) {
    return new Response(JSON.stringify({ error: "não autenticado" }), { status: 401, headers: cors })
  }

  const { question, residentId } = await req.json()
  if (typeof question !== "string" || !question.trim() || question.length > 500) {
    return new Response(JSON.stringify({ error: "pergunta inválida" }), { status: 400, headers: cors })
  }

  const since = new Date(Date.now() - 7 * 86400_000).toISOString()
  const [resident, rx, doses, activities, house] = await Promise.all([
    db.from("residents").select("full_name").eq("id", residentId).single(),
    db.from("prescriptions").select("medicine,dose,times,start_date,end_date")
      .eq("resident_id", residentId).eq("active", true),
    db.from("medication_administrations")
      .select("scheduled_for,status,administered_at,prescriptions(medicine,dose)")
      .eq("resident_id", residentId).gte("scheduled_for", since).order("scheduled_for"),
    db.from("activities").select("activity_date,activity_time,name,status,participation,observation")
      .eq("resident_id", residentId).gte("activity_date", since.slice(0, 10)),
    db.from("house_info").select("visiting_hours,visiting_rules,phone").single(),
  ])

  // RLS devolveu vazio/erro: a pessoa não tem acesso a este residente.
  if (resident.error || !resident.data) {
    return new Response(JSON.stringify({ error: "sem acesso" }), { status: 403, headers: cors })
  }

  const dados = JSON.stringify({
    hoje: new Date().toISOString().slice(0, 10),
    residente: resident.data.full_name,
    prescricao_ativa: rx.data ?? [],
    doses_ultimos_7_dias: doses.data ?? [],
    atividades_ultimos_7_dias: activities.data ?? [],
    casa: house.data ?? {},
  })

  const ai = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "x-api-key": Deno.env.get("ANTHROPIC_API_KEY")!,
      "anthropic-version": "2023-06-01",
      "content-type": "application/json",
    },
    body: JSON.stringify({
      model: "claude-sonnet-5-5",
      max_tokens: 500,
      system: SYSTEM,
      messages: [{
        role: "user",
        content: `<dados>${dados}</dados>\n<pergunta>${question.trim()}</pergunta>`,
      }],
    }),
  })
  if (!ai.ok) {
    return new Response(JSON.stringify({ error: "assistente indisponível" }), { status: 502, headers: cors })
  }
  const out = await ai.json()
  const answer = out.content?.[0]?.text ?? "Não consegui responder. Use “Falar com a equipe”."
  return new Response(JSON.stringify({ answer }), { headers: { ...cors, "content-type": "application/json" } })
})
