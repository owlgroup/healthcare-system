import { QRCodeSVG } from "qrcode.react";

type Props = {
  value: string;
  size?: number;
  label?: string;
};

export default function QrCodeDisplay({ value, size = 128, label }: Props) {
  return (
    <div className="flex flex-col items-center gap-2">
      <div className="rounded-xl border bg-white p-3 shadow-sm">
        <QRCodeSVG value={value} size={size} level="M" includeMargin />
      </div>
      {label && <p className="text-xs text-muted-foreground text-center max-w-[160px]">{label}</p>}
      <p className="text-[10px] font-mono text-muted-foreground break-all text-center max-w-[180px]">
        {value}
      </p>
    </div>
  );
}
