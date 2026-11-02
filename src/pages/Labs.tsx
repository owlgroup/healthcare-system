import TopNav from "@/components/TopNav";
import Sidebar from "@/components/Sidebar";
import LabOrders from "@/components/LabOrders";

const Labs = () => {
  return (
    <div className="flex min-h-screen flex-col">
      <TopNav />
      <div className="flex flex-1">
        <Sidebar />
        <LabOrders />
      </div>
    </div>
  );
};

export default Labs;
