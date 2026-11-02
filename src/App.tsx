import type { ReactNode } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Navigate, Route, Routes, useParams } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import Landing from "./pages/Landing.tsx";
import Home from "./pages/Home.tsx";
import AccountLayout from "./pages/account/AccountLayout.tsx";
import AccountPersonalPage from "./pages/account/AccountPersonalPage.tsx";
import AccountInsurancePage from "./pages/account/AccountInsurancePage.tsx";
import AccountMedicalSupportPage from "./pages/account/AccountMedicalSupportPage.tsx";
import AccountMedicalHistoryPage from "./pages/account/AccountMedicalHistoryPage.tsx";
import AccountVitalsPage from "./pages/account/AccountVitalsPage.tsx";
import AccountSexualHealthPage from "./pages/account/AccountSexualHealthPage.tsx";
import AccountDemographicsPage from "./pages/account/AccountDemographicsPage.tsx";
import AccountSettingsPage from "./pages/account/AccountSettingsPage.tsx";
import AccountDocumentsPage from "./pages/account/AccountDocumentsPage.tsx";
import AccountAddressPage from "./pages/account/AccountAddressPage.tsx";
import Labs from "./pages/Labs.tsx";
import LabResultDetail from "./pages/LabResultDetail.tsx";
import Prescriptions from "./pages/Prescriptions.tsx";
import PrescriptionDetail from "./pages/PrescriptionDetail.tsx";
import Appointments from "./pages/Appointments.tsx";
import PatientExamHistoryPage from "./pages/PatientExamHistoryPage.tsx";
import BookAppointment from "./pages/BookAppointment.tsx";
import PreConsultation from "./pages/PreConsultation.tsx";
import HealthDeclaration from "./pages/HealthDeclaration.tsx";
import OcrProfile from "./pages/OcrProfile.tsx";
import Support from "./pages/Support.tsx";
import Messages from "./pages/Messages.tsx";
import Login, { AdminLogin, DoctorLogin, PatientLogin } from "./pages/Login.tsx";
import Signup from "./pages/Signup.tsx";
import AuthCallback from "./pages/AuthCallback.tsx";
import SetPasswordFromEmail from "./pages/SetPasswordFromEmail.tsx";
import AuthHashRedirect from "./components/auth/AuthHashRedirect.tsx";
import ForgotPassword from "./pages/ForgotPassword.tsx";
import About from "./pages/About.tsx";
import Admin from "./pages/Admin.tsx";
import AdminSectionPlaceholder from "./pages/admin/AdminSectionPlaceholder.tsx";
import AdminUsersContent from "./components/admin/AdminUsersContent.tsx";
import AdminRolesContent from "./components/admin/AdminRolesContent.tsx";
import AdminPermissionsContent from "./components/admin/AdminPermissionsContent.tsx";
import MasterDataContent from "./components/admin/MasterDataContent.tsx";
import AdminAppointmentsContent from "./components/admin/AdminAppointmentsContent.tsx";
import PatientRecordsManagement from "./components/patient-records/PatientRecordsManagement.tsx";
import NotFound from "./pages/NotFound.tsx";
import { AuthProvider } from "./hooks/use-auth.tsx";
import { PatientDobProvider } from "./hooks/usePatientDobVerification.tsx";
import { OnboardingFormProvider } from "./hooks/useOnboardingForm";
import ProtectedRoute from "./components/ProtectedRoute.tsx";
import OnboardingLayout from "./components/onboarding/OnboardingLayout";
import OnboardingFormPage from "./pages/OnboardingFormPage.tsx";
import VerifyDob from "./pages/VerifyDob.tsx";
import ProviderPortal from "./pages/ProviderPortal";
import ProviderDashboard from "./components/provider/ProviderDashboard";
import ProviderPatientsPage from "./pages/provider/ProviderPatientsPage";
import ProviderSectionPlaceholder from "./pages/provider/ProviderSectionPlaceholder";
import ProviderAppointmentsPage from "./pages/provider/ProviderAppointmentsPage";
import { DoctorNotificationsProvider } from "./hooks/DoctorNotificationsContext";
import QuestionLibraryPage from "./pages/admin/clinical-logic/QuestionLibraryPage.tsx";
import QuestionnaireBuilderPage from "./pages/admin/clinical-logic/QuestionnaireBuilderPage.tsx";
import ExaminationPage from "./pages/provider/ExaminationPage.tsx";
import DoctorProfilePage from "./pages/provider/DoctorProfilePage.tsx";
import DoctorMedicalHistoryPage from "./pages/provider/DoctorMedicalHistoryPage.tsx";
import ClinicalTasksContent from "./components/provider/ClinicalTasksContent.tsx";
import AdminAiAccuracyPage from "./pages/admin/AdminAiAccuracyPage.tsx";
import DeltaLogPage from "./pages/admin/DeltaLogPage.tsx";
import CustomerPortal from "./pages/customer/CustomerPortal.tsx";
import CustomerOverviewPage from "./pages/customer/CustomerOverviewPage.tsx";
import CustomerPermissionGuard from "./pages/customer/CustomerPermissionGuard.tsx";
import { PermissionsProvider } from "./hooks/use-permissions.tsx";

