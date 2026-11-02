import { Outlet } from "react-router-dom";
import TopNav from "@/components/TopNav";
import Sidebar from "@/components/Sidebar";

const AccountLayout = () => (
  <div className="flex min-h-screen bg-slate-50/50">
    {/* Fixed Sidebar */}
    <Sidebar />

    {/* Main area - offset by sidebar width */}
    <div className="flex-1 lg:ml-[280px] flex flex-col min-h-screen">
      <TopNav />
      <main className="flex-1 overflow-y-auto p-4 md:p-6 lg:p-6">
        <div className="w-full">
          <Outlet />
        </div>
      </main>
    </div>
  </div>
);

export default AccountLayout;
