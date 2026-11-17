import { FormEvent, ReactNode, useEffect, useMemo, useRef, useState } from "react"
import {
  MIN_PASSWORD,
  changePassword,
  onPasswordRecovery,
  onSignedOut,
  requestPasswordReset,
  restoreSession,
  setNewPassword,
  signIn,
  signOut,
} from "./lib/auth"
import { supabaseConfigured } from "./lib/supabase"
import {
  type Dose,
  type RealResident,
  addActivityDb,
  addHouseQuestion,
  addPrescription,
  askAssistantAi,
  askReportAi,
  loadPendingList,
  answerHouseQuestion,
  createVideoRequest,
  loadTakenSlots,
  loadVideoConfig,
  loadVideoRequests,
  realFutureDays,
  saveVideoConfig,
  updateActivityDb,
  updateVideoRequest,
  groupDoses,
  loadActivities,
  loadAlertMinutes,
  loadConsentFlags,
  loadPhotos,
  publishPhotoDb,
  removePhotoDb,
  loadHouseAnswers,
  loadHouseQuestions,
  loadPendingCount,
  loadThreads,
  saveAlertMinutes,
  sendMessage,
  loadResidents,
  loadTodayDoses,
  markDoseGiven,
} from "./lib/data"

type Screen =
  | "login"
  | "consent"
  | "chat"
  | "summary"
  | "caregiver"
  | "team"
  | "admin-dashboard"
  | "admin-registers"
  | "admin-house"
  | "profile"
  | "family-video"
  | "family-video-request"
  | "team-photos"
  | "team-video"
type Role = "family" | "team" | "admin"
type Account = { name: string; email: string }
type ContentState = "ready" | "loading" | "empty" | "error" | "offline"
type TextSize = "normal" | "large" | "xlarge"
type ThemePreference = "light" | "dark" | "system"

const THEME_STORAGE_KEY = "recanto-theme"

const TEXT_SIZE_KEY = "recanto-text-size"

function readTextSize(): TextSize {
  try {
    const stored = window.localStorage.getItem(TEXT_SIZE_KEY)
    if (stored === "normal" || stored === "large" || stored === "xlarge") return stored
  } catch {
    // Armazenamento indisponível: usa o tamanho normal.
  }
  return "normal"
}

function readThemePreference(): ThemePreference {
  try {
    const stored = window.localStorage.getItem(THEME_STORAGE_KEY)
    if (stored === "light" || stored === "dark" || stored === "system") return stored
  } catch {
    // Armazenamento indisponível: usa o tema do aparelho.
  }
  return "system"
}
type ResidentMessage = {
  sender: Role
  text: string
}
type ActivityStatus = "Programada" | "Realizada" | "Não realizada"
type ActivityId = number | string
type Activity = {
  id: ActivityId
  name: string
  time: string
  status: ActivityStatus
  participation?: "Participou" | "Participou pouco" | "Não quis"
  observation?: string
  registeredBy: string
  registeredAt: string
}
type HouseInfo = {
  visitingHours: string
  phone: string
  visitingRules: string
  updatedBy: string
  updatedAt: string
}
type AssistantTopic = "custom" | "medicines" | "allMedicines" | "activities" | "visits" | "video" | "clinical" | "unknown"

type PhotoId = number | string
type Photo = {
  rowIds?: string[]
  paths?: string[]
  id: PhotoId
  src: string
  caption: string
  residents: string[]
  author: string
  time: string
  day: number
}
type VideoStatus = "Solicitada" | "Confirmada" | "Recusada" | "Realizada"
type VideoId = number | string
type VideoRequest = {
  id: VideoId
  resident: string
  requester: string
  dayLabel: string
  time: string
  status: VideoStatus
  note?: string
  reason?: string
  suggestion?: string
}
type VideoConfig = {
  days: number[]
  start: string
  end: string
  duration: 15 | 20 | 30
  blocked: string[]
}
type DayRecord = {
  n: number
  wd: string
  mood: string
  food: string
  done: number
  total: number
  given: number
  doses: number
  text: string
  routine: { time: string; title: string; detail: string; by: string; at: string }[]
}

function useBackDismiss(open: boolean, onDismiss: () => void, key: string) {
  const dismissRef = useRef(onDismiss)
  dismissRef.current = onDismiss

  useEffect(() => {
    if (!open) return
    window.history.pushState(
      { ...(window.history.state ?? {}), overlay: key },
      "",
      window.location.href,
    )
    const handleBack = () => dismissRef.current()
    window.addEventListener("popstate", handleBack)
    return () => window.removeEventListener("popstate", handleBack)
  }, [open, key])

  return () => {
    if (window.history.state?.overlay === key) {
      window.history.back()
    } else {
      onDismiss()
    }
  }
}
type IconName =
  | "arrow"
  | "calendar"
  | "camera"
  | "video"
  | "bell"
  | "chart"
  | "chat"
  | "check"
  | "chevron"
  | "clock"
  | "eye"
  | "heart"
  | "home"
  | "info"
  | "lock"
  | "medicine"
  | "mic"
  | "moon"
  | "plus"
  | "phone"
  | "profile"
  | "search"
  | "send"
  | "sparkles"
  | "team"
  | "utensils"

function Icon({ name, size = 22 }: { name: IconName; size?: number }) {
  const paths: Record<IconName, ReactNode> = {
    arrow: <path d="m14 18-6-6 6-6" />,
    camera: (
      <>
        <path d="M4 8h3l2-3h6l2 3h3a1 1 0 0 1 1 1v9a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V9a1 1 0 0 1 1-1Z" />
        <circle cx="12" cy="13" r="3.5" />
      </>
    ),
    video: (
      <>
        <rect x="3" y="6" width="13" height="12" rx="3" />
        <path d="m16 10 5-3v10l-5-3" />
      </>
    ),
    calendar: (
      <>
        <rect x="3" y="5" width="18" height="16" rx="3" />
        <path d="M16 3v4M8 3v4M3 10h18" />
      </>
    ),
    chart: (
      <>
        <path d="M4 20V10M10 20V4M16 20v-7M22 20H2" />
        <path d="m4 8 6-5 6 7 5-4" />
      </>
    ),
    bell: (
      <>
        <path d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9" />
        <path d="M10 21h4" />
      </>
    ),
    chat: (
      <>
        <path d="M20 15a4 4 0 0 1-4 4H8l-5 2 1.5-4.5A7 7 0 0 1 4 14V8a4 4 0 0 1 4-4h8a4 4 0 0 1 4 4Z" />
        <path d="M8 10h8M8 14h5" />
      </>
    ),
    check: <path d="m5 12 4 4L19 6" />,
    moon: <path d="M20.5 14.2A8.5 8.5 0 0 1 9.8 3.5a8.5 8.5 0 1 0 10.7 10.7Z" />,
    chevron: <path d="m9 18 6-6-6-6" />,
    clock: (
      <>
        <circle cx="12" cy="12" r="9" />
        <path d="M12 7v5l3 2" />
      </>
    ),
    eye: (
      <>
        <path d="M2 12s3.5-6 10-6 10 6 10 6-3.5 6-10 6S2 12 2 12Z" />
        <circle cx="12" cy="12" r="2.5" />
      </>
    ),
    heart: (
      <path d="M20.8 4.6a5.5 5.5 0 0 0-7.8 0L12 5.7l-1.1-1.1a5.5 5.5 0 0 0-7.8 7.8l1.1 1.1L12 21l7.8-7.5 1.1-1.1a5.5 5.5 0 0 0-.1-7.8Z" />
    ),
    home: (
      <>
        <path d="m3 11 9-8 9 8" />
        <path d="M5 10v10h14V10M9 20v-6h6v6" />
      </>
    ),
    info: (
      <>
        <circle cx="12" cy="12" r="9" />
        <path d="M12 11v5M12 8h.01" />
      </>
    ),
    lock: (
      <>
        <rect x="4" y="10" width="16" height="11" rx="3" />
        <path d="M8 10V7a4 4 0 0 1 8 0v3" />
      </>
    ),
    medicine: (
      <>
        <path d="M7.5 20.5a5 5 0 0 1-4-8L12 4a5 5 0 0 1 7 7l-8.5 8.5a5 5 0 0 1-3 1Z" />
        <path d="m8 8 8 8" />
      </>
    ),
    mic: (
      <>
        <rect x="9" y="3" width="6" height="12" rx="3" />
        <path d="M5 11a7 7 0 0 0 14 0M12 18v3M9 21h6" />
      </>
    ),
    plus: <path d="M12 5v14M5 12h14" />,
    phone: (
      <path d="M22 16.9v3a2 2 0 0 1-2.2 2 19.8 19.8 0 0 1-8.6-3.1 19.5 19.5 0 0 1-6-6A19.8 19.8 0 0 1 2.1 4.2 2 2 0 0 1 4.1 2h3a2 2 0 0 1 2 1.7c.1 1 .4 2 .7 2.9a2 2 0 0 1-.5 2.1L8 10a16 16 0 0 0 6 6l1.3-1.3a2 2 0 0 1 2.1-.5c.9.3 1.9.6 2.9.7a2 2 0 0 1 1.7 2Z" />
    ),
    profile: (
      <>
        <circle cx="12" cy="8" r="4" />
        <path d="M4 21a8 8 0 0 1 16 0" />
      </>
    ),
    search: (
      <>
        <circle cx="10.5" cy="10.5" r="6.5" />
        <path d="m16 16 5 5" />
      </>
    ),
    send: (
      <>
        <path d="m22 2-7 20-4-9-9-4Z" />
        <path d="M22 2 11 13" />
      </>
    ),
    sparkles: (
      <>
        <path d="m12 3 1.1 3.1L16 7.5l-2.9 1.4L12 12l-1.1-3.1L8 7.5l2.9-1.4Z" />
        <path d="m19 13 .8 2.2L22 16l-2.2.8L19 19l-.8-2.2L16 16l2.2-.8ZM5 14l.8 2.2L8 17l-2.2.8L5 20l-.8-2.2L2 17l2.2-.8Z" />
      </>
    ),
    team: (
      <>
        <circle cx="9" cy="8" r="3" />
        <circle cx="17" cy="10" r="2.5" />
        <path d="M3 20a6 6 0 0 1 12 0M14 16a5 5 0 0 1 7 4" />
      </>
    ),
    utensils: (
      <>
        <path d="M7 3v8M4 3v5a3 3 0 0 0 6 0V3M7 11v10M16 3v18M16 3c3 1 4 4 4 7h-4" />
      </>
    ),
  }

  return (
    <svg
      aria-hidden="true"
      className="icon"
      fill="none"
      height={size}
      viewBox="0 0 24 24"
      width={size}
    >
      {paths[name]}
    </svg>
  )
}

function Avatar({
  initials,
  label,
  size = "medium",
  tone = "mint",
  interactive = false,
}: {
  initials: string
  label?: string
  size?: "small" | "medium" | "large"
  tone?: "mint" | "blue" | "orange" | "purple"
  interactive?: boolean
}) {
  const className = `person-avatar person-avatar--${size} person-avatar--${tone}`

  if (interactive) {
    return (
      <button className={className} type="button" aria-label={label ?? "Abrir perfil"}>
        {initials}
      </button>
    )
  }

  return (
    <span className={className} aria-label={label}>
      {initials}
    </span>
  )
}

function Logo({ compact = false }: { compact?: boolean }) {
  return (
    <div className={compact ? "brand brand--compact" : "brand"}>
      <div className="brand__mark">
        <svg
          aria-hidden="true"
          fill="none"
          height={compact ? 26 : 38}
          viewBox="0 0 48 48"
          width={compact ? 26 : 38}
        >
          <path
            d="M8 22.5 20.6 11a5 5 0 0 1 6.8 0L40 22.5V38a4 4 0 0 1-4 4H12a4 4 0 0 1-4-4Z"
            fill="currentColor"
          />
          <path
            d="M24 38s-10-6-10-12.7c0-5.6 7.1-7.5 10-2.8 2.9-4.7 10-2.8 10 2.8C34 32 24 38 24 38Z"
            fill="var(--orange)"
          />
          <path
            d="M5 23 20.2 9.2a5.6 5.6 0 0 1 7.6 0L43 23"
            stroke="currentColor"
            strokeLinecap="round"
            strokeWidth="5"
          />
        </svg>
      </div>
      <div>
        <strong>Recanto do Lar</strong>
        {!compact && <span>Cuidado que acolhe, tranquilidade que conecta.</span>}
      </div>
    </div>
  )
}

function TopBar({
  eyebrow,
  title,
  avatar = "CS",
  onBack,
}: {
  eyebrow?: string
  title: string
  avatar?: string
  onBack?: () => void
}) {
  return (
    <header className="topbar">
      <div className="topbar__title">
        {onBack && (
          <button className="icon-button" onClick={onBack} type="button" aria-label="Voltar">
            <Icon name="arrow" />
          </button>
        )}
        <div>
          {eyebrow && <span>{eyebrow}</span>}
          <h1>{title}</h1>
        </div>
      </div>
      <Avatar initials={avatar} interactive label="Abrir perfil" />
    </header>
  )
}

function BottomNav({
  active,
  role,
  onChange,
  badges = {},
}: {
  active: Screen
  role: Role
  onChange: (screen: Screen) => void
  badges?: Partial<Record<Screen, number>>
}) {
  const items: { screen: Screen; label: string; icon: IconName }[] =
    role === "family"
      ? [
          { screen: "summary", label: "Início", icon: "home" },
          { screen: "chat", label: "Chat", icon: "chat" },
          { screen: "profile", label: "Perfil", icon: "profile" },
        ]
      : role === "team"
        ? [
          { screen: "team", label: "Residentes", icon: "team" },
          { screen: "team-photos", label: "Fotos", icon: "camera" },
          { screen: "team-video", label: "Vídeo", icon: "video" },
          { screen: "profile", label: "Perfil", icon: "profile" },
          ]
        : [
            { screen: "admin-dashboard", label: "Painel", icon: "chart" },
            { screen: "admin-registers", label: "Cadastros", icon: "team" },
            { screen: "admin-house", label: "Casa", icon: "home" },
            { screen: "profile", label: "Perfil", icon: "profile" },
          ]

  return (
    <nav
      className={
        items.length === 2
          ? "bottom-nav bottom-nav--compact"
          : items.length === 3
            ? "bottom-nav bottom-nav--three"
            : "bottom-nav"
      }
      aria-label="Navegação principal"
    >
      {items.map((item) => (
        <button
          className={active === item.screen ? "nav-item nav-item--active" : "nav-item"}
          key={item.screen}
          onClick={() => onChange(item.screen)}
          type="button"
        >
          <Icon name={item.icon} />
          <span>{item.label}</span>
          {(badges[item.screen] ?? 0) > 0 && (
            <span aria-label={`${badges[item.screen]} novidade(s)`} className="nav-badge">{badges[item.screen]}</span>
          )}
        </button>
      ))}
    </nav>
  )
}

function Login({ notice, onEnter }: { notice?: string; onEnter: (role: Role, account?: Account) => void }) {
  const accounts = {
    family: { email: "familiar@recantodolar.com", password: "familia123" },
    team: { email: "equipe@recantodolar.com", password: "equipe123" },
    admin: { email: "admin@recantodolar.com", password: "admin123" },
  }
  const [role, setRole] = useState<Role>("family")
  const [email, setEmail] = useState(supabaseConfigured ? "" : accounts.family.email)
  const [password, setPassword] = useState(supabaseConfigured ? "" : accounts.family.password)
  const [showPassword, setShowPassword] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState("")
  const [resetNote, setResetNote] = useState("")
  const selectRole = (nextRole: Role) => {
    setRole(nextRole)
    setEmail(accounts[nextRole].email)
    setPassword(accounts[nextRole].password)
  }

  return (
    <main className="login-screen">
      <div className="login-decoration login-decoration--one" />
      <div className="login-decoration login-decoration--two" />
      <section className="login-content">
        <Logo />
        <div className="welcome">
          <span className="pill">
            <Icon name="lock" size={16} />
            Ambiente seguro
          </span>
          <h1>Bem-vindo ao Recanto do Lar</h1>
          <p>Acompanhe com tranquilidade, mesmo quando estiver longe.</p>
        </div>

        {!supabaseConfigured && (
        <div className="demo-mode">
          <div className="demo-mode__heading">
            <span><Icon name="info" size={18} /></span>
            <div>
              <strong>Modo demonstração</strong>
              <p>Em uma versão real, o perfil vem da conta de cada pessoa.</p>
            </div>
          </div>
          <div className="role-select" aria-label="Selecione seu perfil de demonstração">
            <button
              className={role === "family" ? "role-option role-option--active" : "role-option"}
              onClick={() => selectRole("family")}
              type="button"
            >
              <Icon name="heart" />
              <span>Familiar</span>
              {role === "family" && (
                <span className="role-check">
                  <Icon name="check" size={16} />
                </span>
              )}
            </button>
            <button
              className={role === "team" ? "role-option role-option--active" : "role-option"}
              onClick={() => selectRole("team")}
              type="button"
            >
              <Icon name="team" />
              <span>Equipe</span>
              {role === "team" && (
                <span className="role-check">
                  <Icon name="check" size={16} />
                </span>
              )}
            </button>
            <button
              className={role === "admin" ? "role-option role-option--active role-option--admin" : "role-option role-option--admin"}
              onClick={() => selectRole("admin")}
              type="button"
            >
              <Icon name="home" />
              <span>Admin</span>
              {role === "admin" && (
                <span className="role-check">
                  <Icon name="check" size={16} />
                </span>
              )}
            </button>
          </div>
        </div>
        )}

        <form
          className="login-form"
          onSubmit={async (event) => {
            event.preventDefault()
            if (!supabaseConfigured) {
              onEnter(role)
              return
            }
            setBusy(true)
            setError("")
            const result = await signIn(email.trim(), password)
            setBusy(false)
            if ("error" in result) setError(result.error)
            else onEnter(result.role, { name: result.name, email: result.email })
          }}
        >
          <label>
            E-mail
            <span className="input-wrap">
              <Icon name="profile" size={20} />
              <input
                onChange={(event) => setEmail(event.target.value)}
                value={email}
                type="email"
                autoComplete="username"
                required
                aria-label="E-mail"
              />
            </span>
          </label>
          <label>
            Senha
            <span className="input-wrap">
              <Icon name="lock" size={20} />
              <input
                onChange={(event) => setPassword(event.target.value)}
                value={password}
                type={showPassword ? "text" : "password"}
                autoComplete="current-password"
                required
                aria-label="Senha"
              />
              <button
                className="input-action"
                onClick={() => setShowPassword((current) => !current)}
                type="button"
                aria-label={showPassword ? "Ocultar senha" : "Mostrar senha"}
              >
                <Icon name="eye" size={20} />
              </button>
            </span>
          </label>
          <button
            className="forgot-password"
            onClick={async () => {
              setError("")
              if (!supabaseConfigured) {
                setResetNote("No modo demonstração nenhum e-mail é enviado. Na versão real, você recebe um link para criar uma nova senha.")
                return
              }
              if (!email.trim()) {
                setResetNote("")
                setError("Digite seu e-mail acima e toque em “Esqueci minha senha” de novo.")
                return
              }
              setBusy(true)
              const result = await requestPasswordReset(email.trim())
              setBusy(false)
              if (result.error) {
                setResetNote("")
                setError(result.error)
              } else {
                setResetNote("Se este e-mail tiver acesso, enviamos um link para criar uma nova senha. Olhe também a caixa de spam.")
              }
            }}
            type="button"
          >
            Esqueci minha senha
          </button>
          {notice && !resetNote && <p className="login-note" role="status">{notice}</p>}
          {resetNote && <p className="login-note" role="status">{resetNote}</p>}
          {error && <p className="login-error" role="alert">{error}</p>}
          <button className="primary-button" disabled={busy} type="submit">
            {busy ? "Entrando..." : "Entrar"}
            <Icon name="chevron" />
          </button>
        </form>
        <p className="access-created-note">O acesso é criado pela administração da casa.</p>
        <p className="demo-disclaimer">Dados fictícios para demonstração</p>
      </section>
    </main>
  )
}

function SetPassword({ onDone }: { onDone: () => void }) {
  const [password, setPassword] = useState("")
  const [confirm, setConfirm] = useState("")
  const [error, setError] = useState("")
  const [busy, setBusy] = useState(false)

  return (
    <main className="login-screen">
      <section className="login-content">
        <Logo />
        <div className="welcome">
          <h1>Crie sua senha</h1>
          <p>Escolha uma senha com pelo menos {MIN_PASSWORD} caracteres para acessar o Recanto do Lar.</p>
        </div>
        <form
          className="login-form"
          onSubmit={async (event) => {
            event.preventDefault()
            if (password.length < MIN_PASSWORD) return setError(`A senha precisa ter pelo menos ${MIN_PASSWORD} caracteres.`)
            if (password !== confirm) return setError("As duas senhas não são iguais.")
            setBusy(true)
            setError("")
            const result = await setNewPassword(password)
            setBusy(false)
            if (result.error) setError(result.error)
            else onDone()
          }}
        >
          <label>
            Nova senha
            <span className="input-wrap">
              <Icon name="lock" size={20} />
              <input autoComplete="new-password" onChange={(event) => setPassword(event.target.value)} type="password" value={password} aria-label="Nova senha" />
            </span>
          </label>
          <label>
            Repita a nova senha
            <span className="input-wrap">
              <Icon name="lock" size={20} />
              <input autoComplete="new-password" onChange={(event) => setConfirm(event.target.value)} type="password" value={confirm} aria-label="Repita a nova senha" />
            </span>
          </label>
          {error && <p className="login-error" role="alert">{error}</p>}
          <button className="primary-button" disabled={busy} type="submit">
            {busy ? "Salvando..." : "Salvar senha"}
          </button>
        </form>
      </section>
    </main>
  )
}

function EmergencyNotice({ phone }: { phone: string }) {
  const phoneHref = phone.replace(/\D/g, "")

  return (
    <section className="emergency-notice">
      <div>
        <span className="emergency-notice__icon"><Icon name="phone" size={18} /></span>
        <p>
          <strong>Urgência? Ligue para a casa.</strong>
          <span>Não é canal de emergência · {phone}</span>
        </p>
      </div>
      <button
        aria-label="Ligar para a casa"
        className="emergency-call"
        onClick={() => {
          window.location.href = `tel:${phoneHref}`
        }}
        type="button"
      >
        <Icon name="phone" size={18} />
        Ligar
      </button>
    </section>
  )
}

function ResponseFeedback() {
  const [feedback, setFeedback] = useState<"yes" | "no" | null>(null)

  return (
    <div className="response-feedback">
      <span>Essa resposta ajudou?</span>
      <div>
        <button
          aria-label="Sim, a resposta ajudou"
          aria-pressed={feedback === "yes"}
          onClick={() => setFeedback("yes")}
          type="button"
        >
          👍
        </button>
        <button
          aria-label="Não, a resposta não ajudou"
          aria-pressed={feedback === "no"}
          onClick={() => setFeedback("no")}
          type="button"
        >
          👎
        </button>
      </div>
      {feedback === "no" && (
        <div className="feedback-followup">
          <span>Se preferir, fale com a equipe pelo botão abaixo.</span>
        </div>
      )}
      {feedback === "yes" && <small>Obrigado pela resposta.</small>}
    </div>
  )
}

function StateSwitcher({
  value,
  onChange,
}: {
  value: ContentState
  onChange: (state: ContentState) => void
}) {
  // Seletor de estados é só uma ferramenta de demonstração.
  if (supabaseConfigured) return null
  const options: { value: ContentState; label: string }[] = [
    { value: "ready", label: "Conteúdo" },
    { value: "loading", label: "Carregando" },
    { value: "empty", label: "Sem dados" },
    { value: "error", label: "Erro" },
    { value: "offline", label: "Sem internet" },
  ]

  return (
    <div className="state-switcher">
      <span>Ver exemplo da tela</span>
      <div>
        {options.map((option) => (
          <button
            aria-pressed={value === option.value}
            key={option.value}
            onClick={() => onChange(option.value)}
            type="button"
          >
            {option.label}
          </button>
        ))}
      </div>
    </div>
  )
}

