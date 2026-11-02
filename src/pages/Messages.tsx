import TopNav from "@/components/TopNav";
import Sidebar from "@/components/Sidebar";
import MessagesContent from "@/components/MessagesContent";

const Messages = () => {
  return (
    <div className="flex min-h-screen flex-col">
      <TopNav />
      <div className="flex flex-1">
        <Sidebar />
        <MessagesContent />
      </div>
    </div>
  );
};

export default Messages;
