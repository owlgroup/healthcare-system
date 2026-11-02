import TopNav from "@/components/TopNav";
import Sidebar from "@/components/Sidebar";
import PrescriptionOrders from "@/components/PrescriptionOrders";

const Prescriptions = () => {
  return (
    <div className="flex min-h-screen flex-col">
      <TopNav />
      <div className="flex flex-1">
        <Sidebar />
        <PrescriptionOrders />
      </div>
    </div>
  );
};

export default Prescriptions;