function ContentStateView({
  state,
  onRetry,
  subject,
}: {
  state: Exclude<ContentState, "ready">
  onRetry: () => void
  subject: "resumo" | "chat"
}) {
  if (state === "loading") {
    return (
      <div className="loading-state" aria-label={`Carregando ${subject}`}>
        <span />
        <span />
        <span />
        <span />
      </div>
    )
  }

  const content = {
    empty: {
      icon: "calendar" as IconName,
      title: "Ainda não há informações",
      text: subject === "resumo"
        ? "Quando a equipe fizer os primeiros registros, eles aparecerão aqui."
        : "Quando você começar uma conversa, as mensagens aparecerão aqui.",
    },
    error: {
      icon: "info" as IconName,
      title: "Não foi possível carregar",
      text: "Tivemos um problema. Você pode tentar novamente.",
    },
    offline: {
      icon: "info" as IconName,
      title: "Você está sem internet",
      text: "Confira sua conexão para ver as informações mais recentes.",
    },
  }[state]

  return (
    <div className="content-state">
      <span><Icon name={content.icon} /></span>
      <h2>{content.title}</h2>
      <p>{content.text}</p>
      {state === "error" && (
        <button onClick={onRetry} type="button">Tentar de novo</button>
      )}
    </div>
  )
}

function Consent({ onAccept, onBack }: { onAccept: () => void; onBack: () => void }) {
  const [showMore, setShowMore] = useState(false)

  return (
    <main className="consent-screen">
      <div className="consent-content">
        <button className="icon-button consent-back" onClick={onBack} type="button" aria-label="Voltar">
          <Icon name="arrow" />
        </button>
        <Logo />
        <span className="consent-icon"><Icon name="heart" size={32} /></span>
        <h1>Antes de começar</h1>
        <p>
          O Recanto do Lar usa informações sobre a saúde e a rotina de Maria para mostrar
          atualizações à família e facilitar a conversa com a equipe.
        </p>
        <div className="consent-points">
          <div><Icon name="lock" /><span>As informações ficam disponíveis apenas para pessoas autorizadas.</span></div>
          <div><Icon name="team" /><span>A equipe registra os cuidados e a família pode acompanhar.</span></div>
          <div><Icon name="info" /><span>Você pode tirar dúvidas sobre o uso dos dados quando quiser.</span></div>
        </div>
        {showMore && (
          <div className="consent-more">
            Usamos somente as informações necessárias para acompanhar Maria. Este protótipo
            não envia dados reais e serve apenas para demonstração.
          </div>
        )}
        <button className="primary-button" onClick={onAccept} type="button">
          <Icon name="check" />
          Li e concordo
        </button>
        <button className="consent-secondary" onClick={() => setShowMore((current) => !current)} type="button">
          {showMore ? "Mostrar menos" : "Saber mais"}
        </button>
        <p className="demo-disclaimer">Dados fictícios para demonstração</p>
      </div>
    </main>
  )
}

const givenText = (dose: Dose) =>
  dose.status === "administrado"
    ? `administrado${dose.administeredAt ? ` às ${dose.administeredAt}` : ""}${dose.administeredBy ? ` por ${dose.administeredBy}` : ""}`
    : "aguardando administração"

/** Linhas de medicamento para a tela da família (dados reais). */
function medicineRows(doses: Dose[]) {
  const colors = ["mint", "orange", "blue", "purple"]
  return groupDoses(doses).map((group, index) => {
    const given = group.items.filter((item) => item.status === "administrado")
    const done = given.length === group.items.length
    const last = given[given.length - 1]
    return {
      name: group.medicine,
      dose: group.dose,
      time: group.items.map((item) => item.time).join(" e "),
      status: done
        ? `Administrado${last?.administeredAt ? ` às ${last.administeredAt}` : ""}${last?.administeredBy ? ` por ${last.administeredBy}` : ""}`
        : given.length > 0
          ? `${given.length} de ${group.items.length} doses administradas`
          : "Aguardando administração",
      statusTone: done ? "done" : "pending",
      color: colors[index % colors.length],
    }
  })
}

function AssistantAnswer({
  activities,
  houseInfo,
  topic,
  videoSlots,
  onOpenVideo,
  customText,
  doses,
  hideSource,
}: {
  activities: Activity[]
  houseInfo: HouseInfo
  topic: AssistantTopic
  videoSlots: string[]
  onOpenVideo: () => void
  customText?: string
  doses?: Dose[] | null
  hideSource?: boolean
}) {
  return (
    <div className="message message--assistant">
      <strong>Assistente Recanto</strong>
      {topic === "custom" && <p style={{ whiteSpace: "pre-line" }}>{customText}</p>}
      {(topic === "medicines" || topic === "allMedicines") && doses && (
        doses.length === 0 ? (
          <p>Ainda não há medicamentos cadastrados para hoje. A equipe pode confirmar com você.</p>
        ) : topic === "medicines" ? (
          <>
            <p>Hoje a Maria toma:</p>
            <ul className="assistant-list">
              {doses.map((dose) => (
                <li key={dose.id}>
                  <Icon name={dose.status === "administrado" ? "check" : "clock"} size={16} />
                  <span><b>{dose.medicine} {dose.dose}</b> às {dose.time} — {givenText(dose)}.</span>
                </li>
              ))}
            </ul>
          </>
        ) : (
          <>
            <p>Estes são todos os medicamentos da Maria hoje:</p>
            <ul className="assistant-list">
              {groupDoses(doses).map((group) => (
                <li key={`${group.medicine}-${group.dose}`}>
                  <Icon name="medicine" size={16} />
                  <span>
                    <b>{group.medicine} {group.dose}</b>, {group.items.map((item) => item.time).join(" e ")} —{" "}
                    {group.items.filter((item) => item.status === "administrado").length} de {group.items.length} doses administradas.
                  </span>
                </li>
              ))}
            </ul>
            <p>Mudanças de dose ou dúvidas sobre o tratamento devem ser tiradas com a equipe.</p>
          </>
        )
      )}
      {topic === "medicines" && !doses && (
        <>
          <p>Hoje a Maria toma:</p>
          <ul className="assistant-list">
            <li><Icon name="check" size={16} /><span><b>Losartana 50 mg</b> às 08:00 — administrado às 08:05 por Elisa Pereira.</span></li>
            <li><Icon name="clock" size={16} /><span><b>Losartana 50 mg</b> às 20:00 — aguardando administração.</span></li>
            <li><Icon name="check" size={16} /><span><b>Vitamina D</b>, 1 cápsula, às 09:00 — administrado.</span></li>
            <li><Icon name="check" size={16} /><span><b>Metformina 500 mg</b> às 12:00 — administrado.</span></li>
          </ul>
        </>
      )}
      {topic === "allMedicines" && !doses && (
        <>
          <p>Estes são todos os medicamentos prescritos para a Maria hoje:</p>
          <ul className="assistant-list">
            <li><Icon name="check" size={16} /><span><b>Losartana 50 mg</b>, 1 comprimido, 08:00 e 20:00 — a dose das 08:00 foi administrada; a das 20:00 está aguardando administração.</span></li>
            <li><Icon name="check" size={16} /><span><b>Vitamina D</b>, 1 cápsula, 09:00 — administrada.</span></li>
            <li><Icon name="check" size={16} /><span><b>Metformina 500 mg</b>, 12:00 — administrada.</span></li>
          </ul>
          <p>Mudanças de dose ou dúvidas sobre o tratamento devem ser tiradas com a equipe.</p>
        </>
      )}
      {topic === "activities" && (
        activities.length > 0 ? (
          <>
            <p>Atividades de hoje:</p>
            <ul className="assistant-list">
              {activities.map((activity) => (
                <li key={activity.id}>
                  <Icon name={activity.status === "Realizada" ? "check" : "clock"} size={16} />
                  <span>
                    <b>{activity.time} · {activity.name}</b> — {activity.status.toLowerCase()}
                    {activity.participation ? `, ${activity.participation.toLowerCase()}` : ""}
                    {activity.observation ? `. ${activity.observation}` : ""}.
                  </span>
                </li>
              ))}
            </ul>
          </>
        ) : (
          <p>A equipe ainda não registrou as atividades de hoje.</p>
        )
      )}
      {topic === "visits" && (
        <p>
          As visitas acontecem {houseInfo.visitingHours}. {houseInfo.visitingRules}
        </p>
      )}
      {topic === "video" && (
        videoSlots.length > 0 ? (
          <>
            <p>A casa tem estes próximos horários livres para videochamada:</p>
            <ul className="assistant-list">
              {videoSlots.map((slot) => (
                <li key={slot}><Icon name="video" size={16} /><span><b>{slot}</b></span></li>
              ))}
            </ul>
            <p>A equipe confirma cada pedido e acompanha a chamada.</p>
            <button className="assistant-inline-button" onClick={onOpenVideo} type="button">
              <Icon name="video" size={16} /> Agendar videochamada
            </button>
          </>
        ) : (
          <p>A casa ainda não definiu horários livres de videochamada.</p>
        )
      )}
      {topic === "clinical" && (
        <p>
          Não tenho essa informação. Já enviei sua pergunta para a equipe, que vai responder no chat com a equipe. Você será avisado aqui.
        </p>
      )}
      {topic === "unknown" && (
        <p>
          Não tenho essa informação. Já enviei sua pergunta para a equipe, que vai responder no chat com a equipe. Você será avisado aqui.
        </p>
      )}
      {!hideSource && topic !== "clinical" && topic !== "unknown" && (
        <span className="assistant-source">
          Informação cadastrada pela equipe · atualizada hoje às 14:30
        </span>
      )}
      <ResponseFeedback />
    </div>
  )
}

function Chat({
  activities,
  customAnswers,
  houseInfo,
  onTalkToCaregiver,
  onUnansweredQuestion,
  videoSlots,
  onOpenVideo,
  doses,
  teamReplyUnread,
  askAi,
}: {
  askAi?: (question: string) => Promise<{ text: string; forward: boolean } | null>
  teamReplyUnread?: boolean
  doses?: Dose[] | null
  activities: Activity[]
  customAnswers: Record<string, string>
  houseInfo: HouseInfo
  videoSlots: string[]
  onOpenVideo: () => void
  onTalkToCaregiver: () => void
  onUnansweredQuestion: (question: string) => void
}) {
  const [message, setMessage] = useState("")
  const [screenState, setScreenState] = useState<ContentState>("ready")
  const [sentMessages, setSentMessages] = useState<
    { question: string; topic: AssistantTopic; typing: boolean; time: string; custom?: string; ai?: boolean }[]
  >([])

  const getTopic = (question: string): AssistantTopic => {
    if (/dor|febre|pressão|diagnóstico|médic|clínic|mal-estar|sintoma/i.test(question)) return "clinical"
    if (/v[ií]deo|chamada/i.test(question)) return "video"
    if (/visita|horário da casa/i.test(question)) return "visits"
    if (/todos os (medicamentos|rem[eé]dios)|lista de (medicamentos|rem[eé]dios)|o que (ela|ele) toma/i.test(question)) return "allMedicines"
    if (/medicamento|remédio/i.test(question)) return "medicines"
    if (/atividade|rotina/i.test(question)) return "activities"
    return "unknown"
  }

  const askAssistant = (question: string, forcedTopic?: AssistantTopic) => {
    if (!question.trim()) return
    const normalize = (text: string) =>
      text.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]+/g, " ").trim()
    // Palavras sem importância são ignoradas; basta a maior parte das palavras-chave coincidir.
    const STOP = new Set("a o as os um uma de do da dos das em no na nos nas por para com e ou que se eu meu minha seu sua ele ela posso pode podem pra ao aos quero queria gostaria saber qual quais como quando onde".split(" "))
    const stem = (word: string) => (word.length > 4 ? word.slice(0, 5) : word)
    const keywords = (text: string) => new Set(normalize(text).split(" ").filter((word) => word && !STOP.has(word)).map(stem))
    const sameQuestion = (asked: string) => {
      if (normalize(asked) === normalize(question)) return true
      const a = keywords(asked)
      const b = keywords(question)
      if (a.size === 0 || b.size === 0) return false
      const common = [...a].filter((word) => b.has(word)).length
      return common / Math.min(a.size, b.size) >= 0.75 && common / Math.max(a.size, b.size) >= 0.5
    }
    const answered = Object.entries(customAnswers).find(([asked]) => sameQuestion(asked))
    // Com o Supabase ligado, a IA (Gemini) responde; vídeo continua com o botão de agendar.
    if (askAi && !answered && (forcedTopic ?? getTopic(question)) !== "video") {
      const aiEntry = {
        question: question.trim(),
        topic: "custom" as AssistantTopic,
        custom: "",
        ai: true,
        typing: true,
        time: new Date().toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" }),
      }
      setSentMessages((current) => [...current, aiEntry])
      setMessage("")
      void askAi(question.trim()).then((result) => {
        const forward = !result || result.forward
        const sent = " Já enviei sua pergunta para a equipe; você será avisado aqui quando responderem."
        const text = !result
          ? `No momento não consegui consultar a assistente.${sent}`
          : result.forward
            ? `${result.text}${sent}`
            : result.text
        if (forward) onUnansweredQuestion(question.trim())
        setSentMessages((current) =>
          current.map((item) => (item === aiEntry ? { ...item, typing: false, custom: text } : item)),
        )
      })
      return
    }
    const topic: AssistantTopic = answered ? "custom" : (forcedTopic ?? getTopic(question))
    const entry = {
      question: question.trim(),
      topic,
      custom: answered?.[1],
      typing: true,
      time: new Date().toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" }),
    }
    if (topic === "clinical" || topic === "unknown") {
      onUnansweredQuestion(question.trim())
    }
    setSentMessages((current) => [...current, entry])
    setMessage("")
    window.setTimeout(() => {
      setSentMessages((current) =>
        current.map((item) => item === entry ? { ...item, typing: false } : item),
      )
    }, 1000)
  }

  const send = (event?: FormEvent) => {
    event?.preventDefault()
    askAssistant(message)
  }

  const suggestions = [
    {
      label: "Videochamada",
      icon: "video" as IconName,
      question: "Quero fazer uma videochamada",
      topic: "video" as AssistantTopic,
    },
    {
      label: "Horário de visitas",
      icon: "clock" as IconName,
      question: "Qual é o horário de visitas?",
      topic: "visits" as AssistantTopic,
    },
    {
      label: "Medicamentos",
      icon: "medicine" as IconName,
      question: "Quais são os medicamentos da Maria?",
      topic: "medicines" as AssistantTopic,
    },
    {
      label: "Atividades de hoje",
      icon: "calendar" as IconName,
      question: "Quais são as atividades de hoje?",
      topic: "activities" as AssistantTopic,
    },
  ]

  return (
    <>
      <TopBar eyebrow="Recanto do Lar · Você acompanha" title="Maria Silva" />
      <main className="screen-content chat-content">
        <EmergencyNotice phone={houseInfo.phone} />
        <StateSwitcher value={screenState} onChange={setScreenState} />
        {screenState !== "ready" ? (
          <ContentStateView
            onRetry={() => setScreenState("ready")}
            state={screenState}
            subject="chat"
          />
        ) : (
          <>
            <div className="status-card">
              <Avatar initials="MS" size="small" label="Maria Silva" />
              <div>
                <strong>Maria está bem hoje</strong>
                <span>Atualizado pela equipe às 14:30</span>
              </div>
              <span className="online-dot" />
            </div>

            <div className="day-divider"><span>Hoje</span></div>
            <div className="messages">
              <div className="message message--user">
                Qual remédio ela toma à noite?
                <span>14:32</span>
              </div>
              <div className="assistant-row">
                <span className="ai-avatar"><Icon name="sparkles" size={18} /></span>
                <AssistantAnswer
                  doses={doses}
                  activities={activities}
                  houseInfo={houseInfo}
                  onOpenVideo={onOpenVideo}
                  topic="medicines"
                  videoSlots={videoSlots}
                />
              </div>
              {sentMessages.map((sent, index) => (
                <div className="message-exchange" key={`${sent.question}-${index}`}>
                  <div className="message message--user">
                    {sent.question}
                    <span>{sent.time}</span>
                  </div>
                  <div className="assistant-row">
                    <span className="ai-avatar"><Icon name="sparkles" size={18} /></span>
                    {sent.typing ? (
                      <div className="typing-indicator">
                        <span /><span /><span />
                        Assistente digitando...
                      </div>
                    ) : (
                      <AssistantAnswer
                  doses={doses}
                        activities={activities}
                        houseInfo={houseInfo}
                        onOpenVideo={onOpenVideo}
                        customText={sent.custom}
                        hideSource={sent.ai}
                        topic={sent.topic}
                        videoSlots={videoSlots}
                      />
                    )}
                  </div>
                </div>
              ))}
            </div>

            <div className="quick-section">
              <span>Pergunte também</span>
              <div className="quick-scroll">
                {suggestions.map((suggestion) => (
                  <button
                    className="quick-chip"
                    key={suggestion.label}
                    onClick={() => askAssistant(suggestion.question, suggestion.topic)}
                    type="button"
                  >
                    <Icon name={suggestion.icon} size={18} />
                    {suggestion.label}
                  </button>
                ))}
              </div>
            </div>

            <div className="medical-note">
              <Icon name="info" size={18} />
              <span>A assistente não dá orientações de saúde. Para essas dúvidas, fale com a equipe.</span>
            </div>
          </>
        )}
      </main>
      <div className="assistant-actions">
        <button className="team-button" onClick={onTalkToCaregiver} type="button">
          <span>
            <Icon name="team" /> Falar com a equipe
            {teamReplyUnread && <span className="unread-dot" aria-label="Nova resposta da equipe">!</span>}
          </span>
          <Icon name="chevron" />
        </button>
      </div>
      <form className="composer" onSubmit={send}>
        <input
          aria-label="Mensagem"
          onChange={(event) => setMessage(event.target.value)}
          placeholder="Escreva sua mensagem..."
          value={message}
        />
        <button type="submit" aria-label="Enviar mensagem">
          <Icon name="send" size={20} />
        </button>
      </form>
    </>
  )
}

function Summary({
  activities,
  houseInfo,
  photos,
  videoRequests,
  onOpenVideo,
  doses,
  residentName = "Maria Silva",
}: {
  residentName?: string
  doses?: Dose[] | null
  activities: Activity[]
  houseInfo: HouseInfo
  photos: Photo[]
  videoRequests: VideoRequest[]
  onOpenVideo: () => void
}) {
  const [selectedDay, setSelectedDay] = useState(12)
  const [dayTab, setDayTab] = useState<"resumo" | "remedios" | "rotina" | "fotos">("resumo")
  const [screenState, setScreenState] = useState<ContentState>("ready")
  const [openPhoto, setOpenPhoto] = useState<Photo | null>(null)
  const closePhoto = useBackDismiss(openPhoto !== null, () => setOpenPhoto(null), "photo")
  const medicines = doses ? medicineRows(doses) : [
    { name: "Losartana", dose: "50 mg", time: "08:00 e 20:00", status: "Administrado às 08:05 por Elisa Pereira", statusTone: "done", color: "mint" },
    { name: "Vitamina D", dose: "1 cápsula", time: "09:00", status: "Administrado às 09:02 por Elisa Pereira", statusTone: "done", color: "orange" },
    { name: "Metformina", dose: "500 mg", time: "12:00", status: "Administrado às 12:03 por Elisa Pereira", statusTone: "done", color: "blue" },
  ]
  const routine = [
    { time: "08:00", title: "Café da manhã", detail: "Comeu bem", registeredBy: "Elisa Pereira", registeredAt: "08:10", icon: "utensils" as IconName, done: true },
    ...activities.map((activity) => ({
      time: activity.time,
      title: activity.name,
      detail: activity.observation ?? activity.participation ?? activity.status,
      // Atividade só programada ainda não foi feita por ninguém: sem nome do cuidador.
      registeredBy: activity.status === "Programada" ? "" : activity.registeredBy,
      registeredAt: activity.status === "Programada" ? "" : activity.registeredAt,
      icon: activity.status === "Realizada" ? "heart" as IconName : "clock" as IconName,
      done: activity.status === "Realizada",
    })),
  ]
  const completedActivities = activities.filter((activity) => activity.status === "Realizada")
  const isToday = selectedDay === 12
  const past = PAST_DAYS.find((day) => day.n === selectedDay)
  const dayPhotos = photos.filter((photo) => photo.day === selectedDay && photo.residents.includes(residentName))
  const weekdays = [...PAST_DAYS.map((day) => day.n), 12].map((n) => ({ n, ...dayInfo(n) }))
  const nextCall = videoRequests.find((request) => (supabaseConfigured || request.resident === "Maria Silva") && request.status === "Confirmada")
  const weekActivities = PAST_DAYS.reduce((sum, day) => sum + day.done, 0) + completedActivities.length
  const weekPlanned = PAST_DAYS.reduce((sum, day) => sum + day.total, 0) + activities.length

  return (
    <>
      <TopBar eyebrow={`Recanto do Lar · ${TODAY_LABEL}`} title="Olá, Carla" />
      <main className="screen-content summary-content">
        <EmergencyNotice phone={houseInfo.phone} />
        <StateSwitcher value={screenState} onChange={setScreenState} />
        {screenState !== "ready" ? (
          <ContentStateView
            onRetry={() => setScreenState("ready")}
            state={screenState}
            subject="resumo"
          />
        ) : (
          <>
            <section className="ai-summary">
              <div className="card-heading">
                <span className="feature-icon"><Icon name="sparkles" /></span>
                <div><span>Criado pela assistente</span><h2>Resumo da semana</h2></div>
              </div>
              <p>
                Nos últimos 7 dias a Maria esteve <strong>bem na maior parte do tempo</strong>. No dia {dayInfo(7).num}
                ficou mais cansada e comeu um pouco menos, mas desde o dia {dayInfo(8).num} voltou ao normal.
              </p>
              <div className="summary-metrics summary-metrics--four">
                <div><span>Humor bom</span><strong>6/7</strong></div>
                <div><span>Alimentação</span><strong>6/7</strong></div>
                <div><span>Doses</span><strong>27/28</strong></div>
                <div><span>Atividades</span><strong>{weekActivities}/{weekPlanned}</strong></div>
              </div>
            </section>

            <section className="video-card">
              <span className="feature-icon"><Icon name="video" /></span>
              <div>
                <h2>{nextCall ? "Videochamada confirmada" : "Videochamada"}</h2>
                <span>{nextCall ? `${nextCall.dayLabel} às ${nextCall.time}` : "Peça um horário à equipe"}</span>
              </div>
              <button onClick={onOpenVideo} type="button">{nextCall ? "Ver" : "Agendar"}</button>
            </section>

            <div className="day-picker-heading">
              <h2>Dia a dia</h2>
              <span>Toque em um dia</span>
            </div>
            <div className="day-strip" role="group" aria-label="Últimos 7 dias">
              {weekdays.map((day) => (
                <button
                  aria-pressed={selectedDay === day.n}
                  aria-label={`${day.wd} ${day.num}${day.n === 12 ? ", hoje" : ""}`}
                  key={day.n}
                  onClick={() => setSelectedDay(day.n)}
                  type="button"
                >
                  <span>{day.n === 12 ? "hoje" : day.wd}</span>
                  <strong>{day.num}</strong>
                </button>
              ))}
            </div>

            <div className="tab-switch" role="group" aria-label="Detalhes do dia">
              {([
                ["resumo", "Resumo"],
                ["remedios", "Remédios"],
                ["rotina", "Rotina"],
                ["fotos", "Fotos"],
              ] as const).map(([value, label]) => (
                <button aria-pressed={dayTab === value} key={value} onClick={() => setDayTab(value)} type="button">
                  {label}
                </button>
              ))}
            </div>

            {dayTab === "resumo" && (
            <section className="section-block">
              <div className="section-title">
                <div><h2>{isToday ? "Hoje" : `${dayInfo(selectedDay).wd} ${dayInfo(selectedDay).num}`}</h2><span>Resumo do dia</span></div>
              </div>
              {isToday ? (
                <p className="day-text">
                  <span>
                    Maria está <strong>tranquila e comunicativa</strong> hoje.
                    {completedActivities.length > 0
                      ? ` Participou de ${completedActivities.map((activity) => activity.name.toLowerCase()).join(" e ")}.`
                      : " A equipe ainda não registrou atividades realizadas."}
                  </span>
                </p>
              ) : (
                <p className="day-text">{past?.text}</p>
              )}
              <div className="summary-metrics">
                <div><span>Humor</span><strong>{isToday ? "Muito bem" : past?.mood}</strong></div>
                <div><span>Alimentação</span><strong>{isToday ? "Boa" : past?.food}</strong></div>
                <div><span>Atividades</span><strong>{isToday ? `${completedActivities.length} de ${activities.length}` : `${past?.done} de ${past?.total}`}</strong></div>
              </div>
            </section>
            )}

            {dayTab === "remedios" && (
            <section className="section-block">
              <div className="section-title">
                <div><h2>Medicamentos</h2><span>{isToday ? (doses ? `${medicines.length} medicamentos · ${doses.filter((dose) => dose.status === "administrado").length} de ${doses.length} doses dadas` : "3 medicamentos · 3 de 4 doses dadas") : `${past?.given} de ${past?.doses} doses administradas`}</span></div>
              </div>
              {isToday ? (
                medicines.length === 0 ? (
                  <p className="day-text"><Icon name="info" size={16} /> <span>Nenhum medicamento previsto para hoje.</span></p>
                ) : (
                <div className="medicine-list">
                  {medicines.map((medicine) => (
                    <article className="medicine-row" key={medicine.name}>
                      <span className={`medicine-icon medicine-icon--${medicine.color}`}><Icon name="medicine" /></span>
                      <div>
                        <strong>{medicine.name}</strong>
                        <span>{medicine.dose}</span>
                        <small className={`medicine-status medicine-status--${medicine.statusTone}`}>
                          <Icon name={medicine.statusTone === "done" ? "check" : "clock"} size={16} />
                          {medicine.status}
                        </small>
                      </div>
                      <time><Icon name="clock" size={16} />{medicine.time}</time>
                    </article>
                  ))}
                </div>
                )
              ) : (
                <p className="day-text">
                  <Icon name="check" size={16} /> <span>Todas as doses do dia foram administradas pela equipe.</span>
                </p>
              )}
            </section>
            )}

            {dayTab === "rotina" && (
            <section className="section-block">
              <div className="section-title"><div><h2>{isToday ? "Rotina de hoje" : "Rotina do dia"}</h2><span>Registros da equipe</span></div></div>
              <div className="timeline">
                {(isToday
                  ? routine
                  : (past?.routine ?? []).map((item) => ({
                      time: item.time,
                      title: item.title,
                      detail: item.detail,
                      registeredBy: item.by,
                      registeredAt: item.at,
                      icon: "heart" as IconName,
                      done: true,
                    }))
                ).map((item) => (
                  <article className={item.done ? "timeline-item timeline-item--done" : "timeline-item"} key={item.time + item.title}>
                    <time>{item.time}</time>
                    <span className="timeline-dot">{item.done ? <Icon name="check" size={14} /> : <Icon name={item.icon} size={16} />}</span>
                    <div>
                      <strong>{item.title}</strong>
                      <span className="timeline-meta">
                        {item.registeredBy ? `${item.detail} · ${item.registeredBy}, ${item.registeredAt}` : item.detail}
                      </span>
                    </div>
                  </article>
                ))}
              </div>
            </section>
            )}

            {dayTab === "fotos" && (
            <section className="section-block">
              <div className="section-title"><div><h2>Fotos</h2><span>Só aparecem fotos em que a Maria está</span></div></div>
              {dayPhotos.length === 0 ? (
                <p className="video-empty">Nenhuma foto neste dia.</p>
              ) : (
                <PhotoGrid photos={dayPhotos} onOpen={setOpenPhoto} />
              )}
            </section>
            )}
          </>
        )}
      </main>
      {openPhoto && <PhotoLightbox photo={openPhoto} onClose={closePhoto} />}
    </>
  )
}

