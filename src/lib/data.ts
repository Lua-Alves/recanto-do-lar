import { supabase } from "./supabase"

/** Camada de dados reais (Supabase). Só é usada quando o .env.local existe. */

export type DoseStatus = "aguardando" | "administrado" | "nao_administrado"

export type RealResident = {
  id: string
  name: string
  room: string
  initials: string
  color: string
}

export type Dose = {
  id: string
  residentId: string
  medicine: string
  dose: string
  time: string // "08:00"
  status: DoseStatus
  administeredAt: string | null // "08:05"
  administeredBy: string | null
}

const COLORS = ["mint", "blue", "orange", "purple"]

const initialsOf = (name: string) =>
  name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join("")

const hhmm = (iso: string) =>
  new Date(iso).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit", timeZone: "America/Sao_Paulo" })

/** Residentes que o usuário pode ver (a equipe vê todos; a família, só o seu). */
export async function loadResidents(): Promise<RealResident[]> {
  if (!supabase) return []
  const { data, error } = await supabase
    .from("residents")
    .select("id, full_name, room")
    .eq("status", "ativo")
    .order("full_name")
  if (error || !data) return []
  return data.map((row, index) => ({
    id: row.id as string,
    name: row.full_name as string,
    room: (row.room as string) ?? "",
    initials: initialsOf(row.full_name as string),
    color: COLORS[index % COLORS.length],
  }))
}

/** Doses de hoje (cria as que faltam a partir das prescrições ativas). */
export async function loadTodayDoses(residentId?: string): Promise<Dose[]> {
  if (!supabase) return []
  await supabase.rpc("ensure_doses_today")
  const now = new Date()
  const start = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1).toISOString()
  let query = supabase
    .from("medication_administrations")
    .select(
      "id, resident_id, scheduled_for, status, administered_at, administered_by_name, prescriptions(medicine, dose)",
    )
    .gte("scheduled_for", start)
    .order("scheduled_for")
  if (residentId) query = query.eq("resident_id", residentId)
  const { data, error } = await query
  if (error || !data) return []
  const todayKey = now.toLocaleDateString("en-CA", { timeZone: "America/Sao_Paulo" })
  return (data as any[])
    .filter((row) => new Date(row.scheduled_for).toLocaleDateString("en-CA", { timeZone: "America/Sao_Paulo" }) === todayKey)
    .map((row) => ({
      id: row.id,
      residentId: row.resident_id,
      medicine: row.prescriptions?.medicine ?? "Medicamento",
      dose: row.prescriptions?.dose ?? "",
      time: hhmm(row.scheduled_for),
      status: row.status as DoseStatus,
      administeredAt: row.administered_at ? hhmm(row.administered_at) : null,
      administeredBy: row.administered_by_name ?? null,
    }))
}

/** Marca como administrado. Horário e responsável são gravados pelo banco. */
export async function markDoseGiven(doseId: string): Promise<boolean> {
  if (!supabase) return false
  const { error } = await supabase
    .from("medication_administrations")
    .update({ status: "administrado" })
    .eq("id", doseId)
  return !error
}

/** Cadastra um medicamento (equipe). */
export async function addPrescription(residentId: string, medicine: string, dose: string, time: string): Promise<boolean> {
  if (!supabase) return false
  const { error } = await supabase
    .from("prescriptions")
    .insert({ resident_id: residentId, medicine: medicine.trim(), dose: dose.trim(), times: [time] })
  return !error
}

/** Administração: quantas doses de hoje aguardam (sem nome do residente). */
export async function loadPendingCount(): Promise<number> {
  if (!supabase) return 0
  const { count } = await supabase.from("pending_medications").select("id", { count: "exact", head: true })
  return count ?? 0
}

/** Agrupa doses iguais do mesmo medicamento: "Losartana 50 mg · 08:00 e 20:00". */
export function groupDoses(doses: Dose[]) {
  const map = new Map<string, { medicine: string; dose: string; items: Dose[] }>()
  for (const d of doses) {
    const key = `${d.medicine}|${d.dose}`
    if (!map.has(key)) map.set(key, { medicine: d.medicine, dose: d.dose, items: [] })
    map.get(key)!.items.push(d)
  }
  return [...map.values()]
}

// ---------------------------------------------------------------------
// Mensagens, perguntas e configuração da casa
// ---------------------------------------------------------------------

export type Sender = "family" | "team" | "admin"
export type ThreadMessage = { sender: Sender; text: string; at: string }

const roleToDb = { family: "familiar", team: "cuidador", admin: "admin" } as const
const roleFromDb = { familiar: "family", cuidador: "team", admin: "admin" } as const

