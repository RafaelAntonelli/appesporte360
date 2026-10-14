import jsPDF from "jspdf";
import QRCode from "qrcode";
import modeloCracha from "@/assets/cracha-modelo.jpg";

// Cartão CR-80 (padrão de crachá): 85,6 x 54 mm
export const CR80 = { largura: 85.6, altura: 54 };

// A arte modelo tem 1920 x 1210 px e a mesma proporção do CR-80
const ARTE = { largura: 1920, altura: 1209 };
const EX = CR80.largura / ARTE.largura;
const EY = CR80.altura / ARTE.altura;

const mmX = (px: number) => px * EX;
const mmY = (px: number) => px * EY;

export type DadosCracha = {
  nome: string;
  rg: string | null;
  cpf: string | null;
  responsavel: string | null;
  telefone: string | null;
  pcd: boolean;
  modalidade: string | null;
  horario: string | null;
  dias: string[] | null;
  fotoUrl?: string | null;
  codigo?: string | null;
};

// Valores desenhados na faixa cinza ABAIXO de cada rótulo, alinhados à esquerda do rótulo
// (coordenadas em px da arte 1920x1209, medidas sobre o modelo)
const CAMPOS = {
  nome: { x: 526, y: 312, w: 890, pt: 12 },
  pcd: { x: 1474, y: 312, w: 350, pt: 12 },
  documento: { x: 526, y: 498, w: 820, pt: 10 },
  matricula: { x: 1400, y: 498, w: 424, pt: 10 },
  responsavel: { x: 526, y: 650, w: 1300, pt: 10 },
  celular: { x: 526, y: 807, w: 700, pt: 10 },
  modalidade: { x: 1269, y: 807, w: 555, pt: 10 },
  horario: { x: 526, y: 974, w: 700, pt: 10 },
  dias: { x: 1269, y: 974, w: 555, pt: 9.5 },
} as const;

const FOTO = { x: 32, y: 158, w: 436, h: 605 };
const QR = { x: 70, y: 790, size: 360 };


const cacheFoto = new Map<string, Promise<string>>();

async function urlParaDataUrl(url: string) {
  const resp = await fetch(url);
  if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
  const blob = await resp.blob();
  return await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject(new Error("Falha ao ler imagem"));
    reader.readAsDataURL(blob);
  });
}

/** Mesma URL só é baixada e convertida uma vez por sessão */
function urlParaDataUrlCache(url: string) {
  let p = cacheFoto.get(url);
  if (!p) {
    p = urlParaDataUrl(url).catch((e) => {
      cacheFoto.delete(url);
      throw e;
    });
    cacheFoto.set(url, p);
  }
  return p;
}

let modeloCache: string | null = null;
async function obterModelo() {
  if (!modeloCache) modeloCache = await urlParaDataUrl(modeloUrl());
  return modeloCache;
}
function modeloUrl() {
  return modeloCracha as unknown as string;
}

async function qrDataUrl(texto: string) {
  // ECC alto + módulos grandes garantem leitura mesmo impresso em ~9 mm
  return await QRCode.toDataURL(texto, { margin: 0, width: 640, errorCorrectionLevel: "H", color: { dark: "#000000", light: "#FFFFFF" } });
}


function textoAjustado(doc: jsPDF, texto: string, larguraMm: number, tamanhoBase = 11) {
  let tamanho = tamanhoBase;
  doc.setFontSize(tamanho);
  while (tamanho > 7 && doc.getTextWidth(texto) > larguraMm) {
    tamanho -= 0.5;
    doc.setFontSize(tamanho);
  }
  return tamanho;
}

function escrever(doc: jsPDF, campo: { x: number; y: number; w: number }, texto: string, tamanhoBase = 11) {
  if (!texto) return;
  textoAjustado(doc, texto, mmX(campo.w), tamanhoBase);
  doc.text(texto, mmX(campo.x), mmY(campo.y), { baseline: "middle" });
}

function documentoFormatado(d: DadosCracha) {
  return (d.cpf && d.cpf.trim()) || (d.rg && d.rg.trim()) || "";
}