type ResidentCard = { initials: string; name: string; room: string; status: string; color: string; pendingCount: number; id?: string }

const residents: ResidentCard[] = [
  { initials: "MS", name: "Maria Silva", room: "Quarto 12", status: "Atualizado há 20 min", color: "mint", pendingCount: 1 },
  { initials: "JP", name: "João Pereira", room: "Quarto 08", status: "Atualizado há 35 min", color: "blue", pendingCount: 0 },
  { initials: "AL", name: "Ana Lourdes", room: "Quarto 15", status: "Atualizado há 1 h", color: "orange", pendingCount: 0 },
  { initials: "RS", name: "Roberto Santos", room: "Quarto 03", status: "Atualizado há 2 h", color: "purple", pendingCount: 2 },
]

function ResidentConversation({
  messages,
  onSend,
  sender,
}: {
  messages: ResidentMessage[]
  onSend: (message: string) => void
  sender: Role
}) {
  const [message, setMessage] = useState("")

  const sendMessage = (event: FormEvent) => {
    event.preventDefault()
    if (!message.trim()) return
    onSend(message.trim())
    setMessage("")
  }

  return (
    <>
      <section className="caregiver-chat caregiver-chat--page">
        <div className="caregiver-chat__heading">
          <span className="feature-icon feature-icon--terracotta"><Icon name="chat" /></span>
          <div>
            <span>Conversa do residente</span>
            <h2>{sender === "family" ? "Falar com Elisa" : "Mensagens da família"}</h2>
          </div>
        </div>
        <div className="caregiver-chat__messages" aria-live="polite">
          {messages.length === 0 && (
            <div className="chat-empty">
              <Icon name="chat" />
              <span>Nenhuma mensagem nesta conversa.</span>
            </div>
          )
          }
          {messages.map((residentMessage, index) => {
            const isOwnMessage = residentMessage.sender === sender
            return (
              <div
                className={
                  isOwnMessage
                    ? "caregiver-message caregiver-message--family"
                    : "caregiver-message caregiver-message--staff"
                }
                key={`${residentMessage.text}-${index}`}
              >
                {residentMessage.text}
                <span>
                  {residentMessage.sender === "family" ? "Carla" : residentMessage.sender === "admin" ? "Administração" : "Elisa"} · agora
                </span>
              </div>
            )
          })}
        </div>
      </section>
      <form className="team-composer" onSubmit={sendMessage}>
        <input
          aria-label={sender === "family" ? "Mensagem para a responsável" : "Resposta para a família"}
          onChange={(event) => setMessage(event.target.value)}
          placeholder={sender === "family" ? "Escreva para Elisa..." : "Responder à família..."}
          value={message}
        />
        <button type="submit" aria-label="Enviar mensagem">
          <Icon name="send" size={20} />
        </button>
      </form>
    </>
  )
}

/** Texto do relatório montado só com o que a equipe registrou (sem inventar nada). */
function buildShiftReport(name: string, activities: Activity[], doses: Dose[] | null): string {
  const first = name.split(" ")[0]
  const parts: string[] = []
  const done = activities.filter((a) => a.status === "Realizada")
  const refused = activities.filter((a) => a.status === "Não realizada")
  const waiting = activities.filter((a) => a.status === "Programada")
  const withNote = (a: Activity) => `${a.name}${a.observation?.trim() ? ` (${a.observation.trim().replace(/[.]+$/, "")})` : ""}`
  done.forEach((a) => {
    parts.push(
      a.participation === "Participou pouco"
        ? `${first} participou pouco de ${withNote(a)}.`
        : `${first} participou de ${withNote(a)}.`,
    )
  })
  refused.forEach((a) => parts.push(`${first} não quis participar de ${withNote(a)}.`))
  if (waiting.length > 0) {
    parts.push(`Ainda não houve registro de: ${waiting.map((a) => a.name).join(", ")}.`)
  }
  if (activities.length === 0) parts.push("Não há atividades registradas hoje.")
  if (doses) {
    const given = doses.filter((d) => d.status === "administrado").length
    const pending = doses.filter((d) => d.status === "aguardando")
    if (doses.length > 0) {
      parts.push(
        pending.length === 0
          ? `Todas as ${doses.length} doses de medicamento do dia foram administradas.`
          : `${given} de ${doses.length} doses de medicamento foram administradas; aguardam: ${pending.map((d) => `${d.medicine} às ${d.time}`).join(", ")}.`,
      )
    }
  } else {
    parts.push("Os medicamentos previstos foram acompanhados pela equipe.")
  }
  return parts.join(" ")
}

function TeamPanel({
  activitiesByResident,
  conversations,
  onAddActivity,
  unreadConversations,
  onMarkAsRead,
  onSendMessage,
  onUpdateActivity,
  realResidents,
  doses,
  onMarkDose,
  onAddPrescription,
}: {
  realResidents: RealResident[]
  doses: Dose[]
  onMarkDose: (doseId: string) => Promise<boolean>
  onAddPrescription: (residentId: string, medicine: string, dose: string, time: string) => Promise<boolean>
  activitiesByResident: Record<string, Activity[]>
  conversations: Record<string, ResidentMessage[]>
  onAddActivity: (residentName: string, name: string, time: string) => void
  unreadConversations: Record<string, boolean>
  onMarkAsRead: (residentName: string) => void
  onSendMessage: (residentName: string, message: string, sender: Role) => void
  onUpdateActivity: (residentName: string, id: ActivityId, updates: Partial<Activity>) => void
}) {
  const [query, setQuery] = useState("")
  const [selected, setSelected] = useState<ResidentCard | null>(null)
  const [rxName, setRxName] = useState("")
  const [rxDose, setRxDose] = useState("")
  const [rxTime, setRxTime] = useState("08:00")
  const [rxError, setRxError] = useState("")
  const [busyDose, setBusyDose] = useState("")
  // Rascunhos: o que a equipe marca só vai para a família depois de confirmar (ou ao aprovar o relatório).
  const [drafts, setDrafts] = useState<Record<string, Partial<Activity>>>({})
  const generateReport = async () => {
    if (!selected) return
    const merged = (activitiesByResident[selected.name] ?? []).map((item) => ({
      ...item,
      ...drafts[`${selected.name}:${item.id}`],
    }))
    const residentDoses = supabaseConfigured && selected.id ? doses.filter((dose) => dose.residentId === selected.id) : null
    const local = buildShiftReport(selected.name, merged, residentDoses)
    if (!supabaseConfigured) {
      setReportText(local)
      return
    }
    setReportLoading(true)
    setReportText("Gerando o relatório…")
    // A IA só reescreve em linguagem natural os fatos já registrados; se falhar, vale o texto montado aqui.
    const written = await askReportAi(`Residente: ${selected.name}\n${local}`)
    setReportText(written ?? local)
    setReportLoading(false)
  }
  const draftKey = (residentName: string, id: ActivityId) => `${residentName}:${id}`
  const setDraft = (residentName: string, id: ActivityId, patch: Partial<Activity>) =>
    setDrafts((current) => ({ ...current, [draftKey(residentName, id)]: { ...current[draftKey(residentName, id)], ...patch } }))
  const confirmDraft = (residentName: string, id: ActivityId) => {
    const key = draftKey(residentName, id)
    const draft = drafts[key]
    if (!draft) return
    onUpdateActivity(residentName, id, { ...draft, registeredBy: "Elisa Pereira", registeredAt: currentTime })
    setDrafts((current) => {
      const { [key]: _removed, ...rest } = current
      return rest
    })
  }
  const confirmAllDrafts = (residentName: string) => {
    Object.keys(drafts)
      .filter((key) => key.startsWith(`${residentName}:`))
      .forEach((key) => {
        const raw = key.slice(residentName.length + 1)
        const activity = (activitiesByResident[residentName] ?? []).find((item) => String(item.id) === raw)
        if (activity) confirmDraft(residentName, activity.id)
      })
  }
  const [profilePage, setProfilePage] = useState<"record" | "chat" | "report">("record")
  const [saved, setSaved] = useState(false)
  const [notesSaved, setNotesSaved] = useState(false)
  const [recordSavedOnce, setRecordSavedOnce] = useState(false)
  const [notesEdited, setNotesEdited] = useState(false)
  const [notes, setNotes] = useState("Maria esteve tranquila e comunicativa. Alimentou-se bem no almoço e participou da oficina de pintura.")
  const [dictating, setDictating] = useState(false)
  const [reportStatus, setReportStatus] = useState<"idle" | "draft" | "editing" | "approved">("idle")
  const [reportText, setReportText] = useState("")
  const [reportLoading, setReportLoading] = useState(false)
  const [reportDiscardConfirm, setReportDiscardConfirm] = useState(false)
  const closeReportDiscard = useBackDismiss(
    reportDiscardConfirm,
    () => setReportDiscardConfirm(false),
    "report-discard-confirmation",
  )
  const [activityName, setActivityName] = useState("")
  const [activityTime, setActivityTime] = useState("15:30")
  const [residentFilter, setResidentFilter] = useState<"pending" | "all">("all")
  const [sortOrder, setSortOrder] = useState<"priority" | "name">("priority")
  const currentTime = useMemo(
    () => new Date().toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" }),
    [],
  )
  const quickRecords = ["Comeu bem", "Comeu pouco", "Recusou", "Dormiu bem", "Agitado"]
  const residentList: ResidentCard[] = useMemo(
    () =>
      supabaseConfigured
        ? realResidents.map((resident) => {
            const pending = doses.filter((dose) => dose.residentId === resident.id && dose.status === "aguardando").length
            return {
              id: resident.id,
              initials: resident.initials,
              name: resident.name,
              room: resident.room,
              color: resident.color,
              pendingCount: pending,
              status: pending > 0 ? "Há doses a administrar hoje" : "Medicação em dia",
            }
          })
        : residents,
    [realResidents, doses],
  )
  const filtered = useMemo(
    () =>
      residentList
        .filter((resident) => resident.name.toLowerCase().includes(query.toLowerCase()))
        .filter((resident) => residentFilter === "all" || resident.pendingCount > 0)
        .sort((a, b) =>
          sortOrder === "name"
            ? a.name.localeCompare(b.name)
            : b.pendingCount - a.pendingCount ||
              Number(unreadConversations[b.name]) - Number(unreadConversations[a.name]),
        ),
    [query, residentFilter, sortOrder, unreadConversations, residentList],
  )

  useEffect(() => {
    const handleBack = () => {
      if (reportDiscardConfirm) {
        return
      } else if (profilePage === "report" && reportStatus !== "approved") {
        setReportDiscardConfirm(true)
      } else if (profilePage !== "record") {
        setProfilePage("record")
      } else if (selected) {
        setSelected(null)
      }
    }
    window.addEventListener("popstate", handleBack)
    return () => window.removeEventListener("popstate", handleBack)
  }, [profilePage, reportDiscardConfirm, reportStatus, selected])

  if (selected) {
    if (profilePage === "chat") {
      return (
        <>
          <TopBar
            title="Chat"
            eyebrow={`Recanto do Lar · ${selected.name}`}
            avatar="EP"
            onBack={() => window.history.back()}
          />
          <main className="screen-content resident-chat-page">
            <div className="resident-chat-person">
              <Avatar
                initials={selected.initials}
                tone={selected.color as "mint" | "blue" | "orange" | "purple"}
                label={selected.name}
              />
              <div>
                <strong>{selected.name}</strong>
                <span>{selected.room} · Conversa com a família</span>
              </div>
            </div>
            <div className="shift-response-note">
              <Icon name="clock" size={18} />
              Respondemos durante o plantão (08:00 às 18:00)
            </div>
            <ResidentConversation
              messages={conversations[selected.name] ?? []}
              onSend={(message) => onSendMessage(selected.name, message, "team")}
              sender="team"
            />
          </main>
        </>
      )
    }

    if (profilePage === "report") {
      return (
        <>
          <TopBar
            title="Relatório com IA"
            eyebrow={`Recanto do Lar · ${selected.name}`}
            avatar="EP"
            onBack={() => {
              if (reportStatus === "approved") {
                window.history.back()
              } else {
                setReportDiscardConfirm(true)
              }
            }}
          />
          <main className="screen-content resident-form">
            <section className="report-draft">
              <span className="draft-badge">
                <Icon name="sparkles" size={18} />
                {reportStatus === "approved"
                  ? "Aprovado e enviado à família"
                  : "Rascunho gerado por IA – revise antes de enviar"}
              </span>
              {reportStatus === "editing" ? (
                <textarea
                  aria-label="Editar relatório"
                  onChange={(event) => setReportText(event.target.value)}
                  value={reportText}
                />
              ) : (
                <p>{reportText}</p>
              )}
              {reportStatus !== "approved" && (
                <>
                  <p className="report-note">
                    O resumo diário da família será atualizado somente depois da aprovação.
                  </p>
                  <div className="report-actions">
                    <button disabled={reportLoading} onClick={() => setReportStatus("editing")} type="button">Editar</button>
                    <button disabled={reportLoading} onClick={() => { confirmAllDrafts(selected.name); setReportStatus("approved") }} type="button">
                      <Icon name="check" size={18} />
                      Aprovar e enviar à família
                    </button>
                    <button onClick={() => setReportDiscardConfirm(true)} type="button">Descartar</button>
                  </div>
                </>
              )}
            </section>
          </main>
          {reportDiscardConfirm && (
            <div className="confirmation-backdrop" onClick={closeReportDiscard} role="presentation">
              <section className="confirmation-dialog" onClick={(event) => event.stopPropagation()} role="dialog" aria-modal="true">
                <span className="confirmation-icon"><Icon name="info" /></span>
                <h2>Descartar alterações?</h2>
                <p>O rascunho do relatório não será enviado à família.</p>
                <div>
                  <button
                    onClick={() => {
                      closeReportDiscard()
                    }}
                    type="button"
                  >
                    Continuar editando
                  </button>
                  <button
                    onClick={() => {
                      setReportDiscardConfirm(false)
                      setReportStatus("idle")
                      setProfilePage("record")
                    }}
                    type="button"
                  >
                    Descartar
                  </button>
                </div>
              </section>
            </div>
          )}
        </>
      )
    }

    return (
      <>
        <TopBar
          title={selected.name}
          eyebrow={`Recanto do Lar · ${selected.room}`}
          avatar="EP"
          onBack={() => window.history.back()}
        />
        <main className="screen-content resident-form">
          <div className="form-intro">
            <Avatar
              initials={selected.initials}
              tone={selected.color as "mint" | "blue" | "orange" | "purple"}
              label={selected.name}
            />
            <div><strong>Atualizar informações</strong><span>Os familiares verão os dados salvos</span></div>
          </div>

          <button
            className="resident-chat-entry"
            onClick={() => {
              window.history.pushState({ ...(window.history.state ?? {}), overlay: "resident-chat" }, "", window.location.href)
              setProfilePage("chat")
              onMarkAsRead(selected.name)
            }}
            type="button"
          >
            <span className="feature-icon feature-icon--terracotta"><Icon name="chat" /></span>
            <span>
              <strong>
                Chat
                {unreadConversations[selected.name] && (
                  <span className="unread-dot" aria-label="Nova mensagem da família">!</span>
                )}
              </strong>
              <small>Ver e responder mensagens da família</small>
            </span>
            <Icon name="chevron" />
          </button>

          {supabaseConfigured && selected.id && (
            <section className="form-card">
              <div className="card-heading">
                <span className="feature-icon"><Icon name="medicine" /></span>
                <div><span>Hoje</span><h2>Medicação</h2></div>
              </div>
              {doses.filter((dose) => dose.residentId === selected.id).length === 0 && (
                <p className="record-author">Nenhum medicamento previsto para hoje.</p>
              )}
              <div className="medicine-list">
                {doses
                  .filter((dose) => dose.residentId === selected.id)
                  .map((dose) => (
                    <article className="medicine-row" key={dose.id}>
                      <span className="medicine-icon medicine-icon--mint"><Icon name="medicine" /></span>
                      <div>
                        <strong>{dose.medicine}</strong>
                        <span>{dose.dose} · {dose.time}</span>
                        {dose.status === "administrado" ? (
                          <small className="medicine-status medicine-status--done">
                            <Icon name="check" size={16} />
                            Administrado{dose.administeredAt ? ` às ${dose.administeredAt}` : ""}
                            {dose.administeredBy ? ` por ${dose.administeredBy}` : ""}
                          </small>
                        ) : (
                          <button
                            className="outline-button"
                            disabled={busyDose === dose.id}
                            onClick={async () => {
                              setBusyDose(dose.id)
                              await onMarkDose(dose.id)
                              setBusyDose("")
                            }}
                            type="button"
                          >
                            <Icon name="check" />
                            {busyDose === dose.id ? "Registrando..." : "Administrado"}
                          </button>
                        )}
                      </div>
                    </article>
                  ))}
              </div>
              <label>Novo medicamento<input onChange={(event) => setRxName(event.target.value)} placeholder="Ex.: Losartana" value={rxName} /></label>
              <div className="field-row">
                <label>Dose<input onChange={(event) => setRxDose(event.target.value)} placeholder="Ex.: 50 mg" value={rxDose} /></label>
                <label>Horário<input onChange={(event) => setRxTime(event.target.value)} type="time" value={rxTime} /></label>
              </div>
              {rxError && <p className="login-error" role="alert">{rxError}</p>}
              <button
                className="outline-button"
                onClick={async () => {
                  if (!rxName.trim() || !rxDose.trim()) {
                    setRxError("Preencha o nome e a dose do medicamento.")
                    return
                  }
                  setRxError("")
                  const ok = await onAddPrescription(selected.id!, rxName, rxDose, rxTime)
                  if (ok) {
                    setRxName("")
                    setRxDose("")
                  } else {
                    setRxError("Não foi possível salvar. Tente novamente.")
                  }
                }}
                type="button"
              >
                <Icon name="plus" />
                Adicionar medicamento
              </button>
            </section>
          )}

          {!supabaseConfigured && (
          <section className="form-card">
            <div className="card-heading">
              <span className="feature-icon"><Icon name="medicine" /></span>
              <div><span>Cadastro rápido</span><h2>Medicamento</h2></div>
            </div>
            <label>Nome do medicamento<input defaultValue="Losartana" /></label>
            <div className="field-row">
              <label>Dose<input defaultValue="50 mg" /></label>
              <label>Horário<input defaultValue="20:00" type="time" /></label>
            </div>
            <button className="outline-button" onClick={() => setSaved(true)} type="button">
              <Icon name={saved ? "check" : "plus"} />
              {saved ? "Salvo" : "Adicionar medicamento"}
            </button>
            {saved && (
              <p className="record-author">
                <Icon name="check" size={16} />
                Registrado por Elisa Pereira às {currentTime}
              </p>
            )}
          </section>
          )}

          <section className="form-card activity-card">
            <div className="card-heading">
              <span className="feature-icon feature-icon--terracotta"><Icon name="calendar" /></span>
              <div><span>Visível para a família</span><h2>Atividades do dia</h2></div>
            </div>
            <div className="activity-list">
              {(activitiesByResident[selected.name] ?? []).map((saved) => {
                const draft = drafts[draftKey(selected.name, saved.id)]
                const activity: Activity = { ...saved, ...draft }
                return (
                <article className="activity-item" key={activity.id}>
                  <div className="activity-item__heading">
                    <div>
                      <strong>{activity.name}</strong>
                      <span>{activity.time}</span>
                    </div>
                    <span
                      className={`activity-status activity-status--${
                        activity.status === "Realizada"
                          ? "done"
                          : activity.status === "Programada"
                            ? "pending"
                            : "missed"
                      }`}
                    >
                      <Icon name={activity.status === "Realizada" ? "check" : activity.status === "Programada" ? "clock" : "info"} size={15} />
                      {activity.status}
                    </span>
                  </div>
                  <div className="participation-actions">
                    {["Participou", "Participou pouco", "Não quis"].map((option) => (
                      <button
                        aria-pressed={activity.participation === option}
                        key={option}
                        onClick={() =>
                          setDraft(selected.name, activity.id, {
                            participation: option as Activity["participation"],
                            status: option === "Não quis" ? "Não realizada" : "Realizada",
                          })
                        }
                        type="button"
                      >
                        {option}
                      </button>
                    ))}
                  </div>
                  <input
                    aria-label={`Observação sobre ${activity.name}`}
                    onChange={(event) => setDraft(selected.name, activity.id, { observation: event.target.value })}
                    placeholder="Observação opcional"
                    value={activity.observation ?? ""}
                  />
                  {draft ? (
                    <>
                      <small>Ainda não enviado à família</small>
                      <button className="outline-button" onClick={() => confirmDraft(selected.name, activity.id)} type="button">
                        <Icon name="check" />
                        Confirmar e enviar à família
                      </button>
                    </>
                  ) : (
                    <small>
                      {saved.status === "Programada" ? "Ainda não registrada" : `${saved.registeredBy} · ${saved.registeredAt}`}
                    </small>
                  )}
                </article>
                )
              })}
            </div>
            <div className="add-activity-form">
              <label>
                Nome
                <input
                  onChange={(event) => setActivityName(event.target.value)}
                  placeholder="Ex.: Caminhada"
                  value={activityName}
                />
              </label>
              <label>
                Horário
                <input
                  onChange={(event) => setActivityTime(event.target.value)}
                  type="time"
                  value={activityTime}
                />
              </label>
            </div>
            <button
              className="outline-button"
              onClick={() => {
                if (!activityName.trim()) return
                onAddActivity(selected.name, activityName.trim(), activityTime)
                setActivityName("")
              }}
              type="button"
            >
              <Icon name="plus" />
              Adicionar atividade
            </button>
            <p className="form-helper">
              Estas informações aparecem para a família e são usadas pela assistente.
            </p>
          </section>

          <section className="form-card">
            <div className="card-heading">
              <span className="feature-icon feature-icon--blue"><Icon name="chat" /></span>
              <div><span>Registro rápido</span><h2>Rotina e observações</h2></div>
            </div>
            <label>
              Horário do registro
              <input value={currentTime} readOnly aria-label="Horário preenchido automaticamente" />
            </label>
            <div className="quick-record">
              <span>Toque em uma opção</span>
              <div>
                {quickRecords.map((option) => (
                  <button
                    aria-pressed={notes.startsWith(option)}
                    key={option}
                    onClick={() => {
                      setNotes(option)
                      setNotesSaved(false)
                    }}
                    type="button"
                  >
                    {option}
                  </button>
                ))}
              </div>
            </div>
            <label className="sr-only" htmlFor="notes">Observações do dia</label>
            <div className="voice-field">
              <textarea
                id="notes"
                onChange={(event) => {
                  setNotes(event.target.value)
                  setNotesSaved(false)
                }}
                placeholder="Ou escreva uma observação..."
                value={notes}
              />
              <button
                aria-pressed={dictating}
                className="voice-button"
                onClick={() => {
                  setDictating((current) => !current)
                  if (!dictating) {
                    setNotes((current) => current || "Registro feito por voz.")
                    setNotesSaved(false)
                  }
                }}
                type="button"
              >
                <Icon name="mic" />
                {dictating ? "Ouvindo..." : "Falar"}
              </button>
            </div>
            <p className="form-helper">O botão Falar serve apenas para ditar observações do dia, que alimentam o resumo gerado por IA. A medicação não é registrada por voz.</p>
            <button
              className="outline-button"
              onClick={() => {
                if (recordSavedOnce) setNotesEdited(true)
                setRecordSavedOnce(true)
                setNotesSaved(true)
                setDictating(false)
              }}
              type="button"
            >
              <Icon name={notesSaved ? "check" : "plus"} />
              {notesSaved ? "Salvo" : "Salvar observações"}
            </button>
            {notesSaved && (
              <p className="record-author">
                <Icon name={notesEdited ? "profile" : "check"} size={16} />
                {notesEdited
                  ? `Editado por Elisa Pereira às ${currentTime}`
                  : `Registrado por Elisa Pereira às ${currentTime}`}
              </p>
            )}
          </section>

          <button
            className={reportStatus === "approved" ? "ai-button ai-button--success" : "ai-button"}
            onClick={() => {
              if (reportStatus === "idle") {
                setReportStatus("draft")
                void generateReport()
              }
              window.history.pushState({ ...(window.history.state ?? {}), overlay: "resident-report" }, "", window.location.href)
              setProfilePage("report")
            }}
            type="button"
          >
            <Icon name={reportStatus === "approved" ? "check" : "sparkles"} />
            {reportStatus === "approved" ? "Ver relatório aprovado" : "Gerar relatório de plantão com IA"}
          </button>
          <p className="privacy-note"><Icon name="lock" size={16} /> Dados fictícios protegidos e visíveis apenas para pessoas autorizadas.</p>
        </main>
      </>
    )
  }

  return (
    <>
      <TopBar eyebrow="Recanto do Lar · Painel da equipe" title="Boa tarde, Elisa" avatar="EP" />
      <main className="screen-content team-content">
        <section className="shift-card">
          <div><span>Plantão de hoje</span><strong>08:00 — 18:00</strong><small>4 residentes sob seus cuidados</small></div>
          <span className="shift-icon"><Icon name="team" /></span>
        </section>
        <div className="search-box">
          <Icon name="search" />
          <input
            aria-label="Buscar residente"
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Buscar residente..."
            value={query}
          />
        </div>
        <div className="resident-controls">
          <div aria-label="Filtrar residentes">
            <button
              aria-pressed={residentFilter === "pending"}
              onClick={() => setResidentFilter("pending")}
              type="button"
            >
              Pendentes
            </button>
            <button
              aria-pressed={residentFilter === "all"}
              onClick={() => setResidentFilter("all")}
              type="button"
            >
              Todos
            </button>
          </div>
          <button
            className="sort-button"
            onClick={() => setSortOrder((current) => current === "priority" ? "name" : "priority")}
            type="button"
          >
            {sortOrder === "priority" ? "Prioridade" : "Nome"}
          </button>
        </div>
        <div className="list-heading"><h2>Residentes</h2><span>{filtered.length} pessoas</span></div>
        <div className="resident-list">
          {filtered.map((resident) => (
            <button
              className="resident-row"
              key={resident.name}
              onClick={() => {
                window.history.pushState({ ...(window.history.state ?? {}), overlay: "resident-detail" }, "", window.location.href)
                setSelected(resident)
                setProfilePage("record")
              }}
              type="button"
            >
              <Avatar
                initials={resident.initials}
                tone={resident.color as "mint" | "blue" | "orange" | "purple"}
                label={resident.name}
              />
              <span className="resident-info"><strong>{resident.name}</strong><span>{resident.room}</span><small><i />{resident.status}</small></span>
              <span className="resident-priority">
                {resident.pendingCount > 0 && (
                  <span className="pending-badge">
                    <Icon name="clock" size={15} />
                    <small>
                      {resident.pendingCount} · Aguardando medicação
                    </small>
                  </span>
                )}
                {unreadConversations[resident.name] && (
                  <span className="resident-unread" aria-label="Nova mensagem no chat">
                    <span className="unread-dot">!</span>
                    <small>Mensagem nova</small>
                  </span>
                )}
              </span>
              <span className="row-chevron"><Icon name="chevron" /></span>
            </button>
          ))}
        </div>
      </main>
    </>
  )
}

