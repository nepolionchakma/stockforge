import type {
  ButtonHTMLAttributes,
  InputHTMLAttributes,
  ReactNode,
  SelectHTMLAttributes
} from 'react'
import { Check, ChevronDown, Loader2, X } from 'lucide-react'
import type { ImageAsset } from '@shared/types'
import { useState } from 'react'
import { imageUrl } from '../lib/imageAnalysis'

export function cx(...values: Array<string | false | null | undefined>): string {
  return values.filter(Boolean).join(' ')
}

type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger'
type ButtonSize = 'sm' | 'md' | 'lg'

const BUTTON_VARIANTS: Record<ButtonVariant, string> = {
  primary:
    'bg-accent text-accent-ink hover:bg-accent-strong shadow-[inset_0_1px_0_rgba(255,255,255,.28),0_8px_20px_-12px_rgba(240,179,95,.8)]',
  secondary:
    'border border-edge bg-white/[0.04] text-ink hover:border-edge-strong hover:bg-white/[0.07]',
  ghost: 'text-muted hover:bg-white/[0.05] hover:text-ink',
  danger: 'border border-danger/25 bg-danger/[0.08] text-danger hover:bg-danger/[0.14]'
}

const BUTTON_SIZES: Record<ButtonSize, string> = {
  sm: 'h-7.5 gap-1.5 rounded-lg px-2.5 text-[11px]',
  md: 'h-9 gap-2 rounded-[10px] px-3.5 text-[12.5px]',
  lg: 'h-10 gap-2 rounded-xl px-4 text-[13px]'
}

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant
  size?: ButtonSize
  icon?: ReactNode
  loading?: boolean
}

export function Button({
  variant = 'secondary',
  size = 'md',
  icon,
  loading = false,
  className,
  children,
  disabled,
  ...props
}: ButtonProps): React.JSX.Element {
  return (
    <button
      className={cx(
        'inline-flex shrink-0 items-center justify-center font-medium transition-colors duration-150',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/45',
        'disabled:pointer-events-none disabled:opacity-40',
        BUTTON_VARIANTS[variant],
        BUTTON_SIZES[size],
        className
      )}
      disabled={disabled || loading}
      {...props}
    >
      {loading ? <Loader2 className="h-3.5 w-3.5 spin" /> : icon}
      {children}
    </button>
  )
}

interface IconButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  label: string
  tone?: 'default' | 'danger'
}

export function IconButton({
  label,
  tone = 'default',
  className,
  children,
  ...props
}: IconButtonProps): React.JSX.Element {
  return (
    <button
      type="button"
      title={label}
      aria-label={label}
      className={cx(
        'inline-flex h-7.5 w-7.5 shrink-0 items-center justify-center rounded-lg border border-transparent text-faint transition-colors',
        'hover:border-edge hover:bg-white/[0.05] hover:text-ink',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/40',
        'disabled:pointer-events-none disabled:opacity-35',
        tone === 'danger' && 'hover:border-danger/20 hover:bg-danger/10 hover:text-danger',
        className
      )}
      {...props}
    >
      {children}
    </button>
  )
}

export function Badge({
  children,
  tone = 'neutral',
  className
}: {
  children: ReactNode
  tone?: 'neutral' | 'accent' | 'success' | 'danger' | 'info'
  className?: string
}): React.JSX.Element {
  const tones = {
    neutral: 'border-white/[0.08] bg-white/[0.04] text-muted',
    accent: 'border-accent/25 bg-accent-soft text-accent',
    success: 'border-mint/20 bg-mint/[0.08] text-mint',
    danger: 'border-danger/25 bg-danger/[0.08] text-danger',
    info: 'border-info/20 bg-info/[0.08] text-info'
  }
  return (
    <span
      className={cx(
        'inline-flex items-center gap-1 rounded-md border px-1.5 py-0.5 text-[10px] font-medium leading-4',
        tones[tone],
        className
      )}
    >
      {children}
    </span>
  )
}

export function Eyebrow({ children }: { children: ReactNode }): React.JSX.Element {
  return (
    <div className="text-[10px] font-medium uppercase tracking-[0.18em] text-faint">
      {children}
    </div>
  )
}

export function Select({
  className,
  children,
  ...props
}: SelectHTMLAttributes<HTMLSelectElement>): React.JSX.Element {
  return (
    <div className="relative">
      <select
        className={cx(
          'field h-8 w-full appearance-none rounded-lg border border-edge bg-white/[0.035] pl-2.5 pr-8 text-[11.5px] text-ink',
          'transition-colors hover:border-edge-strong focus:outline-none',
          className
        )}
        {...props}
      >
        {children}
      </select>
      <ChevronDown className="pointer-events-none absolute right-2 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-faint" />
    </div>
  )
}

export function FieldLabel({
  children,
  hint
}: {
  children: ReactNode
  hint?: ReactNode
}): React.JSX.Element {
  return (
    <div className="mb-1.5 flex items-center justify-between gap-3">
      <label className="text-[10.5px] font-medium uppercase tracking-[0.11em] text-muted">
        {children}
      </label>
      {hint}
    </div>
  )
}