async function desenharCracha(doc: jsPDF, dados: DadosCracha, modelo: string, ox = 0, oy = 0) {
  doc.addImage(modelo, "JPEG", ox, oy, CR80.largura, CR80.altura);

  if (dados.fotoUrl) {
    try {
      const foto = await urlParaDataUrl(dados.fotoUrl);
      doc.addImage(foto, ox + mmX(FOTO.x), oy + mmY(FOTO.y), mmX(FOTO.w), mmY(FOTO.h), undefined, "FAST");
    } catch {
      // segue sem foto
    }
  }

  if (dados.codigo) {
    try {
      const qr = await qrDataUrl(dados.codigo);
      doc.setFillColor(255, 255, 255);
      doc.rect(ox + mmX(QR.x) - 1.4, oy + mmY(QR.y) - 1.4, mmX(QR.size) + 2.8, mmY(QR.size) + 2.8, "F");
      doc.addImage(qr, "PNG", ox + mmX(QR.x), oy + mmY(QR.y), mmX(QR.size), mmY(QR.size), undefined, "NONE");
    } catch {
      // segue sem QR
    }
  }

  doc.setTextColor(20, 20, 40);
  doc.setFont("helvetica", "bold");

  const put = (campo: { x: number; y: number; w: number; pt?: number }, texto: string) => {
    if (!texto) return;
    textoAjustado(doc, texto, mmX(campo.w), campo.pt ?? 11);
    doc.text(texto, ox + mmX(campo.x), oy + mmY(campo.y), { baseline: "middle" });
  };

  put(CAMPOS.nome, dados.nome ?? "");
  put(CAMPOS.pcd, dados.pcd ? "Sim" : "Não");
  put(CAMPOS.documento, documentoFormatado(dados));
  put(CAMPOS.matricula, dados.codigo ? `Matrícula: ${dados.codigo}` : "");
  put(CAMPOS.responsavel, dados.responsavel ?? "");
  put(CAMPOS.celular, dados.telefone ?? "");
  put(CAMPOS.modalidade, dados.modalidade ?? "");
  put(CAMPOS.horario, dados.horario ?? "");
  put(CAMPOS.dias, (dados.dias ?? []).join(" e "));
}

// Um crachá por página, no tamanho exato CR-80 (impressoras de cartão)
export async function gerarCrachasPdf(lista: DadosCracha[], nomeArquivo: string) {
  if (!lista.length) throw new Error("Nenhum aluno selecionado");
  const modelo = await obterModelo();
  const doc = new jsPDF({ orientation: "landscape", unit: "mm", format: [CR80.largura, CR80.altura] });

  for (let i = 0; i < lista.length; i++) {
    if (i > 0) doc.addPage([CR80.largura, CR80.altura], "landscape");
    await desenharCracha(doc, lista[i]!, modelo);
  }

  doc.save(nomeArquivo.endsWith(".pdf") ? nomeArquivo : `${nomeArquivo}.pdf`);
}

// Folha A4 com vários crachás (2 colunas x 5 linhas) para recorte
export async function gerarFolhaA4Crachas(lista: DadosCracha[], nomeArquivo: string) {
  if (!lista.length) throw new Error("Nenhum aluno selecionado");
  const modelo = await obterModelo();
  const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });

  const colunas = 2;
  const linhas = 5;
  const margemX = 10;
  const margemY = 8;
  const espacoX = 5;
  const espacoY = 3;
  const porPagina = colunas * linhas;

  for (let i = 0; i < lista.length; i++) {
    const indice = i % porPagina;
    if (i > 0 && indice === 0) doc.addPage();
    const col = indice % colunas;
    const lin = Math.floor(indice / colunas);
    const ox = margemX + col * (CR80.largura + espacoX);
    const oy = margemY + lin * (CR80.altura + espacoY);
    await desenharCracha(doc, lista[i]!, modelo, ox, oy);
    doc.setDrawColor(200);
    doc.rect(ox, oy, CR80.largura, CR80.altura);
  }

  doc.save(nomeArquivo.endsWith(".pdf") ? nomeArquivo : `${nomeArquivo}.pdf`);
}

// Gera um PDF de um único crachá e devolve uma URL de blob para pré-visualização
export async function gerarCrachaPreviewUrl(dados: DadosCracha) {
  const modelo = await obterModelo();
  const doc = new jsPDF({ orientation: "landscape", unit: "mm", format: [CR80.largura, CR80.altura] });
  await desenharCracha(doc, dados, modelo);
  return doc.output("bloburl").toString();
}

// ---- Pré-visualização em imagem (PNG) — mais confiável que embutir PDF em iframe ----
function carregarImagem(src: string) {
  return new Promise<HTMLImageElement>((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error("Falha ao carregar imagem"));
    img.src = src;
  });
}

const cacheImagem = new Map<string, Promise<HTMLImageElement>>();
function carregarImagemCache(src: string) {
  let p = cacheImagem.get(src);
  if (!p) {
    p = carregarImagem(src).catch((e) => {
      cacheImagem.delete(src);
      throw e;
    });
    cacheImagem.set(src, p);
  }
  return p;
}

