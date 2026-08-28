import { ImageResponse } from "next/og";

export const size = { width: 1200, height: 630 };
export const contentType = "image/png";
export const alt = "Jurídico IA — O trabalho jurídico, finalmente organizado";

export default function OpengraphImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "center",
          padding: "80px",
          backgroundColor: "#131210",
          color: "#faf9f5",
          fontFamily: "serif",
        }}
      >
        <div style={{ display: "flex", fontSize: 28, letterSpacing: 4, textTransform: "uppercase", color: "#a3a099" }}>
          PARA ESCRITÓRIOS DE ADVOCACIA
        </div>
        <div style={{ display: "flex", marginTop: 28, fontSize: 76, fontWeight: 600, lineHeight: 1.08, maxWidth: 980 }}>
          O trabalho jurídico, finalmente organizado.
        </div>
        <div style={{ display: "flex", marginTop: 36, fontSize: 30, color: "#c9c6bd", maxWidth: 880 }}>
          Documentos analisados, prazos monitorados e o cliente sempre informado.
        </div>
      </div>
    ),
    { ...size },
  );
}
