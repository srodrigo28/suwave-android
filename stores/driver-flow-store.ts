import AsyncStorage from '@react-native-async-storage/async-storage';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

import { DriverDelivery, DriverRideRequest } from '@/services/driver-client';

export type DriverSignupForm = {
  accepted_privacy: boolean;
  accepted_terms: boolean;
  birth_date: string;
  cnpj: string;
  confirm_password: string;
  cpf: string;
  email: string;
  full_name: string;
  gender: string;
  password: string;
  pix_account: string;
  pix_key_type: string;
  whatsapp: string;
};

export const initialSignupForm: DriverSignupForm = {
  accepted_privacy: false,
  accepted_terms: false,
  birth_date: '',
  cnpj: '',
  confirm_password: '',
  cpf: '',
  email: '',
  full_name: '',
  gender: '',
  password: '',
  pix_account: '',
  pix_key_type: '',
  whatsapp: '',
};

export type DriverFlowImage = {
  uri: string;
  name: string;
  type: string;
  size: number;
};

export type VehicleBrandOption = {
  codigo: string;
  nome: string;
};

export type VehicleForm = {
  model: string;
  plate: string;
  year: string;
};

export const initialVehicleForm: VehicleForm = {
  model: '',
  plate: '',
  year: '',
};

export type DriverWorkMode = 'car_trip_delivery' | 'car_delivery' | 'moto_delivery' | 'bike_delivery';

export type VehicleUploads = {
  front?: DriverFlowImage;
  interior?: DriverFlowImage;
  rear?: DriverFlowImage;
  side?: DriverFlowImage;
};

type DriverFlowState = {
  signupForm: DriverSignupForm;
  signupStep: number;
  /** true quando o e-mail do cadastro já existe como comprador (não como motorista). */
  isLinkingExistingAccount: boolean;
  faceImage?: DriverFlowImage;
  cnhFront?: DriverFlowImage;
  cnhBack?: DriverFlowImage;
  editingVehicleId?: string;
  selectedWorkMode: DriverWorkMode | null;
  selectedBrand: VehicleBrandOption | null;
  vehicleForm: VehicleForm;
  vehicleUploads: VehicleUploads;
  pendingRide: DriverRideRequest | null;
  pendingDelivery: DriverDelivery | null;
  activeRide: DriverRideRequest | null;
  activeDelivery: DriverDelivery | null;
  setSignupForm: (form: DriverSignupForm) => void;
  setSignupStep: (step: number) => void;
  setIsLinkingExistingAccount: (value: boolean) => void;
  setFaceImage: (image: DriverFlowImage) => void;
  setCnhFront: (image: DriverFlowImage) => void;
  setCnhBack: (image: DriverFlowImage) => void;
  setEditingVehicleId: (id?: string) => void;
  setSelectedWorkMode: (mode: DriverWorkMode | null) => void;
  setSelectedBrand: (brand: VehicleBrandOption | null) => void;
  setVehicleForm: (form: VehicleForm) => void;
  updateVehicleForm: (patch: Partial<VehicleForm>) => void;
  setVehicleUploads: (uploads: VehicleUploads) => void;
  setPendingRide: (ride: DriverRideRequest | null) => void;
  setPendingDelivery: (delivery: DriverDelivery | null) => void;
  setActiveRide: (ride: DriverRideRequest | null) => void;
  setActiveDelivery: (delivery: DriverDelivery | null) => void;
  resetFlow: () => void;
};

export const useDriverFlowStore = create<DriverFlowState>()(
  persist(
    (set) => ({
      signupForm: initialSignupForm,
      signupStep: 1,
      isLinkingExistingAccount: false,
      faceImage: undefined,
      cnhFront: undefined,
      cnhBack: undefined,
      editingVehicleId: undefined,
      selectedWorkMode: null,
      selectedBrand: null,
      vehicleForm: initialVehicleForm,
      vehicleUploads: {},
      pendingRide: null,
      pendingDelivery: null,
      activeRide: null,
      activeDelivery: null,
      setSignupForm: (form) => set({ signupForm: form }),
      setSignupStep: (step) => set({ signupStep: step }),
      setIsLinkingExistingAccount: (value) => set({ isLinkingExistingAccount: value }),
      setFaceImage: (image) => set({ faceImage: image }),
      setCnhFront: (image) => set({ cnhFront: image }),
      setCnhBack: (image) => set({ cnhBack: image }),
      setEditingVehicleId: (id) => set({ editingVehicleId: id }),
      setSelectedWorkMode: (mode) => set({ selectedWorkMode: mode }),
      setSelectedBrand: (brand) => set({ selectedBrand: brand }),
      setVehicleForm: (form) => set({ vehicleForm: form }),
      updateVehicleForm: (patch) => set((state) => ({ vehicleForm: { ...state.vehicleForm, ...patch } })),
      setVehicleUploads: (uploads) => set({ vehicleUploads: uploads }),
      setPendingRide: (ride) => set({ pendingRide: ride }),
      setPendingDelivery: (delivery) => set({ pendingDelivery: delivery }),
      setActiveRide: (ride) => set({ activeRide: ride }),
      setActiveDelivery: (delivery) => set({ activeDelivery: delivery }),
      resetFlow: () =>
        set({
          signupForm: initialSignupForm,
          signupStep: 1,
          isLinkingExistingAccount: false,
          faceImage: undefined,
          cnhFront: undefined,
          cnhBack: undefined,
          editingVehicleId: undefined,
          selectedWorkMode: null,
          selectedBrand: null,
          vehicleForm: initialVehicleForm,
          vehicleUploads: {},
        }),
    }),
    {
      name: 'suwave-driver-flow',
      storage: createJSONStorage(() => AsyncStorage),
      partialize: (state) => ({
        activeRide: state.activeRide,
        activeDelivery: state.activeDelivery,
      }),
    },
  ),
);