const cacheQr = new Map<string, Promise<HTMLImageElement>>();
function carregarQr(texto: string) {
  let p = cacheQr.get(texto);
  if (!p) {
    p = qrDataUrl(texto)
      .then(carregarImagem)
      .catch((e) => {
        cacheQr.delete(texto);
        throw e;
      });
    cacheQr.set(texto, p);
  }
  return p;
}

/** Devolve o controle ao navegador para a interface não travar */
const respirar = () => new Promise<void>((r) => setTimeout(r, 0));

const PX_POR_MM = ARTE.altura / CR80.altura;


export type OpcoesRender = {
  /** Desenha uma grade de guias por cima para conferir posições */
  guias?: boolean;
  /** Multiplicador de resolução (1 = 1920x1209) */
  escala?: number;
};

function desenharGuias(ctx: CanvasRenderingContext2D) {
  const passo = 100; // px da arte (~4,5 mm)
  ctx.save();
  ctx.lineWidth = 1;
  ctx.font = "bold 22px monospace";
  ctx.textBaseline = "top";

  for (let x = 0; x <= ARTE.largura; x += passo) {
    ctx.strokeStyle = x % 500 === 0 ? "rgba(220,38,38,0.55)" : "rgba(37,99,235,0.28)";
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x, ARTE.altura);
    ctx.stroke();
    if (x % 500 === 0) {
      ctx.fillStyle = "rgba(220,38,38,0.85)";
      ctx.fillText(String(x), x + 4, 4);
    }
  }
  for (let y = 0; y <= ARTE.altura; y += passo) {
    ctx.strokeStyle = y % 500 === 0 ? "rgba(220,38,38,0.55)" : "rgba(37,99,235,0.28)";
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(ARTE.largura, y);
    ctx.stroke();
    if (y % 500 === 0 && y > 0) {
      ctx.fillStyle = "rgba(220,38,38,0.85)";
      ctx.fillText(String(y), 4, y + 4);
    }
  }

  // Caixas dos campos, da foto e do QR Code
  ctx.setLineDash([10, 8]);
  ctx.strokeStyle = "rgba(16,185,129,0.9)";
  ctx.fillStyle = "rgba(16,185,129,0.95)";
  ctx.font = "bold 20px monospace";
  for (const [nome, c] of Object.entries(CAMPOS)) {
    const alturaCaixa = (c.pt ?? 11) * 0.3528 * PX_POR_MM * 1.4;
    ctx.strokeRect(c.x, c.y - alturaCaixa / 2, c.w, alturaCaixa);
    ctx.fillText(`${nome} ${c.x},${c.y}`, c.x + 4, c.y - alturaCaixa / 2 - 24);
  }
  ctx.strokeStyle = "rgba(217,119,6,0.9)";
  ctx.strokeRect(FOTO.x, FOTO.y, FOTO.w, FOTO.h);
  ctx.strokeRect(QR.x, QR.y, QR.size, QR.size);
  ctx.restore();
}

/** Desenha o crachá num canvas — mesma fonte de verdade do preview e da exportação fiel */
export async function renderizarCrachaCanvas(
  dados: DadosCracha,
  opcoes: OpcoesRender & { canvas?: HTMLCanvasElement } = {},
) {
  const escala = opcoes.escala ?? 1;
  const canvas = opcoes.canvas ?? document.createElement("canvas");
  const largura = Math.round(ARTE.largura * escala);
  const altura = Math.round(ARTE.altura * escala);
  if (canvas.width !== largura || canvas.height !== altura) {
    canvas.width = largura;
    canvas.height = altura;
  }
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas indisponível");
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.clearRect(0, 0, largura, altura);
  ctx.scale(escala, escala);

  const modelo = await carregarImagemCache(await obterModelo());
  ctx.drawImage(modelo, 0, 0, ARTE.largura, ARTE.altura);

  if (dados.fotoUrl) {
    try {
      const foto = await carregarImagemCache(await urlParaDataUrlCache(dados.fotoUrl));
      ctx.drawImage(foto, FOTO.x, FOTO.y, FOTO.w, FOTO.h);
    } catch {
      // segue sem foto
    }
  }

  if (dados.codigo) {
    try {
      const qr = await carregarQr(dados.codigo);
      ctx.imageSmoothingEnabled = false;
      ctx.fillStyle = "#ffffff";
      ctx.fillRect(QR.x - 14, QR.y - 14, QR.size + 28, QR.size + 28);
      ctx.drawImage(qr, QR.x, QR.y, QR.size, QR.size);
      ctx.imageSmoothingEnabled = true;
    } catch {
      // segue sem QR
    }
  }


  ctx.fillStyle = "#141428";
  ctx.textBaseline = "middle";

  const put = (campo: { x: number; y: number; w: number; pt?: number }, texto: string) => {
    if (!texto) return;
    let tamanhoPt = campo.pt ?? 11;
    const aplicar = () => {
      ctx.font = `bold ${(tamanhoPt * 0.3528 * PX_POR_MM).toFixed(1)}px Helvetica, Arial, sans-serif`;
    };
    aplicar();
    while (tamanhoPt > 7 && ctx.measureText(texto).width > campo.w) {
      tamanhoPt -= 0.5;
      aplicar();
    }
    ctx.fillText(texto, campo.x, campo.y);
  };

  put(CAMPOS.nome, dados.nome ?? "");
  put(CAMPOS.pcd, dados.pcd ? "Sim" : "Não");
  put(CAMPOS.documento, documentoFormatado(dados));
  put(CAMPOS.matricula, dados.codigo ? `Matrícula: ${dados.codigo}` : "");
  put(CAMPOS.responsavel, dados.responsavel ?? "");
  put(CAMPOS.celular, dados.telefone ?? "");
  put(CAMPOS.modalidade, dados.modalidade ?? "");
  put(CAMPOS.horario, dados.horario ?? "");
  put(CAMPOS.dias, (dados.dias ?? []).join(" e "));

  if (opcoes.guias) desenharGuias(ctx);

  return canvas;
}

