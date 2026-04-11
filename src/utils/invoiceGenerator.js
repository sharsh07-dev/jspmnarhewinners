import jsPDF from 'jspdf';

// Helper to convert number to words
function numberToWords(num) {
    const a = ['', 'One ', 'Two ', 'Three ', 'Four ', 'Five ', 'Six ', 'Seven ', 'Eight ', 'Nine ', 'Ten ', 'Eleven ', 'Twelve ', 'Thirteen ', 'Fourteen ', 'Fifteen ', 'Sixteen ', 'Seventeen ', 'Eighteen ', 'Nineteen '];
    const b = ['', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety'];
    if ((num = num.toString()).length > 9) return 'overflow';
    let n = ('000000000' + num).substr(-9).match(/^(\d{2})(\d{2})(\d{2})(\d{1})(\d{2})$/);
    if (!n) return; let str = '';
    str += (n[1] != 0) ? (a[Number(n[1])] || b[n[1][0]] + ' ' + a[n[1][1]]) + 'Crore ' : '';
    str += (n[2] != 0) ? (a[Number(n[2])] || b[n[2][0]] + ' ' + a[n[2][1]]) + 'Lakh ' : '';
    str += (n[3] != 0) ? (a[Number(n[3])] || b[n[3][0]] + ' ' + a[n[3][1]]) + 'Thousand ' : '';
    str += (n[4] != 0) ? (a[Number(n[4])] || b[n[4][0]] + ' ' + a[n[4][1]]) + 'Hundred ' : '';
    str += (n[5] != 0) ? ((str != '') ? 'and ' : '') + (a[Number(n[5])] || b[n[5][0]] + ' ' + a[n[5][1]]) : '';
    return str.trim() ? str.trim() + ' Only' : 'Zero Only';
}

export const generateGSTInvoice = (transaction, seller, buyer) => {
    const doc = new jsPDF('p', 'mm', 'a4');
    
    const isInterState = seller.state?.toLowerCase() !== buyer.state?.toLowerCase() && buyer.state;
    const sellerState = seller.state || "Maharashtra";
    const buyerState = buyer.state || "Maharashtra";
    const actualInterState = sellerState !== buyerState;

    const baseAmount = transaction.price || 0;
    const gstRate = actualInterState ? 0.18 : 0.09; 
    const gstAmount = baseAmount * (actualInterState ? 0.18 : 0.18); // 18% total
    const totalAmount = baseAmount + gstAmount;

    // --- STRUCTURAL GRID & LINES ---
    doc.setLineWidth(0.8);
    doc.setDrawColor(0, 0, 0); // Black

    // 1. Master Border
    doc.rect(10, 10, 190, 277);

    // 2. Thick Headers Lines
    doc.setLineWidth(0.4);
    doc.line(10, 16, 200, 16); // Below "TAX INVOICE"
    doc.setLineWidth(0.8);
    doc.line(10, 40, 200, 40); // Below Company Banner
    
    // 3. Bill To / Meta Headers
    doc.setLineWidth(0.4);
    doc.line(10, 45, 200, 45); // Under meta headers (Bill to, Place of supply)
    doc.line(10, 60, 100, 60); // Under Bill To address (above GST TIN No)
    doc.setLineWidth(0.8);
    doc.line(10, 65, 200, 65); // Under entire Meta Box
    
    doc.setLineWidth(0.4);
    doc.line(100, 40, 100, 65); // Split Bill To | Place of Supply
    doc.line(150, 40, 150, 65); // Split POS | Invoice
    doc.line(175, 40, 175, 65); // Split Invoice | Dated
    
    // 4. Main Table Grid
    doc.setLineWidth(0.8);
    doc.line(10, 72, 200, 72); // Under Table Column Headers
    
    // Sub-totals lines
    doc.setLineWidth(0.4);
    doc.line(10, 150, 200, 150); // Under main body / Top of "Total"
    doc.line(10, 156, 200, 156); // Under "Total"
    doc.line(10, 162, 100, 162); // Under "Less Discount" (only spans Description)
    doc.line(10, 168, 200, 168); // Under "Taxable Value"
    
    // Final Total Lines
    doc.setLineWidth(0.8);
    doc.line(10, 240, 200, 240); // Top of Final Total
    doc.line(10, 246, 200, 246); // Bottom of Final Total (Footer starts)

    // Vertical Table Lines (from Y=65 to Y=246)
    doc.setLineWidth(0.6);
    doc.line(100, 65, 100, 246); // Right of Description
    doc.line(120, 65, 120, 156); // Right of HSN (Stops at Total)
    doc.line(135, 65, 135, 156); // Right of QTY
    doc.line(150, 65, 150, 156); // Right of Units
    doc.line(175, 65, 175, 246); // Right of RATE / Tax %

    // --- TEXT POPULATION ---

    // TAX INVOICE
    doc.setFont("helvetica", "bold");
    doc.setFontSize(10);
    doc.text("TAX INVOICE", 105, 14.5, { align: "center" });

    // Company Banner
    doc.setFontSize(22);
    doc.text(seller.name || "AgroShare Vendor", 105, 25, { align: "center" });
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);
    doc.text(seller.address || seller.village || "Vendor Local Business Address", 105, 30, { align: "center" });
    doc.text(`State: ${sellerState}, CONTACT:- ${seller.phone || "Not Provided"}`, 105, 34, { align: "center" });
    doc.setFont("helvetica", "bold");
    doc.text(`GST No ${seller.gstin || "Unregistered"}`, 105, 38, { align: "center" });

    // Meta Headers
    doc.setFontSize(9);
    doc.setFont("helvetica", "bold");
    doc.text("Bill to", 12, 44);
    doc.text("Place of Supply", 102, 44);
    doc.text("INVOICE No", 162.5, 44, { align: "center" });
    doc.text("Dated", 187.5, 44, { align: "center" });
    
    // Bill To Details
    doc.setFontSize(11);
    doc.text(buyer.name || "Farmer", 12, 50);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);
    doc.text(buyer.address || buyer.village || "Local Farming Address", 12, 54);
    doc.text(`State: ${buyerState}, India`, 12, 58);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(9);
    doc.text(`GST Tin No:- ${buyer.gstin || "Unregistered"}`, 12, 64);
    
    // Sub Places
    // Place of Supply Details
    doc.setFontSize(11);
    doc.text(buyer.name || "Farmer", 102, 50);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);
    doc.text(buyer.address || buyer.village || "Local Farming Address", 102, 54);
    doc.text(`State: ${buyerState}, India`, 102, 58);

    doc.setFont("helvetica", "normal");
    doc.setFontSize(9);
    doc.text(`INV-${transaction.id?.substring(0, 5).toUpperCase() || '1X0A'}`, 162.5, 55, { align: "center" });
    doc.setFont("helvetica", "bold");
    doc.text(`${new Date(transaction.createdAt || Date.now()).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: '2-digit' }).replace(/ /g, '-')}`, 187.5, 55, { align: "center" });

    // Table Column Headers
    doc.text("Description of Service", 12, 70);
    doc.text("HSN CODE", 102, 70);
    doc.text("QTY", 122, 70);
    doc.text("Units", 137, 70);
    doc.text("RATE", 152, 70);
    doc.text("Amount", 187.5, 70, { align: "center" });

    // Parse Qty String logically
    let q = "1", un = "pcs";
    if (transaction.duration) {
        if (isNaN(transaction.duration)) {
            // Extracted from "120ml" -> "120", "ml"
            const match = transaction.duration.match(/^(\d+)([a-zA-Z]+)$/);
            if (match) { q = match[1]; un = match[2]; }
            else { q = transaction.duration; un = "units"; }
        } else {
            q = transaction.duration;
            un = transaction.isPesticide ? "units" : "hrs";
        }
    }

    // Row Data
    doc.setFontSize(8);
    doc.setFont("helvetica", "normal");
    doc.text(transaction.equipmentName || "Farm Equipment / Service", 12, 80);
    doc.text("9973", 110, 80, { align: "center" });
    doc.text(q.toString(), 127.5, 80, { align: "center" });
    doc.text(un, 142.5, 80, { align: "center" });
    doc.text(baseAmount.toFixed(2), 172, 80, { align: "right" });
    doc.text(baseAmount.toFixed(2), 197, 80, { align: "right" });

    // Sub Totals Section
    doc.setFont("helvetica", "bold");
    doc.setFontSize(9);
    doc.text("Total", 12, 154);
    doc.text(baseAmount.toFixed(2), 197, 154, { align: "right" });

    doc.setFont("helvetica", "normal");
    doc.text("Less Discount 0%", 12, 160);
    doc.text("0.00", 197, 160, { align: "right" });

    doc.setFont("helvetica", "bold");
    doc.text("Taxable Value", 12, 166);
    doc.text(baseAmount.toFixed(2), 197, 166, { align: "right" });

    // Taxation Calculation
    if (actualInterState) {
        doc.text("ADD IGST 18%", 12, 175);
        doc.setFont("helvetica", "normal");
        doc.text("18%", 162.5, 175, { align: "center" });
        doc.text(gstAmount.toFixed(2), 197, 175, { align: "right" });
    } else {
        doc.text("ADD CGST 9%", 12, 175);
        doc.setFont("helvetica", "normal");
        doc.text("9%", 162.5, 175, { align: "center" });
        doc.text((gstAmount / 2).toFixed(2), 197, 175, { align: "right" });

        doc.setFont("helvetica", "bold");
        doc.text("ADD SGST 9%", 12, 185);
        doc.setFont("helvetica", "normal");
        doc.text("9%", 162.5, 185, { align: "center" });
        doc.text((gstAmount / 2).toFixed(2), 197, 185, { align: "right" });
    }

    // Final Total Row
    doc.setFont("helvetica", "bold");
    doc.text("Total", 12, 244);
    doc.setFontSize(10);
    doc.text(totalAmount.toFixed(2), 197, 244, { align: "right" });

    // Footer / Signatory
    doc.setFontSize(9);
    doc.setFont("helvetica", "normal");
    doc.text("Amount Chargeable (in words)", 12, 252);
    doc.setFont("helvetica", "bold");
    doc.text(`${numberToWords(Math.round(totalAmount))}`, 12, 256);
    doc.text(`Company's PAN : ${seller.pan || "NOT PROVIDED"}`, 12, 262);

    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);
    doc.text("Note-Please make cheques in favor of \"" + (seller.name || "Vendor") + "\"", 12, 274);

    doc.setFont("helvetica", "bold");
    doc.setFontSize(9);
    doc.text(`For ${seller.name || "AgroShare Vendor"}`, 195, 252, { align: "right" });
    doc.text("Authorized Signatory", 195, 274, { align: "right" });

    // ── Generate & Download ──────────────────────────────────────────
    const fileName = `AgroShare_Invoice_${transaction.id || Date.now()}.pdf`;
    
    try {
        // Output as blob for more robust mobile download handling
        const pdfBlob = doc.output('blob');
        const url = URL.createObjectURL(pdfBlob);
        const link = document.createElement('a');
        link.href = url;
        link.download = fileName;
        
        // Append to body, click and remove (standard robust pattern)
        document.body.appendChild(link);
        link.click();
        
        // Cleanup
        setTimeout(() => {
            document.body.removeChild(link);
            URL.revokeObjectURL(url);
        }, 100);
    } catch (err) {
        console.error("Invoice generation failed:", err);
        // Final fallback
        doc.save(fileName);
    }
};
