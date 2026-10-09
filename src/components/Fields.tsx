// Form fields with validation by regular expression, length limits and Spanish messages.

import { useState, type InputHTMLAttributes, type ReactNode } from "react";
import { check, PASSWORD_CHECKS, PASSWORD_MAX, type Rule } from "../validation";

interface TextFieldProps extends Omit<InputHTMLAttributes<HTMLInputElement>, "onChange" | "value"> {
  label: string;
  rule: Rule;
  value: string;
  onChange: (value: string) => void;
  required?: boolean;
  hint?: ReactNode;
  // Show the error even if the user has not left the field (after a submit attempt).
  showErrors?: boolean;
}

export function TextField({ label, rule, value, onChange, required = true, hint, showErrors, ...rest }: TextFieldProps) {
  const [touched, setTouched] = useState(false);
  const [blocked, setBlocked] = useState(false);
  const error = check(rule, value, required);
  // An empty field only complains after a submit attempt, not just for leaving it.
  const visible = error && (showErrors || (touched && value !== ""));

  function handle(raw: string) {
    let next = rule.transform ? rule.transform(raw) : raw;
    if (rule.allowed && !rule.allowed.test(next)) {
      setBlocked(true); // character not allowed: ignore it
      return;
    }
    if (next.length > rule.maxLength) next = next.slice(0, rule.maxLength);
    setBlocked(false);
    onChange(next);
  }

  return (
    <label className={`field${visible ? " field-invalid" : ""}`}>
      <span className="field-label">
        {label}
        {!required && <small className="muted"> (opcional)</small>}
        <small className="field-count" aria-hidden="true">
          {value.length}/{rule.maxLength}
        </small>
      </span>
      <input
        {...rest}
        value={value}
        maxLength={rule.maxLength}
        required={required}
        aria-invalid={Boolean(visible)}
        onChange={(e) => handle(e.target.value)}
        onBlur={() => setTouched(true)}
      />
      {visible ? (
        <small className="field-error">{error}</small>
      ) : blocked ? (
        <small className="field-error">Ese carácter no está permitido aquí.</small>
      ) : (
        hint && <small className="field-hint">{hint}</small>
      )}
    </label>
  );
}

interface PasswordFieldProps {
  label?: string;
  value: string;
  onChange: (value: string) => void;
  autoComplete: "current-password" | "new-password";
  // Show the password policy checklist (when creating a password).
  withPolicy?: boolean;
}

// The password is always masked: there is no "show" button, it cannot be copied
// and it is limited to 64 characters. It is hashed before being sent.
export function PasswordField({ label = "Contraseña", value, onChange, autoComplete, withPolicy }: PasswordFieldProps) {
  const [capsLock, setCapsLock] = useState(false);
  return (
    <div className="field">
      <label className="field-label" htmlFor={`pw-${autoComplete}`}>
        {label}
        <small className="field-count" aria-hidden="true">
          {value.length}/{PASSWORD_MAX}
        </small>
      </label>
      <input
        id={`pw-${autoComplete}`}
        type="password"
        autoComplete={autoComplete}
        required
        maxLength={PASSWORD_MAX}
        value={value}
        spellCheck={false}
        onChange={(e) => onChange(e.target.value.slice(0, PASSWORD_MAX))}
        onKeyUp={(e) => setCapsLock(e.getModifierState("CapsLock"))}
        onCopy={(e) => e.preventDefault()}
        onCut={(e) => e.preventDefault()}
      />
      {capsLock && <small className="field-error">Bloq Mayús está activado.</small>}
      {withPolicy && (
        <ul className="password-policy" aria-label="Requisitos de la contraseña">
          {PASSWORD_CHECKS.map((rule) => {
            const ok = rule.test(value);
            return (
              <li key={rule.label} className={ok ? "is-ok" : ""}>
                <span aria-hidden="true">{ok ? "✓" : "•"}</span> {rule.label}
              </li>
            );
          })}
        </ul>
      )}
      <small className="field-hint">
        <LockIcon /> Se cifra en su dispositivo (SHA-256) antes de enviarse; nunca viaja ni se guarda tal cual.
      </small>
    </div>
  );
}

function LockIcon() {
  return (
    <svg viewBox="0 0 16 16" width="12" height="12" aria-hidden="true" style={{ verticalAlign: "-1px" }}>
      <rect x="3" y="7" width="10" height="8" rx="1.5" fill="currentColor" />
      <path d="M5 7V5a3 3 0 0 1 6 0v2" fill="none" stroke="currentColor" strokeWidth="1.6" />
    </svg>
  );
}

interface SelectFieldProps {
  label: string;
  value: string;
  onChange: (value: string) => void;
  options: { value: string | number; label: string }[];
  placeholder?: string;
  required?: boolean;
  disabled?: boolean;
}

export function SelectField({ label, value, onChange, options, placeholder, required = true, disabled }: SelectFieldProps) {
  return (
    <label className="field">
      <span className="field-label">
        {label}
        {!required && <small className="muted"> (opcional)</small>}
      </span>
      <select value={value} required={required} disabled={disabled} onChange={(e) => onChange(e.target.value)}>
        {placeholder !== undefined && <option value="">{placeholder}</option>}
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </label>
  );
}

interface NumberFieldProps {
  label: string;
  value: string;
  onChange: (value: string) => void;
  min: number;
  max: number;
  step?: number;
  hint?: ReactNode;
  required?: boolean;
}

// Numbers with hard limits: values outside the range are rejected while typing.
export function NumberField({ label, value, onChange, min, max, step = 1, hint, required = true }: NumberFieldProps) {
  const decimals = step < 1;
  const allowed = decimals ? /^-?\d{0,4}(\.\d{0,6})?$/ : /^-?\d{0,4}$/;
  const number = Number(value);
  const outOfRange = value !== "" && value !== "-" && (Number.isNaN(number) || number < min || number > max);
  return (
    <label className={`field${outOfRange ? " field-invalid" : ""}`}>
      <span className="field-label">{label}</span>
      <input
        type="text"
        inputMode={decimals ? "decimal" : "numeric"}
        value={value}
        required={required}
        maxLength={12}
        aria-invalid={outOfRange}
        onChange={(e) => {
          const next = e.target.value.replace(",", ".");
          if (allowed.test(next)) onChange(next);
        }}
      />
      {outOfRange ? (
        <small className="field-error">
          Debe estar entre {min} y {max}.
        </small>
      ) : (
        hint && <small className="field-hint">{hint}</small>
      )}
    </label>
  );
}

export function isValidNumber(value: string, min: number, max: number): boolean {
  if (value === "" || value === "-") return false;
  const number = Number(value);
  return !Number.isNaN(number) && number >= min && number <= max;
}