export async function gerarCrachaPreviewImagem(dados: DadosCracha, opcoes: OpcoesRender = {}) {
  const canvas = await renderizarCrachaCanvas(dados, opcoes);
  return canvas.toDataURL("image/png");
}

/** Baixa as fotos em paralelo (com limite) antes de renderizar — evita travar no meio do lote */
async function prepararFotos(lista: DadosCracha[], limite = 6) {
  const urls = Array.from(new Set(lista.map((d) => d.fotoUrl).filter(Boolean) as string[]));
  let i = 0;
  const trabalhador = async () => {
    while (i < urls.length) {
      const url = urls[i++]!;
      try {
        await carregarImagemCache(await urlParaDataUrlCache(url));
      } catch {
        // segue sem foto
      }
    }
  };
  await Promise.all(Array.from({ length: Math.min(limite, urls.length) }, trabalhador));
}

// ---- Exportação fiel ao preview: usa exatamente a mesma renderização em canvas ----
export async function gerarCrachasPdfFielAoPreview(
  lista: DadosCracha[],
  nomeArquivo: string,
  opcoes: {
    formato?: "cartao" | "folha";
    guias?: boolean;
    /** Recebe (feitos, total) a cada crachá renderizado */
    aoProgredir?: (feitos: number, total: number) => void;
  } = {},
) {
  if (!lista.length) throw new Error("Nenhum aluno selecionado");
  const formato = opcoes.formato ?? "cartao";
  const escala = 1.5; // ~850 dpi no cartão CR-80 — nítido e muito mais leve que 2x PNG

  const colunas = 2;
  const linhas = 5;
  const margemX = 10;
  const margemY = 8;
  const espacoX = 5;
  const espacoY = 3;
  const porPagina = colunas * linhas;

  const doc =
    formato === "cartao"
      ? new jsPDF({ orientation: "landscape", unit: "mm", format: [CR80.largura, CR80.altura] })
      : new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });

  // Fotos baixadas em paralelo e um único canvas reaproveitado em todo o lote
  await prepararFotos(lista);
  const canvas = document.createElement("canvas");

  for (let i = 0; i < lista.length; i++) {
    await renderizarCrachaCanvas(lista[i]!, { escala, guias: !!opcoes.guias, canvas });
    // JPEG é ordens de grandeza mais rápido/leve que PNG para arte fotográfica
    const img = canvas.toDataURL("image/jpeg", 0.92);

    if (formato === "cartao") {
      if (i > 0) doc.addPage([CR80.largura, CR80.altura], "landscape");
      doc.addImage(img, "JPEG", 0, 0, CR80.largura, CR80.altura, undefined, "FAST");
    } else {
      const indice = i % porPagina;
      if (i > 0 && indice === 0) doc.addPage();
      const col = indice % colunas;
      const lin = Math.floor(indice / colunas);
      const ox = margemX + col * (CR80.largura + espacoX);
      const oy = margemY + lin * (CR80.altura + espacoY);
      doc.addImage(img, "JPEG", ox, oy, CR80.largura, CR80.altura, undefined, "FAST");
      doc.setDrawColor(200);
      doc.rect(ox, oy, CR80.largura, CR80.altura);
    }

    opcoes.aoProgredir?.(i + 1, lista.length);
    await respirar(); // mantém a interface responsiva
  }

  doc.save(nomeArquivo.endsWith(".pdf") ? nomeArquivo : `${nomeArquivo}.pdf`);
}


