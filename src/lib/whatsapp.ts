/** Click-to-chat opens WhatsApp's app/web handoff, not a number-availability check. */
export function linkWhatsApp(telefone: string | null | undefined): string | null {
  const digitos = (telefone ?? "").replace(/\D/g, "");
  const numero = digitos.length === 10 || digitos.length === 11 ? `55${digitos}` : digitos;
  if (!/^55[1-9]\d(?:[2-5]\d{7}|9\d{8})$/.test(numero)) return null;
  return `https://wa.me/${numero}`;
}