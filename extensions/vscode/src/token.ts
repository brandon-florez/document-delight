/** Clave dentro del almacén cifrado de Cursor. El valor no se escribe en el repositorio. */
export const TOKEN_SECRET_KEY = "nexo.developerToken";

/** El portal genera `nxo_` más 64 hexadecimales (dos UUID sin guiones). */
export const TOKEN_PATTERN = /^nxo_[0-9a-f]{64}$/i;

export function validateToken(value: string): string | undefined {
  const trimmed = value.trim();
  if (!trimmed) {
    return "Escribe el token.";
  }
  if (!TOKEN_PATTERN.test(trimmed)) {
    return "El token debe empezar por nxo_ y tener el formato que genera el portal.";
  }
  return undefined;
}
