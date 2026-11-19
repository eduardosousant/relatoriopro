import { CadastroCliente, CadastroPoco } from '../types/relatorio';

export function normalizarTextoCliente(str?: string): string {
  return (str || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

export function limparDigitosDocumento(doc?: string): string {
  const digits = (doc || '').replace(/\D/g, '');
  // Ignora sequências inválidas/placeholder curtas
  if (digits.length !== 11 && digits.length !== 14) return '';
  if (/^0+$/.test(digits)) return '';
  return digits;
}

/**
 * Determina com rigor se um poço pertence exclusivamente a um determinado cliente.
 * - Se o poço possui `clienteUuid`, exige correspondência exata pelo UUID do cliente.
 * - Para poços legados sem `clienteUuid`, faz correspondência exata pelo nome normalizado ou CNPJ/CPF válido.
 */
export function pertenceAoCliente(
  poco: CadastroPoco,
  cliente: CadastroCliente
): boolean {
  if (!poco || !cliente) return false;

  if (poco.clienteUuid && poco.clienteUuid.trim()) {
    return poco.clienteUuid === cliente.uuid;
  }

  const cnpjPoco = limparDigitosDocumento(poco.clienteCNPJ);
  const cnpjCliente = limparDigitosDocumento(cliente.cnpjCpf);
  if (cnpjPoco && cnpjCliente && cnpjPoco === cnpjCliente) {
    return true;
  }

  const nomePoco = normalizarTextoCliente(poco.cliente);
  const nomeCliente = normalizarTextoCliente(cliente.razaoSocial);
  const fantasiaCliente = normalizarTextoCliente(cliente.nomeFantasia);

  if (!nomePoco) return false;
  if (nomeCliente && nomePoco === nomeCliente) return true;
  if (fantasiaCliente && nomePoco === fantasiaCliente) return true;

  return false;
}

/**
 * Retorna exclusivamente os poços cadastrados para o cliente informado.
 */
export function obterPocosDoCliente(
  pocos: CadastroPoco[],
  cliente?: CadastroCliente | null
): CadastroPoco[] {
  if (!cliente) return [];
  return pocos
    .filter((p) => pertenceAoCliente(p, cliente))
    .sort((a, b) => a.tag.localeCompare(b.tag, 'pt-BR'));
}