function Caregiver({
  messages,
  onBack,
  onSendMessage,
}: {
  messages: ResidentMessage[]
  onBack: () => void
  onSendMessage: (message: string) => void
}) {
  return (
    <>
      <TopBar eyebrow="Recanto do Lar · Maria Silva" title="Chat com a equipe" onBack={onBack} />
      <main className="screen-content resident-chat-page">
        <div className="share-conversation-note">
          <Icon name="info" size={18} />
          A conversa com a assistente será compartilhada com a equipe
        </div>
        <div className="resident-chat-person">
          <Avatar initials="EP" size="small" label="Elisa Pereira" />
          <div>
            <strong>Elisa Pereira</strong>
            <span>Responsável pelo plantão de Maria</span>
          </div>
        </div>
        <div className="shift-response-note">
          <Icon name="clock" size={18} />
          Respondemos durante o plantão (08:00 às 18:00)
        </div>
        <ResidentConversation messages={messages} onSend={onSendMessage} sender="family" />
      </main>
    </>
  )
}

// Mensagens seguidas da família no fim da conversa, ainda sem resposta da equipe.
function pendingFamilyMessages(messages: ResidentMessage[]): string[] {
  const pending: string[] = []
  for (let index = messages.length - 1; index >= 0; index -= 1) {
    if (messages[index].sender !== "family") break
    pending.unshift(messages[index].text)
  }
  return pending
}

function AdminDashboard({
  alertMinutes,
  conversations,
  onAnswerQuestion,
  onReply,
  pendingVideo,
  unansweredQuestions,
  unreadConversations,
  pendingMedicines,
  pendingList,
  overdueThreads,
}: {
  pendingList?: { id: string; medicine: string; dose: string; time: string; minutesLate: number }[]
  overdueThreads?: { resident: string; minutes: number }[]
  pendingMedicines?: number
  alertMinutes: 10 | 15 | 30
  conversations: Record<string, ResidentMessage[]>
  onAnswerQuestion: (question: string, answer: string) => void
  onReply: (resident: string, text: string) => void
  pendingVideo: number
  unansweredQuestions: string[]
  unreadConversations: Record<string, boolean>
}) {
  const overdue =
    overdueThreads ??
    (unreadConversations["João Pereira"] && 18 >= alertMinutes ? [{ resident: "João Pereira", minutes: 18 }] : [])
  const ago = (minutes: number) => (minutes >= 60 ? `há ${Math.floor(minutes / 60)} h ${minutes % 60} min` : `há ${minutes} min`)
  const [selectedAlert, setSelectedAlert] = useState<{
    resident: string
    involved: string
    time: string
    elapsed: string
    status: string
    canReply?: boolean
  } | null>(null)
  const [adminTab, setAdminTab] = useState<"alertas" | "perguntas" | "historico">("alertas")
  const [replying, setReplying] = useState(false)
  const [replyText, setReplyText] = useState("")
  const [replySent, setReplySent] = useState(false)
  const [answeringQuestion, setAnsweringQuestion] = useState<string | null>(null)
  const [answerText, setAnswerText] = useState("")
  const [answerSent, setAnswerSent] = useState(false)
  const closeAlert = useBackDismiss(
    selectedAlert !== null,
    () => {
      setSelectedAlert(null)
      setReplying(false)
      setReplyText("")
      setReplySent(false)
    },
    "admin-alert-detail",
  )
  const closeQuestion = useBackDismiss(
    answeringQuestion !== null,
    () => {
      setAnsweringQuestion(null)
      setAnswerText("")
      setAnswerSent(false)
    },
    "admin-question",
  )

  if (answeringQuestion !== null) {
    return (
      <>
        <TopBar
          eyebrow="Administração da casa"
          title="Responder pergunta"
          avatar="MA"
          onBack={closeQuestion}
        />
        <main className="screen-content admin-screen">
          <div className="alert-details alert-details--page">
            <dl>
              <div><dt>Pergunta de uma família</dt><dd>{answeringQuestion}</dd></div>
            </dl>
            {answerSent ? (
              <>
                <p className="inline-toast" role="status">
                  <Icon name="check" size={18} /> Resposta salva. A assistente já pode usá-la.
                </p>
                <button className="primary-button" onClick={closeQuestion} type="button">
                  Voltar ao painel
                </button>
              </>
            ) : (
              <>
                <label className="admin-field">
                  Sua resposta
                  <textarea
                    onChange={(event) => setAnswerText(event.target.value)}
                    placeholder="Escreva a informação que a assistente deve passar às famílias"
                    rows={4}
                    value={answerText}
                  />
                </label>
                <button
                  className="primary-button"
                  disabled={!answerText.trim()}
                  onClick={() => {
                    onAnswerQuestion(answeringQuestion, answerText.trim())
                    setAnswerSent(true)
                  }}
                  type="button"
                >
                  Salvar resposta
                </button>
              </>
            )}
          </div>
        </main>
      </>
    )
  }

  if (selectedAlert) {
    return (
      <>
        <TopBar
          eyebrow="Administração da casa"
          title="Dados do alerta"
          avatar="MA"
          onBack={closeAlert}
        />
        <main className="screen-content admin-screen">
          <div className="alert-details alert-details--page">
            <dl>
              {selectedAlert.resident && <div><dt>Residente</dt><dd>{selectedAlert.resident}</dd></div>}
              <div><dt>Envolvidos</dt><dd>{selectedAlert.involved}</dd></div>
              {selectedAlert.time && <div><dt>Horário</dt><dd>{selectedAlert.time}</dd></div>}
              <div><dt>Tempo</dt><dd>{selectedAlert.elapsed}</dd></div>
              <div><dt>Status</dt><dd>{replySent ? "Respondida pela administração" : selectedAlert.status}</dd></div>
            </dl>
            {selectedAlert.canReply ? (
              <>
                <div className="alert-message">
                  <strong>Mensagem da família</strong>
                  {pendingFamilyMessages(conversations[selectedAlert.resident] ?? []).map((text, index) => (
                    <p key={`${text}-${index}`}>{text}</p>
                  ))}
                </div>
                {replySent ? (
                  <p className="inline-toast" role="status">
                    <Icon name="check" size={18} /> Resposta enviada. A família já pode ver.
                  </p>
                ) : replying ? (
                  <>
                    <label className="admin-field">
                      Sua resposta
                      <textarea
                        onChange={(event) => setReplyText(event.target.value)}
                        placeholder="Escreva a resposta para a família"
                        rows={4}
                        value={replyText}
                      />
                    </label>
                    <button
                      className="primary-button"
                      disabled={!replyText.trim()}
                      onClick={() => {
                        onReply(selectedAlert.resident, replyText.trim())
                        setReplySent(true)
                      }}
                      type="button"
                    >
                      Enviar resposta
                    </button>
                  </>
                ) : (
                  <button className="primary-button" onClick={() => setReplying(true)} type="button">
                    <Icon name="chat" /> Responder à família
                  </button>
                )}
              </>
            ) : null}
            <p><Icon name="lock" size={18} />
              {selectedAlert.canReply
                ? "A administração só acessa o conteúdo de mensagens que ficaram sem resposta acima do tempo configurado."
                : "A administração vê apenas informações do alerta. O nome do residente só aparece em medicamentos já administrados."}
            </p>
          </div>
        </main>
      </>
    )
  }

  return (
    <>
      <TopBar eyebrow="Administração da casa" title="Painel de hoje" avatar="MA" />
      <main className="screen-content admin-screen">
        <section className="admin-summary-grid">
          <article className="admin-summary-card admin-summary-card--pending">
            <span><Icon name="medicine" /></span>
            <div><h2>Medicamentos aguardando administração: <strong>{pendingMedicines ?? 3}</strong></h2></div>
            <small>Aguardando a equipe de plantão</small>
          </article>
          {!supabaseConfigured && (
          <article className="admin-summary-card">
            <span><Icon name="clock" /></span>
            <div><h2>Sem registro há mais de 3 horas: <strong>2</strong></h2></div>
            <small>Ana Lourdes · Roberto Santos</small>
          </article>
          )}
          <article className="admin-summary-card admin-summary-card--alert">
            <span><Icon name="chat" /></span>
            <div><h2>Mensagens sem resposta: <strong>{overdue.length}</strong></h2></div>
            <small>{overdue.length > 0 ? overdue.map((item) => `${item.resident} · ${ago(item.minutes)}`).join(" · ") : "Nenhuma acima do tempo configurado"}</small>
          </article>
          <article className="admin-summary-card">
            <span><Icon name="video" /></span>
            <div><h2>Pedidos de videochamada: <strong>{pendingVideo}</strong></h2></div>
            <small>{pendingVideo > 0 ? "Aguardando resposta da equipe" : "Nenhum pedido pendente"}</small>
          </article>
        </section>

        <div className="tab-switch tab-switch--three" role="group" aria-label="Seções do painel">
          {([
            ["alertas", "Alertas"],
            ["perguntas", `Perguntas (${unansweredQuestions.length})`],
            ["historico", "Histórico"],
          ] as const).map(([value, label]) => (
            <button aria-pressed={adminTab === value} key={value} onClick={() => setAdminTab(value)} type="button">
              {label}
            </button>
          ))}
        </div>

        {adminTab === "alertas" && (
        <section className="admin-section">
          <div className="admin-section__title"><h2>Alertas</h2><span>Somente para consulta</span></div>
          <div className="admin-alert-list">
            {overdue.map((item) => (
              <article key={item.resident}>
                <span className="admin-alert-icon"><Icon name="chat" /></span>
                <div><strong>Mensagem da família de {item.resident}</strong><small>Sem resposta {ago(item.minutes)}</small></div>
                <button
                  onClick={() =>
                    setSelectedAlert({
                      resident: item.resident,
                      involved: supabaseConfigured ? "Família e equipe de plantão" : "Paulo Pereira e Elisa Pereira",
                      time: supabaseConfigured ? "" : "14:42",
                      elapsed: ago(item.minutes),
                      status: "Aguardando resposta",
                      canReply: true,
                    })
                  }
                  type="button"
                >
                  Ver
                </button>
              </article>
            ))}
            {overdue.length === 0 && supabaseConfigured && (pendingList ?? []).length === 0 && (
              <p className="video-empty">Nenhum alerta no momento.</p>
            )}
            {supabaseConfigured && (pendingList ?? []).map((item) => (
              <article key={item.id}>
                <span className="admin-alert-icon admin-alert-icon--pending"><Icon name="clock" /></span>
                <div>
                  <strong>{item.medicine} {item.dose} aguardando administração</strong>
                  <small>Prevista para {item.time} · {item.minutesLate > 0 ? ago(item.minutesLate) : "ainda dentro do horário"}</small>
                </div>
                <button
                  onClick={() =>
                    setSelectedAlert({
                      resident: "",
                      involved: "Equipe de plantão",
                      time: item.time,
                      elapsed: item.minutesLate > 0 ? ago(item.minutesLate) : "dentro do horário",
                      status: `${item.medicine} ${item.dose} · aguardando administração`,
                    })
                  }
                  type="button"
                >
                  Ver
                </button>
              </article>
            ))}
            {!supabaseConfigured && (
            <article>
              <span className="admin-alert-icon admin-alert-icon--pending"><Icon name="clock" /></span>
              <div><strong>Medicamento aguardando administração</strong><small>Prevista para 14:00 · há 20 min</small></div>
              <button
                onClick={() =>
                  setSelectedAlert({
                    resident: "",
                    involved: "Elisa Pereira (plantão)",
                    time: "14:00",
                    elapsed: "há 20 min",
                    status: "Aguardando administração",
                  })
                }
                type="button"
              >
                Ver
              </button>
            </article>
            )}
          </div>
        </section>
        )}

        {adminTab === "historico" && (
        <section className="admin-section">
          {supabaseConfigured ? (
            <p className="video-empty">O histórico de alterações aparece aqui.</p>
          ) : (<>
          <div className="admin-section__title"><h2>Histórico de edições</h2></div>
          <div className="admin-history">
            <p><Icon name="profile" /><span><strong>Elisa Pereira</strong> corrigiu o horário da Metformina de Maria Silva (12:00 → 12:10) <small>às 12:40</small></span></p>
            <p><Icon name="profile" /><span><strong>Elisa Pereira</strong> marcou a oficina de pintura de Maria Silva como Realizada <small>às 11:05</small></span></p>
          </div>
          </>)}
        </section>
        )}

        {adminTab === "perguntas" && (
        <section className="admin-section">
          <div className="admin-section__title"><h2>Perguntas sem resposta da assistente</h2></div>
          <div className="unanswered-list">
            {unansweredQuestions.length === 0 && (
              <p className="video-empty">Nenhuma pergunta sem resposta.</p>
            )}
            {unansweredQuestions.map((question, index) => (
              <article key={`${question}-${index}`}>
                <div><Icon name="info" /><span>{question}</span></div>
                <button onClick={() => setAnsweringQuestion(question)} type="button">Responder</button>
              </article>
            ))}
          </div>
        </section>
        )}

        <p className="admin-readonly-note">
          <Icon name="lock" size={18} />
          A administração acompanha os alertas, mas não edita registros de saúde.
        </p>
      </main>
    </>
  )
}

type RegistrationType = "residents" | "caregivers" | "families"
type Registration = {
  id: number
  active: boolean
  invite?: "sent"
  data: Record<string, string>
}
type Registrations = Record<RegistrationType, Registration[]>
type ChangeLogEntry = { id: number; at: string; who: string; text: string }
type ConsentInfo = { authorized: boolean; by: string; date: string; validUntil: string }

// Data fictícia "de hoje" usada pelo protótipo (a mesma do resumo da família)
const TODAY_ISO = "2026-06-12"
const consentActive = (info?: ConsentInfo) =>
  Boolean(info?.authorized && (!info.validUntil || info.validUntil >= TODAY_ISO))
const EMPTY_CONSENT: ConsentInfo = { authorized: false, by: "", date: "", validUntil: "" }
type FieldConfig = {
  key: string
  label: string
  kind?: "text" | "email" | "tel" | "cpf" | "date" | "time" | "select" | "textarea" | "checkbox" | "residents"
  options?: string[]
  required?: boolean
  placeholder?: string
  hint?: string
  half?: boolean
}

const REGISTRATION_LABELS: Record<RegistrationType, string> = {
  residents: "Residentes",
  caregivers: "Cuidadores",
  families: "Famílias",
}
const REGISTRATION_SINGULAR: Record<RegistrationType, string> = {
  residents: "residente",
  caregivers: "cuidador",
  families: "familiar",
}

const REGISTRATION_FIELDS: Record<RegistrationType, FieldConfig[]> = {
  residents: [
    { key: "name", label: "Nome completo", required: true },
    { key: "birthDate", label: "Data de nascimento", kind: "date", half: true },
    { key: "room", label: "Quarto", required: true, placeholder: "Ex.: Quarto 12", half: true },
    { key: "admissionDate", label: "Data de entrada na casa", kind: "date" },
    {
      key: "cpf",
      label: "CPF (opcional)",
      kind: "cpf",
      placeholder: "000.000.000-00",
      hint: "Dado sensível: preencha só se a casa precisar. No protótipo, use apenas números fictícios.",
    },
    { key: "address", label: "Endereço de origem", placeholder: "Rua, número, bairro, cidade" },
    { key: "emergencyName", label: "Contato de emergência (nome)" },
    { key: "emergencyPhone", label: "Contato de emergência (telefone)", kind: "tel" },
    {
      key: "notes",
      label: "Observações administrativas",
      kind: "textarea",
      hint: "Somente dados administrativos. Informações de saúde ficam com a equipe.",
    },
  ],
  caregivers: [
    { key: "name", label: "Nome completo", required: true },
    { key: "email", label: "E-mail de acesso", kind: "email", required: true },
    { key: "phone", label: "Telefone", kind: "tel", required: true },
    {
      key: "role",
      label: "Função",
      kind: "select",
      options: ["Cuidador(a)", "Técnico(a) de enfermagem", "Enfermeiro(a)", "Coordenação"],
    },
    {
      key: "accessLevel",
      label: "Nível de acesso no app",
      kind: "select",
      options: ["Cuidador", "Coordenação"],
      hint: "Cuidador registra e responde às famílias. Coordenação também aprova relatórios e vê o histórico de alterações.",
    },
    { key: "shift", label: "Turno", kind: "select", options: ["Diurno", "Noturno", "Outro"], half: true },
    { key: "professionalId", label: "Registro profissional", placeholder: "Ex.: COREN", half: true },
    { key: "startTime", label: "Início do plantão", kind: "time", half: true },
    { key: "endTime", label: "Fim do plantão", kind: "time", half: true },
    { key: "admissionDate", label: "Data de admissão", kind: "date" },
    {
      key: "cpf",
      label: "CPF (opcional)",
      kind: "cpf",
      placeholder: "000.000.000-00",
      hint: "Dado sensível: preencha só se a casa precisar. No protótipo, use apenas números fictícios.",
    },
    { key: "address", label: "Endereço", placeholder: "Rua, número, bairro, cidade" },
    { key: "notes", label: "Observações", kind: "textarea" },
  ],
  families: [
    { key: "name", label: "Nome completo", required: true },
    { key: "email", label: "E-mail de acesso", kind: "email", required: true },
    { key: "phone", label: "Telefone", kind: "tel", required: true },
    {
      key: "relationship",
      label: "Parentesco",
      kind: "select",
      options: ["Filho", "Filha", "Cônjuge", "Neto", "Neta", "Irmão", "Irmã", "Sobrinho", "Sobrinha", "Outro"],
    },
    { key: "residentIds", label: "Residentes vinculados", kind: "residents", required: true, hint: "A família enxerga somente os residentes marcados aqui." },
    {
      key: "cpf",
      label: "CPF (opcional)",
      kind: "cpf",
      placeholder: "000.000.000-00",
      hint: "Dado sensível: preencha só se a casa precisar. No protótipo, use apenas números fictícios.",
    },
    { key: "address", label: "Endereço", placeholder: "Rua, número, bairro, cidade" },
    { key: "primaryContact", label: "Contato principal de emergência", kind: "checkbox" },
    { key: "notes", label: "Observações", kind: "textarea" },
  ],
}

