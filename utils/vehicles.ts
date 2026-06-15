import { SuwaveAssets } from '@/constants/suwave-theme';
import { DriverWorkMode, VehicleBrandOption } from '@/stores/driver-flow-store';

/**
 * Equivalente nativo (parcial) das constantes/helpers de veiculo em
 * app/motorista/src/app/page.tsx:231-303 e 3374-3423, 6523-6609.
 */
export const vehicleSteps = ['1', '2', '3', '4'];

export const fallbackBrands: VehicleBrandOption[] = [
  { codigo: 'gm', nome: 'Chevrolet' },
  { codigo: 'fiat', nome: 'Fiat' },
  { codigo: 'toyota', nome: 'Toyota' },
  { codigo: 'volkswagen', nome: 'Volkswagen' },
  { codigo: 'hyundai', nome: 'Hyundai' },
  { codigo: 'ford', nome: 'Ford' },
  { codigo: 'honda', nome: 'Honda' },
  { codigo: 'renault', nome: 'Renault' },
  { codigo: 'nissan', nome: 'Nissan' },
  { codigo: 'jeep', nome: 'Jeep' },
  { codigo: 'citroen', nome: 'Citroën' },
  { codigo: 'peugeot', nome: 'Peugeot' },
];

export function normalizeBrandName(value: string) {
  return value
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase();
}

export function getBrandInitials(name: string) {
  return name
    .split(/\s|-/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0])
    .join('')
    .toUpperCase();
}

export type VehiclePhotoSlotKey = 'front' | 'rear' | 'side' | 'interior';

export type VehiclePhotoSlot = {
  key: VehiclePhotoSlotKey;
  label: string;
};

export type WorkModeUi = {
  brandLabel: string;
  brandMode: 'select' | 'input';
  dataSubtitle: string;
  dataTitle: string;
  emptyPreviewImageSrc: keyof typeof SuwaveAssets;
  entityLabel: string;
  heroImageSrc: keyof typeof SuwaveAssets;
  needsPlate: boolean;
  needsYear: boolean;
  photoInfo: string;
  photoSubtitle: string;
  photoTitle: string;
  reviewPhotoAlt: string;
  slots: VehiclePhotoSlot[];
};

export function getWorkModeUi(mode: DriverWorkMode | null): WorkModeUi {
  switch (mode) {
    case 'moto_delivery':
      return {
        brandLabel: 'Fabricante',
        brandMode: 'select',
        dataSubtitle: 'Informe os dados da moto que você usará para realizar entregas.',
        dataTitle: 'Dados da moto',
        emptyPreviewImageSrc: 'workmodeMoto',
        entityLabel: 'moto',
        heroImageSrc: 'workmodeMoto',
        needsPlate: true,
        needsYear: true,
        photoInfo: 'ⓘ Envie fotos nítidas da frente, traseira, lateral e do painel ou baú da moto.',
        photoSubtitle: 'Envie fotos nítidas da moto para análise.',
        photoTitle: 'Fotos da moto',
        reviewPhotoAlt: 'Foto da moto cadastrada',
        slots: [
          { key: 'front', label: 'Frente' },
          { key: 'rear', label: 'Traseira' },
          { key: 'side', label: 'Lateral' },
          { key: 'interior', label: 'Painel ou baú' },
        ],
      };
    case 'bike_delivery':
      return {
        brandLabel: 'Marca',
        brandMode: 'input',
        dataSubtitle: 'Informe os dados da bicicleta que você usará para realizar entregas.',
        dataTitle: 'Dados da bicicleta',
        emptyPreviewImageSrc: 'workmodeBike',
        entityLabel: 'bicicleta',
        heroImageSrc: 'workmodeBike',
        needsPlate: false,
        needsYear: false,
        photoInfo: 'ⓘ Envie fotos nítidas da frente, traseira e lateral da bicicleta.',
        photoSubtitle: 'Envie fotos nítidas da bicicleta para análise.',
        photoTitle: 'Fotos da bicicleta',
        reviewPhotoAlt: 'Foto da bicicleta cadastrada',
        slots: [
          { key: 'front', label: 'Frente' },
          { key: 'rear', label: 'Traseira' },
          { key: 'side', label: 'Lateral' },
        ],
      };
    case 'car_trip_delivery':
    case 'car_delivery':
    default:
      return {
        brandLabel: 'Fabricante',
        brandMode: 'select',
        dataSubtitle: 'Informe os dados do veículo que você usará para realizar corridas.',
        dataTitle: 'Dados do veículo',
        emptyPreviewImageSrc: 'loginHero',
        entityLabel: 'veículo',
        heroImageSrc: 'loginHero',
        needsPlate: true,
        needsYear: true,
        photoInfo: 'ⓘ Certifique-se de que o veículo esteja bem iluminado e todos os detalhes visíveis.',
        photoSubtitle: 'Envie fotos nítidas do veículo para análise.',
        photoTitle: 'Fotos do veículo',
        reviewPhotoAlt: 'Foto frontal do veículo cadastrado',
        slots: [
          { key: 'front', label: 'Frente' },
          { key: 'rear', label: 'Traseira' },
          { key: 'side', label: 'Lateral' },
          { key: 'interior', label: 'Interior' },
        ],
      };
  }
}

export function workModeToVehicleType(mode: DriverWorkMode | null): 'car' | 'moto' | 'bike' {
  switch (mode) {
    case 'moto_delivery':
      return 'moto';
    case 'bike_delivery':
      return 'bike';
    case 'car_trip_delivery':
    case 'car_delivery':
    default:
      return 'car';
  }
}

export function getVehicleStatusLabel(status?: string | null) {
  if (!status) {
    return 'Em análise';
  }

  switch (status.toUpperCase()) {
    case 'APROVADO':
      return 'Ativo';
    case 'REJEITADO':
      return 'Reprovado';
    case 'PENDENTE':
      return 'Em análise';
    default:
      return status;
  }
}

export function formatVehicleYear(value?: string | number | null) {
  if (value == null || value === '') {
    return 'Não informado';
  }

  return String(value);
}
