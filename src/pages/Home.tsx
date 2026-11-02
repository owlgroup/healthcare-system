import TopNav from "@/components/TopNav";
import Sidebar from "@/components/Sidebar";
import HomeContent from "@/components/HomeContent";

const Home = () => {
  return (
    <div className="flex min-h-screen bg-[#F8FAFC]">
      {/* Fixed Sidebar */}
      <Sidebar />

      {/* Main area - offset by sidebar width */}
      <div className="flex-1 lg:ml-[280px] flex flex-col min-h-screen">
        <TopNav />
        <HomeContent />
      </div>
    </div>
  );
};

export default Home;