const INITIAL_REGISTRATIONS: Record<RegistrationType, Registration[]> = {
  residents: [
    { id: 1, active: true, data: { name: "Maria Silva", birthDate: "1941-03-14", room: "Quarto 12", admissionDate: "2024-02-05", address: "Rua das Acácias, 120, Vila Mariana, São Paulo", emergencyName: "Carla Souza", emergencyPhone: "(11) 91234-5678", notes: "" } },
    { id: 2, active: true, data: { name: "João Pereira", birthDate: "1938-09-02", room: "Quarto 08", admissionDate: "2023-11-20", address: "Av. Brasil, 455, Santo Amaro, São Paulo", emergencyName: "Paulo Pereira", emergencyPhone: "(11) 98888-1122", notes: "" } },
    { id: 3, active: true, data: { name: "Ana Lourdes", birthDate: "1945-12-21", room: "Quarto 15", admissionDate: "2025-06-10", address: "Rua do Sol, 78, Jabaquara, São Paulo", emergencyName: "Beatriz Alves", emergencyPhone: "(11) 97777-3344", notes: "" } },
    { id: 4, active: true, data: { name: "Roberto Santos", birthDate: "1936-07-30", room: "Quarto 03", admissionDate: "2022-08-15", address: "Rua Verde, 32, Saúde, São Paulo", emergencyName: "Rui Santos", emergencyPhone: "(11) 96666-5566", notes: "" } },
  ],
  caregivers: [
    { id: 1, active: true, data: { name: "Elisa Pereira", email: "equipe@recantodolar.com", phone: "(11) 95555-0001", role: "Cuidador(a)", shift: "Diurno", professionalId: "", startTime: "08:00", endTime: "18:00", admissionDate: "2023-03-01", address: "Rua das Flores, 90, São Paulo", notes: "" } },
    { id: 2, active: true, data: { name: "Marcos Lima", email: "marcos@recantodolar.com", phone: "(11) 95555-0002", role: "Técnico(a) de enfermagem", shift: "Noturno", professionalId: "COREN-SP 000000", startTime: "18:00", endTime: "06:00", admissionDate: "2024-01-15", address: "Av. Central, 300, São Paulo", notes: "" } },
  ],
  families: [
    { id: 1, active: true, data: { name: "Carla Souza", email: "familiar@recantodolar.com", phone: "(11) 91234-5678", relationship: "Filha", residentIds: "1", address: "Rua Azul, 15, São Paulo", primaryContact: "sim", notes: "" } },
    { id: 2, active: true, data: { name: "Paulo Pereira", email: "paulo@email.com", phone: "(11) 98888-1122", relationship: "Filho", residentIds: "2", address: "Rua Verde, 200, São Paulo", primaryContact: "sim", notes: "" } },
    { id: 3, active: true, data: { name: "Beatriz Alves", email: "beatriz@email.com", phone: "(11) 97777-3344", relationship: "Neta", residentIds: "3", address: "Rua Alegre, 61, São Paulo", primaryContact: "sim", notes: "" } },
    { id: 4, active: true, data: { name: "Rui Santos", email: "rui@email.com", phone: "(11) 96666-5566", relationship: "Irmão", residentIds: "4", address: "Rua Nova, 12, São Paulo", primaryContact: "sim", notes: "" } },
  ],
}

function formatPhone(value: string) {
  const digits = value.replace(/\D/g, "").slice(0, 11)
  if (digits.length <= 2) return digits
  if (digits.length <= 6) return `(${digits.slice(0, 2)}) ${digits.slice(2)}`
  if (digits.length <= 10) return `(${digits.slice(0, 2)}) ${digits.slice(2, 6)}-${digits.slice(6)}`
  return `(${digits.slice(0, 2)}) ${digits.slice(2, 7)}-${digits.slice(7)}`
}
function formatCpf(value: string) {
  const digits = value.replace(/\D/g, "").slice(0, 11)
  if (digits.length <= 3) return digits
  if (digits.length <= 6) return `${digits.slice(0, 3)}.${digits.slice(3)}`
  if (digits.length <= 9) return `${digits.slice(0, 3)}.${digits.slice(3, 6)}.${digits.slice(6)}`
  return `${digits.slice(0, 3)}.${digits.slice(3, 6)}.${digits.slice(6, 9)}-${digits.slice(9)}`
}
const INITIAL_LOG: ChangeLogEntry[] = [
  { id: 2, at: "ontem às 16:40", who: "Marta Andrade", text: "registrou autorização de imagem de Maria Silva (até 05/02/2027)" },
  { id: 1, at: "ontem às 16:35", who: "Marta Andrade", text: "atualizou os dados de contato de Elisa Pereira" },
]
function formatDateBr(value?: string) {
  if (!value) return ""
  const [year, month, day] = value.split("-")
  return year && month && day ? `${day}/${month}/${year}` : value
}

function AdminRegistrations({
  records,
  setRecords,
  log,
  setLog,
  imageConsent,
  onSetConsent,
  onResidentAdded,
  onResidentRenamed,
  onResidentRemoved,
}: {
  records: Registrations
  setRecords: (updater: (current: Registrations) => Registrations) => void
  log: ChangeLogEntry[]
  setLog: (updater: (current: ChangeLogEntry[]) => ChangeLogEntry[]) => void
  imageConsent: Record<string, ConsentInfo>
  onSetConsent: (name: string, info: ConsentInfo) => void
  onResidentAdded: (name: string) => void
  onResidentRenamed: (oldName: string, newName: string) => void
  onResidentRemoved: (name: string) => void
}) {
  type FormState = { mode: "new" } | { mode: "edit"; id: number }
  type Confirmation = { record: Registration; action: "toggle" | "delete" }

  const [type, setType] = useState<RegistrationType>("residents")
  const [query, setQuery] = useState("")
  const [form, setForm] = useState<FormState | null>(null)
  const [draft, setDraft] = useState<Record<string, string>>({})
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [openMenuId, setOpenMenuId] = useState<number | null>(null)
  const [confirmation, setConfirmation] = useState<Confirmation | null>(null)
  const [discardFormConfirm, setDiscardFormConfirm] = useState(false)
  const [notice, setNotice] = useState("")
  const [showHistory, setShowHistory] = useState(false)
  const [inviteDialog, setInviteDialog] = useState<{ name: string; email: string } | null>(null)
  const [consentFor, setConsentFor] = useState<Registration | null>(null)
  const [consentDraft, setConsentDraft] = useState<ConsentInfo>(EMPTY_CONSENT)
  const [consentError, setConsentError] = useState("")

  const addLog = (text: string) =>
    setLog((current) => [{ id: Date.now() + Math.random(), at: `hoje às ${nowTime()}`, who: "Marta Andrade", text }, ...current])

  useEffect(() => {
    if (!notice) return
    const timer = window.setTimeout(() => setNotice(""), 3500)
    return () => window.clearTimeout(timer)
  }, [notice])

  const fields = REGISTRATION_FIELDS[type]
  const idsOf = (value?: string) => (value ?? "").split(",").filter(Boolean)
  const familiesOf = (residentId: number) =>
    records.families.filter((item) => idsOf(item.data.residentIds).includes(String(residentId)))
  const editing = form?.mode === "edit" ? records[type].find((item) => item.id === form.id) : undefined
  const buildDraft = (record?: Registration): Record<string, string> => {
    const base: Record<string, string> = {}
    fields.forEach((field) => {
      base[field.key] =
        record?.data[field.key] ??
        (field.kind === "residents" ? String(records.residents[0]?.id ?? "") : field.kind === "select" ? field.options![0] : "")
    })
    if (!record && type === "caregivers") {
      base.startTime = "08:00"
      base.endTime = "18:00"
    }
    return base
  }
  const formHasChanges = form !== null && JSON.stringify(draft) !== JSON.stringify(buildDraft(editing))

  const summaryOf = (record: Registration) => {
    const data = record.data
    if (type === "residents") {
      const family = familiesOf(record.id).map((item) => `${item.data.name}, ${item.data.relationship.toLowerCase()}`)
      return [data.room, family.length ? `Família: ${family.join(", ")}` : "Sem família vinculada"]
    }
    if (type === "caregivers") {
      return [data.phone, `${data.role} · ${data.shift}${data.startTime ? ` · ${data.startTime} às ${data.endTime}` : ""}`]
    }
    const linkedNames = idsOf(data.residentIds)
      .map((id) => records.residents.find((item) => String(item.id) === id)?.data.name)
      .filter(Boolean)
    return [data.phone, linkedNames.length ? `${data.relationship} de ${linkedNames.join(" e ")}` : "Sem residente vinculado"]
  }

  const openForm = (next: FormState) => {
    const record = next.mode === "edit" ? records[type].find((item) => item.id === next.id) : undefined
    setDraft(buildDraft(record))
    setErrors({})
    setForm(next)
  }
  const closeMenuSilently = () => {
    window.history.replaceState({ screen: window.history.state?.screen ?? "admin-registers" }, "", window.location.href)
    setOpenMenuId(null)
  }

  const requestCloseForm = () => {
    if (discardFormConfirm) setDiscardFormConfirm(false)
    else if (formHasChanges) setDiscardFormConfirm(true)
    else setForm(null)
  }
  const closeForm = useBackDismiss(form !== null, requestCloseForm, "admin-registration-form")
  const closeDiscardForm = useBackDismiss(discardFormConfirm, () => setDiscardFormConfirm(false), "discard-registration-form")
  const closeMenu = useBackDismiss(openMenuId !== null, () => setOpenMenuId(null), "registration-menu")
  const closeConfirmation = useBackDismiss(confirmation !== null, () => setConfirmation(null), "registration-confirmation")

  const validate = () => {
    const found: Record<string, string> = {}
    fields.forEach((field) => {
      const value = (draft[field.key] ?? "").trim()
      if (field.required && !value) found[field.key] = "Preencha este campo."
    })
    if (draft.email && !found.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(draft.email.trim())) {
      found.email = "Digite um e-mail válido."
    }
    if (draft.email && !found.email && type !== "residents") {
      const duplicated = [...records.caregivers, ...records.families].some(
        (item) =>
          item.data.email.toLowerCase() === draft.email.trim().toLowerCase() &&
          !(editing && item.id === editing.id && records[type].includes(item)),
      )
      if (duplicated) found.email = "Já existe um cadastro com este e-mail."
    }
    if (draft.cpf && draft.cpf.replace(/\D/g, "").length !== 11) found.cpf = "Digite os 11 números do CPF."
    for (const key of ["phone", "emergencyPhone"]) {
      if (draft[key] && draft[key].replace(/\D/g, "").length < 10) found[key] = "Digite o telefone com DDD."
    }
    return found
  }

  const saveForm = () => {
    const found = validate()
    setErrors(found)
    if (Object.keys(found).length > 0) return
    const clean: Record<string, string> = {}
    Object.keys(draft).forEach((key) => (clean[key] = draft[key].trim()))
    if (editing) {
      const oldName = editing.data.name
      setRecords((current) => ({
        ...current,
        [type]: current[type].map((item) => (item.id === editing.id ? { ...item, data: clean } : item)),
      }))
      if (type === "residents" && oldName !== clean.name) onResidentRenamed(oldName, clean.name)
      const changed = fields.filter((field) => (editing.data[field.key] ?? "") !== (clean[field.key] ?? "")).map((field) => field.label.replace(" (opcional)", "").toLowerCase())
      if (changed.length > 0) addLog(`editou ${changed.join(", ")} de ${clean.name}`)
      setNotice(`Dados de ${clean.name} atualizados.`)
    } else {
      const needsInvite = type !== "residents"
      setRecords((current) => ({
        ...current,
        [type]: [...current[type], { id: Date.now(), active: true, invite: needsInvite ? "sent" : undefined, data: clean }],
      }))
      if (type === "residents") onResidentAdded(clean.name)
      addLog(`cadastrou ${REGISTRATION_SINGULAR[type]} ${clean.name}${needsInvite ? " e enviou o convite de acesso" : ""}`)
      if (needsInvite) setInviteDialog({ name: clean.name, email: clean.email })
      else setNotice(`${clean.name} cadastrado(a).`)
    }
    window.history.replaceState({ screen: window.history.state?.screen ?? "admin-registers" }, "", window.location.href)
    setForm(null)
  }

  const applyConfirmation = () => {
    if (!confirmation) return
    const { record, action } = confirmation
    if (action === "toggle") {
      setRecords((current) => ({
        ...current,
        [type]: current[type].map((item) => (item.id === record.id ? { ...item, active: !item.active } : item)),
      }))
      const done = record.active ? (type === "residents" ? "arquivou" : "desativou o acesso de") : type === "residents" ? "reativou" : "reativou o acesso de"
      addLog(`${done} ${record.data.name}`)
      setNotice(record.active ? `${record.data.name} ${type === "residents" ? "arquivado(a)" : "teve o acesso desativado"}.` : `${record.data.name} reativado(a).`)
    } else {
      setRecords((current) => ({
        ...current,
        [type]: current[type].filter((item) => item.id !== record.id),
        families:
          type === "residents"
            ? current.families.map((item) => ({
                ...item,
                data: { ...item.data, residentIds: idsOf(item.data.residentIds).filter((id) => id !== String(record.id)).join(",") },
              }))
            : current.families,
      }))
      if (type === "residents") onResidentRemoved(record.data.name)
      // anonimização: registros anteriores deixam de citar o nome da pessoa excluída
      setLog((current) =>
        [
          { id: Date.now(), at: `hoje às ${nowTime()}`, who: "Marta Andrade", text: `excluiu um cadastro de ${REGISTRATION_SINGULAR[type]} (dados pessoais apagados)` },
          ...current.map((entry) => ({ ...entry, text: entry.text.split(record.data.name).join("[cadastro excluído]") })),
        ],
      )
      setNotice("Cadastro excluído e dados pessoais apagados.")
    }
    if (form !== null) {
      // exclusão feita de dentro do formulário: fecha confirmação e formulário e volta duas entradas do histórico
      setConfirmation(null)
      setForm(null)
      window.setTimeout(() => window.history.go(-2), 50)
    } else {
      closeConfirmation()
    }
  }

  const consentText = (info?: ConsentInfo) => {
    if (!info?.authorized) return "Uso de imagem: não autorizado"
    if (!consentActive(info)) return `Uso de imagem: autorização vencida em ${formatDateBr(info.validUntil)}`
    return `Uso de imagem: autorizado ${info.validUntil ? `até ${formatDateBr(info.validUntil)}` : "sem prazo"} (por ${info.by})`
  }

  const visibleRecords = records[type].filter((record) =>
    record.data.name.toLowerCase().includes(query.toLowerCase()),
  )

  const renderField = (field: FieldConfig) => {
    const value = draft[field.key] ?? ""
    const change = (next: string) => {
      setDraft((current) => ({ ...current, [field.key]: next }))
      if (errors[field.key]) setErrors((current) => ({ ...current, [field.key]: "" }))
    }
    if (field.kind === "residents") {
      const ids = idsOf(value)
      return (
        <div className="admin-field" key={field.key}>
          <span>{field.label} *</span>
          <div className="admin-check-group" role="group" aria-label={field.label}>
            {records.residents
              .filter((item) => item.active || ids.includes(String(item.id)))
              .map((item) => (
                <label className="admin-check" key={item.id}>
                  <input
                    checked={ids.includes(String(item.id))}
                    onChange={(event) =>
                      change(
                        (event.target.checked ? [...ids, String(item.id)] : ids.filter((id) => id !== String(item.id))).join(","),
                      )
                    }
                    type="checkbox"
                  />
                  <span>{item.data.name}</span>
                </label>
              ))}
          </div>
          {field.hint && <small>{field.hint}</small>}
          {errors[field.key] && <em role="alert">{errors[field.key]}</em>}
        </div>
      )
    }
    if (field.kind === "checkbox") {
      return (
        <label className="admin-check" key={field.key}>
          <input checked={value === "sim"} onChange={(event) => change(event.target.checked ? "sim" : "")} type="checkbox" />
          <span>{field.label}</span>
        </label>
      )
    }
    let control
    if (field.kind === "select") {
      control = (
        <select onChange={(event) => change(event.target.value)} value={value}>
          {field.options!.map((option) => <option key={option}>{option}</option>)}
        </select>
      )
    } else if (field.kind === "textarea") {
      control = <textarea onChange={(event) => change(event.target.value)} rows={3} value={value} />
    } else {
      control = (
        <input
          aria-invalid={Boolean(errors[field.key])}
          onChange={(event) =>
            change(field.kind === "tel" ? formatPhone(event.target.value) : field.kind === "cpf" ? formatCpf(event.target.value) : event.target.value)
          }
          placeholder={field.placeholder}
          type={field.kind === "tel" ? "tel" : field.kind === "cpf" ? "text" : field.kind ?? "text"}
          inputMode={field.kind === "cpf" ? "numeric" : undefined}
          value={value}
        />
      )
    }
    return (
      <label className={field.half ? "admin-field admin-field--half" : "admin-field"} key={field.key}>
        {field.label}{field.required ? " *" : ""}
        {control}
        {field.hint && <small>{field.hint}</small>}
        {errors[field.key] && <em role="alert">{errors[field.key]}</em>}
      </label>
    )
  }

  const openConsent = (record: Registration) => {
    const current = imageConsent[record.data.name]
    setConsentDraft(current ?? EMPTY_CONSENT)
    setConsentError("")
    setConsentFor(record)
  }
  const saveConsent = () => {
    if (!consentFor) return
    const name = consentFor.data.name
    if (consentDraft.authorized) {
      if (!consentDraft.by.trim() || !consentDraft.date) {
        setConsentError("Informe quem autorizou e a data da autorização.")
        return
      }
      if (consentDraft.validUntil && consentDraft.validUntil < consentDraft.date) {
        setConsentError("A validade não pode ser anterior à data da autorização.")
        return
      }
    }
    const info = consentDraft.authorized ? { ...consentDraft, by: consentDraft.by.trim() } : { ...EMPTY_CONSENT }
    onSetConsent(name, info)
    addLog(
      info.authorized
        ? `registrou autorização de imagem de ${name}${info.validUntil ? ` (até ${formatDateBr(info.validUntil)})` : " (sem prazo)"}`
        : `retirou a autorização de imagem de ${name}`,
    )
    setNotice(info.authorized ? `Autorização de imagem de ${name} registrada.` : `Autorização de imagem de ${name} retirada.`)
    window.history.replaceState({ screen: window.history.state?.screen ?? "admin-registers" }, "", window.location.href)
    setConsentFor(null)
  }
  const closeConsent = useBackDismiss(consentFor !== null, () => setConsentFor(null), "admin-consent-form")
  const closeHistory = useBackDismiss(showHistory, () => setShowHistory(false), "admin-registration-history")

  if (showHistory) {
    return (
      <>
        <TopBar eyebrow="Cadastros" title="Histórico de alterações" avatar="MA" onBack={closeHistory} />
        <main className="screen-content admin-screen">
          <div className="admin-history">
            {log.map((entry) => (
              <p key={entry.id}>
                <Icon name="profile" />
                <span><strong>{entry.who}</strong> {entry.text} <small>{entry.at}</small></span>
              </p>
            ))}
          </div>
          <p className="admin-readonly-note">
            <Icon name="lock" size={18} />
            Quando um cadastro é excluído, o nome dele sai deste histórico e os dados pessoais são apagados.
          </p>
        </main>
      </>
    )
  }

  if (consentFor) {
    const name = consentFor.data.name
    const familyNames = familiesOf(consentFor.id).map((item) => item.data.name)
    return (
      <>
        <TopBar eyebrow="Cadastros · Residentes" title="Autorização de imagem" avatar="MA" onBack={closeConsent} />
        <main className="screen-content admin-screen">
          <section className="admin-new-form admin-new-form--page">
            <p className="consent-resident"><strong>{name}</strong></p>
            <div className="admin-field-grid">
              <label className="admin-check">
                <input
                  checked={consentDraft.authorized}
                  onChange={(event) => setConsentDraft((current) => ({ ...current, authorized: event.target.checked }))}
                  type="checkbox"
                />
                <span>Uso de imagem autorizado (fotos das atividades)</span>
              </label>
              {consentDraft.authorized && (
                <>
                  <label className="admin-field">
                    Autorizado por *
                    <input
                      list="consent-people"
                      onChange={(event) => setConsentDraft((current) => ({ ...current, by: event.target.value }))}
                      placeholder="Nome do responsável"
                      value={consentDraft.by}
                    />
                    <datalist id="consent-people">
                      {[name, ...familyNames].map((person) => <option key={person} value={person} />)}
                    </datalist>
                  </label>
                  <label className="admin-field admin-field--half">
                    Data *
                    <input onChange={(event) => setConsentDraft((current) => ({ ...current, date: event.target.value }))} type="date" value={consentDraft.date} />
                  </label>
                  <label className="admin-field admin-field--half">
                    Válida até
                    <input onChange={(event) => setConsentDraft((current) => ({ ...current, validUntil: event.target.value }))} type="date" value={consentDraft.validUntil} />
                  </label>
                  <p className="admin-field"><small>Sem data de validade, a autorização vale até ser retirada. Vencida, a pessoa deixa de poder ser marcada nas fotos.</small></p>
                </>
              )}
            </div>
            {consentError && <p className="admin-form-error" role="alert">{consentError}</p>}
            <button className="primary-button" onClick={saveConsent} type="button">Salvar autorização</button>
          </section>
        </main>
      </>
    )
  }

  if (form) {
    return (
      <>
        <TopBar
          eyebrow={`Cadastros · ${REGISTRATION_LABELS[type]}`}
          title={editing ? `Editar ${REGISTRATION_SINGULAR[type]}` : `Novo ${REGISTRATION_SINGULAR[type]}`}
          avatar="MA"
          onBack={closeForm}
        />
        <main className="screen-content admin-screen">
          <section className="admin-new-form admin-new-form--page">
            <div className="admin-field-grid">{fields.map(renderField)}</div>
            {Object.values(errors).some(Boolean) && (
              <p className="admin-form-error" role="alert">Revise os campos destacados antes de salvar.</p>
            )}
            <button className="primary-button" onClick={saveForm} type="button">
              {editing ? "Salvar alterações" : "Salvar cadastro"}
            </button>
            {editing && (
              <button
                className="danger-button"
                onClick={() => setConfirmation({ record: editing, action: "delete" })}
                type="button"
              >
                Excluir cadastro
              </button>
            )}
            <p className="admin-readonly-note">
              <Icon name="lock" size={18} />
              Dados pessoais protegidos pela LGPD. Ficam visíveis apenas para a administração.
            </p>
          </section>
        </main>
        {discardFormConfirm && (
          <div className="confirmation-backdrop" onClick={closeDiscardForm} role="presentation">
            <section className="confirmation-dialog" onClick={(event) => event.stopPropagation()} role="dialog" aria-modal="true">
              <span className="confirmation-icon"><Icon name="info" /></span>
              <h2>Descartar alterações?</h2>
              <p>As mudanças feitas neste formulário não serão salvas.</p>
              <div>
                <button onClick={closeDiscardForm} type="button">Continuar editando</button>
                <button
                  onClick={() => {
                    setDiscardFormConfirm(false)
                    setForm(null)
                  }}
                  type="button"
                >
                  Descartar
                </button>
              </div>
            </section>
          </div>
        )}
        {confirmation && renderConfirmation()}
      </>
    )
  }

  function renderConfirmation() {
    if (!confirmation) return null
    const { record, action } = confirmation
    const name = record.data.name
    const linked = type === "residents" ? familiesOf(record.id).length : 0
    const isResident = type === "residents"
    let title = ""
    let text = ""
    let button = ""
    if (action === "delete") {
      title = `Excluir ${name}?`
      text = isResident
        ? `Os dados pessoais serão apagados${linked ? ` e ${linked === 1 ? "a família vinculada perde" : "as famílias vinculadas perdem"} o acesso a este residente` : ""}. Os registros de cuidado já feitos continuam no histórico, sem identificação do nome. Esta ação não pode ser desfeita. Para apenas esconder o cadastro, use Arquivar.`
        : type === "caregivers"
          ? "Os dados pessoais e o acesso serão apagados. Os registros já feitos continuam no histórico da casa, sem identificação do nome. Esta ação não pode ser desfeita. Para apenas bloquear a entrada, use Desativar acesso."
          : "Os dados pessoais e o acesso serão apagados. Esta ação não pode ser desfeita. Para apenas bloquear a entrada, use Desativar acesso."
      button = "Excluir"
    } else if (record.active) {
      title = isResident ? `Arquivar ${name}?` : `Desativar o acesso de ${name}?`
      text = isResident ? "O residente deixará de aparecer nos cadastros ativos." : `${name} deixará de entrar no app.`
      button = isResident ? "Arquivar" : "Desativar"
    } else {
      title = `Reativar ${name}?`
      text = isResident ? "O residente voltará a aparecer nos cadastros ativos." : `${name} poderá entrar no app novamente.`
      button = "Reativar"
    }
    return (
      <div className="confirmation-backdrop" onClick={closeConfirmation} role="presentation">
        <section className="confirmation-dialog" onClick={(event) => event.stopPropagation()} role="dialog" aria-modal="true" aria-labelledby="confirmation-title">
          <span className="confirmation-icon"><Icon name="info" /></span>
          <h2 id="confirmation-title">{title}</h2>
          <p>{text}</p>
          <div>
            <button onClick={closeConfirmation} type="button">Cancelar</button>
            <button className={action === "delete" ? "confirmation-danger" : ""} onClick={applyConfirmation} type="button">{button}</button>
          </div>
        </section>
      </div>
    )
  }

  return (
    <>
      <TopBar eyebrow="Administração da casa" title="Cadastros" avatar="MA" />
      <main className="screen-content admin-screen">
        <div className="registration-tabs">
          {(Object.keys(REGISTRATION_LABELS) as RegistrationType[]).map((item) => (
            <button
              aria-pressed={type === item}
              key={item}
              onClick={() => {
                setType(item)
                setQuery("")
              }}
              type="button"
            >
              {REGISTRATION_LABELS[item]}
            </button>
          ))}
        </div>
        <div className="search-box">
          <Icon name="search" />
          <input
            aria-label={`Buscar em ${REGISTRATION_LABELS[type]}`}
            onChange={(event) => setQuery(event.target.value)}
            placeholder={`Buscar ${REGISTRATION_LABELS[type].toLowerCase()}...`}
            value={query}
          />
        </div>
        <div className="admin-section__title">
          <h2>{REGISTRATION_LABELS[type]}</h2>
          <button className="admin-new-button" onClick={() => openForm({ mode: "new" })} type="button">
            <Icon name="plus" size={18} /> Novo
          </button>
        </div>
        <button className="outline-button history-link" onClick={() => setShowHistory(true)} type="button">
          Histórico de alterações
        </button>
        {notice && <p className="inline-toast" role="status"><Icon name="check" size={18} /> {notice}</p>}
        {visibleRecords.length === 0 && <p className="video-empty">Nenhum cadastro encontrado.</p>}
        <div className="registration-list">
          {visibleRecords.map((record, index) => {
            const [line1, line2] = summaryOf(record)
            const name = record.data.name
            return (
              <article className={record.active ? "" : "registration-item--inactive"} key={record.id}>
                <Avatar initials={name.split(" ").map((part) => part[0]).slice(0, 2).join("")} size="small" />
                <div
                  className="registration-item__body"
                  onClick={() => openForm({ mode: "edit", id: record.id })}
                  onKeyDown={(event) => {
                    if (event.key === "Enter") openForm({ mode: "edit", id: record.id })
                  }}
                  role="button"
                  tabIndex={0}
                >
                  <strong>{name}</strong>
                  <span>{type === "residents" ? line1 : record.data.email}</span>
                  <small>{type === "residents" ? line2 : `${line1} · ${line2}`}</small>
                  {type === "residents" && record.data.birthDate && (
                    <small>Nascimento: {formatDateBr(record.data.birthDate)}</small>
                  )}
                  {type === "residents" && (
                    <small className={consentActive(imageConsent[name]) ? "consent-tag consent-tag--yes" : "consent-tag"}>
                      {consentText(imageConsent[name])}
                    </small>
                  )}
                  {record.invite === "sent" && <small className="consent-tag">Convite enviado · aguardando o primeiro acesso</small>}
                  {!record.active && <small>{type === "residents" ? "Residente arquivado" : "Acesso desativado"}</small>}
                </div>
                <div className="registration-menu">
                  {openMenuId === record.id && (
                    <button aria-label="Fechar menu" className="registration-menu__backdrop" onClick={closeMenu} type="button" />
                  )}
                  <button
                    aria-label={`Abrir opções de ${name}`}
                    className="registration-menu__trigger"
                    onClick={() => setOpenMenuId((current) => (current === record.id ? null : record.id))}
                    type="button"
                  >
                    ⋯
                  </button>
                  {openMenuId === record.id && (
                    <div
                      className={
                        index >= visibleRecords.length - 2
                          ? "registration-menu__popover registration-menu__popover--up"
                          : "registration-menu__popover"
                      }
                    >
                      <button
                        className="registration-menu__neutral"
                        onClick={() => {
                          closeMenuSilently()
                          openForm({ mode: "edit", id: record.id })
                        }}
                        type="button"
                      >
                        Editar dados
                      </button>
                      {type === "residents" && (
                        <button
                          className="registration-menu__neutral"
                          onClick={() => {
                            closeMenuSilently()
                            openConsent(record)
                          }}
                          type="button"
                        >
                          Autorização de imagem
                        </button>
                      )}
                      {record.invite === "sent" && (
                        <button
                          className="registration-menu__neutral"
                          onClick={() => {
                            closeMenuSilently()
                            addLog(`reenviou o convite de acesso para ${name}`)
                            setNotice(`Convite reenviado para ${record.data.email}.`)
                          }}
                          type="button"
                        >
                          Reenviar convite
                        </button>
                      )}
                      <button
                        className="registration-menu__neutral"
                        onClick={() => {
                          closeMenuSilently()
                          setConfirmation({ record, action: "toggle" })
                        }}
                        type="button"
                      >
                        {record.active ? (type === "residents" ? "Arquivar residente" : "Desativar acesso") : type === "residents" ? "Reativar residente" : "Reativar acesso"}
                      </button>
                      <button
                        onClick={() => {
                          closeMenuSilently()
                          setConfirmation({ record, action: "delete" })
                        }}
                        type="button"
                      >
                        Excluir cadastro
                      </button>
                    </div>
                  )}
                </div>
              </article>
            )
          })}
        </div>
        {confirmation && renderConfirmation()}
        {inviteDialog && (
          <div className="confirmation-backdrop" onClick={() => setInviteDialog(null)} role="presentation">
            <section className="confirmation-dialog" onClick={(event) => event.stopPropagation()} role="dialog" aria-modal="true">
              <span className="confirmation-icon"><Icon name="check" /></span>
              <h2>Convite enviado</h2>
              <p>
                Enviamos um e-mail para {inviteDialog.email} com um link para {inviteDialog.name} criar a própria senha no primeiro acesso. O link vale por 48 horas, e a administração nunca vê a senha.
              </p>
              <div>
                <button className="confirmation-ok" onClick={() => setInviteDialog(null)} type="button">Entendi</button>
              </div>
            </section>
          </div>
        )}
        {type === "families" && (
          <p className="admin-readonly-note">
            <Icon name="lock" size={18} />
            Cada família enxerga somente o residente vinculado ao seu acesso.
          </p>
        )}
      </main>
    </>
  )
}

