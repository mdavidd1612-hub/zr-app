import * as OTPAuth from 'otpauth'

export function generateTOTP(secret: string, label: string, issuer = 'ZR Mecademy'): string {
  const totp = new OTPAuth.TOTP({
    issuer,
    label,
    algorithm: 'SHA1',
    digits: 6,
    period: 30,
    secret: OTPAuth.Secret.fromBase32(secret),
  })

  return totp.generate()
}

// Obtiene cuántos segundos faltan para el siguiente código (para la barra de progreso)
export function secondsUntilNextTOTP(periodSeconds = 30): number {
  const now = Date.now()
  const elapsed = now % (periodSeconds * 1000)
  return Math.ceil((periodSeconds * 1000 - elapsed) / 1000)
}