/** Conversas visíveis ao usuário (as regras do banco já filtram por perfil), agrupadas por residente. */
export async function loadThreads(): Promise<Record<string, ThreadMessage[]>> {
  if (!supabase) return {}
  const [{ data: msgs }, { data: res }] = await Promise.all([
    supabase.from("messages").select("resident_id, sender_role, body, created_at").order("created_at"),
    supabase.from("residents").select("id, full_name"),
  ])
  const names = new Map((res ?? []).map((row: any) => [row.id, row.full_name as string]))
  const out: Record<string, ThreadMessage[]> = {}
  for (const row of (msgs ?? []) as any[]) {
    const name = names.get(row.resident_id)
    if (!name) continue
    ;(out[name] ??= []).push({
      sender: roleFromDb[row.sender_role as keyof typeof roleFromDb] ?? "team",
      text: row.body,
      at: row.created_at,
    })
  }
  return out
}

export async function sendMessage(residentId: string, text: string, sender: Sender): Promise<boolean> {
  if (!supabase) return false
  const { data } = await supabase.auth.getSession()
  const uid = data.session?.user.id
  if (!uid) return false
  const { error } = await supabase
    .from("messages")
    .insert({ resident_id: residentId, sender_id: uid, sender_role: roleToDb[sender], body: text })
  return !error
}

/** Respostas cadastradas pela administração (a assistente usa). */
export async function loadHouseAnswers(): Promise<Record<string, string>> {
  if (!supabase) return {}
  const { data } = await supabase.from("house_answers").select("question, answer")
  return Object.fromEntries(((data ?? []) as any[]).map((row) => [row.question, row.answer]))
}

export async function addHouseQuestion(question: string): Promise<void> {
  if (!supabase) return
  const { data } = await supabase.auth.getSession()
  const uid = data.session?.user.id
  if (!uid) return
  await supabase.from("house_questions").insert({ question, asked_by: uid })
}

/** Só a administração consegue ler. */
export async function loadHouseQuestions(): Promise<string[]> {
  if (!supabase) return []
  const { data } = await supabase.from("house_questions").select("question").order("created_at")
  return ((data ?? []) as any[]).map((row) => row.question)
}

export async function answerHouseQuestion(question: string, answer: string): Promise<boolean> {
  if (!supabase) return false
  const { data } = await supabase.auth.getSession()
  const uid = data.session?.user.id
  const { error } = await supabase.from("house_answers").insert({ question, answer, answered_by: uid })
  if (error) return false
  await supabase.from("house_questions").delete().eq("question", question)
  return true
}

export async function loadAlertMinutes(): Promise<10 | 15 | 30 | null> {
  if (!supabase) return null
  const { data } = await supabase.from("house_info").select("alert_minutes").limit(1)
  const value = (data as any[] | null)?.[0]?.alert_minutes
  return value === 10 || value === 15 || value === 30 ? value : null
}

export async function saveAlertMinutes(minutes: 10 | 15 | 30): Promise<boolean> {
  if (!supabase) return false
  const { error } = await supabase.from("house_info").update({ alert_minutes: minutes }).eq("id", true)
  return !error
}

// ---------------------------------------------------------------------
// Videochamada
// ---------------------------------------------------------------------

const WD = ["dom", "seg", "ter", "qua", "qui", "sex", "sáb"]

/** Data de São Paulo (UTC-3, sem horário de verão) a partir de um instante. */
const spDate = (d: Date) => new Date(d.getTime() - 3 * 3600_000)
export const isoToLabel = (iso: string) => {
  const d = spDate(new Date(iso))
  const hh = String(d.getUTCHours()).padStart(2, "0")
  const mm = String(d.getUTCMinutes()).padStart(2, "0")
  return { label: `${WD[d.getUTCDay()]} ${d.getUTCDate()}`, time: `${hh}:${mm}` }
}
const dateToLabel = (date: string) => {
  const d = new Date(`${date}T12:00:00Z`)
  return `${WD[d.getUTCDay()]} ${d.getUTCDate()}`
}

/** Próximos 7 dias (a partir de amanhã), no calendário real. */
export function realFutureDays(): { n: number; wd: string; idx: number; iso: string }[] {
  const base = spDate(new Date())
  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date(Date.UTC(base.getUTCFullYear(), base.getUTCMonth(), base.getUTCDate() + i + 1))
    return { n: d.getUTCDate(), wd: WD[d.getUTCDay()], idx: d.getUTCDay(), iso: d.toISOString().slice(0, 10) }
  })
}

export type RealVideoConfig = { days: number[]; start: string; end: string; duration: 15 | 20 | 30; blocked: string[] }

export async function loadVideoConfig(): Promise<RealVideoConfig | null> {
  if (!supabase) return null
  const { data } = await supabase.from("video_config").select("weekdays, start_time, end_time, slot_minutes, blocked_dates").limit(1)
  const row = (data as any[] | null)?.[0]
  if (!row) return null
  return {
    days: row.weekdays,
    start: String(row.start_time).slice(0, 5),
    end: String(row.end_time).slice(0, 5),
    duration: [15, 20, 30].includes(row.slot_minutes) ? row.slot_minutes : 20,
    blocked: (row.blocked_dates ?? []).map(dateToLabel),
  }
}