function AdminHouse({
  alertMinutes,
  houseInfo,
  onAlertMinutesChange,
  onHouseInfoChange,
  videoConfig,
  videoRequests,
  onVideoConfigChange,
}: {
  videoConfig: VideoConfig
  videoRequests: VideoRequest[]
  onVideoConfigChange: (config: VideoConfig) => void
  alertMinutes: 10 | 15 | 30
  houseInfo: HouseInfo
  onAlertMinutesChange: (minutes: 10 | 15 | 30) => void
  onHouseInfoChange: (info: HouseInfo) => void
}) {
  const [draft, setDraft] = useState(houseInfo)
  const [saved, setSaved] = useState(false)
  const [videoDraft, setVideoDraft] = useState(videoConfig)
  const [videoSaved, setVideoSaved] = useState(false)
  const [houseTab, setHouseTab] = useState<"casa" | "video">("casa")
  const changeVideo = (patch: Partial<VideoConfig>) => {
    setVideoDraft((current) => ({ ...current, ...patch }))
    setVideoSaved(false)
  }
  const slotCount = generateSlots(videoDraft, videoRequests).reduce((sum, day) => sum + day.times.length, 0)

  return (
    <>
      <TopBar eyebrow="Administração da casa" title="Informações da casa" avatar="MA" />
      <main className="screen-content admin-screen admin-screen--house">
        <div className="tab-switch tab-switch--two" role="group" aria-label="Seções da casa">
          <button aria-pressed={houseTab === "casa"} onClick={() => setHouseTab("casa")} type="button">Casa e visitas</button>
          <button aria-pressed={houseTab === "video"} onClick={() => setHouseTab("video")} type="button">Videochamada</button>
        </div>

        {houseTab === "casa" && (
        <section className="admin-house-card">
          <div className="card-heading">
            <span className="feature-icon"><Icon name="home" /></span>
            <div><span>Visível para famílias</span><h2>Casa e visitas</h2></div>
          </div>
          <label>
            Horário de visitas
            <input
              onChange={(event) => {
                setDraft((current) => ({ ...current, visitingHours: event.target.value }))
                setSaved(false)
              }}
              value={draft.visitingHours}
            />
          </label>
          <label>
            Telefone da recepção
            <input
              onChange={(event) => {
                setDraft((current) => ({ ...current, phone: event.target.value }))
                setSaved(false)
              }}
              value={draft.phone}
            />
          </label>
          <label>
            Regras de visita
            <textarea
              onChange={(event) => {
                setDraft((current) => ({ ...current, visitingRules: event.target.value }))
                setSaved(false)
              }}
              value={draft.visitingRules}
            />
          </label>
          <div className="alert-time-setting">
            <span>Alertar quando uma mensagem ficar sem resposta por:</span>
            <div>
              {([10, 15, 30] as const).map((minutes) => (
                <button
                  aria-pressed={alertMinutes === minutes}
                  key={minutes}
                  onClick={() => onAlertMinutesChange(minutes)}
                  type="button"
                >
                  {minutes} min
                </button>
              ))}
            </div>
          </div>
          <button
            className="primary-button"
            onClick={() => {
              onHouseInfoChange({
                ...draft,
                updatedBy: "Marta Andrade",
                updatedAt: `${TODAY_LABEL} às 09:15`,
              })
              setSaved(true)
            }}
            type="button"
          >
            <Icon name="check" />
            {saved ? "Salvo" : "Salvar informações"}
          </button>
          <small>
            Última atualização por {saved ? `Marta Andrade, ${TODAY_LABEL} às 09:15` : `${houseInfo.updatedBy}, ${houseInfo.updatedAt}`}
          </small>
          <p>
            Estas informações aparecem para as famílias, no aviso de emergência e nas
            respostas da assistente.
          </p>
        </section>
        )}

        {houseTab === "video" && (
        <section className="admin-house-card">
          <div className="card-heading">
            <span className="feature-icon"><Icon name="video" /></span>
            <div><span>Visível para famílias</span><h2>Horários de videochamada</h2></div>
          </div>
          <div className="alert-time-setting">
            <span>Dias disponíveis</span>
            <div className="day-toggle-row">
              {WEEKDAY_BUTTONS.map((day) => (
                <button
                  aria-pressed={videoDraft.days.includes(day.idx)}
                  key={day.idx}
                  onClick={() =>
                    changeVideo({
                      days: videoDraft.days.includes(day.idx)
                        ? videoDraft.days.filter((item) => item !== day.idx)
                        : [...videoDraft.days, day.idx],
                    })
                  }
                  type="button"
                >
                  {day.label}
                </button>
              ))}
            </div>
          </div>
          <div className="time-pair">
            <label>
              Início
              <input onChange={(event) => changeVideo({ start: event.target.value })} type="time" value={videoDraft.start} />
            </label>
            <label>
              Fim
              <input onChange={(event) => changeVideo({ end: event.target.value })} type="time" value={videoDraft.end} />
            </label>
          </div>
          <div className="alert-time-setting">
            <span>Duração de cada chamada</span>
            <div>
              {([15, 20, 30] as const).map((minutes) => (
                <button
                  aria-pressed={videoDraft.duration === minutes}
                  key={minutes}
                  onClick={() => changeVideo({ duration: minutes })}
                  type="button"
                >
                  {minutes} min
                </button>
              ))}
            </div>
          </div>
          <div className="alert-time-setting">
            <span>Bloquear datas (feriados, eventos)</span>
            <div className="day-toggle-row day-toggle-row--wrap">
              {futureDays().map((day) => {
                const label = `${day.wd} ${day.n}`
                return (
                  <button
                    aria-pressed={videoDraft.blocked.includes(label)}
                    key={label}
                    onClick={() =>
                      changeVideo({
                        blocked: videoDraft.blocked.includes(label)
                          ? videoDraft.blocked.filter((item) => item !== label)
                          : [...videoDraft.blocked, label],
                      })
                    }
                    type="button"
                  >
                    {label}
                  </button>
                )
              })}
            </div>
          </div>
          <button
            className="primary-button"
            onClick={() => {
              onVideoConfigChange(videoDraft)
              setVideoSaved(true)
            }}
            type="button"
          >
            <Icon name="check" />
            {videoSaved ? "Salvo" : "Salvar horários"}
          </button>
          <small>{slotCount} horários livres nos próximos 7 dias</small>
          <p>
            A família solicita um horário, o cuidador de plantão confirma e acompanha a
            chamada. A administração só define quando as chamadas podem acontecer.
          </p>
        </section>
        )}
      </main>
    </>
  )
}

function Profile({
  account,
  onExit,
  role,
  textSize,
  onTextSizeChange,
  themePreference,
  onThemeChange,
}: {
  account: Account | null
  onExit: () => void
  role: Role
  textSize: TextSize
  onTextSizeChange: (size: TextSize) => void
  themePreference: ThemePreference
  onThemeChange: (theme: ThemePreference) => void
}) {
  const isFamily = role === "family"
  const isTeam = role === "team"
  const fallbackName = isFamily ? "Carla Souza" : isTeam ? "Elisa Pereira" : "Marta Andrade"
  const fallbackEmail = isFamily
    ? "familiar@recantodolar.com"
    : isTeam
      ? "equipe@recantodolar.com"
      : "admin@recantodolar.com"
  const displayName = account?.name || fallbackName
  const displayEmail = account?.email || fallbackEmail
  const userInitials = account?.name
    ? account.name.split(/\s+/).filter(Boolean).slice(0, 2).map((part) => part[0].toUpperCase()).join("")
    : isFamily ? "CS" : isTeam ? "EP" : "MA"
  const [dailySummary, setDailySummary] = useState(true)
  const [teamMessage, setTeamMessage] = useState(true)
  const [profilePage, setProfilePage] = useState<"main" | "text" | "notifications" | "appearance" | "password">("main")
  const [pwCurrent, setPwCurrent] = useState("")
  const [pwNew, setPwNew] = useState("")
  const [pwConfirm, setPwConfirm] = useState("")
  const [pwError, setPwError] = useState("")
  const [pwDone, setPwDone] = useState(false)
  const [pwBusy, setPwBusy] = useState(false)
  const closeProfilePage = useBackDismiss(
    profilePage !== "main",
    () => setProfilePage("main"),
    `profile-${profilePage}`,
  )

  if (profilePage === "text") {
    return (
      <>
        <TopBar avatar={userInitials} eyebrow="Perfil" title="Tamanho do texto" onBack={closeProfilePage} />
        <main className="screen-content profile-content profile-subpage">
          <section className="profile-section">
            <div className="profile-section__title">
              <Icon name="profile" />
              <div><h3>Tamanho do texto</h3><span>Escolha a opção mais confortável.</span></div>
            </div>
            <div className="text-size-options">
              {[
                { value: "normal", label: "Normal" },
                { value: "large", label: "Grande" },
                { value: "xlarge", label: "Muito grande" },
              ].map((option) => (
                <button
                  aria-pressed={textSize === option.value}
                  key={option.value}
                  onClick={() => onTextSizeChange(option.value as TextSize)}
                  type="button"
                >
                  {option.label}
                </button>
              ))}
            </div>
            <div className="text-size-preview">
              <span>Prévia</span>
              <p>Maria está bem e participou das atividades de hoje.</p>
            </div>
          </section>
        </main>
      </>
    )
  }

  if (profilePage === "password") {
    const submitPassword = async (event: FormEvent) => {
      event.preventDefault()
      setPwError("")
      if (pwNew.length < MIN_PASSWORD) return setPwError(`A nova senha precisa ter pelo menos ${MIN_PASSWORD} caracteres.`)
      if (pwNew !== pwConfirm) return setPwError("As duas senhas novas não são iguais.")
      if (pwNew === pwCurrent) return setPwError("A nova senha precisa ser diferente da atual.")
      if (!supabaseConfigured) {
        setPwDone(true)
        return
      }
      setPwBusy(true)
      const result = await changePassword(displayEmail, pwCurrent, pwNew)
      setPwBusy(false)
      if (result.error) setPwError(result.error)
      else setPwDone(true)
    }
    return (
      <>
        <TopBar avatar={userInitials} eyebrow="Perfil" title="Alterar senha" onBack={closeProfilePage} />
        <main className="screen-content profile-content profile-subpage">
          <section className="profile-section">
            <div className="profile-section__title">
              <Icon name="lock" />
              <div><h3>Alterar senha</h3><span>Você mesmo troca a sua senha, sem precisar da administração.</span></div>
            </div>
            {pwDone ? (
              <>
                <p className="inline-toast" role="status">
                  <Icon name="check" size={18} /> Senha alterada com sucesso.
                </p>
                <button className="primary-button" onClick={closeProfilePage} type="button">Voltar ao perfil</button>
              </>
            ) : (
              <form className="admin-field-grid" onSubmit={submitPassword}>
                <label className="admin-field">
                  Senha atual
                  <input autoComplete="current-password" onChange={(event) => setPwCurrent(event.target.value)} required type="password" value={pwCurrent} />
                </label>
                <label className="admin-field">
                  Nova senha
                  <input autoComplete="new-password" onChange={(event) => setPwNew(event.target.value)} required type="password" value={pwNew} />
                  <small>Pelo menos {MIN_PASSWORD} caracteres.</small>
                </label>
                <label className="admin-field">
                  Repita a nova senha
                  <input autoComplete="new-password" onChange={(event) => setPwConfirm(event.target.value)} required type="password" value={pwConfirm} />
                </label>
                {pwError && <p className="login-error" role="alert">{pwError}</p>}
                <button className="primary-button" disabled={pwBusy} type="submit">
                  {pwBusy ? "Salvando..." : "Salvar nova senha"}
                </button>
              </form>
            )}
          </section>
        </main>
      </>
    )
  }

  if (profilePage === "appearance") {
    return (
      <>
        <TopBar avatar={userInitials} eyebrow="Perfil" title="Aparência" onBack={closeProfilePage} />
        <main className="screen-content profile-content profile-subpage">
          <section className="profile-section">
            <div className="profile-section__title">
              <Icon name="moon" />
              <div><h3>Tema do app</h3><span>Escolha o visual mais confortável para você.</span></div>
            </div>
            <div className="text-size-options">
              {[
                { value: "light", label: "Claro" },
                { value: "dark", label: "Escuro" },
                { value: "system", label: "Automático" },
              ].map((option) => (
                <button
                  aria-pressed={themePreference === option.value}
                  key={option.value}
                  onClick={() => onThemeChange(option.value as ThemePreference)}
                  type="button"
                >
                  {option.label}
                </button>
              ))}
            </div>
            <div className="text-size-preview">
              <span>Prévia</span>
              <p>
                {themePreference === "system"
                  ? "O app segue o tema claro ou escuro do seu aparelho."
                  : "Assim ficam os textos e os cartões do app."}
              </p>
            </div>
          </section>
        </main>
      </>
    )
  }

  if (profilePage === "notifications") {
    return (
      <>
        <TopBar avatar={userInitials} eyebrow="Perfil" title="Notificações" onBack={closeProfilePage} />
        <main className="screen-content profile-content profile-subpage">
          <section className="profile-section">
            <div className="profile-section__title">
              <Icon name="bell" />
              <div><h3>Notificações</h3><span>Escolha quais avisos deseja receber.</span></div>
            </div>
            <button
              aria-pressed={dailySummary}
              className="notification-toggle"
              onClick={() => setDailySummary((current) => !current)}
              type="button"
            >
              <span>Resumo do dia disponível</span>
              <i className={dailySummary ? "switch switch--on" : "switch"} />
            </button>
            <button
              aria-pressed={teamMessage}
              className="notification-toggle"
              onClick={() => setTeamMessage((current) => !current)}
              type="button"
            >
              <span>Mensagem nova da equipe</span>
              <i className={teamMessage ? "switch switch--on" : "switch"} />
            </button>
            <div className="notification-example">
              <Icon name="lock" size={18} />
              <div>
                <span>Exemplo na tela bloqueada</span>
                <strong>Você tem uma atualização sobre Maria.</strong>
                <small>Os detalhes de saúde não aparecem na notificação.</small>
              </div>
            </div>
          </section>
        </main>
      </>
    )
  }

  return (
    <>
      <TopBar avatar={userInitials} eyebrow="Recanto do Lar · Sua conta" title="Perfil" />
      <main className="screen-content profile-content">
        <Avatar
          initials={userInitials}
          size="large"
          tone="mint"
          label={displayName}
        />
        <h2>{displayName}</h2>
        <p>{isFamily ? "Familiar responsável" : isTeam ? "Equipe de cuidados" : "Coordenadora"}</p>
        <dl className="profile-details">
          <div>
            <dt>Nome</dt>
            <dd>{displayName}</dd>
          </div>
          <div>
            <dt>E-mail</dt>
            <dd>{displayEmail}</dd>
          </div>
          <div>
            <dt>{isFamily ? "Pessoa acompanhada" : isTeam ? "Horário de trabalho" : "Cargo"}</dt>
            <dd>{isFamily ? "Maria Silva" : isTeam ? "08:00 às 18:00" : "Coordenadora"}</dd>
          </div>
        </dl>
        <section className="profile-card">
          <button
            onClick={() => setProfilePage("text")}
            type="button"
          >
            <span><Icon name="profile" /> Tamanho do texto</span><Icon name="chevron" />
          </button>
          {isFamily && (
            <>
              <button
                onClick={() => setProfilePage("notifications")}
                type="button"
              >
                <span><Icon name="bell" /> Notificações</span><Icon name="chevron" />
              </button>
            </>
          )}
          <button
            onClick={() => setProfilePage("appearance")}
            type="button"
          >
            <span><Icon name="moon" /> Aparência</span><Icon name="chevron" />
          </button>
          <button
            onClick={() => {
              setPwCurrent("")
              setPwNew("")
              setPwConfirm("")
              setPwError("")
              setPwDone(false)
              setProfilePage("password")
            }}
            type="button"
          >
            <span><Icon name="lock" /> Alterar senha</span><Icon name="chevron" />
          </button>
        </section>
        {isTeam && (
          <div className="personal-account-note personal-account-note--profile">
            <Icon name="profile" size={18} />
            Você está registrando com a sua conta pessoal.
          </div>
        )}
        <button className="outline-button" onClick={onExit} type="button">Sair da conta</button>
        <p className="demo-disclaimer demo-disclaimer--profile">Dados fictícios para demonstração</p>
      </main>
    </>
  )
}

/* ===================== Etapas 2, 3 e 4: histórico, fotos e videochamada ===================== */

const DEMO_FUTURE_DAYS = [
  { n: 13, wd: "sáb", idx: 6 },
  { n: 14, wd: "dom", idx: 0 },
  { n: 15, wd: "seg", idx: 1 },
  { n: 16, wd: "ter", idx: 2 },
  { n: 17, wd: "qua", idx: 3 },
  { n: 18, wd: "qui", idx: 4 },
  { n: 19, wd: "sex", idx: 5 },
]
const WEEKDAY_BUTTONS = [
  { idx: 1, label: "Seg" },
  { idx: 2, label: "Ter" },
  { idx: 3, label: "Qua" },
  { idx: 4, label: "Qui" },
  { idx: 5, label: "Sex" },
  { idx: 6, label: "Sáb" },
  { idx: 0, label: "Dom" },
]

function toMinutes(time: string) {
  const [hours, minutes] = time.split(":").map(Number)
  return hours * 60 + minutes
}
function fromMinutes(value: number) {
  return `${String(Math.floor(value / 60)).padStart(2, "0")}:${String(value % 60).padStart(2, "0")}`
}
function nowTime() {
  return new Date().toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })
}

const futureDays = () => (supabaseConfigured ? realFutureDays() : DEMO_FUTURE_DAYS)

function generateSlots(config: VideoConfig, requests: VideoRequest[]) {
  const taken = new Set(
    requests
      .filter((request) => request.status === "Solicitada" || request.status === "Confirmada")
      .map((request) => `${request.dayLabel}|${request.time}`),
  )
  return futureDays().filter((day) => config.days.includes(day.idx))
    .map((day) => ({ label: `${day.wd} ${day.n}`, times: [] as string[] }))
    .filter((day) => !config.blocked.includes(day.label))
    .map((day) => {
      const times: string[] = []
      for (
        let minute = toMinutes(config.start);
        minute + config.duration <= toMinutes(config.end);
        minute += config.duration
      ) {
        const time = fromMinutes(minute)
        if (!taken.has(`${day.label}|${time}`)) times.push(time)
      }
      return { label: day.label, times }
    })
    .filter((day) => day.times.length > 0)
}

