import { Navigate } from "react-router-dom";
import UnifiedLoginPage from "@/components/auth/UnifiedLoginPage";

const Login = () => <UnifiedLoginPage />;

/** Legacy portal URLs → unified login */
const PatientLogin = () => <Navigate to="/login" replace />;
const DoctorLogin = () => <Navigate to="/login" replace />;
const AdminLogin = () => <Navigate to="/login" replace />;

export default Login;
export { PatientLogin, DoctorLogin, AdminLogin };
