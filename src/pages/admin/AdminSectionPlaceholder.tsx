type Props = { title: string };

const AdminSectionPlaceholder = ({ title }: Props) => (
  <div className="max-w-6xl mx-auto">
    <h1 className="text-2xl md:text-3xl font-bold text-foreground">{title}</h1>
    <p className="text-sm text-muted-foreground mt-2">Nội dung đang được phát triển.</p>
  </div>
);

export default AdminSectionPlaceholder;
