import { Link } from "react-router-dom";

type Props = { title: string };

const ProviderSectionPlaceholder = ({ title }: Props) => (
  <div className="rounded-xl border bg-card p-8 text-center">
    <h2 className="text-xl font-semibold">{title}</h2>
    <p className="mt-2 text-sm text-muted-foreground">Mục này đang phát triển.</p>
    <Link
      to="/provider-portal/dashboard"
      className="mt-4 inline-flex min-h-11 items-center rounded-lg bg-primary px-4 text-sm font-semibold text-primary-foreground hover:opacity-90"
    >
      Về bảng tổng quan
    </Link>
  </div>
);

export default ProviderSectionPlaceholder;
