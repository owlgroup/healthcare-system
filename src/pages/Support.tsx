import TopNav from "@/components/TopNav";
import Sidebar from "@/components/Sidebar";
import SupportContent from "@/components/SupportContent";

const Support = () => {
  return (
    <div className="flex min-h-screen flex-col">
      <TopNav />
      <div className="flex flex-1">
        <Sidebar />
        <SupportContent />
      </div>
    </div>
  );
};

export default Support;
