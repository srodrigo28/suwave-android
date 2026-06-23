/**
 * Equivalente nativo de app/motorista/src/types/enums.ts.
 */

export const DriverStatus = {
  RASCUNHO: 'RASCUNHO',
  EM_ANALISE: 'EM_ANALISE',
  APROVADO: 'APROVADO',
  RECUSADO: 'RECUSADO',
  BLOQUEADO: 'BLOQUEADO',
  SUSPENSO: 'SUSPENSO',
} as const;
export type DriverStatus = (typeof DriverStatus)[keyof typeof DriverStatus];

export const VehicleStatus = {
  EM_ANALISE: 'EM_ANALISE',
  APROVADO: 'APROVADO',
  BLOQUEADO: 'BLOQUEADO',
} as const;
export type VehicleStatus = (typeof VehicleStatus)[keyof typeof VehicleStatus];

export const RideStatus = {
  PROCURANDO: 'PROCURANDO',
  SEM_MOTORISTA: 'SEM_MOTORISTA',
  ACEITA: 'ACEITA',
  EM_ANDAMENTO: 'EM_ANDAMENTO',
  RECUSADA: 'RECUSADA',
  CONCLUIDA: 'CONCLUIDA',
  BLOQUEADA: 'BLOQUEADA',
} as const;
export type RideStatus = (typeof RideStatus)[keyof typeof RideStatus];

export const TripStatus = {
  ATIVA: 'ATIVA',
  CANCELADA: 'CANCELADA',
  CONCLUIDA: 'CONCLUIDA',
} as const;
export type TripStatus = (typeof TripStatus)[keyof typeof TripStatus];

export const DeliveryStatus = {
  PAID: 'paid',
  PREPARING: 'preparing',
  ON_ROUTE: 'on_route',
  DELIVERED: 'delivered',
} as const;
export type DeliveryStatus = (typeof DeliveryStatus)[keyof typeof DeliveryStatus];

export const Gender = {
  MASCULINO: 'masculino',
  FEMININO: 'feminino',
  OUTROS: 'outros',
} as const;
export type Gender = (typeof Gender)[keyof typeof Gender];

export const PixKeyType = {
  EMAIL: 'email',
  PHONE: 'phone',
  CPF: 'cpf',
  CNPJ: 'cnpj',
  RANDOM: 'random',
} as const;
export type PixKeyType = (typeof PixKeyType)[keyof typeof PixKeyType];
