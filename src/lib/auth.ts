import { supabase } from "./supabase"

export type AppRole = "family" | "team" | "admin"

export type SignedInUser = { id: string; role: AppRole; name: string; email: string }

// Papel no banco -> papel usado nas telas.
const ROLE_MAP: Record<string, AppRole> = {
  familiar: "family",
  cuidador: "team",
  admin: "admin",
}

async function loadProfile(userId: string, email: string): Promise<SignedInUser | { error: string }> {
  if (!supabase) return { error: "Banco de dados não configurado." }
  const { data, error } = await supabase
    .from("profiles")
    .select("role, status, full_name")
    .eq("id", userId)
    .single()
  if (error || !data) return { error: "Não encontramos o perfil desta conta. Fale com a administração da casa." }
  if (data.status !== "ativo") return { error: "Este acesso está desativado. Fale com a administração da casa." }
  const role = ROLE_MAP[data.role as string]
  if (!role) return { error: "Perfil de acesso inválido. Fale com a administração da casa." }
  return { id: userId, role, name: data.full_name ?? "", email }
}

export async function signIn(email: string, password: string): Promise<SignedInUser | { error: string }> {
  if (!supabase) return { error: "Banco de dados não configurado." }
  const { data, error } = await supabase.auth.signInWithPassword({ email, password })
  if (error || !data.user) return { error: "E-mail ou senha incorretos." }
  const profile = await loadProfile(data.user.id, email)
  if ("error" in profile) await supabase.auth.signOut()
  return profile
}

// Recupera a sessão salva no navegador (ao recarregar a página).
export async function restoreSession(): Promise<SignedInUser | null> {
  if (!supabase) return null
  const { data } = await supabase.auth.getSession()
  if (!data.session) return null
  const profile = await loadProfile(data.session.user.id, data.session.user.email ?? "")
  return "error" in profile ? null : profile
}

export async function signOut() {
  if (supabase) await supabase.auth.signOut()
}

// Avisa quando a sessão termina (outra aba, expiração).
export function onSignedOut(callback: () => void) {
  if (!supabase) return () => {}
  const { data } = supabase.auth.onAuthStateChange((event) => {
    if (event === "SIGNED_OUT") callback()
  })
  return () => data.subscription.unsubscribe()
}

export const MIN_PASSWORD = 8

// Envia o link de redefinição para o e-mail da pessoa.
export async function requestPasswordReset(email: string): Promise<{ error?: string }> {
  if (!supabase) return { error: "Banco de dados não configurado." }
  const { error } = await supabase.auth.resetPasswordForEmail(email, { redirectTo: window.location.origin })
  // Mensagem genérica: não revela se o e-mail existe.
  return error && error.status === 429
    ? { error: "Muitos pedidos seguidos. Aguarde alguns minutos e tente de novo." }
    : {}
}

// Define a nova senha de quem chegou pelo link do e-mail (redefinição ou convite).
export async function setNewPassword(password: string): Promise<{ error?: string }> {
  if (!supabase) return { error: "Banco de dados não configurado." }
  const { error } = await supabase.auth.updateUser({ password })
  return error ? { error: "Não foi possível salvar a nova senha. Peça um novo link e tente de novo." } : {}
}

// Troca de senha dentro do app: confere a senha atual antes.
export async function changePassword(email: string, current: string, next: string): Promise<{ error?: string }> {
  if (!supabase) return { error: "Banco de dados não configurado." }
  const check = await supabase.auth.signInWithPassword({ email, password: current })
  if (check.error) return { error: "A senha atual está incorreta." }
  const { error } = await supabase.auth.updateUser({ password: next })
  return error ? { error: "Não foi possível alterar a senha. Tente de novo." } : {}
}

// Avisa quando a pessoa abre o link de redefinição enviado por e-mail.
export function onPasswordRecovery(callback: () => void) {
  if (!supabase) return () => {}
  const { data } = supabase.auth.onAuthStateChange((event) => {
    if (event === "PASSWORD_RECOVERY") callback()
  })
  return () => data.subscription.unsubscribe()
}
