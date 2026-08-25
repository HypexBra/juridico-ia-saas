import { describe, expect, it } from "vitest";
import { bufferBateComAssinatura, inferirTipoArquivoUpload, TIPOS_ARQUIVO_UPLOAD } from "./validacao";

function arquivoFake(nome: string, tipo: string): File {
  return new File([new Uint8Array([1, 2, 3])], nome, { type: tipo });
}

describe("inferirTipoArquivoUpload", () => {
  it("infere por MIME quando presente", () => {
    expect(inferirTipoArquivoUpload(arquivoFake("qualquer", "application/pdf"), TIPOS_ARQUIVO_UPLOAD)).toBe("pdf");
  });

  it("infere por extensão quando o MIME não bate (tolerância de navegador/SO)", () => {
    expect(inferirTipoArquivoUpload(arquivoFake("peca.docx", ""), TIPOS_ARQUIVO_UPLOAD)).toBe("docx");
  });

  it("retorna null quando não bate com nenhum tipo permitido", () => {
    expect(inferirTipoArquivoUpload(arquivoFake("virus.exe", "application/x-msdownload"), TIPOS_ARQUIVO_UPLOAD)).toBeNull();
  });

  it("restringe à lista de tipos permitidos pela feature chamadora", () => {
    expect(inferirTipoArquivoUpload(arquivoFake("foto.jpg", "image/jpeg"), ["pdf", "docx"] as const)).toBeNull();
  });
});

describe("bufferBateComAssinatura", () => {
  it("aceita PDF real (%PDF-)", () => {
    const buffer = Buffer.from("%PDF-1.7\n...");
    expect(bufferBateComAssinatura(buffer, "pdf")).toBe(true);
  });

  it("rejeita conteúdo que não é PDF mas foi declarado como pdf — achado de dívida técnica corrigido", () => {
    const buffer = Buffer.from("isto não é um pdf de verdade");
    expect(bufferBateComAssinatura(buffer, "pdf")).toBe(false);
  });

  it("aceita DOCX real (assinatura ZIP PK\\x03\\x04)", () => {
    const buffer = Buffer.from([0x50, 0x4b, 0x03, 0x04, 0x00, 0x00]);
    expect(bufferBateComAssinatura(buffer, "docx")).toBe(true);
  });

  it("aceita JPEG/PNG/WEBP reais", () => {
    expect(bufferBateComAssinatura(Buffer.from([0xff, 0xd8, 0xff, 0xe0]), "imagem")).toBe(true);
    expect(bufferBateComAssinatura(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a]), "imagem")).toBe(true);
    const webp = Buffer.concat([Buffer.from("RIFF"), Buffer.from([0, 0, 0, 0]), Buffer.from("WEBP")]);
    expect(bufferBateComAssinatura(webp, "imagem")).toBe(true);
  });

  it("rejeita imagem forjada (bytes de texto simples renomeado para .jpg)", () => {
    const buffer = Buffer.from("conteudo de texto qualquer, nao e uma imagem real");
    expect(bufferBateComAssinatura(buffer, "imagem")).toBe(false);
  });

  it("rejeita buffer vazio/curto demais pra qualquer assinatura", () => {
    expect(bufferBateComAssinatura(Buffer.from([]), "pdf")).toBe(false);
    expect(bufferBateComAssinatura(Buffer.from([0x25]), "pdf")).toBe(false);
  });
});
