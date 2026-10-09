// Form rules: the same regular expressions the API uses (app/validation.py),
// so mistakes are caught before anything is sent. Messages are in Spanish.

export interface Rule {
  pattern: RegExp;
  maxLength: number;
  minLength?: number;
  message: string;
  // Characters allowed while typing (blocks anything else at the keyboard).
  allowed?: RegExp;
  transform?: (value: string) => string;
}

const LETTERS = "A-Za-zÁÉÍÓÚáéíóúÑñÜü";

export const RULES = {
  personName: {
    pattern: new RegExp(`^[${LETTERS}]+(?:[ '-][${LETTERS}]+)*$`),
    minLength: 2,
    maxLength: 50,
    allowed: new RegExp(`^[${LETTERS} '-]*$`),
    message: "Solo letras, espacios, guion o apóstrofo (2 a 50 caracteres).",
  },
  email: {
    pattern: /^[a-z0-9._%+-]{1,64}@[a-z0-9-]{1,63}(?:\.[a-z0-9-]{1,63})*\.[a-z]{2,10}$/,
    minLength: 6,
    maxLength: 120,
    allowed: /^[a-zA-Z0-9._%+@-]*$/,
    transform: (v: string) => v.toLowerCase(),
    message: "Correo no válido. Ejemplo: nombre@dominio.com",
  },
  phone: {
    pattern: /^3[0-9]{9}$/,
    minLength: 10,
    maxLength: 10,
    allowed: /^[0-9]*$/,
    message: "Celular colombiano de 10 dígitos que empiece por 3.",
  },
  document: {
    pattern: /^[0-9]{6,10}$/,
    minLength: 6,
    maxLength: 10,
    allowed: /^[0-9]*$/,
    message: "Solo números, de 6 a 10 dígitos.",
  },
  plate: {
    pattern: /^[A-Z]{3}[0-9]{3}$/,
    minLength: 6,
    maxLength: 6,
    allowed: /^[A-Za-z0-9]*$/,
    transform: (v: string) => v.toUpperCase(),
    message: "Placa de 3 letras y 3 números. Ejemplo: ABC123",
  },
  license: {
    pattern: /^[0-9]{6,12}$/,
    minLength: 6,
    maxLength: 12,
    allowed: /^[0-9]*$/,
    message: "Número de licencia: solo números, de 6 a 12 dígitos.",
  },
  label: {
    pattern: new RegExp(`^[${LETTERS}0-9]+(?:[ .,#°º()'/-]+[${LETTERS}0-9]+)*[.)]?$`),
    minLength: 3,
    maxLength: 80,
    allowed: new RegExp(`^[${LETTERS}0-9 .,#°º()'/-]*$`),
    message: "Use letras, números y signos básicos (3 a 80 caracteres).",
  },
  catalogName: {
    pattern: new RegExp(`^[${LETTERS}0-9]+(?:[ .,#°º()'/-]+[${LETTERS}0-9]+)*[.)]?$`),
    minLength: 2,
    maxLength: 60,
    allowed: new RegExp(`^[${LETTERS}0-9 .,#°º()'/-]*$`),
    message: "Use letras, números y signos básicos (2 a 60 caracteres).",
  },
  code: {
    pattern: /^[a-z][a-z_]{1,29}$/,
    minLength: 2,
    maxLength: 30,
    allowed: /^[a-z_]*$/,
    transform: (v: string) => v.toLowerCase(),
    message: "Código interno: minúsculas y guion bajo, sin espacios. Ejemplo: heavy_rain",
  },
  weatherCodes: {
    pattern: /^[0-9]{1,2}(?:,[0-9]{1,2}){0,19}$/,
    maxLength: 60,
    allowed: /^[0-9,]*$/,
    message: "Números separados por coma (códigos de Open-Meteo). Ejemplo: 61,63",
  },
  freeText: {
    pattern: /^[^<>{}$\\]+$/,
    minLength: 10,
    maxLength: 500,
    allowed: /^[^<>{}$\\]*$/,
    message: "Describa lo ocurrido (10 a 500 caracteres, sin < > { } $ \\).",
  },
  qr: {
    pattern: /^RS-[A-Z0-9]{4,8}(?:-[A-Z0-9]{4})?$/,
    minLength: 7,
    maxLength: 20,
    allowed: /^[A-Za-z0-9-]*$/,
    transform: (v: string) => v.toUpperCase(),
    message: "Código del carnet, por ejemplo RS-DEMO-0001.",
  },
} satisfies Record<string, Rule>;

export type RuleName = keyof typeof RULES;

// Messages that already appear under each field (not repeated in the form summary).
export const FIELD_MESSAGES = new Set<string>([
  "Campo obligatorio.",
  ...Object.values(RULES).map((rule: Rule) => rule.message),
]);

// Returns an error message or null.
export function check(rule: Rule, value: string, required = true): string | null {
  if (!value) return required ? "Campo obligatorio." : null;
  if (value.length > rule.maxLength) return rule.message;
  if (rule.minLength && value.length < rule.minLength) return rule.message;
  return rule.pattern.test(value) ? null : rule.message;
}

// ---------------------------------------------------------------------------
// Password policy (checked here because the server only receives the hash).
// ---------------------------------------------------------------------------

export const PASSWORD_MAX = 64;
export const PASSWORD_MIN = 8;

export const PASSWORD_CHECKS: { label: string; test: (v: string) => boolean }[] = [
  { label: `Entre ${PASSWORD_MIN} y ${PASSWORD_MAX} caracteres`, test: (v) => v.length >= PASSWORD_MIN && v.length <= PASSWORD_MAX },
  { label: "Una letra mayúscula", test: (v) => /[A-ZÑ]/.test(v) },
  { label: "Una letra minúscula", test: (v) => /[a-zñ]/.test(v) },
  { label: "Un número", test: (v) => /[0-9]/.test(v) },
  { label: "Un símbolo (* . ! @ # $ % & _ -)", test: (v) => /[*.!@#$%&_\-?+=]/.test(v) },
  { label: "Sin espacios", test: (v) => v.length > 0 && !/\s/.test(v) },
];

export function passwordProblems(value: string): string[] {
  return PASSWORD_CHECKS.filter((c) => !c.test(value)).map((c) => c.label);
}