function svgUri(svg: string) {
  return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`
}
const SAMPLE_PAINTING = svgUri(
  "<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 400 300'><rect width='400' height='300' fill='#f1e6d8'/><rect x='40' y='36' width='320' height='190' rx='12' fill='#ffffff'/><circle cx='120' cy='130' r='40' fill='#f2683c'/><circle cx='210' cy='105' r='30' fill='#08707a'/><circle cx='285' cy='150' r='36' fill='#f59e0b'/><path d='M60 205 Q150 160 340 200' stroke='#15803d' stroke-width='10' fill='none'/><rect x='185' y='226' width='30' height='56' fill='#8a5700'/></svg>",
)
const SAMPLE_GARDEN = svgUri(
  "<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 400 300'><rect width='400' height='300' fill='#cfeaf0'/><circle cx='320' cy='60' r='32' fill='#f59e0b'/><path d='M0 190 Q100 120 210 180 T400 160 V300 H0Z' fill='#6dbf7b'/><path d='M0 230 Q140 180 400 225 V300 H0Z' fill='#2f9a52'/><circle cx='90' cy='235' r='9' fill='#f2683c'/><circle cx='140' cy='255' r='9' fill='#dc2626'/><circle cx='250' cy='245' r='9' fill='#ffffff'/><circle cx='310' cy='262' r='9' fill='#f59e0b'/></svg>",
)

const WEEKDAYS_PT = ["dom", "seg", "ter", "qua", "qui", "sex", "sáb"]
// Os dias internos vão de 6 a 12 (12 = hoje). Esta função devolve a data real de cada um.
const dayInfo = (n: number) => {
  const date = new Date()
  date.setDate(date.getDate() - (12 - n))
  return { num: date.getDate(), wd: WEEKDAYS_PT[date.getDay()] }
}
const TODAY_LABEL = new Date().toLocaleDateString("pt-BR", { day: "numeric", month: "long" })

const PAST_DAYS: DayRecord[] = [
  {
    n: 6, wd: "sáb", mood: "Bem", food: "Boa", done: 2, total: 2, given: 4, doses: 4,
    text: "Maria teve um sábado tranquilo, conversou bastante e participou das atividades.",
    routine: [
      { time: "08:00", title: "Café da manhã", detail: "Comeu bem", by: "Elisa Pereira", at: "08:10" },
      { time: "10:00", title: "Oficina de música", detail: "Participou e cantou", by: "Elisa Pereira", at: "10:45" },
      { time: "15:30", title: "Lanche da tarde", detail: "Comeu bem", by: "Elisa Pereira", at: "15:45" },
    ],
  },
  {
    n: 7, wd: "dom", mood: "Cansada", food: "Regular", done: 1, total: 2, given: 4, doses: 4,
    text: "Maria acordou mais cansada e comeu um pouco menos. Participou de uma atividade leve e descansou à tarde.",
    routine: [
      { time: "08:00", title: "Café da manhã", detail: "Comeu pouco", by: "Elisa Pereira", at: "08:15" },
      { time: "10:00", title: "Sessão de leitura", detail: "Participou", by: "Elisa Pereira", at: "10:40" },
      { time: "15:30", title: "Lanche da tarde", detail: "Comeu bem", by: "Elisa Pereira", at: "15:50" },
    ],
  },
  {
    n: 8, wd: "seg", mood: "Muito bem", food: "Boa", done: 2, total: 2, given: 4, doses: 4,
    text: "Maria voltou animada e participou bem das atividades.",
    routine: [
      { time: "08:00", title: "Café da manhã", detail: "Comeu bem", by: "Elisa Pereira", at: "08:10" },
      { time: "10:00", title: "Alongamento em grupo", detail: "Participou e se divertiu", by: "Elisa Pereira", at: "10:35" },
      { time: "15:30", title: "Jogo de memória", detail: "Participou", by: "Elisa Pereira", at: "16:05" },
    ],
  },
  {
    n: 9, wd: "ter", mood: "Bem", food: "Boa", done: 2, total: 2, given: 4, doses: 4,
    text: "Dia calmo e agradável. Fez uma caminhada leve e conversou com outras residentes.",
    routine: [
      { time: "08:00", title: "Café da manhã", detail: "Comeu bem", by: "Elisa Pereira", at: "08:10" },
      { time: "10:00", title: "Caminhada leve", detail: "Participou", by: "Elisa Pereira", at: "10:50" },
      { time: "15:30", title: "Lanche da tarde", detail: "Comeu bem", by: "Elisa Pereira", at: "15:40" },
    ],
  },
  {
    n: 10, wd: "qua", mood: "Muito bem", food: "Boa", done: 1, total: 1, given: 4, doses: 4,
    text: "Maria recebeu a visita da família e ficou contente no resto do dia. Também passeou pelo jardim.",
    routine: [
      { time: "08:00", title: "Café da manhã", detail: "Comeu bem", by: "Elisa Pereira", at: "08:10" },
      { time: "14:00", title: "Passeio no jardim", detail: "Participou e se divertiu", by: "Elisa Pereira", at: "15:10" },
      { time: "15:30", title: "Lanche da tarde", detail: "Comeu bem", by: "Elisa Pereira", at: "15:45" },
    ],
  },
  {
    n: 11, wd: "qui", mood: "Bem", food: "Boa", done: 2, total: 2, given: 4, doses: 4,
    text: "Maria participou da oficina de pintura e do jogo de memória.",
    routine: [
      { time: "08:00", title: "Café da manhã", detail: "Comeu bem", by: "Elisa Pereira", at: "08:10" },
      { time: "10:00", title: "Oficina de pintura", detail: "Participou", by: "Elisa Pereira", at: "10:55" },
      { time: "15:30", title: "Jogo de memória", detail: "Participou", by: "Elisa Pereira", at: "16:00" },
    ],
  },
]

function PhotoGrid({ photos, onOpen }: { photos: Photo[]; onOpen: (photo: Photo) => void }) {
  return (
    <div className="photo-grid">
      {photos.map((photo) => (
        <button className="photo-thumb" key={photo.id} onClick={() => onOpen(photo)} type="button">
          <img alt={photo.caption} src={photo.src} />
          <span>{photo.caption}</span>
        </button>
      ))}
    </div>
  )
}

function PhotoLightbox({ photo, onClose }: { photo: Photo; onClose: () => void }) {
  return (
    <div className="photo-lightbox" onClick={onClose} role="presentation">
      <section
        aria-label="Foto ampliada"
        aria-modal="true"
        onClick={(event) => event.stopPropagation()}
        role="dialog"
      >
        <img alt={photo.caption} src={photo.src} />
        <strong>{photo.caption}</strong>
        <span>Publicada por {photo.author} às {photo.time}</span>
        <button onClick={onClose} type="button">Fechar</button>
      </section>
    </div>
  )
}

function StatusBadge({ status }: { status: VideoStatus }) {
  const icon: IconName = status === "Confirmada" || status === "Realizada" ? "check" : "clock"
  return (
    <span className={`video-badge video-badge--${status.toLowerCase()}`}>
      <Icon name={icon} size={14} />
      {status}
    </span>
  )
}

function FamilyVideo({
  requests,
  onNewRequest,
  onRequest,
  onCancel,
  onJoin,
  onBack,
}: {
  requests: VideoRequest[]
  onNewRequest: () => void
  onRequest: (dayLabel: string, time: string, note: string) => void
  onCancel: (id: VideoId) => void
  onJoin: (request: VideoRequest) => void
  onBack: () => void
}) {
  const mine = supabaseConfigured ? requests : requests.filter((request) => request.resident === "Maria Silva")

  return (
    <>
      <TopBar eyebrow="Recanto do Lar · Maria Silva" title="Videochamada" onBack={onBack} />
      <main className="screen-content video-content">
        <p className="video-intro">
          <Icon name="video" size={20} />
          <span>
            A chamada é acompanhada por um cuidador. A equipe confirma cada pedido de acordo com a
            rotina da Maria.
          </span>
        </p>
        <section className="section-block">
          <div className="section-title"><div><h2>Meus pedidos</h2><span>Acompanhe o status</span></div></div>
          {mine.length === 0 ? (
            <p className="video-empty">Você ainda não fez nenhum pedido.</p>
          ) : (
            <div className="video-list">
              {mine.map((request) => (
                <article key={request.id}>
                  <div className="video-list__head">
                    <strong>{request.dayLabel} às {request.time}</strong>
                    <StatusBadge status={request.status} />
                  </div>
                  {request.note && <small>Recado: {request.note}</small>}
                  {request.status === "Recusada" && (
                    <small>
                      Motivo: {request.reason}.
                      {request.suggestion ? ` A equipe sugere ${request.suggestion}.` : ""}
                    </small>
                  )}
                  <div className="video-list__actions">
                    {request.status === "Confirmada" && (
                      <button className="video-action video-action--primary" onClick={() => onJoin(request)} type="button">
                        Entrar na chamada
                      </button>
                    )}
                    {request.status === "Recusada" && request.suggestion && (
                      <button
                        className="video-action video-action--primary"
                        onClick={() => {
                          const [suggestedDay, suggestedTime] = request.suggestion!.split(" às ")
                          onRequest(suggestedDay, suggestedTime, "")
                        }}
                        type="button"
                      >
                        Pedir {request.suggestion}
                      </button>
                    )}
                    {(request.status === "Solicitada" || request.status === "Confirmada") && (
                      <button className="video-action" onClick={() => onCancel(request.id)} type="button">
                        Cancelar pedido
                      </button>
                    )}
                  </div>
                </article>
              ))}
            </div>
          )}
        </section>
        <button className="primary-button" onClick={onNewRequest} type="button">
          <Icon name="video" />
          Solicitar uma videochamada
        </button>
      </main>
    </>
  )
}

function FamilyVideoRequest({
  config,
  requests,
  onRequest,
  onBack,
}: {
  config: VideoConfig
  requests: VideoRequest[]
  onRequest: (dayLabel: string, time: string, note: string) => void | Promise<boolean>
  onBack: () => void
}) {
  const [sendError, setSendError] = useState("")
  const [sending, setSending] = useState(false)
  const slots = generateSlots(config, requests)
  const [dayLabel, setDayLabel] = useState("")
  const [time, setTime] = useState("")
  const [note, setNote] = useState("")
  const activeDay = slots.find((day) => day.label === dayLabel) ?? slots[0]

  const submit = async () => {
    if (!activeDay || !time || sending) return
    setSending(true)
    setSendError("")
    const ok = await onRequest(activeDay.label, time, note.trim())
    setSending(false)
    if (ok === false) {
      setSendError("Não foi possível enviar o pedido. Tente outro horário ou fale com a equipe.")
      return
    }
    onBack()
  }

  return (
    <>
      <TopBar eyebrow="Recanto do Lar · Maria Silva" title="Solicitar videochamada" onBack={onBack} />
      <main className="screen-content video-content">
        <section className="section-block">
          <div className="section-title"><div><h2>Escolha um horário</h2><span>Horários livres definidos pela casa</span></div></div>
          {slots.length === 0 ? (
            <p className="video-empty">
              A casa ainda não tem horários livres de videochamada. Use o botão “Falar com a equipe”
              no chat.
            </p>
          ) : (
            <>
              <div className="chip-row" role="group" aria-label="Dia">
                {slots.map((day) => (
                  <button
                    aria-pressed={activeDay?.label === day.label}
                    key={day.label}
                    onClick={() => { setDayLabel(day.label); setTime("") }}
                    type="button"
                  >
                    {day.label}
                  </button>
                ))}
              </div>
              <div className="chip-row chip-row--times" role="group" aria-label="Horário">
                {activeDay?.times.map((slot) => (
                  <button
                    aria-pressed={time === slot}
                    key={slot}
                    onClick={() => { setTime(slot) }}
                    type="button"
                  >
                    {slot}
                  </button>
                ))}
              </div>
              <label className="video-note">
                Recado para a equipe (opcional)
                <input
                  onChange={(event) => setNote(event.target.value)}
                  placeholder="Ex.: queremos mostrar uma foto da família"
                  value={note}
                />
              </label>
              {sendError && <p className="login-error" role="alert">{sendError}</p>}
              <button className="primary-button" disabled={!time || sending} onClick={submit} type="button">
                <Icon name="video" />
                Solicitar videochamada
              </button>
            </>
          )}
        </section>

      </main>
    </>
  )
}

function TeamVideo({
  config,
  requests,
  onDecide,
  onJoin,
}: {
  config: VideoConfig
  requests: VideoRequest[]
  onDecide: (id: VideoId, patch: Partial<VideoRequest>) => void
  onJoin: (request: VideoRequest) => void
}) {
  const [declining, setDeclining] = useState<VideoId | null>(null)
  const [reason, setReason] = useState("Residente descansando")
  const [suggestion, setSuggestion] = useState("")
  const reasons = ["Residente descansando", "Atividade programada", "Sem cuidador disponível nesse horário", "Outro motivo"]
  const options = generateSlots(config, requests)
    .slice(0, 3)
    .flatMap((day) => day.times.slice(0, 3).map((slot) => `${day.label} às ${slot}`))
  const waiting = requests.filter((request) => request.status === "Solicitada")
  const confirmed = requests.filter((request) => request.status === "Confirmada")
  const history = requests.filter((request) => !["Solicitada", "Confirmada"].includes(request.status))

  const renderItem = (request: VideoRequest) => (
    <article key={request.id}>
      <div className="video-list__head">
        <strong>{request.resident}</strong>
        <StatusBadge status={request.status} />
      </div>
      <small>
        {request.dayLabel} às {request.time} · pedido de {request.requester}
      </small>
      {request.note && <small>Recado: {request.note}</small>}
      {request.status === "Recusada" && (
        <small>Motivo: {request.reason}{request.suggestion ? ` · sugerido ${request.suggestion}` : ""}</small>
      )}
      {request.status === "Solicitada" && declining !== request.id && (
        <div className="video-list__actions">
          <button className="video-action video-action--primary" onClick={() => onDecide(request.id, { status: "Confirmada" })} type="button">
            Confirmar
          </button>
          <button className="video-action" onClick={() => { setDeclining(request.id); setSuggestion(options[0] ?? "") }} type="button">
            Recusar
          </button>
        </div>
      )}
      {request.status === "Solicitada" && declining === request.id && (
        <div className="video-decline">
          <span>Motivo da recusa</span>
          <div className="chip-row">
            {reasons.map((item) => (
              <button aria-pressed={reason === item} key={item} onClick={() => setReason(item)} type="button">{item}</button>
            ))}
          </div>
          <label>
            Sugerir outro horário
            <select onChange={(event) => setSuggestion(event.target.value)} value={suggestion}>
              <option value="">Sem sugestão</option>
              {options.map((option) => <option key={option}>{option}</option>)}
            </select>
          </label>
          <div className="video-list__actions">
            <button
              className="video-action video-action--primary"
              onClick={() => {
                onDecide(request.id, { status: "Recusada", reason, suggestion: suggestion || undefined })
                setDeclining(null)
              }}
              type="button"
            >
              Enviar resposta
            </button>
            <button className="video-action" onClick={() => setDeclining(null)} type="button">Voltar</button>
          </div>
        </div>
      )}
      {request.status === "Confirmada" && (
        <div className="video-list__actions">
          <button className="video-action video-action--primary" onClick={() => onJoin(request)} type="button">
            Entrar na chamada
          </button>
        </div>
      )}
    </article>
  )

  return (
    <>
      <TopBar eyebrow="Recanto do Lar · Painel da equipe" title="Videochamadas" avatar="EP" />
      <main className="screen-content video-content">
        <p className="video-intro">
          <Icon name="video" size={20} />
          <span>Você confirma cada pedido e acompanha a chamada ao lado do residente. Os horários são definidos pela administração.</span>
        </p>
        <section className="section-block">
          <div className="section-title"><div><h2>Aguardando resposta</h2><span>{waiting.length} {waiting.length === 1 ? "pedido" : "pedidos"}</span></div></div>
          {waiting.length === 0 ? <p className="video-empty">Nenhum pedido pendente.</p> : <div className="video-list">{waiting.map(renderItem)}</div>}
        </section>
        <section className="section-block">
          <div className="section-title"><div><h2>Confirmadas</h2></div></div>
          {confirmed.length === 0 ? <p className="video-empty">Nenhuma chamada confirmada.</p> : <div className="video-list">{confirmed.map(renderItem)}</div>}
        </section>
        {history.length > 0 && (
          <section className="section-block">
            <div className="section-title"><div><h2>Histórico</h2></div></div>
            <div className="video-list">{history.map(renderItem)}</div>
          </section>
        )}
      </main>
    </>
  )
}

function TeamPhotos({
  photos,
  consent,
  activities,
  activitiesByResident,
  onPublish,
  onRemove,
}: {
  photos: Photo[]
  consent: Record<string, boolean>
  activities: Activity[]
  activitiesByResident?: Record<string, Activity[]>
  onPublish: (photo: Omit<Photo, "id" | "author" | "time" | "day">) => void | Promise<boolean>
  onRemove: (id: PhotoId) => void
}) {
  const [publishError, setPublishError] = useState("")
  const [publishing, setPublishing] = useState(false)
  const names = Object.keys(consent)
  const [src, setSrc] = useState("")
  const [caption, setCaption] = useState("")
  const [activity, setActivity] = useState("")
  const [tagged, setTagged] = useState<string[]>(supabaseConfigured ? [] : ["Maria Silva"])
  const [done, setDone] = useState("")
  const inputRef = useRef<HTMLInputElement>(null)
  const today = photos.filter((photo) => photo.day === 12)
  const validTags = tagged.filter((name) => consent[name])
  // Atividades de hoje dos residentes marcados (ou de todos, enquanto ninguém foi marcado).
  const activityOptions = Array.from(
    new Set(
      (activitiesByResident
        ? (validTags.length > 0 ? validTags : Object.keys(activitiesByResident)).flatMap((name) => activitiesByResident[name] ?? [])
        : activities
      ).map((item) => item.name),
    ),
  )

  const onFile = (file?: File) => {
    if (!file) return
    const reader = new FileReader()
    reader.onload = () => {
      const image = new Image()
      image.onload = () => {
        const scale = Math.min(1, 1000 / Math.max(image.width, image.height))
        const canvas = document.createElement("canvas")
        canvas.width = Math.round(image.width * scale)
        canvas.height = Math.round(image.height * scale)
        canvas.getContext("2d")?.drawImage(image, 0, 0, canvas.width, canvas.height)
        setSrc(canvas.toDataURL("image/jpeg", 0.8))
        setDone("")
      }
      image.src = String(reader.result)
    }
    reader.readAsDataURL(file)
  }

  const publish = async () => {
    if (!src || validTags.length === 0 || publishing) return
    setPublishing(true)
    setPublishError("")
    const ok = await onPublish({ src, caption: caption.trim() || activity || "Foto do dia", residents: validTags })
    setPublishing(false)
    if (ok === false) {
      setPublishError("Não foi possível publicar a foto. Confira a autorização de imagem e tente de novo.")
      return
    }
    setDone(`Foto publicada para as famílias de: ${validTags.join(", ")}.`)
    setSrc("")
    setCaption("")
    setActivity("")
  }

  return (
    <>
      <TopBar eyebrow="Recanto do Lar · Painel da equipe" title="Fotos das atividades" avatar="EP" />
      <main className="screen-content video-content">
        <section className="photo-form">
          <div className="card-heading">
            <span className="feature-icon"><Icon name="camera" /></span>
            <div><span>Compartilhado com a família</span><h2>Nova foto</h2></div>
          </div>
          <input
            accept="image/*"
            aria-label="Escolher foto"
            hidden
            onChange={(event) => onFile(event.target.files?.[0])}
            ref={inputRef}
            type="file"
          />
          {src ? (
            <img alt="Prévia da foto" className="photo-preview" src={src} />
          ) : (
            <div className="photo-actions">
              <button className="video-action video-action--primary" onClick={() => inputRef.current?.click()} type="button">
                <Icon name="camera" size={18} /> Câmera ou galeria
              </button>
              <button className="video-action" onClick={() => setSrc(SAMPLE_PAINTING)} type="button">
                Usar foto de exemplo
              </button>
            </div>
          )}
          <label>
            Atividade (opcional)
            <select onChange={(event) => setActivity(event.target.value)} value={activity}>
              <option value="">Sem atividade</option>
              {activityOptions.map((name) => <option key={name}>{name}</option>)}
            </select>
          </label>
          <label>
            Legenda (opcional)
            <input onChange={(event) => setCaption(event.target.value)} placeholder="Ex.: Oficina de pintura" value={caption} />
          </label>
          <fieldset className="photo-tags">
            <legend>Quem aparece na foto</legend>
            {names.map((name) => (
              <label className={consent[name] ? "" : "photo-tags--blocked"} key={name}>
                <input
                  checked={tagged.includes(name) && consent[name]}
                  disabled={!consent[name]}
                  onChange={(event) =>
                    setTagged((current) =>
                      event.target.checked ? [...current, name] : current.filter((item) => item !== name),
                    )
                  }
                  type="checkbox"
                />
                <span>{name}{consent[name] ? "" : " — sem autorização válida de uso de imagem"}</span>
              </label>
            ))}
          </fieldset>
          <p className="photo-hint">
            <Icon name="lock" size={16} />
            Só é possível marcar residentes com autorização de uso de imagem válida, cadastrada pela
            administração. Cada família vê apenas as fotos em que o seu residente aparece.
          </p>
          {publishError && <p className="login-error" role="alert">{publishError}</p>}
          <button className="primary-button" disabled={!src || validTags.length === 0 || publishing} onClick={publish} type="button">
            <Icon name="check" />
            Publicar para as famílias
          </button>
          {done && <p className="inline-toast" role="status"><Icon name="check" size={18} /> {done}</p>}
        </section>

        <section className="section-block">
          <div className="section-title"><div><h2>Publicadas hoje</h2><span>{today.length} {today.length === 1 ? "foto" : "fotos"}</span></div></div>
          {today.length === 0 ? (
            <p className="video-empty">Nenhuma foto publicada hoje.</p>
          ) : (
            <div className="video-list">
              {today.map((photo) => (
                <article className="photo-row" key={photo.id}>
                  <img alt={photo.caption} src={photo.src} />
                  <div>
                    <strong>{photo.caption}</strong>
                    <small>{photo.residents.join(", ")} · {photo.author}, {photo.time}</small>
                  </div>
                  <button className="video-action" onClick={() => onRemove(photo.id)} type="button">Remover</button>
                </article>
              ))}
            </div>
          )}
        </section>
      </main>
    </>
  )
}

function CallOverlay({
  request,
  role,
  onEnd,
  onClose,
}: {
  request: VideoRequest
  role: Role
  onEnd: () => void
  onClose: () => void
}) {
  return (
    <div className="call-overlay" role="dialog" aria-modal="true" aria-label="Videochamada">
      <span className="call-overlay__tag">Videochamada simulada</span>
      <span className="call-overlay__avatar">{request.resident.split(" ").map((part) => part[0]).join("")}</span>
      <h2>{role === "family" ? request.resident : `${request.resident} com ${request.requester}`}</h2>
      <p>{request.dayLabel} às {request.time} · acompanhada por Elisa Pereira</p>
      <small>
        Na versão real, aqui abre a sala de vídeo (por exemplo, Jitsi), com link único e sem gravação.
      </small>
      <div>
        <button onClick={onClose} type="button">Voltar</button>
        <button className="call-overlay__end" onClick={onEnd} type="button">Encerrar chamada</button>
      </div>
    </div>
  )
}

export default function App() {
  const [screen, setScreen] = useState<Screen>("login")
  const [role, setRole] = useState<Role>("family")
  const [account, setAccount] = useState<Account | null>(null)
  // Link do e-mail (redefinição de senha ou convite): a pessoa precisa criar a senha.
  const [needsPassword, setNeedsPassword] = useState(
    () => supabaseConfigured && /type=(recovery|invite)/.test(window.location.hash),
  )
  const [loginNotice, setLoginNotice] = useState("")
  const needsPasswordRef = useRef(needsPassword)
  needsPasswordRef.current = needsPassword
  const [consentAccepted, setConsentAccepted] = useState(false)
  const [textSize, setTextSizeState] = useState<TextSize>(readTextSize)
  const setTextSize = (size: TextSize) => {
    setTextSizeState(size)
    try {
      window.localStorage.setItem(TEXT_SIZE_KEY, size)
    } catch {
      // Armazenamento indisponível: a escolha vale só até fechar o app.
    }
  }
  const [themePreference, setThemePreference] = useState<ThemePreference>(readThemePreference)
  const [alertMinutes, setAlertMinutes] = useState<10 | 15 | 30>(15)
  const [unansweredQuestions, setUnansweredQuestions] = useState<string[]>(supabaseConfigured ? [] : [
    "A Maria pode receber uma visita pela manhã?",
    "Posso levar meu sobrinho no horário de visita da Maria?",
  ])
  const [customAnswers, setCustomAnswers] = useState<Record<string, string>>({})
  // Dados reais (só quando o Supabase está configurado).
  const [realResidents, setRealResidents] = useState<RealResident[]>([])
  const [realDoses, setRealDoses] = useState<Dose[]>([])
  const [pendingMedicines, setPendingMedicines] = useState(0)
  const [pendingList, setPendingList] = useState<{ id: string; medicine: string; dose: string; time: string; minutesLate: number }[]>([])
  const [overdueThreads, setOverdueThreads] = useState<{ resident: string; minutes: number }[]>([])
  const reloadMessages = async (list: RealResident[] = realResidents) => {
    if (!supabaseConfigured || !account) return
    const threads = await loadThreads()
    const next: Record<string, ResidentMessage[]> = {}
    const unread: Record<string, boolean> = {}
    const late: { resident: string; minutes: number }[] = []
    for (const [name, msgs] of Object.entries(threads)) {
      next[name] = msgs.map((m) => ({ sender: m.sender, text: m.text }))
      const last = msgs[msgs.length - 1]
      unread[name] = last?.sender === "family" && (role !== "team" || msgs.length > (seen.msgs[name] ?? 0))
      const minutes = last ? Math.floor((Date.now() - new Date(last.at).getTime()) / 60000) : 0
      if (last?.sender === "family" && minutes >= alertMinutes) late.push({ resident: name, minutes })
    }
    for (const resident of list) next[resident.name] ??= []
    setConversations(next)
    setUnreadConversations((current) => ({ ...unread, ...Object.fromEntries(Object.keys(current).filter((k) => current[k] && unread[k] === undefined).map((k) => [k, false])) }))
    setOverdueThreads(late)
  }
  const reloadVideo = async () => {
    if (!supabaseConfigured || !account) return
    const [config, requests, taken] = await Promise.all([loadVideoConfig(), loadVideoRequests(), loadTakenSlots()])
    if (config) setVideoConfig(config)
    setVideoRequests(requests)
    setTakenSlots(taken)
  }
  const reloadMedication = async () => {
    if (!supabaseConfigured || !account) return
    void reloadVideo()
    const [answers, minutes] = await Promise.all([loadHouseAnswers(), loadAlertMinutes()])
    setCustomAnswers(answers)
    if (minutes) setAlertMinutes(minutes)
    if (role === "admin") {
      const [pending, questions, residentsList, pendingItems] = await Promise.all([
        loadPendingCount(),
        loadHouseQuestions(),
        loadResidents(),
        loadPendingList(),
      ])
      setPendingMedicines(pending)
      setPendingList(pendingItems)
      setUnansweredQuestions(questions)
      setRealResidents(residentsList)
      await reloadMessages(residentsList)
      return
    }
    const [list, doseList, acts, photoList, consent] = await Promise.all([
      loadResidents(),
      loadTodayDoses(),
      loadActivities(),
      loadPhotos(),
      loadConsentFlags(),
    ])
    setRealResidents(list)
    setRealDoses(doseList)
    setActivitiesByResident(acts)
    setPhotos(photoList)
    setRealConsent(consent)
    await reloadMessages(list)
  }
  useEffect(() => {
    if (screen === "login" || screen === "consent") return
    void reloadMedication()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [account, role, screen])
  const [houseInfo, setHouseInfo] = useState<HouseInfo>({
    visitingHours: "todos os dias, das 14:00 às 17:00",
    phone: "(11) 4000-1234",
    visitingRules: "Para visitar fora desse horário, fale com a equipe.",
    updatedBy: "Marta Andrade",
    updatedAt: `${TODAY_LABEL} às 09:15`,
  })
  const [activitiesByResident, setActivitiesByResident] = useState<Record<string, Activity[]>>(supabaseConfigured ? {} : {
    "Maria Silva": [
      {
        id: 1,
        name: "Oficina de pintura",
        time: "10:00",
        status: "Realizada",
        participation: "Participou",
        observation: "Maria participou e se divertiu",
        registeredBy: "Elisa Pereira",
        registeredAt: "11:05",
      },
      {
        id: 2,
        name: "Lanche da tarde",
        time: "15:30",
        status: "Programada",
        registeredBy: "Elisa Pereira",
        registeredAt: "14:45",
      },
    ],
    "João Pereira": [],
    "Ana Lourdes": [],
    "Roberto Santos": [],
  })
  const [conversations, setConversations] = useState<Record<string, ResidentMessage[]>>(supabaseConfigured ? {} : {
    "Maria Silva": [
      {
        sender: "team",
        text: "Olá, Carla. Estou disponível para ajudar com informações sobre a rotina da Maria.",
      },
    ],
    "João Pereira": [
      {
        sender: "family",
        text: "Olá, Elisa. O João participou da caminhada hoje pela manhã?",
      },
    ],
    "Ana Lourdes": [],
    "Roberto Santos": [],
  })
  const [unreadConversations, setUnreadConversations] = useState<Record<string, boolean>>(supabaseConfigured ? {} : {
    "Maria Silva": false,
    "João Pereira": true,
    "Ana Lourdes": false,
    "Roberto Santos": false,
  })

  const [realConsent, setRealConsent] = useState<Record<string, boolean>>({})
  const [photos, setPhotos] = useState<Photo[]>(supabaseConfigured ? [] : [
    { id: 1, src: SAMPLE_PAINTING, caption: "Oficina de pintura", residents: ["Maria Silva"], author: "Elisa Pereira", time: "11:00", day: 12 },
    { id: 2, src: SAMPLE_GARDEN, caption: "Passeio no jardim", residents: ["Maria Silva", "João Pereira"], author: "Elisa Pereira", time: "15:10", day: 10 },
  ])
  const [imageConsent, setImageConsent] = useState<Record<string, ConsentInfo>>({
    "Maria Silva": { authorized: true, by: "Carla Souza", date: "2024-02-05", validUntil: "2027-02-05" },
    "João Pereira": { authorized: true, by: "Paulo Pereira", date: "2023-11-20", validUntil: "2026-11-20" },
    "Ana Lourdes": { ...EMPTY_CONSENT },
    "Roberto Santos": { authorized: true, by: "Rui Santos", date: "2022-08-15", validUntil: "" },
  })
  const [registrations, setRegistrations] = useState<Registrations>(INITIAL_REGISTRATIONS)
  const [changeLog, setChangeLog] = useState<ChangeLogEntry[]>(INITIAL_LOG)
  const consentFlags = supabaseConfigured
    ? realConsent
    : Object.fromEntries(Object.entries(imageConsent).map(([name, info]) => [name, consentActive(info)]))
  const [videoConfig, setVideoConfig] = useState<VideoConfig>({
    days: [1, 3, 5, 6],
    start: "15:00",
    end: "17:00",
    duration: 20,
    blocked: [],
  })
  const [takenSlots, setTakenSlots] = useState<{ dayLabel: string; time: string }[]>([])
  const [videoRequests, setVideoRequests] = useState<VideoRequest[]>(supabaseConfigured ? [] : [
    { id: 1, resident: "Maria Silva", requester: "Carla Souza", dayLabel: "seg 15", time: "15:20", status: "Confirmada" },
    { id: 2, resident: "João Pereira", requester: "Paulo Pereira", dayLabel: "qua 17", time: "15:40", status: "Solicitada" },
  ])
  const [activeCall, setActiveCall] = useState<VideoRequest | null>(null)
  const closeCall = useBackDismiss(activeCall !== null, () => setActiveCall(null), "call")

  const requestVideo = (dayLabel: string, time: string, note: string): void | Promise<boolean> => {
    if (supabaseConfigured) {
      const resident = realResidents[0]
      if (!resident) return Promise.resolve(false)
      return createVideoRequest(resident.id, dayLabel, time, note).then(async (ok) => {
        await reloadVideo()
        return ok
      })
    }
    setVideoRequests((current) => [
      ...current,
      { id: Date.now(), resident: "Maria Silva", requester: "Carla Souza", dayLabel, time, status: "Solicitada", note: note || undefined },
    ])
  }
  const updateVideo = (id: VideoId, patch: Partial<VideoRequest>) => {
    setVideoRequests((current) => current.map((request) => (request.id === id ? { ...request, ...patch } : request)))
    if (supabaseConfigured) void updateVideoRequest(String(id), patch).then(() => reloadVideo())
  }
  const publishPhoto = (photo: Omit<Photo, "id" | "author" | "time" | "day">): void | Promise<boolean> => {
    if (supabaseConfigured) {
      const ids = photo.residents
        .map((name) => realResidents.find((resident) => resident.name === name)?.id)
        .filter((id): id is string => !!id)
      if (ids.length === 0) return Promise.resolve(false)
      return publishPhotoDb(photo.src, photo.caption, ids).then(async (ok) => {
        if (ok) await reloadMedication()
        return ok
      })
    }
    setPhotos((current) => [{ ...photo, id: Date.now(), author: "Elisa Pereira", time: nowTime(), day: 12 }, ...current])
  }
  const removePhoto = (id: PhotoId) => {
    if (supabaseConfigured) {
      const photo = photos.find((item) => item.id === id)
      if (photo?.rowIds && photo.paths) void removePhotoDb(photo.rowIds, photo.paths).then(() => reloadMedication())
      return
    }
    setPhotos((current) => current.filter((photo) => photo.id !== id))
  }
  const slotRequests: VideoRequest[] = [
    ...videoRequests,
    ...takenSlots.map((slot, index) => ({ id: `taken-${index}`, resident: "", requester: "", ...slot, status: "Solicitada" as VideoStatus })),
  ]
  const videoSlots = generateSlots(videoConfig, slotRequests)
    .slice(0, 3)
    .flatMap((day) => day.times.slice(0, 2).map((slot) => `${day.label} às ${slot}`))
    .slice(0, 4)

  useEffect(() => {
    const media = window.matchMedia("(prefers-color-scheme: dark)")
    const applyTheme = () => {
      const resolved =
        themePreference === "system" ? (media.matches ? "dark" : "light") : themePreference
      document.documentElement.setAttribute("data-theme", resolved)
      document
        .querySelector('meta[name="theme-color"]')
        ?.setAttribute("content", resolved === "dark" ? "#0a181a" : "#f1f7f7")
    }
    applyTheme()
    try {
      window.localStorage.setItem(THEME_STORAGE_KEY, themePreference)
    } catch {
      // Sem armazenamento, a escolha vale só nesta sessão.
    }
    media.addEventListener("change", applyTheme)
    return () => media.removeEventListener("change", applyTheme)
  }, [themePreference])

  useEffect(() => {
    if (!supabaseConfigured) return
    let active = true
    restoreSession().then((user) => {
      if (!active || !user || needsPasswordRef.current) return
      setRole(user.role)
      setAccount({ name: user.name, email: user.email })
      setScreen(user.role === "admin" ? "admin-dashboard" : user.role === "team" ? "team" : "consent")
    })
    const stop = onSignedOut(() => {
      setAccount(null)
      setScreen("login")
    })
    const stopRecovery = onPasswordRecovery(() => setNeedsPassword(true))
    return () => {
      active = false
      stop()
      stopRecovery()
    }
  }, [])

  useEffect(() => {
    window.history.replaceState({ screen: "login" }, "", window.location.href)
    const handleBack = (event: PopStateEvent) => {
      const previousScreen = event.state?.screen as Screen | undefined
      if (previousScreen) {
        setScreen(previousScreen)
      } else {
        window.history.pushState({ screen: "login" }, "", window.location.href)
        setScreen("login")
      }
    }
    window.addEventListener("popstate", handleBack)
    return () => window.removeEventListener("popstate", handleBack)
  }, [])

  const navigate = (nextScreen: Screen) => {
    if (nextScreen === screen) return
    window.history.pushState({ screen: nextScreen }, "", window.location.href)
    setScreen(nextScreen)
  }

  const sendResidentMessage = (residentName: string, message: string, sender: Role) => {
    setConversations((current) => ({
      ...current,
      [residentName]: [...(current[residentName] ?? []), { sender, text: message }],
    }))
    // Mensagem da família deixa a conversa "não lida"; resposta da equipe ou da administração limpa.
    setUnreadConversations((current) => ({
      ...current,
      [residentName]: sender === "family",
    }))
    if (supabaseConfigured) {
      const resident = realResidents.find((item) => item.name === residentName)
      if (resident) void sendMessage(resident.id, message, sender).then(() => reloadMessages())
    }
  }
  const familyResident = supabaseConfigured ? (realResidents[0]?.name ?? "") : "Maria Silva"

  // Avisos: o que a pessoa já viu fica guardado neste aparelho.
  const seenKey = `recanto-visto-${account?.email ?? "demo"}`
  const [seen, setSeen] = useState<{ msgs: Record<string, number>; video: string[] }>({
    msgs: supabaseConfigured ? {} : { "Maria Silva": 1 },
    video: [],
  })
  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(seenKey)
      if (raw) setSeen(JSON.parse(raw))
    } catch {
      // Sem armazenamento: os avisos valem só nesta sessão.
    }
  }, [seenKey])
  const saveSeen = (next: { msgs: Record<string, number>; video: string[] }) => {
    setSeen(next)
    try {
      window.localStorage.setItem(seenKey, JSON.stringify(next))
    } catch {
      // ignorado
    }
  }
  const familyThread = conversations[familyResident] ?? []
  const familyReplyUnread =
    role === "family" && familyThread.length > (seen.msgs[familyResident] ?? 0) && familyThread[familyThread.length - 1]?.sender !== "family"
  const videoAnswers = videoRequests.filter((request) => request.status !== "Solicitada" && request.status !== "Realizada")
  const videoAnswerKeys = videoAnswers.map((request) => `${request.id}:${request.status}`)
  const unseenVideo = role === "family" ? videoAnswerKeys.filter((key) => !seen.video.includes(key)).length : 0
  useEffect(() => {
    if (role !== "family") return
    if (screen === "caregiver" && familyThread.length !== (seen.msgs[familyResident] ?? 0)) {
      saveSeen({ ...seen, msgs: { ...seen.msgs, [familyResident]: familyThread.length } })
    }
    if (screen === "family-video" && unseenVideo > 0) {
      saveSeen({ ...seen, video: Array.from(new Set([...seen.video, ...videoAnswerKeys])) })
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [screen, familyThread.length, unseenVideo])
  const navBadges: Partial<Record<Screen, number>> =
    role === "family"
      ? { chat: familyReplyUnread ? 1 : 0, summary: unseenVideo }
      : role === "team"
        ? {
            team: Object.values(unreadConversations).filter(Boolean).length,
            "team-video": videoRequests.filter((request) => request.status === "Solicitada").length,
          }
        : { "admin-dashboard": unansweredQuestions.length + (supabaseConfigured ? overdueThreads.length : 0) }

  // Atualização automática: novas mensagens e pedidos aparecem sem recarregar a página.
  const refreshRef = useRef<() => void>(() => {})
  refreshRef.current = () => {
    void reloadMessages()
    void reloadVideo()
  }
  useEffect(() => {
    if (!supabaseConfigured || !account) return
    const timer = window.setInterval(() => refreshRef.current(), 15000)
    return () => window.clearInterval(timer)
  }, [account])

  const addActivity = (residentName: string, name: string, time: string) => {
    if (supabaseConfigured) {
      const resident = realResidents.find((item) => item.name === residentName)
      if (resident) void addActivityDb(resident.id, name, time).then(() => reloadMedication())
      return
    }
    setActivitiesByResident((current) => ({
      ...current,
      [residentName]: [
        ...(current[residentName] ?? []),
        {
          id: Date.now(),
          name,
          time,
          status: "Programada",
          registeredBy: "Elisa Pereira",
          registeredAt: new Date().toLocaleTimeString("pt-BR", {
            hour: "2-digit",
            minute: "2-digit",
          }),
        },
      ],
    }))
  }

  const activityTimers = useRef<Record<string, { timer: number; patch: Record<string, string> }>>({})
  const updateActivity = (
    residentName: string,
    id: ActivityId,
    updates: Partial<Activity>,
  ) => {
    if (supabaseConfigured) {
      // Quem registrou aparece já na tela; o banco grava o nome e o horário de verdade.
      updates = { ...updates, registeredBy: account?.name ?? updates.registeredBy }
      const key = String(id)
      const slot = activityTimers.current[key] ?? { timer: 0, patch: {} }
      window.clearTimeout(slot.timer)
      for (const field of ["status", "participation", "observation"] as const) {
        const value = updates[field]
        if (typeof value === "string") slot.patch[field] = value
      }
      slot.timer = window.setTimeout(() => {
        const patch = slot.patch
        delete activityTimers.current[key]
        void updateActivityDb(key, patch).then(() => reloadMedication())
      }, 700)
      activityTimers.current[key] = slot
    }
    setActivitiesByResident((current) => ({
      ...current,
      [residentName]: (current[residentName] ?? []).map((activity) =>
        activity.id === id ? { ...activity, ...updates } : activity,
      ),
    }))
  }

  return (
    <div className="app-shell">
      <div className={`phone phone--text-${textSize}`}>
        {needsPassword ? (
          <SetPassword
            onDone={async () => {
              await signOut()
              window.history.replaceState({ screen: "login" }, "", window.location.pathname)
              setNeedsPassword(false)
              setAccount(null)
              setLoginNotice("Senha criada. Entre com a sua nova senha.")
              setScreen("login")
            }}
          />
        ) : screen === "login" ? (
          <Login
            notice={loginNotice}
            onEnter={(selectedRole, signedAccount) => {
              setRole(selectedRole)
              setAccount(signedAccount ?? null)
              navigate(
                selectedRole === "admin"
                  ? "admin-dashboard"
                  : selectedRole === "team"
                    ? "team"
                  : consentAccepted
                    ? "summary"
                    : "consent",
              )
            }}
          />
        ) : screen === "consent" ? (
          <Consent
            onBack={() => window.history.back()}
            onAccept={() => {
              setConsentAccepted(true)
              navigate("summary")
            }}
          />
        ) : (
          <div className="app-view">
            {screen === "chat" && (
              <Chat
                doses={supabaseConfigured ? realDoses : null}
                activities={activitiesByResident[familyResident] ?? []}
                customAnswers={customAnswers}
                houseInfo={houseInfo}
                onOpenVideo={() => navigate("family-video")}
                videoSlots={videoSlots}
                onTalkToCaregiver={() => navigate("caregiver")}
                askAi={
                  supabaseConfigured && realResidents[0]
                    ? (question: string) => askAssistantAi(question, realResidents[0].id)
                    : undefined
                }
                teamReplyUnread={familyReplyUnread}
                onUnansweredQuestion={(question) => {
                  sendResidentMessage(familyResident, `Pergunta feita à assistente: ${question}`, "family")
                  if (supabaseConfigured) void addHouseQuestion(question)
                  setUnansweredQuestions((current) =>
                    current.includes(question) ? current : [...current, question],
                  )
                }}
              />
            )}
            {screen === "summary" && (
              <Summary
                residentName={familyResident || "Maria Silva"}
                doses={supabaseConfigured ? realDoses : null}
                activities={activitiesByResident[familyResident] ?? []}
                houseInfo={houseInfo}
                onOpenVideo={() => navigate("family-video")}
                photos={photos}
                videoRequests={videoRequests}
              />
            )}
            {screen === "family-video" && (
              <FamilyVideo
                onBack={() => window.history.back()}
                onCancel={(id) => {
                  setVideoRequests((current) => current.filter((request) => request.id !== id))
                  if (supabaseConfigured) void updateVideoRequest(String(id), { status: "Cancelada" }).then(() => reloadVideo())
                }}
                onJoin={setActiveCall}
                onNewRequest={() => navigate("family-video-request")}
                onRequest={requestVideo}
                requests={videoRequests}
              />
            )}
            {screen === "family-video-request" && (
              <FamilyVideoRequest
                config={videoConfig}
                onBack={() => window.history.back()}
                onRequest={requestVideo}
                requests={slotRequests}
              />
            )}
            {screen === "team-photos" && (
              <TeamPhotos
                activitiesByResident={activitiesByResident}
                activities={activitiesByResident[familyResident] ?? []}
                consent={consentFlags}
                onPublish={publishPhoto}
                onRemove={removePhoto}
                photos={photos}
              />
            )}
            {screen === "team-video" && (
              <TeamVideo
                config={videoConfig}
                onDecide={updateVideo}
                onJoin={setActiveCall}
                requests={videoRequests}
              />
            )}
            {screen === "caregiver" && (
              <Caregiver
                messages={conversations[familyResident] ?? []}
                onBack={() => window.history.back()}
                onSendMessage={(message) => sendResidentMessage(familyResident, message, "family")}
              />
            )}
            {screen === "team" && (
              <TeamPanel
                doses={realDoses}
                onAddPrescription={async (residentId, medicine, dose, time) => {
                  const ok = await addPrescription(residentId, medicine, dose, time)
                  if (ok) await reloadMedication()
                  return ok
                }}
                onMarkDose={async (doseId) => {
                  const ok = await markDoseGiven(doseId)
                  if (ok) await reloadMedication()
                  return ok
                }}
                realResidents={realResidents}
                activitiesByResident={activitiesByResident}
                conversations={conversations}
                onAddActivity={addActivity}
                unreadConversations={unreadConversations}
                onMarkAsRead={(residentName) => {
                  setUnreadConversations((current) => ({
                    ...current,
                    [residentName]: false,
                  }))
                  saveSeen({ ...seen, msgs: { ...seen.msgs, [residentName]: (conversations[residentName] ?? []).length } })
                }}
                onSendMessage={sendResidentMessage}
                onUpdateActivity={updateActivity}
              />
            )}
            {screen === "admin-dashboard" && (
              <AdminDashboard
                pendingMedicines={supabaseConfigured ? pendingMedicines : undefined}
                pendingList={supabaseConfigured ? pendingList : undefined}
                alertMinutes={alertMinutes}
                conversations={conversations}
                overdueThreads={supabaseConfigured ? overdueThreads : undefined}
                onAnswerQuestion={(question, answer) => {
                  if (supabaseConfigured) void answerHouseQuestion(question, answer)
                  setCustomAnswers((current) => ({ ...current, [question]: answer }))
                  setUnansweredQuestions((current) => current.filter((item) => item !== question))
                }}
                onReply={(resident, text) => sendResidentMessage(resident, text, "admin")}
                pendingVideo={videoRequests.filter((request) => request.status === "Solicitada").length}
                unansweredQuestions={unansweredQuestions}
                unreadConversations={unreadConversations}
              />
            )}
            {screen === "admin-registers" && (
              <AdminRegistrations
                imageConsent={imageConsent}
                log={changeLog}
                records={registrations}
                setLog={setChangeLog}
                setRecords={setRegistrations}
                onSetConsent={(name, info) => setImageConsent((current) => ({ ...current, [name]: info }))}
                onResidentAdded={(name) => setImageConsent((current) => ({ ...current, [name]: { ...EMPTY_CONSENT } }))}
                onResidentRenamed={(oldName, newName) => {
                  setImageConsent((current) => {
                    const { [oldName]: previous, ...rest } = current
                    return { ...rest, [newName]: previous ?? { ...EMPTY_CONSENT } }
                  })
                  setPhotos((current) =>
                    current.map((photo) => ({
                      ...photo,
                      residents: photo.residents.map((name) => (name === oldName ? newName : name)),
                    })),
                  )
                  setVideoRequests((current) =>
                    current.map((request) => (request.resident === oldName ? { ...request, resident: newName } : request)),
                  )
                }}
                onResidentRemoved={(name) => {
                  setImageConsent((current) => {
                    const { [name]: removed, ...rest } = current
                    void removed
                    return rest
                  })
                  setPhotos((current) =>
                    current
                      .map((photo) => ({ ...photo, residents: photo.residents.filter((item) => item !== name) }))
                      .filter((photo) => photo.residents.length > 0),
                  )
                  setVideoRequests((current) => current.filter((request) => request.resident !== name))
                }}
              />
            )}
            {screen === "admin-house" && (
              <AdminHouse
                alertMinutes={alertMinutes}
                houseInfo={houseInfo}
                onAlertMinutesChange={(minutes) => {
                  setAlertMinutes(minutes)
                  if (supabaseConfigured) void saveAlertMinutes(minutes)
                }}
                onHouseInfoChange={setHouseInfo}
                onVideoConfigChange={(config) => {
                  setVideoConfig(config)
                  if (supabaseConfigured) void saveVideoConfig(config)
                }}
                videoConfig={videoConfig}
                videoRequests={videoRequests}
              />
            )}
            {screen === "profile" && (
              <Profile
                account={account}
                onExit={async () => {
                  await signOut()
                  setAccount(null)
                  navigate("login")
                }}
                onTextSizeChange={setTextSize}
                onThemeChange={setThemePreference}
                role={role}
                textSize={textSize}
                themePreference={themePreference}
              />
            )}
            <BottomNav active={screen === "family-video" || screen === "family-video-request" ? "summary" : screen} badges={navBadges} onChange={navigate} role={role} />
            {activeCall && (
              <CallOverlay
                onClose={closeCall}
                onEnd={() => {
                  updateVideo(activeCall.id, { status: "Realizada" })
                  closeCall()
                }}
                request={activeCall}
                role={role}
              />
            )}
          </div>
        )}
      </div>
    </div>
  )
}
