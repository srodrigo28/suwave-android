export const reviewApprovalWindowSeconds = 10 * 60;

export const reviewMissingLabels: Record<string, string> = {
  cnh_back: 'verso da CNH',
  cnh_front: 'frente da CNH',
  cnpj: 'CNPJ',
  cpf: 'CPF',
  email: 'e-mail',
  face_photo: 'foto do rosto',
  full_name: 'nome completo',
  gender: 'sexo',
  pix_account: 'conta Pix',
  pix_key_type: 'tipo de chave Pix',
};

export function formatReviewTime(seconds: number) {
  const safeSeconds = Math.max(0, seconds);
  const minutes = Math.floor(safeSeconds / 60);
  const remainingSeconds = safeSeconds % 60;

  return `${minutes}:${String(remainingSeconds).padStart(2, '0')}`;
}
