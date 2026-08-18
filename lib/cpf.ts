/**
 * Validação e formatação de CPF (algoritmo padrão dos dígitos verificadores).
 * Sem dependência externa — é só aritmética sobre os 11 dígitos.
 */

function calcularDigitoVerificador(digitos: string, peso: number): number {
  let soma = 0;
  for (let i = 0; i < digitos.length; i++) {
    soma += Number(digitos[i]) * (peso - i);
  }
  const resto = (soma * 10) % 11;
  return resto === 10 ? 0 : resto;
}

/** Retorna só os dígitos de um CPF (remove pontuação, espaços etc.). */
export function apenasDigitosCpf(valor: string): string {
  return valor.replace(/\D/g, "");
}

/**
 * Valida um CPF (11 dígitos + dígitos verificadores corretos). Rejeita
 * sequências repetidas (ex: "00000000000"), que passam no cálculo do
 * dígito verificador mas nunca são CPFs reais emitidos.
 */
export function cpfValido(valor: string): boolean {
  const digitos = apenasDigitosCpf(valor);
  if (digitos.length !== 11) return false;
  if (/^(\d)\1{10}$/.test(digitos)) return false;

  const dv1 = calcularDigitoVerificador(digitos.slice(0, 9), 10);
  if (dv1 !== Number(digitos[9])) return false;

  const dv2 = calcularDigitoVerificador(digitos.slice(0, 10), 11);
  if (dv2 !== Number(digitos[10])) return false;

  return true;
}

/** Formata os 11 dígitos de um CPF já validado como `000.000.000-00`. */
export function formatarCpf(valor: string): string {
  const digitos = apenasDigitosCpf(valor);
  return `${digitos.slice(0, 3)}.${digitos.slice(3, 6)}.${digitos.slice(6, 9)}-${digitos.slice(9, 11)}`;
}