export async function saveVideoConfig(cfg: RealVideoConfig): Promise<boolean> {
  if (!supabase) return false
  const blocked = realFutureDays().filter((d) => cfg.blocked.includes(`${d.wd} ${d.n}`)).map((d) => d.iso)
  const { error } = await supabase
    .from("video_config")
    .update({ weekdays: cfg.days, start_time: cfg.start, end_time: cfg.end, slot_minutes: cfg.duration, blocked_dates: blocked })
    .eq("id", true)
  return !error
}

export type RealVideoRequest = {
  id: string
  resident: string
  requester: string
  dayLabel: string
  time: string
  status: "Solicitada" | "Confirmada" | "Recusada" | "Realizada"
  note?: string
  reason?: string
  suggestion?: string
}

const statusFromDb: Record<string, RealVideoRequest["status"] | undefined> = {
  solicitada: "Solicitada",
  confirmada: "Confirmada",
  recusada: "Recusada",
  realizada: "Realizada",
}
const statusToDb = { Solicitada: "solicitada", Confirmada: "confirmada", Recusada: "recusada", Realizada: "realizada" } as const

export async function loadVideoRequests(): Promise<RealVideoRequest[]> {
  if (!supabase) return []
  const [{ data }, { data: res }] = await Promise.all([
    supabase
      .from("video_requests")
      .select("id, resident_id, slot_start, status, requester_name, note, reason, suggestion")
      .order("slot_start"),
    supabase.from("residents").select("id, full_name"),
  ])
  const names = new Map((res ?? []).map((r: any) => [r.id, r.full_name as string]))
  const out: RealVideoRequest[] = []
  for (const row of (data ?? []) as any[]) {
    const status = statusFromDb[row.status]
    if (!status) continue
    const { label, time } = isoToLabel(row.slot_start)
    out.push({
      id: row.id,
      resident: names.get(row.resident_id) ?? "",
      requester: row.requester_name ?? "",
      dayLabel: label,
      time,
      status,
      note: row.note ?? undefined,
      reason: row.reason ?? undefined,
      suggestion: row.suggestion ?? undefined,
    })
  }
  return out
}

/** Horários já ocupados por qualquer família (sem revelar quem). */
export async function loadTakenSlots(): Promise<{ dayLabel: string; time: string }[]> {
  if (!supabase) return []
  const { data } = await supabase.rpc("video_taken_slots")
  return ((data ?? []) as string[]).map((iso) => {
    const { label, time } = isoToLabel(iso)
    return { dayLabel: label, time }
  })
}

export async function createVideoRequest(residentId: string, dayLabel: string, time: string, note: string): Promise<boolean> {
  if (!supabase) return false
  const day = realFutureDays().find((d) => `${d.wd} ${d.n}` === dayLabel)
  if (!day) return false
  const { data } = await supabase.auth.getSession()
  const uid = data.session?.user.id
  if (!uid) return false
  const { error } = await supabase.from("video_requests").insert({
    resident_id: residentId,
    requested_by: uid,
    slot_start: `${day.iso}T${time}:00-03:00`,
    note: note || null,
  })
  return !error
}

export async function updateVideoRequest(
  id: string,
  patch: { status?: RealVideoRequest["status"] | "Cancelada"; reason?: string; suggestion?: string },
): Promise<boolean> {
  if (!supabase) return false
  const body: Record<string, unknown> = {}
  if (patch.status) body.status = patch.status === "Cancelada" ? "cancelada" : statusToDb[patch.status]
  if (patch.reason !== undefined) body.reason = patch.reason
  if (patch.suggestion !== undefined) body.suggestion = patch.suggestion
  const { error } = await supabase.from("video_requests").update(body).eq("id", id)
  return !error
}

// ---------------------------------------------------------------------
// Assistente (Edge Function "assistant" + Gemini)
// ---------------------------------------------------------------------

/** Devolve { text, forward } ou null se a assistente estiver indisponível. */
export async function askAssistantAi(question: string, residentId: string): Promise<{ text: string; forward: boolean } | null> {
  if (!supabase) return null
  const { data, error } = await supabase.functions.invoke("assistant", { body: { question, residentId } })
  if (error || !data || typeof data.answer !== "string") {
    // Detalhe técnico para diagnóstico (aparece no console do navegador, F12).
    let detail: unknown = null
    try {
      detail = await (error as any)?.context?.json?.()
    } catch {
      detail = null
    }
    console.error("[assistente] falha ao consultar a função:", error, detail ?? data)
    return null
  }
  const raw: string = data.answer.trim()
  const forward = raw.startsWith("[ENCAMINHAR]")
  // Segurança: se a IA mandar markdown, tiramos asteriscos e títulos.
  const clean = raw
    .replace("[ENCAMINHAR]", "")
    .replace(/\*\*(.+?)\*\*/g, "$1")
    .replace(/^\s*\*\s+/gm, "- ")
    .replace(/^#+\s*/gm, "")
    .trim()
  return { text: clean, forward }
}
