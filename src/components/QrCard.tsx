// Printable student ID card with the QR code the driver scans.

import QRCode from "qrcode";
import { useEffect, useState } from "react";
import type { Student } from "../types";

export function QrImage({ code, size = 160 }: { code: string; size?: number }) {
  const [src, setSrc] = useState<string | null>(null);
  useEffect(() => {
    QRCode.toDataURL(code, { width: size * 2, margin: 1, errorCorrectionLevel: "M", color: { dark: "#17231C" } })
      .then(setSrc)
      .catch(() => setSrc(null));
  }, [code, size]);
  return src ? <img src={src} width={size} height={size} alt={`Código QR ${code}`} /> : <span className="muted">{code}</span>;
}

interface Props {
  student: Student;
  routeName?: string;
  stopName?: string;
  schoolName?: string;
}

export function QrCard({ student, routeName, stopName, schoolName }: Props) {
  return (
    <article className="id-card">
      <header className="id-card-head">
        <span>RutaSegura</span>
        <small>Carnet de transporte escolar</small>
      </header>
      <div className="id-card-body">
        <QrImage code={student.qr_code} size={130} />
        <div>
          <p className="id-card-name">{student.full_name}</p>
          <p>
            {student.document_type.code.toUpperCase()} {student.document_number}
          </p>
          <p>{student.grade.name}</p>
          {routeName && <p>{routeName}</p>}
          {stopName && <p>Parada: {stopName}</p>}
          <p className="id-card-code">{student.qr_code}</p>
        </div>
      </div>
      {schoolName && <footer className="id-card-foot">{schoolName}</footer>}
    </article>
  );
}
