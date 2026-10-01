import jsPDF from "jspdf";
import QRCode from "qrcode";
import type { Product } from "@/context/FirebaseContext";
import "@/lib/fonts/NotoSans-Regular-normal.js";

const PESO_SIGN = "\u20B1";

type InventoryQrProduct = Product & {
  batches?: Array<{
    id: string;
    batchSku?: string;
    expiryDate?: string | null;
  }>;
};

type InventoryQrEntry = {
  product: InventoryQrProduct;
  batchId?: string;
  batchSku?: string;
  expiryDate?: string | null;
};

const formatDate = (date?: string | null) => {
  if (!date) return null;
  const parsedDate = new Date(date);
  return Number.isNaN(parsedDate.getTime()) ? date : parsedDate.toLocaleDateString();
};

export async function downloadInventoryQrPdf(products: InventoryQrProduct[]) {
  const entries: InventoryQrEntry[] = products
    .filter((product) => !product.archived && !product.deleted)
    .flatMap((product): InventoryQrEntry[] => {
      const batches = product.batches?.filter((batch) => batch.batchSku) || [];
      if (batches.length === 0) {
        return [{ product, batchId: undefined, batchSku: undefined, expiryDate: product.expiryDate }];
      }
      return batches.map((batch) => ({
        product,
        batchId: batch.id,
        batchSku: batch.batchSku,
        expiryDate: batch.expiryDate,
      }));
    });

  if (entries.length === 0) return;

  const pdf = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
  const pageWidth = pdf.internal.pageSize.getWidth();
  const margin = 10;
  const columnGap = 4;
  const rowGap = 3;
  const columnCount = 3;
  const columnWidth = (pageWidth - margin * 2 - columnGap * (columnCount - 1)) / columnCount;
  const cardHeight = 22;
  const qrSize = 12.7;
  const textXOffset = 16;
  const entriesPerPage = 30;

  pdf.setProperties({ title: "Clinic Inventory QR Codes" });
  pdf.setFont("NotoSans-Regular", "normal");

  for (let index = 0; index < entries.length; index += 1) {
    const pageIndex = Math.floor(index / entriesPerPage);
    const pagePosition = index % entriesPerPage;
    if (pagePosition === 0 && pageIndex > 0) pdf.addPage();

    const column = pagePosition % columnCount;
    const row = Math.floor(pagePosition / columnCount);
    const x = margin + column * (columnWidth + columnGap);
    const y = margin + row * (cardHeight + rowGap);
    const entry = entries[index];
    const qrValue = new URL(`/inventory?product=${encodeURIComponent(entry.product.id)}`, window.location.origin);
    qrValue.searchParams.set("name", entry.product.name);
    if (entry.batchId && entry.batchSku) {
      qrValue.searchParams.set("batch", entry.batchId);
      qrValue.searchParams.set("batchSku", entry.batchSku);
    }
    if (entry.expiryDate) qrValue.searchParams.set("expiry", entry.expiryDate);

    const qrDataUrl = await QRCode.toDataURL(qrValue.toString(), {
      errorCorrectionLevel: "M",
      margin: 1,
      width: 300,
      color: { dark: "#000000", light: "#FFFFFF" },
    });

    pdf.setDrawColor(0, 0, 0);
    pdf.setLineWidth(0.25);
    pdf.rect(x, y, columnWidth, cardHeight);
    pdf.addImage(qrDataUrl, "PNG", x + 2, y + 4.5, qrSize, qrSize);
    pdf.setFont("NotoSans-Regular", "normal");
    pdf.setFontSize(6.5);
    pdf.setTextColor(0, 0, 0);
    const productNameLine = pdf.splitTextToSize(entry.product.name, columnWidth - textXOffset - 2)[0];
    pdf.text(productNameLine, x + textXOffset, y + 6.5);

    let labelY = y + 10;
    pdf.setFont("NotoSans-Regular", "normal");
    pdf.setFontSize(5);
    pdf.text(`SKU: ${entry.product.sku}`, x + textXOffset, labelY);
    labelY += 3.2;
    if (entry.batchSku) {
      pdf.text(`Batch: ${entry.batchSku}`, x + textXOffset, labelY);
      labelY += 3.2;
    }
    const formattedExpiry = formatDate(entry.expiryDate);
    if (formattedExpiry) {
      pdf.text(`Expiry: ${formattedExpiry}`, x + textXOffset, labelY);
      labelY += 3.2;
    }
    pdf.setFont("NotoSans-Regular", "normal");
    pdf.text(`Retail: ${PESO_SIGN}${entry.product.markupPrice.toFixed(2)}`, x + textXOffset, labelY);
  }

  pdf.save(`Clinic_Inventory_QR_Codes_${new Date().toISOString().split("T")[0]}.pdf`);
}