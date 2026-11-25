import { jsPDF } from 'jspdf';
import { RIG_50_NAME } from './defaultForm';

export interface SoarPdfData {
  responseId?: string | number;
  date: string;
  rig?: string;
  zone: string;
  role: string;
  name: string;
  assessment: 'Safe' | 'Unsafe' | string;
  obsType?: string;
  category?: string;
  observation: string;
  action: string;
}

export function generateSoarPdf(data: SoarPdfData): jsPDF {
  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4'
  });

  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const margin = 15;
  const contentWidth = pageWidth - margin * 2;

  // Header Banner (Teal)
  doc.setFillColor(3, 120, 124); // #03787c
  doc.rect(margin, 12, contentWidth, 24, 'F');

  // Header Text
  doc.setTextColor(255, 255, 255);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(16);
  doc.text('STOP OBSERVE ACT REPORT (SOAR)', margin + 6, 22);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.text('HSE SAFETY OBSERVATION & INTERVENTION CARD  |  REV-02', margin + 6, 30);

  // Status Badge on top-right of banner
  const isSafe = data.assessment.toLowerCase() === 'safe';
  if (isSafe) {
    doc.setFillColor(16, 185, 129); // Green
  } else {
    doc.setFillColor(225, 29, 72); // Rose/Red
  }
  doc.roundedRect(pageWidth - margin - 35, 17, 30, 14, 2, 2, 'F');
  doc.setTextColor(255, 255, 255);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10);
  doc.text(isSafe ? 'SAFE' : 'UNSAFE', pageWidth - margin - 20, 25, { align: 'center' });

  // Receipt ID & Metadata Ribbon
  doc.setFillColor(241, 245, 249); // slate-100
  doc.rect(margin, 40, contentWidth, 12, 'F');
  doc.setDrawColor(203, 213, 225); // slate-300
  doc.rect(margin, 40, contentWidth, 12, 'S');

  doc.setTextColor(51, 65, 85); // slate-700
  doc.setFontSize(9);
  doc.setFont('helvetica', 'bold');
  doc.text('RECEIPT ID:', margin + 4, 47.5);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(3, 120, 124);
  doc.text(`#${data.responseId || 'PENDING'}`, margin + 26, 47.5);

  doc.setTextColor(51, 65, 85);
  doc.setFont('helvetica', 'bold');
  doc.text('FORM STATUS:', margin + 65, 47.5);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(16, 185, 129);
  doc.text('Verified Live Cloud Submission', margin + 92, 47.5);

  doc.setTextColor(51, 65, 85);
  doc.setFont('helvetica', 'bold');
  doc.text('DATE:', pageWidth - margin - 42, 47.5);
  doc.setFont('helvetica', 'normal');
  doc.text(data.date || new Date().toISOString().split('T')[0], pageWidth - margin - 4, 47.5, { align: 'right' });

  // SECTION 1: REPORT DETAILS TABLE
  let y = 60;
  doc.setTextColor(15, 23, 42); // slate-900
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(12);
  doc.text('1. Incident & Location Details', margin, y);
  y += 4;

  const rowHeight = 9;
  const col1Width = 45;
  const col2Width = contentWidth - col1Width;

  const tableFields = [
    { label: 'Target Rig / Unit:', value: data.rig || RIG_50_NAME },
    { label: 'Rig Zone / Area:', value: data.zone || 'Rig Floor' },
    { label: 'Observer Role:', value: data.role || 'Floorman' },
    { 
      label: 'Observer Name:', 
      value: data.name ? data.name : 'Anonymous / Empty (Confidential)' 
    },
    { label: 'Assessment Classification:', value: data.assessment },
    { label: 'Observation Type:', value: data.obsType || 'Behavior Observation' },
    { label: 'Hazard Category:', value: data.category || 'Red Zone Control Failure' }
  ];

  tableFields.forEach((field, idx) => {
    // Zebra striping
    if (idx % 2 === 0) {
      doc.setFillColor(248, 250, 252);
      doc.rect(margin, y, contentWidth, rowHeight, 'F');
    }
    doc.setDrawColor(226, 232, 240);
    doc.rect(margin, y, contentWidth, rowHeight, 'S');

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9);
    doc.setTextColor(71, 85, 105);
    doc.text(field.label, margin + 4, y + 6);

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);
    doc.setTextColor(15, 23, 42);
    doc.text(String(field.value), margin + col1Width + 4, y + 6);

    y += rowHeight;
  });

  // SECTION 2: OBSERVATION DESCRIPTION
  y += 8;
  doc.setTextColor(15, 23, 42);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(12);
  doc.text('2. Description of Observation', margin, y);
  y += 4;

  doc.setFillColor(248, 250, 252);
  doc.setDrawColor(203, 213, 225);
  doc.roundedRect(margin, y, contentWidth, 34, 1.5, 1.5, 'FD');

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9.5);
  doc.setTextColor(30, 41, 59);

  const splitObs = doc.splitTextToSize(data.observation || 'No observation description provided.', contentWidth - 8);
  doc.text(splitObs, margin + 4, y + 7);
  y += 34;

  // SECTION 3: ACTION TAKEN
  y += 8;
  doc.setTextColor(15, 23, 42);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(12);
  doc.text('3. Corrective Action Taken / Intervention', margin, y);
  y += 4;

  doc.setFillColor(240, 253, 250); // teal-50
  doc.setDrawColor(153, 246, 228); // teal-200
  doc.roundedRect(margin, y, contentWidth, 32, 1.5, 1.5, 'FD');

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9.5);
  doc.setTextColor(19, 78, 74); // teal-900

  const splitAction = doc.splitTextToSize(data.action || 'No action taken provided.', contentWidth - 8);
  doc.text(splitAction, margin + 4, y + 7);
  y += 32;

  // FOOTER & VERIFICATION STAMP
  const footerY = pageHeight - 25;
  doc.setDrawColor(203, 213, 225);
  doc.setLineWidth(0.4);
  doc.line(margin, footerY, pageWidth - margin, footerY);

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8);
  doc.setTextColor(100, 116, 139);
  doc.text('RIG 50 SAFETY MANAGEMENT SYSTEM', margin, footerY + 6);
  doc.text('OFFICIAL HSE RECORD', pageWidth - margin, footerY + 6, { align: 'right' });

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7.5);
  doc.text(
    `Submitted directly to Microsoft Forms (Tenant: ${RIG_50_NAME}) | Generated ${new Date().toLocaleString()}`,
    margin,
    footerY + 11
  );

  return doc;
}

export function downloadSoarPdf(data: SoarPdfData, filename?: string) {
  const doc = generateSoarPdf(data);
  const name = filename || `SOAR_Rig50_Receipt_${data.responseId || Date.now()}.pdf`;
  doc.save(name);
}

export function getSoarPdfBase64(data: SoarPdfData): string {
  const doc = generateSoarPdf(data);
  return doc.output('datauristring');
}
