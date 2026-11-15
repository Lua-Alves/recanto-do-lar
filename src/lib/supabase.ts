import { createClient } from "@supabase/supabase-js"

const url = import.meta.env.VITE_SUPABASE_URL
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

// Sem as variáveis, o app continua funcionando no modo demonstração.
export const supabaseConfigured = Boolean(url && anonKey)

// A chave "anon" é pública por desenho: quem protege os dados são as regras
// RLS do banco (supabase/schema.sql). Nunca coloque a chave service_role aqui.
export const supabase = supabaseConfigured ? createClient(url, anonKey) : null
