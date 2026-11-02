import {
  createContext,
  ReactNode,
  useContext,
  useMemo,
  useState,
} from "react";
import { mergeOcrFillEmpty } from "@/lib/cccd-ocr";

type PersonalData = {
  legalFirstName: string;
  legalLastName: string;
  dateOfBirth: string;
  phoneNumber: string;
  email: string;
  pronouns: string;
};

type IdentityData = {
  idNumber: string;
  expirationDate: string;
  residentialAddress: string;
  issuedDate: string;
  issuer: string;
  idFileName: string;
  idBackFileName: string;
};

type InsuranceData = {
  provider: string;
  memberId: string;
  groupNumber: string;
  cardFrontFileName: string;
  bhytName: string;
  bhytDob: string;
  bhytGender: string;
  bhytAddress: string;
  bhytKcb: string;
  bhytKcbCode: string;
  bhytValidFrom: string;
  bhytFiveYear: string;
};

export type OnboardingFormData = {
  personal: PersonalData;
  identity: IdentityData;
  insurance: InsuranceData;
  acceptedPrivacy: boolean;
};

const defaultData: OnboardingFormData = {
  personal: {
    legalFirstName: "",
    legalLastName: "",
    dateOfBirth: "",
    phoneNumber: "",
    email: "",
    pronouns: "",
  },
  identity: {
    idNumber: "",
    expirationDate: "",
    residentialAddress: "",
    issuedDate: "",
    issuer: "",
    idFileName: "",
    idBackFileName: "",
  },
  insurance: {
    provider: "",
    memberId: "",
    groupNumber: "",
    cardFrontFileName: "",
    bhytName: "",
    bhytDob: "",
    bhytGender: "",
    bhytAddress: "",
    bhytKcb: "",
    bhytKcbCode: "",
    bhytValidFrom: "",
    bhytFiveYear: "",
  },
  acceptedPrivacy: false,
};

export type PatientOnboardingUploadFiles = {
  idFile: File | null;
  idBackFile: File | null;
  cardFrontFile: File | null;
};

type OnboardingContextValue = {
  data: OnboardingFormData;
  uploadFiles: PatientOnboardingUploadFiles;
  updatePersonal: (updates: Partial<PersonalData>) => void;
  updateIdentity: (updates: Partial<IdentityData>) => void;
  updateInsurance: (updates: Partial<InsuranceData>) => void;
  updatePersonalFromOcr: (updates: Partial<PersonalData>) => void;
  updateIdentityFromOcr: (updates: Partial<IdentityData>) => void;
  updateInsuranceFromOcr: (updates: Partial<InsuranceData>) => void;
  setAcceptedPrivacy: (value: boolean) => void;
  setIdFile: (file: File | null) => void;
  setIdBackFile: (file: File | null) => void;
  setCardFrontFile: (file: File | null) => void;
  resetForm: () => void;
};

const OnboardingFormContext = createContext<OnboardingContextValue | null>(null);

const emptyUploadFiles: PatientOnboardingUploadFiles = {
  idFile: null,
  idBackFile: null,
  cardFrontFile: null,
};

export const OnboardingFormProvider = ({ children }: { children: ReactNode }) => {
  const [data, setData] = useState<OnboardingFormData>(defaultData);

  const [uploadFiles, setUploadFiles] = useState<PatientOnboardingUploadFiles>(emptyUploadFiles);

  const value = useMemo<OnboardingContextValue>(
    () => ({
      data,
      uploadFiles,
      updatePersonal: (updates) => {
        setData((prev) => ({ ...prev, personal: { ...prev.personal, ...updates } }));
      },
      updateIdentity: (updates) => {
        setData((prev) => ({ ...prev, identity: { ...prev.identity, ...updates } }));
      },
      updateInsurance: (updates) => {
        setData((prev) => ({ ...prev, insurance: { ...prev.insurance, ...updates } }));
      },
      updatePersonalFromOcr: (updates) => {
        setData((prev) => ({ ...prev, personal: mergeOcrFillEmpty(prev.personal, updates) }));
      },
      updateIdentityFromOcr: (updates) => {
        setData((prev) => ({ ...prev, identity: mergeOcrFillEmpty(prev.identity, updates) }));
      },
      updateInsuranceFromOcr: (updates) => {
        setData((prev) => ({ ...prev, insurance: mergeOcrFillEmpty(prev.insurance, updates) }));
      },
      setAcceptedPrivacy: (value) => {
        setData((prev) => ({ ...prev, acceptedPrivacy: value }));
      },
      setIdFile: (file) => {
        setUploadFiles((prev) => ({ ...prev, idFile: file }));
      },
      setIdBackFile: (file) => {
        setUploadFiles((prev) => ({ ...prev, idBackFile: file }));
      },
      setCardFrontFile: (file) => {
        setUploadFiles((prev) => ({ ...prev, cardFrontFile: file }));
      },
      resetForm: () => {
        setData(defaultData);
        setUploadFiles(emptyUploadFiles);
      },
    }),
    [data, uploadFiles],
  );

  return <OnboardingFormContext.Provider value={value}>{children}</OnboardingFormContext.Provider>;
};

export const useOnboardingForm = () => {
  const context = useContext(OnboardingFormContext);
  if (!context) {
    throw new Error("useOnboardingForm must be used within OnboardingFormProvider.");
  }
  return context;
};