const queryClient = new QueryClient();

function PatientRoute({ children }: { children: ReactNode }) {
  return <ProtectedRoute requiredPortal="patient">{children}</ProtectedRoute>;
}

function RedirectClinicalLogicQuestionnaire() {
  const { id } = useParams();
  return <Navigate to={`/admin/question-library/${id}`} replace />;
}

const App = () => (
  <QueryClientProvider client={queryClient}>
    <AuthProvider>
      <PatientDobProvider>
      <PermissionsProvider>
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <BrowserRouter>
          <AuthHashRedirect />
          <Routes>
            <Route path="/" element={<Landing />} />
            <Route
              path="/home"
              element={
                <PatientRoute>
                  <Home />
                </PatientRoute>
              }
            />
            <Route
              path="/account"
              element={
                <PatientRoute>
                  <AccountLayout />
                </PatientRoute>
              }
            >
              <Route index element={<Navigate to="personal" replace />} />
              <Route path="personal" element={<AccountPersonalPage />} />
              <Route path="documents" element={<AccountDocumentsPage />} />
              <Route path="address" element={<AccountAddressPage />} />
              <Route path="insurance" element={<AccountInsurancePage />} />
              <Route path="medical-support" element={<AccountMedicalSupportPage />} />
              <Route path="medical-history" element={<AccountMedicalHistoryPage />} />
              <Route path="vitals" element={<AccountVitalsPage />} />
              <Route path="sexual-health" element={<AccountSexualHealthPage />} />
              <Route path="demographics" element={<AccountDemographicsPage />} />
              <Route path="settings" element={<AccountSettingsPage />} />
            </Route>
            <Route
              path="/labs"
              element={
                <PatientRoute>
                  <Labs />
                </PatientRoute>
              }
            />
            <Route
              path="/labs/detail"
              element={
                <PatientRoute>
                  <LabResultDetail />
                </PatientRoute>
              }
            />
            <Route
              path="/prescriptions"
              element={
                <PatientRoute>
                  <Prescriptions />
                </PatientRoute>
              }
            />
            <Route
              path="/prescriptions/detail"
              element={
                <PatientRoute>
                  <PrescriptionDetail />
                </PatientRoute>
              }
            />
            <Route
              path="/appointments"
              element={
                <PatientRoute>
                  <Appointments />
                </PatientRoute>
              }
            />
            <Route
              path="/exam-history"
              element={
                <PatientRoute>
                  <PatientExamHistoryPage />
                </PatientRoute>
              }
            />
            <Route
              path="/appointments/book"
              element={
                <PatientRoute>
                  <BookAppointment />
                </PatientRoute>
              }
            />
            <Route
              path="/appointments/:appointmentId/pre-consultation"
              element={
                <PatientRoute>
                  <PreConsultation />
                </PatientRoute>
              }
            />
            <Route
              path="/health-declaration"
              element={
                <PatientRoute>
                  <HealthDeclaration />
                </PatientRoute>
              }
            />
            <Route
              path="/ocr-profile"
              element={
                <PatientRoute>
                  <OcrProfile />
                </PatientRoute>
              }
            />
            <Route
              path="/support"
              element={
                <PatientRoute>
                  <Support />
                </PatientRoute>
              }
            />
            <Route
              path="/messages"
              element={
                <PatientRoute>
                  <Messages />
                </PatientRoute>
              }
            />
            <Route
              path="/verify-dob"
              element={
                <ProtectedRoute requiredPortal="patient">
                  <VerifyDob />
                </ProtectedRoute>
              }
            />
            <Route path="/login" element={<Login />} />
            <Route path="/patient/login" element={<PatientLogin />} />
            <Route path="/doctor/login" element={<DoctorLogin />} />
            <Route path="/admin/login" element={<AdminLogin />} />
            {/* legacy aliases */}
            <Route path="/forgot-password" element={<ForgotPassword />} />
            <Route path="/auth/callback" element={<AuthCallback />} />
            <Route path="/auth/set-password" element={<SetPasswordFromEmail />} />
            <Route path="/register" element={<Signup />} />
            <Route path="/signup" element={<Signup />} />
            <Route
              path="/provider-portal"
              element={
                <ProtectedRoute requiredPortal="doctor">
                  <DoctorNotificationsProvider>
                    <ProviderPortal />
                  </DoctorNotificationsProvider>
                </ProtectedRoute>
              }
            >
              <Route index element={<Navigate to="dashboard" replace />} />
              <Route path="dashboard" element={<ProviderDashboard />} />
              <Route
                path="patient-records"
                element={<PatientRecordsManagement portal="doctor" />}
              />
              <Route path="patients" element={<ProviderPatientsPage />} />
              <Route path="appointments" element={<ProviderAppointmentsPage />} />
              <Route path="examination/:appointmentId" element={<ExaminationPage />} />
              <Route path="tasks" element={<ClinicalTasksContent portal="doctor" />} />
              <Route path="medical-history" element={<DoctorMedicalHistoryPage />} />
              <Route path="profile" element={<DoctorProfilePage />} />
              <Route path="analytics" element={<ProviderSectionPlaceholder title="Analytics" />} />
            </Route>
            <Route
              path="/onboarding"
              element={
                <ProtectedRoute requiredPortal="patient">
                  <OnboardingFormProvider>
                    <OnboardingLayout />
                  </OnboardingFormProvider>
                </ProtectedRoute>
              }
            >
              <Route index element={<OnboardingFormPage />} />
              <Route path="profile" element={<Navigate to="/onboarding" replace />} />
              <Route path="personal" element={<Navigate to="/onboarding" replace />} />
              <Route path="insurance" element={<Navigate to="/onboarding" replace />} />
              <Route path="review" element={<Navigate to="/onboarding" replace />} />
            </Route>
            <Route
              path="/customer-portal"
              element={
                <ProtectedRoute requiredPortal="customer">
                  <CustomerPortal />
                </ProtectedRoute>
              }
            >
              <Route index element={<Navigate to="overview" replace />} />
              <Route element={<CustomerPermissionGuard />}>
                <Route path="overview" element={<CustomerOverviewPage />} />
                <Route
                  path="patient-records"
                  element={<PatientRecordsManagement portal="admin" />}
                />
                <Route path="patients" element={<ProviderPatientsPage />} />
                <Route path="appointments" element={<AdminAppointmentsContent />} />
                <Route path="master-data" element={<MasterDataContent />} />
              </Route>
            </Route>
            <Route path="/about" element={<About />} />
            <Route
              path="/admin"
              element={
                <ProtectedRoute requiredPortal="admin">
                  <Admin />
                </ProtectedRoute>
              }
            >
              <Route index element={<Navigate to="/admin/patient-records" replace />} />
              <Route path="overview" element={<Navigate to="/admin/patient-records" replace />} />
              <Route
                path="patient-records"
                element={<PatientRecordsManagement portal="admin" />}
              />
              <Route path="patients" element={<ProviderPatientsPage />} />
              <Route path="appointments" element={<AdminAppointmentsContent />} />
              <Route path="examination/:appointmentId" element={<ExaminationPage />} />
              <Route path="master-data" element={<MasterDataContent />} />
              <Route path="users" element={<AdminUsersContent />} />
              <Route path="permissions" element={<AdminPermissionsContent />} />
              <Route path="roles" element={<AdminRolesContent />} />
              <Route path="tasks" element={<ClinicalTasksContent portal="admin" />} />
              <Route path="delta-log" element={<DeltaLogPage />} />
              <Route path="settings" element={<AdminSectionPlaceholder title="Settings" />} />
              <Route path="question-library" element={<QuestionLibraryPage />} />
              <Route path="question-library/new" element={<QuestionnaireBuilderPage />} />
              <Route path="question-library/:id" element={<QuestionnaireBuilderPage />} />
              <Route path="ai-accuracy" element={<AdminAiAccuracyPage />} />
            </Route>
            <Route path="/admin/clinical-logic" element={<Navigate to="/admin/question-library" replace />} />
            <Route path="/admin/clinical-logic/question-library" element={<Navigate to="/admin/question-library" replace />} />
            <Route path="/admin/clinical-logic/question-library/new" element={<Navigate to="/admin/question-library/new" replace />} />
            <Route path="/admin/clinical-logic/question-library/:id" element={<RedirectClinicalLogicQuestionnaire />} />
            {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
            <Route path="*" element={<NotFound />} />
          </Routes>
        </BrowserRouter>
      </TooltipProvider>
      </PermissionsProvider>
      </PatientDobProvider>
    </AuthProvider>
  </QueryClientProvider>
);

export default App;
