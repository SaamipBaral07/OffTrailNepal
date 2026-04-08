import { jsPDF } from "jspdf";

export const formatMoney = (amount, currency = "NPR") => {
  const numericValue = Number(amount || 0);
  return `${currency} ${numericValue.toLocaleString()}`;
};

export const formatInvoiceDate = (value) => {
  if (!value) return "-";
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return "-";
  return parsed.toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
};

const blobToDataUrl = (blob) =>
  new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => resolve(String(reader.result || ""));
    reader.onerror = () => reject(new Error("Failed to read logo blob"));
    reader.readAsDataURL(blob);
  });

const resolveLogoDataUrl = async (logoPath) => {
  const fallbackPath = "/offtrail-latest.png";
  const chosenPath = String(logoPath || fallbackPath).trim() || fallbackPath;
  const absoluteUrl = chosenPath.startsWith("http")
    ? chosenPath
    : `${window.location.origin}${chosenPath.startsWith("/") ? chosenPath : `/${chosenPath}`}`;

  try {
    const response = await fetch(absoluteUrl, { cache: "no-store" });
    if (!response.ok) {
      throw new Error(`Logo request failed with status ${response.status}`);
    }
    const blob = await response.blob();
    return await blobToDataUrl(blob);
  } catch (_error) {
    return null;
  }
};

export const downloadInvoicePdfFile = async (invoice) => {
  const doc = new jsPDF({ unit: "pt", format: "a4" });
  const margin = 42;
  const pageWidth = doc.internal.pageSize.getWidth();
  let y = 46;

  doc.setFillColor(12, 35, 64);
  doc.rect(0, 0, pageWidth, 100, "F");

  const logoDataUrl = await resolveLogoDataUrl(invoice?.issuer?.logo_path);
  if (logoDataUrl) {
    // Draw logo after header fill so it stays visible.
    doc.addImage(logoDataUrl, "PNG", margin, y - 4, 52, 52);
  }

  doc.setTextColor(255, 255, 255);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(20);
  doc.text(invoice?.issuer?.name || "OffTrail Nepal", margin + 62, y + 16);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  doc.text(invoice?.issuer?.location || "Pokhara, Nepal", margin + 62, y + 34);

  doc.setFont("helvetica", "bold");
  doc.setFontSize(16);
  doc.text("INVOICE", pageWidth - margin, y + 12, { align: "right" });
  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  doc.text(`Invoice No: ${invoice?.invoice_number || "-"}`, pageWidth - margin, y + 30, { align: "right" });
  doc.text(`Issued: ${formatInvoiceDate(invoice?.issued_at)}`, pageWidth - margin, y + 46, { align: "right" });

  y = 128;
  doc.setTextColor(30, 41, 59);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  doc.text("Billed To", margin, y);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  y += 16;
  doc.text(invoice?.snapshot?.billing_name || "-", margin, y);
  y += 14;
  doc.text(invoice?.snapshot?.billing_email || "-", margin, y);
  y += 14;
  doc.text(invoice?.snapshot?.billing_phone || "-", margin, y);

  const detailsX = pageWidth / 2;
  let detailsY = 128;
  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  doc.text("Booking Details", detailsX, detailsY);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  detailsY += 16;
  doc.text(`Booking Code: ${invoice?.snapshot?.booking_code || "-"}`, detailsX, detailsY);
  detailsY += 14;
  doc.text(`Type: ${invoice?.booking_type === "guide_package" ? "Guide Package" : "Homestay"}`, detailsX, detailsY);
  detailsY += 14;
  doc.text(`Listing: ${invoice?.snapshot?.listing_name || "-"}`, detailsX, detailsY);
  detailsY += 14;
  doc.text(`Location: ${invoice?.snapshot?.listing_location || "-"}`, detailsX, detailsY);

  y = 232;
  doc.setDrawColor(226, 232, 240);
  doc.line(margin, y, pageWidth - margin, y);
  y += 22;

  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  doc.text("Description", margin, y);
  doc.text("Amount", pageWidth - margin, y, { align: "right" });

  y += 10;
  doc.line(margin, y, pageWidth - margin, y);
  y += 20;

  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  const description = invoice?.booking_type === "guide_package"
    ? `${invoice?.snapshot?.listing_name || "Guide package"} with ${invoice?.snapshot?.guide_name || "assigned guide"}`
    : `${invoice?.snapshot?.listing_name || "Homestay"} stay`;
  doc.text(description, margin, y);
  doc.text(formatMoney(invoice?.subtotal_amount, invoice?.currency || "NPR"), pageWidth - margin, y, { align: "right" });

  y += 22;
  doc.text("Tax", margin, y);
  doc.text(formatMoney(invoice?.tax_amount, invoice?.currency || "NPR"), pageWidth - margin, y, { align: "right" });

  y += 20;
  doc.text("Service Charge", margin, y);
  doc.text(formatMoney(invoice?.service_charge, invoice?.currency || "NPR"), pageWidth - margin, y, { align: "right" });

  y += 18;
  doc.line(margin, y, pageWidth - margin, y);
  y += 24;

  doc.setFont("helvetica", "bold");
  doc.setFontSize(12);
  doc.text("Total Paid", margin, y);
  doc.text(formatMoney(invoice?.total_amount, invoice?.currency || "NPR"), pageWidth - margin, y, { align: "right" });

  y += 28;
  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  doc.text(`Payment Method: ${String(invoice?.payment_method || "unknown").toUpperCase()}`, margin, y);
  y += 14;
  doc.text(`Payment Status: ${String(invoice?.payment_status || "unknown").toUpperCase()}`, margin, y);
  y += 14;
  doc.text(`Transaction Ref: ${invoice?.payment_reference || "-"}`, margin, y);

  doc.setFontSize(9);
  doc.setTextColor(100, 116, 139);
  doc.text("Thank you for choosing OffTrail Nepal. Safe travels in the Himalayas.", margin, 790);

  const fileNameBase = String(invoice?.invoice_number || "offtrail-invoice").replace(/[^a-zA-Z0-9-_]/g, "-");
  doc.save(`${fileNameBase}.pdf`);
};