export function ToggleRow({
  checked,
  onChange,
  title,
  description
}: {
  checked: boolean
  onChange: (value: boolean) => void
  title: string
  description: string
}): React.JSX.Element {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      onClick={() => onChange(!checked)}
      className="flex w-full items-start justify-between gap-4 rounded-xl border border-edge bg-white/[0.025] px-3.5 py-3 text-left transition-colors hover:bg-white/[0.045] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/40"
    >
      <span>
        <span className="block text-[12px] font-medium text-ink">{title}</span>
        <span className="mt-0.5 block text-[10.5px] leading-relaxed text-faint">{description}</span>
      </span>
      <span
        className={cx(
          'mt-0.5 flex h-5 w-9 shrink-0 items-center rounded-full border p-0.5 transition-colors',
          checked ? 'border-accent/40 bg-accent/90' : 'border-white/10 bg-white/[0.06]'
        )}
      >
        <span
          className={cx(
            'h-3.5 w-3.5 rounded-full bg-white shadow-sm transition-transform',
            checked ? 'translate-x-4' : 'translate-x-0'
          )}
        />
      </span>
    </button>
  )
}

export function EmptyState({
  icon,
  title,
  description,
  action
}: {
  icon: ReactNode
  title: string
  description: string
  action?: ReactNode
}): React.JSX.Element {
  return (
    <div className="flex flex-col items-center justify-center px-8 py-14 text-center">
      <div className="flex h-12 w-12 items-center justify-center rounded-2xl border border-white/[0.08] bg-white/[0.035] text-faint">
        {icon}
      </div>
      <h3 className="mt-4 text-[13.5px] font-medium text-ink">{title}</h3>
      <p className="mt-1.5 max-w-[330px] text-[11.5px] leading-relaxed text-faint">
        {description}
      </p>
      {action ? <div className="mt-4">{action}</div> : null}
    </div>
  )
}

export function Thumb({
  image,
  className,
  iconSize = 'h-4 w-4'
}: {
  image: ImageAsset
  className?: string
  iconSize?: string
}): React.JSX.Element {
  const [failed, setFailed] = useState(false)
  if (failed) {
    return (
      <div
        className={cx(
          'flex items-center justify-center rounded-lg border border-edge bg-white/[0.03] text-faint',
          className
        )}
      >
        <svg
          className={iconSize}
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.6"
        >
          <rect x="3" y="4" width="18" height="16" rx="2" />
          <circle cx="8.5" cy="9" r="1.5" />
          <path d="m21 15-4.5-4.5L7 20" />
        </svg>
      </div>
    )
  }
  return (
    <img
      src={imageUrl(image.path)}
      alt=""
      draggable={false}
      onError={() => setFailed(true)}
      className={cx('rounded-lg border border-edge bg-black/30 object-cover', className)}
    />
  )
}

export function Checkbox({
  checked,
  onChange,
  disabled,
  label
}: {
  checked: boolean
  onChange: () => void
  disabled?: boolean
  label: string
}): React.JSX.Element {
  return (
    <button
      type="button"
      role="checkbox"
      aria-checked={checked}
      aria-label={label}
      disabled={disabled}
      onClick={(event) => {
        event.stopPropagation()
        onChange()
      }}
      className={cx(
        'flex h-4 w-4 shrink-0 items-center justify-center rounded-[4px] border transition-colors',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/40',
        checked
          ? 'border-accent bg-accent text-accent-ink'
          : 'border-white/20 bg-white/[0.02] text-transparent hover:border-white/35',
        disabled && 'pointer-events-none opacity-30'
      )}
    >
      <Check className="h-3 w-3" strokeWidth={2.6} />
    </button>
  )
}

export function ProgressBar({ value, total }: { value: number; total: number }): React.JSX.Element {
  const percent = total > 0 ? Math.min(100, Math.round((value / total) * 100)) : 0
  return (
    <div className="h-1.5 w-full overflow-hidden rounded-full bg-white/[0.06]">
      <div
        className="h-full rounded-full bg-accent transition-all duration-300"
        style={{ width: `${percent}%` }}
      />
    </div>
  )
}

export function CloseChip({ onClick }: { onClick: () => void }): React.JSX.Element {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex h-4 w-4 items-center justify-center rounded-full text-faint transition-colors hover:bg-white/10 hover:text-ink"
      aria-label="Remove"
    >
      <X className="h-2.5 w-2.5" />
    </button>
  )
}

export function TextInput({
  className,
  ...props
}: InputHTMLAttributes<HTMLInputElement>): React.JSX.Element {
  return (
    <input
      className={cx(
        'field h-8 w-full rounded-lg border border-edge bg-white/[0.03] px-2.5 text-[12px] text-ink',
        'placeholder:text-faint focus:outline-none',
        className
      )}
      {...props}
    />
  )
}
