import { useRef } from 'react';
import { X, Printer, Download } from 'lucide-react';
import html2canvas from 'html2canvas';
import jsPDF from 'jspdf';
import { format } from 'date-fns';
import { Transaction } from '../types/Transaction';

interface PrintReceiptProps {
  transaction: Transaction;
  onClose: () => void;
}

export default function PrintReceipt({ transaction, onClose }: PrintReceiptProps) {
  const receiptRef = useRef<HTMLDivElement>(null);

  const handlePrint = () => {
    window.print();
  };

  const handleDownloadPDF = async () => {
    if (!receiptRef.current) return;

    try {
      const canvas = await html2canvas(receiptRef.current, {
        scale: 2,
        useCORS: true,
        backgroundColor: '#ffffff',
      });

      const pdf = new jsPDF({
        orientation: 'portrait',
        unit: 'mm',
        format: 'a4',
      });

      const imgData = canvas.toDataURL('image/png');
      const pdfWidth = pdf.internal.pageSize.getWidth();
      const pdfHeight = (canvas.height * pdfWidth) / canvas.width;

      pdf.addImage(imgData, 'PNG', 0, 0, pdfWidth, pdfHeight);
      pdf.save(`Receipt_${transaction.trans_no}.pdf`);
    } catch (error) {
      alert('Error generating PDF');
    }
  };

  const formatDateTime = (dateString: string | null | undefined) => {
    if (!dateString) return 'Not recorded';
    try {
      return format(new Date(dateString), 'MMM dd, yyyy HH:mm');
    } catch {
      return dateString || 'Invalid Date';
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-lg shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="sticky top-0 bg-white border-b border-gray-200 p-6 flex justify-between items-center print:hidden">
          <h2 className="text-2xl font-bold text-gray-900">Transaction Receipt</h2>
          <button
            onClick={onClose}
            className="text-gray-500 hover:text-gray-700"
          >
            <X className="h-6 w-6" />
          </button>
        </div>

        {/* Action Buttons */}
        <div className="bg-gray-50 border-b border-gray-200 p-4 flex gap-3 print:hidden">
          <button
            onClick={handlePrint}
            className="flex items-center gap-2 px-4 py-2 bg-neon-cyan-glow text-white rounded-lg hover:bg-neon-cyan-bright dark:shadow-neon-cyan transition"
          >
            <Printer className="h-4 w-4" />
            Print
          </button>
          <button
            onClick={handleDownloadPDF}
            className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition"
          >
            <Download className="h-4 w-4" />
            Download PDF
          </button>
        </div>

        {/* Receipt Content */}
        <div ref={receiptRef} className="p-8 bg-white print:p-3">
          {/* Company Header */}
          <div className="text-center mb-6 pb-3 border-b-2 border-gray-300 print:mb-3 print:pb-2">
            <div className="mx-auto w-64 mb-3 print:w-48 print:mb-2">
              <img 
                src="/metpower-official-logo.png" 
                alt="METpower Logo" 
                className="h-auto w-full object-contain"
                crossOrigin="anonymous"
              />
            </div>
            <p className="text-gray-600 text-sm print:text-xs">Official Transaction Receipt</p>
          </div>

          {/* Receipt Number and Date */}
          <div className="grid grid-cols-2 gap-4 mb-4 print:mb-2 print:gap-2">
            <div>
              <p className="text-xs text-gray-500 uppercase print:text-[10px]">Receipt #</p>
              <p className="text-lg font-bold text-gray-900 print:text-sm">{transaction.trans_no || 'N/A'}</p>
            </div>
            <div>
              <p className="text-xs text-gray-500 uppercase print:text-[10px]">Generated</p>
              <p className="text-lg font-bold text-gray-900 print:text-sm">{new Date().toLocaleDateString()}</p>
            </div>
          </div>

          {/* Primary Transaction Details */}
          <div className="mb-4 print:mb-2">
            <h3 className="text-sm font-bold text-gray-700 uppercase mb-3 pb-2 border-b border-gray-300 print:text-xs print:mb-2 print:pb-1">
              Transaction Details
            </h3>
            <div className="grid grid-cols-2 gap-3 print:gap-2">
              <div>
                <p className="text-xs text-gray-500 uppercase print:text-[10px]">Driver</p>
                <p className="text-sm font-semibold text-gray-900 print:text-xs">{transaction.driver || 'N/A'}</p>
              </div>
              <div>
                <p className="text-xs text-gray-500 uppercase print:text-[10px]">Product</p>
                <p className="text-sm font-semibold text-gray-900 print:text-xs">{transaction.product || 'N/A'}</p>
              </div>
              <div>
                <p className="text-xs text-gray-500 uppercase print:text-[10px]">Company/Supplier</p>
                <p className="text-sm font-semibold text-gray-900 print:text-xs">{transaction.del_comp || 'N/A'}</p>
              </div>
              <div>
                <p className="text-xs text-gray-500 uppercase print:text-[10px]">Vehicle Type</p>
                <p className="text-sm font-semibold text-gray-900 print:text-xs">{transaction.type_veh || 'N/A'}</p>
              </div>
              <div>
                <p className="text-xs text-gray-500 uppercase print:text-[10px]">Plate/License</p>
                <p className="text-sm font-semibold text-gray-900 print:text-xs">{transaction.plate || 'N/A'}</p>
              </div>
              <div>
                <p className="text-xs text-gray-500 uppercase print:text-[10px]">Barge Details</p>
                <p className="text-sm font-semibold text-gray-900 print:text-xs">{transaction.barge_details || 'N/A'}</p>
              </div>
            </div>
          </div>

          {/* Delivery & Documentation */}
          <div className="mb-4 print:mb-2">
            <h3 className="text-sm font-bold text-gray-700 uppercase mb-3 pb-2 border-b border-gray-300 print:text-xs print:mb-2 print:pb-1">
              Delivery Information
            </h3>
            <div className="grid grid-cols-2 gap-3 print:gap-2">
              <div>
                <p className="text-xs text-gray-500 uppercase print:text-[10px]">WS No.</p>
                <p className="text-sm font-semibold text-gray-900 print:text-xs">{transaction.ws_no || 'N/A'}</p>
              </div>
              <div>
                <p className="text-xs text-gray-500 uppercase print:text-[10px]">DR No.</p>
                <p className="text-sm font-semibold text-gray-900 print:text-xs">{transaction.dr_no || 'N/A'}</p>
              </div>
              <div className="col-span-2">
                <p className="text-xs text-gray-500 uppercase print:text-[10px]">Delivery Address</p>
                <p className="text-sm font-semibold text-gray-900 print:text-xs">{transaction.del_address || 'N/A'}</p>
              </div>
            </div>
          </div>

          {/* Time Log */}
          <div className="mb-4 print:mb-2">
            <h3 className="text-sm font-bold text-gray-700 uppercase mb-3 pb-2 border-b border-gray-300 print:text-xs print:mb-2 print:pb-1">
              Time Log
            </h3>
            <div className="grid grid-cols-2 gap-3 print:gap-2">
              <div>
                <p className="text-xs text-gray-500 uppercase print:text-[10px]">Inbound Date/Time</p>
                <p className="text-sm font-semibold text-gray-900 print:text-xs">{formatDateTime(transaction.inbound)}</p>
              </div>
              <div>
                <p className="text-xs text-gray-500 uppercase print:text-[10px]">Outbound Date/Time</p>
                <p className="text-sm font-semibold text-gray-900 print:text-xs">{formatDateTime(transaction.outbound)}</p>
              </div>
            </div>
          </div>

          {/* Weight Summary */}
          <div className="mb-4 bg-blue-50 p-3 rounded-lg border border-blue-200 print:mb-2 print:p-2">
            <h3 className="text-sm font-bold text-gray-700 uppercase mb-3 pb-2 print:text-xs print:mb-2 print:pb-1">
              Weight Summary
            </h3>
            <div className="grid grid-cols-4 gap-3 print:gap-2">
              <div className="text-center">
                <p className="text-xs text-gray-500 uppercase mb-1 print:text-[10px] print:mb-0">Gross Weight</p>
                <p className="text-xl font-bold text-gray-900 print:text-sm">{transaction.gross_weight ?? 'N/A'}</p>
                <p className="text-xs text-gray-500 print:text-[10px]">kg</p>
              </div>
              <div className="text-center">
                <p className="text-xs text-gray-500 uppercase mb-1 print:text-[10px] print:mb-0">Tare Weight</p>
                <p className="text-xl font-bold text-gray-900 print:text-sm">{transaction.tare_weight ?? 'N/A'}</p>
                <p className="text-xs text-gray-500 print:text-[10px]">kg</p>
              </div>
              <div className="text-center">
                <p className="text-xs text-gray-500 uppercase mb-1 print:text-[10px] print:mb-0">Net Weight</p>
                <p className="text-xl font-bold text-neon-cyan-glow print:text-sm">{transaction.net_weight ?? 'N/A'}</p>
                <p className="text-xs text-gray-500 print:text-[10px]">kg</p>
              </div>
              <div className="text-center">
                <p className="text-xs text-gray-500 uppercase mb-1 print:text-[10px] print:mb-0">Initial Net Wt</p>
                <p className="text-xl font-bold text-gray-900 print:text-sm">{transaction.initial_net_wt ?? 'N/A'}</p>
                <p className="text-xs text-gray-500 print:text-[10px]">kg</p>
              </div>
            </div>
          </div>

          {/* Additional Weight Details */}
          {(transaction.inbound_wt || transaction.outbound_wt) && (
            <div className="mb-4 print:mb-2">
              <h3 className="text-sm font-bold text-gray-700 uppercase mb-3 pb-2 border-b border-gray-300 print:text-xs print:mb-2 print:pb-1">
                Weight Tracking
              </h3>
              <div className="grid grid-cols-2 gap-3 print:gap-2">
                <div>
                  <p className="text-xs text-gray-500 uppercase print:text-[10px]">Inbound Weight</p>
                  <p className="text-sm font-semibold text-gray-900 print:text-xs">{transaction.inbound_wt ? `${transaction.inbound_wt} kg` : 'N/A'}</p>
                </div>
                <div>
                  <p className="text-xs text-gray-500 uppercase print:text-[10px]">Outbound Weight</p>
                  <p className="text-sm font-semibold text-gray-900 print:text-xs">{transaction.outbound_wt ? `${transaction.outbound_wt} kg` : 'N/A'}</p>
                </div>
              </div>
            </div>
          )}

          {/* Additional Details */}
          <div className="mb-4 print:mb-2">
            <h3 className="text-sm font-bold text-gray-700 uppercase mb-3 pb-2 border-b border-gray-300 print:text-xs print:mb-2 print:pb-1">
              Additional Information
            </h3>
            <div className="grid grid-cols-2 gap-3 print:gap-2">
              <div>
                <p className="text-xs text-gray-500 uppercase print:text-[10px]">No. of Bags</p>
                <p className="text-sm font-semibold text-gray-900 print:text-xs">{transaction.no_of_bags || 'N/A'}</p>
              </div>
              <div>
                <p className="text-xs text-gray-500 uppercase print:text-[10px]">Status</p>
                <p className="text-sm font-semibold text-gray-900 print:text-xs">{transaction.status || 'N/A'}</p>
              </div>
              <div>
                <p className="text-xs text-gray-500 uppercase print:text-[10px]">Weigher</p>
                <p className="text-sm font-semibold text-gray-900 print:text-xs">{transaction.weigher || 'N/A'}</p>
              </div>
              <div>
                <p className="text-xs text-gray-500 uppercase print:text-[10px]">Vessel ID</p>
                <p className="text-sm font-semibold text-gray-900 print:text-xs">{transaction.vessel_id || 'N/A'}</p>
              </div>
            </div>
          </div>

          {/* Remarks */}
          {transaction.remarks && (
            <div className="mb-3 print:mb-2">
              <h3 className="text-sm font-bold text-gray-700 uppercase mb-2 pb-2 border-b border-gray-300 print:text-xs print:mb-1 print:pb-1">
                Remarks
              </h3>
              <p className="text-sm text-gray-900 bg-gray-50 p-2 rounded print:text-xs print:p-1">{transaction.remarks}</p>
            </div>
          )}

          {/* Footer */}
          <div className="text-center text-xs text-gray-500 pt-4 border-t border-gray-300 print:pt-2 print:text-[10px]">
            <p>This is an official receipt from METpower Truck Accession System</p>
            <p className="mt-1">For support, contact your administrator</p>
            <p className="mt-2 font-semibold text-gray-700">Thank You!</p>
          </div>

          {/* Print Stylesheet */}
          <style>{`
            @media print {
              @page {
                size: A4;
                margin: 10mm;
              }
              body {
                background: white;
                margin: 0;
                padding: 0;
              }
              .no-print {
                display: none !important;
              }
              img {
                max-height: 60px !important;
              }
            }
          `}</style>
        </div>
      </div>
    </div>
  );
}
