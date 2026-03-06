import React from 'react';
import { X, Calendar, Package, Truck, User, Building2, Scale, Clock } from 'lucide-react';
import { Transaction } from '../types/Transaction';
import { format } from 'date-fns';
import AuditLog from './AuditLog';

// Function to format datetime for HTML input
const formatDateTimeForInput = (dateTimeString: string | null | undefined): string => {
  if (!dateTimeString) return '';
  
  try {
    // Handle different datetime formats from the database
    let date: Date;
    
    // Try parsing as ISO format first
    if (dateTimeString.includes('T')) {
      date = new Date(dateTimeString);
    } else {
      // Handle SQL Server datetime format: "2025-11-11 15:58:00.0000000"
      const cleanString = dateTimeString.replace(/\.\d+$/, ''); // Remove microseconds
      date = new Date(cleanString);
    }
    
    if (isNaN(date.getTime())) return '';
    
    // Format as YYYY-MM-DDThh:mm for datetime-local input
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    const hours = String(date.getHours()).padStart(2, '0');
    const minutes = String(date.getMinutes()).padStart(2, '0');
    
    return `${year}-${month}-${day}T${hours}:${minutes}`;
  } catch (error) {
    console.warn('Error formatting datetime:', error);
    return '';
  }
};

// Function to format date for HTML input
const formatDateForInput = (dateString: string | null | undefined): string => {
  if (!dateString) return '';
  
  try {
    const date = new Date(dateString);
    if (isNaN(date.getTime())) return '';
    
    // Format as YYYY-MM-DD for date input
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    
    return `${year}-${month}-${day}`;
  } catch (error) {
    console.warn('Error formatting date:', error);
    return '';
  }
};

interface TransactionModalProps {
  transaction: Transaction | null;
  isOpen: boolean;
  onClose: () => void;
  mode: 'view' | 'edit';
  onEdit?: () => void;
  onSave?: (data: Partial<Transaction>) => Promise<void>;
}

export default function TransactionModal({ 
  transaction, 
  isOpen, 
  onClose, 
  mode, 
  onEdit, 
  onSave 
}: TransactionModalProps) {
  const [formData, setFormData] = React.useState<Partial<Transaction>>({});
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState('');
  const [showAuditLog, setShowAuditLog] = React.useState(false);

  React.useEffect(() => {
    if (transaction) {
      // Convert weight values to numbers to ensure they display correctly
      const processedTransaction = { ...transaction };
      
      // Convert all weight fields from strings to numbers
      if (processedTransaction.gross_weight) {
        processedTransaction.gross_weight = parseInt(String(processedTransaction.gross_weight), 10) || 0;
      }
      if (processedTransaction.tare_weight) {
        processedTransaction.tare_weight = parseInt(String(processedTransaction.tare_weight), 10) || 0;
      }
      if (processedTransaction.net_weight) {
        processedTransaction.net_weight = parseInt(String(processedTransaction.net_weight), 10) || 0;
      }
      if (processedTransaction.inbound_wt) {
        processedTransaction.inbound_wt = parseInt(String(processedTransaction.inbound_wt), 10) || 0;
      }
      if (processedTransaction.outbound_wt) {
        processedTransaction.outbound_wt = parseInt(String(processedTransaction.outbound_wt), 10) || 0;
      }
      if (processedTransaction.initial_net_wt) {
        processedTransaction.initial_net_wt = parseInt(String(processedTransaction.initial_net_wt), 10) || 0;
      }
      if (processedTransaction.no_of_bags) {
        processedTransaction.no_of_bags = parseInt(String(processedTransaction.no_of_bags), 10) || 0;
      }
      
      setFormData(processedTransaction);
    }
  }, [transaction]);

  if (!isOpen || !transaction) return null;

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: name.includes('weight') || name.includes('wt') ? parseInt(value) || 0 : value
    }));

    // Auto-calculate net weight
    if (name === 'gross_weight' || name === 'tare_weight') {
      const gross = name === 'gross_weight' ? (parseInt(value) || 0) : (formData.gross_weight || 0);
      const tare = name === 'tare_weight' ? (parseInt(value) || 0) : (formData.tare_weight || 0);
      setFormData(prev => ({
        ...prev,
        [name]: parseInt(value) || 0,
        net_weight: gross - tare
      }));
    }
  };

  const handleSave = async () => {
    if (!onSave) return;
    
    try {
      setLoading(true);
      setError('');
      await onSave(formData);
      onClose();
    } catch (error: any) {
      setError(error.message || 'Failed to save transaction');
    } finally {
      setLoading(false);
    }
  };

  const formatDateTime = (dateString: string | null | undefined) => {
    if (!dateString) return '-';
    try {
      return format(new Date(dateString), 'MMM dd, yyyy HH:mm');
    } catch {
      return dateString;
    }
  };

  const inputClass = `w-full px-3 py-2 border rounded-lg text-sm ${
    mode === 'edit' 
      ? 'border-gray-300 focus:ring-2 focus:ring-neon-cyan-glow focus:border-transparent' 
      : 'border-gray-200 bg-gray-50 cursor-not-allowed'
  } transition-colors`;

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-stretch justify-center z-50 p-4 lg:p-8">
      <div className="glass-card rounded-2xl shadow-2xl w-full h-full max-w-none flex flex-col">
        {/* Header */}
        <div className="bg-gradient-to-r from-neon-cyan-glow to-teal-600 dark:shadow-neon-cyan px-6 py-4 flex-shrink-0">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <div className="h-8 w-8 bg-white/20 rounded-lg flex items-center justify-center">
                <Package className="h-5 w-5 text-white" />
              </div>
              <div>
                <h2 className="text-xl font-bold text-white">
                  {mode === 'view' ? 'Transaction Details' : 'Edit Transaction'}
                </h2>
                <p className="text-blue-100 text-sm">
                  Transaction #{transaction.id} - {transaction.trans_no}
                </p>
              </div>
            </div>
            
            <div className="flex items-center space-x-2">
              {mode === 'view' && onEdit && (
                <button
                  onClick={onEdit}
                  className="flex items-center space-x-2 px-4 py-2 bg-white/20 hover:bg-white/30 rounded-lg text-white font-medium transition-colors"
                >
                  <span>Edit</span>
                </button>
              )}
              
              <button
                onClick={onClose}
                className="p-2 hover:bg-white/20 rounded-lg text-white transition-colors"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
          </div>
        </div>

        {/* Content - Scrollable */}
        <div className="flex-1 overflow-y-auto">
          <div className="p-6">
            {error && (
              <div className="mb-6 bg-red-50 border border-red-200 rounded-lg p-4">
                <p className="text-red-700 text-sm">{error}</p>
              </div>
            )}

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Left Column */}
              <div className="space-y-6">
                {/* Reference Information */}
                <div className="bg-blue-50 p-4 rounded-lg border border-blue-200">
                  <h3 className="text-lg font-semibold text-gray-900 mb-4">
                    Reference Information
                  </h3>
                  
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Transaction No.
                      </label>
                      {mode === 'view' ? (
                        <div className="px-3 py-2 bg-white rounded-lg border text-sm font-medium">
                          {transaction.trans_no || '-'}
                        </div>
                      ) : (
                        <input
                          type="text"
                          name="trans_no"
                          value={formData.trans_no || ''}
                          onChange={handleChange}
                          className={inputClass}
                        />
                      )}
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Status
                      </label>
                      {mode === 'view' ? (
                        <div className="px-3 py-2 bg-white rounded-lg border">
                          <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                            transaction.status === 'Valid' 
                              ? 'bg-green-100 text-green-800'
                              : transaction.status === 'Pending'
                              ? 'bg-yellow-100 text-yellow-800'
                              : transaction.status === 'Void'
                              ? 'bg-gray-100 text-gray-800'
                              : 'bg-red-100 text-red-800'
                          }`}>
                            {transaction.status}
                          </span>
                        </div>
                      ) : (
                        <select
                          name="status"
                          value={formData.status || ''}
                          onChange={handleChange}
                          className={inputClass}
                        >
                          <option value="Valid">Valid</option>
                          <option value="Pending">Pending</option>
                          <option value="Cancelled">Cancelled</option>
                          <option value="Void">Void</option>
                        </select>
                      )}
                    </div>
                  </div>
                </div>

                {/* Vehicle Information */}
                <div className="bg-gray-50 p-4 rounded-lg">
                  <h3 className="flex items-center space-x-2 text-lg font-semibold text-gray-900 mb-4">
                    <Truck className="h-5 w-5 text-neon-cyan-glow" />
                    <span>Vehicle Information</span>
                  </h3>
                  
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Truck Plate
                      </label>
                      {mode === 'view' ? (
                        <div className="px-3 py-2 bg-white rounded-lg border text-sm">
                          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                            {transaction.plate || '-'}
                          </span>
                        </div>
                      ) : (
                        <input
                          type="text"
                          name="plate"
                          value={formData.plate || ''}
                          onChange={handleChange}
                          className={inputClass}
                        />
                      )}
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Vehicle Type
                      </label>
                      {mode === 'view' ? (
                        <div className="px-3 py-2 bg-white rounded-lg border text-sm">
                          {transaction.type_veh || '-'}
                        </div>
                      ) : (
                        <input
                          type="text"
                          name="type_veh"
                          value={formData.type_veh || ''}
                          onChange={handleChange}
                          className={inputClass}
                        />
                      )}
                    </div>
                  </div>
                </div>

                {/* Personnel Information */}
                <div className="bg-gray-50 p-4 rounded-lg">
                  <h3 className="flex items-center space-x-2 text-lg font-semibold text-gray-900 mb-4">
                    <User className="h-5 w-5 text-neon-cyan-glow" />
                    <span>Personnel</span>
                  </h3>
                  
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Driver
                      </label>
                      {mode === 'view' ? (
                        <div className="px-3 py-2 bg-white rounded-lg border text-sm">
                          {transaction.driver || '-'}
                        </div>
                      ) : (
                        <input
                          type="text"
                          name="driver"
                          value={formData.driver || ''}
                          onChange={handleChange}
                          className={inputClass}
                        />
                      )}
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Weigher
                      </label>
                      {mode === 'view' ? (
                        <div className="px-3 py-2 bg-white rounded-lg border text-sm">
                          {transaction.weigher || '-'}
                        </div>
                      ) : (
                        <input
                          type="text"
                          name="weigher"
                          value={formData.weigher || ''}
                          onChange={handleChange}
                          className={inputClass}
                        />
                      )}
                    </div>
                  </div>
                </div>

                {/* Product Information */}
                <div className="bg-gray-50 p-4 rounded-lg">
                  <h3 className="flex items-center space-x-2 text-lg font-semibold text-gray-900 mb-4">
                    <Package className="h-5 w-5 text-neon-cyan-glow" />
                    <span>Product Details</span>
                  </h3>
                  
                  <div className="space-y-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Commodity/Product
                      </label>
                      {mode === 'view' ? (
                        <div className="px-3 py-2 bg-white rounded-lg border text-sm">
                          {transaction.product || '-'}
                        </div>
                      ) : (
                        <input
                          type="text"
                          name="product"
                          value={formData.product || ''}
                          onChange={handleChange}
                          className={inputClass}
                        />
                      )}
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          No. of Bags
                        </label>
                        {mode === 'view' ? (
                          <div className="px-3 py-2 bg-white rounded-lg border text-sm">
                            {transaction.no_of_bags || '-'}
                          </div>
                        ) : (
                          <input
                            type="text"
                            name="no_of_bags"
                            value={formData.no_of_bags || ''}
                            onChange={handleChange}
                            className={inputClass}
                          />
                        )}
                      </div>

                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          Barge Details
                        </label>
                        {mode === 'view' ? (
                          <div className="px-3 py-2 bg-white rounded-lg border text-sm">
                            {transaction.barge_details || '-'}
                          </div>
                        ) : (
                          <select
                            name="barge_details"
                            value={formData.barge_details || ''}
                            onChange={handleChange}
                            className={inputClass}
                          >
                            <option value="GROSS">GROSS</option>
                            <option value="NET">NET</option>
                            <option value="TARE">TARE</option>
                          </select>
                        )}
                      </div>
                    </div>
                  </div>
                </div>

                {/* Company Information */}
                <div className="bg-gray-50 p-4 rounded-lg">
                  <h3 className="flex items-center space-x-2 text-lg font-semibold text-gray-900 mb-4">
                    <Building2 className="h-5 w-5 text-neon-cyan-glow" />
                    <span>Company Details</span>
                  </h3>
                  
                  <div className="space-y-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Company Name
                      </label>
                      {mode === 'view' ? (
                        <div className="px-3 py-2 bg-white rounded-lg border text-sm">
                          {transaction.del_comp || '-'}
                        </div>
                      ) : (
                        <input
                          type="text"
                          name="del_comp"
                          value={formData.del_comp || ''}
                          onChange={handleChange}
                          className={inputClass}
                        />
                      )}
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Location/Address
                      </label>
                      {mode === 'view' ? (
                        <div className="px-3 py-2 bg-white rounded-lg border text-sm min-h-[60px]">
                          {transaction.del_address || '-'}
                        </div>
                      ) : (
                        <textarea
                          name="del_address"
                          value={formData.del_address || ''}
                          onChange={handleChange}
                          rows={2}
                          className={inputClass}
                        />
                      )}
                    </div>
                  </div>
                </div>
              </div>

              {/* Right Column */}
              <div className="space-y-6">
                {/* Weight Information */}
                <div className="bg-gradient-to-br from-blue-50 to-teal-50 p-6 rounded-lg border border-blue-200">
                  <h3 className="flex items-center space-x-2 text-lg font-semibold text-gray-900 mb-6">
                    <Scale className="h-5 w-5 text-neon-cyan-glow" />
                    <span>Weight Measurements</span>
                  </h3>
                  
                  <div className="space-y-6">
                    {/* Main Weights */}
                    <div className="grid grid-cols-1 gap-4">
                      <div className="bg-white p-4 rounded-lg shadow-sm">
                        <label className="block text-sm font-medium text-gray-600 mb-2">
                          Gross Weight (kg)
                        </label>
                        {mode === 'view' ? (
                          <div className="text-2xl font-bold text-gray-900">
                            {transaction.gross_weight?.toLocaleString() || '0'}
                          </div>
                        ) : (
                          <input
                            type="number"
                            name="gross_weight"
                            value={formData.gross_weight || 0}
                            onChange={handleChange}
                            className="w-full px-4 py-3 text-2xl font-bold text-gray-900 border border-gray-300 rounded-lg focus:ring-2 focus:ring-neon-cyan-glow focus:border-transparent"
                          />
                        )}
                      </div>

                      <div className="bg-white p-4 rounded-lg shadow-sm">
                        <label className="block text-sm font-medium text-gray-600 mb-2">
                          Tare Weight (kg)
                        </label>
                        {mode === 'view' ? (
                          <div className="text-2xl font-bold text-gray-900">
                            {transaction.tare_weight?.toLocaleString() || '0'}
                          </div>
                        ) : (
                          <input
                            type="number"
                            name="tare_weight"
                            value={formData.tare_weight || 0}
                            onChange={handleChange}
                            className="w-full px-4 py-3 text-2xl font-bold text-gray-900 border border-gray-300 rounded-lg focus:ring-2 focus:ring-neon-cyan-glow focus:border-transparent"
                          />
                        )}
                      </div>

                      <div className="bg-gradient-to-r from-green-500 to-emerald-500 text-white p-4 rounded-lg shadow-lg">
                        <label className="block text-sm font-medium text-green-100 mb-2">
                          Net Weight (kg)
                        </label>
                        <div className="text-3xl font-bold">
                          {(mode === 'edit' ? formData.net_weight : transaction.net_weight)?.toLocaleString() || '0'}
                        </div>
                      </div>
                    </div>

                    {/* Additional Weights */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          Inbound Weight
                        </label>
                        {mode === 'view' ? (
                          <div className="px-3 py-2 bg-white rounded-lg border text-sm font-medium">
                            {transaction.inbound_wt?.toLocaleString() || '0'} kg
                          </div>
                        ) : (
                          <input
                            type="number"
                            name="inbound_wt"
                            value={formData.inbound_wt || 0}
                            onChange={handleChange}
                            className={inputClass}
                          />
                        )}
                      </div>

                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          Outbound Weight
                        </label>
                        {mode === 'view' ? (
                          <div className="px-3 py-2 bg-white rounded-lg border text-sm font-medium">
                            {transaction.outbound_wt?.toLocaleString() || '0'} kg
                          </div>
                        ) : (
                          <input
                            type="number"
                            name="outbound_wt"
                            value={formData.outbound_wt || 0}
                            onChange={handleChange}
                            className={inputClass}
                          />
                        )}
                      </div>
                    </div>
                  </div>
                </div>

                {/* DateTime Information */}
                <div className="bg-gray-50 p-4 rounded-lg">
                  <h3 className="flex items-center space-x-2 text-lg font-semibold text-gray-900 mb-4">
                    <Calendar className="h-5 w-5 text-neon-cyan-glow" />
                    <span>Date & Time</span>
                  </h3>
                  
                  <div className="space-y-4">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          Inbound Date/Time
                        </label>
                        {mode === 'view' ? (
                          <div className="px-3 py-2 bg-white rounded-lg border text-sm">
                            {formatDateTime(transaction.inbound)}
                          </div>
                        ) : (
                          <input
                            type="datetime-local"
                            name="inbound"
                            value={formatDateTimeForInput(formData.inbound)}
                            onChange={handleChange}
                            className={inputClass}
                          />
                        )}
                      </div>

                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          Outbound Date/Time
                        </label>
                        {mode === 'view' ? (
                          <div className="px-3 py-2 bg-white rounded-lg border text-sm">
                            {formatDateTime(transaction.outbound)}
                          </div>
                        ) : (
                          <input
                            type="datetime-local"
                            name="outbound"
                            value={formatDateTimeForInput(formData.outbound)}
                            onChange={handleChange}
                            className={inputClass}
                          />
                        )}
                      </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          Transaction Date
                        </label>
                        {mode === 'view' ? (
                          <div className="px-3 py-2 bg-white rounded-lg border text-sm">
                            {formatDateTime(transaction.transac_date)}
                          </div>
                        ) : (
                          <input
                            type="datetime-local"
                            name="transac_date"
                            value={formatDateTimeForInput(formData.transac_date)}
                            onChange={handleChange}
                            className={inputClass}
                          />
                        )}
                      </div>

                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          Date
                        </label>
                        {mode === 'view' ? (
                          <div className="px-3 py-2 bg-white rounded-lg border text-sm">
                            {transaction.date || '-'}
                          </div>
                        ) : (
                          <input
                            type="date"
                            name="date"
                            value={formatDateForInput(formData.date)}
                            onChange={handleChange}
                            className={inputClass}
                          />
                        )}
                      </div>
                    </div>
                  </div>
                </div>

                {/* Additional Fields */}
                <div className="bg-gray-50 p-4 rounded-lg">
                  <h3 className="text-lg font-semibold text-gray-900 mb-4">
                    Additional Information
                  </h3>
                  
                  <div className="space-y-4">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          WS No.
                        </label>
                        {mode === 'view' ? (
                          <div className="px-3 py-2 bg-white rounded-lg border text-sm">
                            {transaction.ws_no || '-'}
                          </div>
                        ) : (
                          <input
                            type="text"
                            name="ws_no"
                            value={formData.ws_no || ''}
                            onChange={handleChange}
                            className={inputClass}
                          />
                        )}
                      </div>

                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          DR No.
                        </label>
                        {mode === 'view' ? (
                          <div className="px-3 py-2 bg-white rounded-lg border text-sm">
                            {transaction.dr_no || '-'}
                          </div>
                        ) : (
                          <input
                            type="text"
                            name="dr_no"
                            value={formData.dr_no || ''}
                            onChange={handleChange}
                            className={inputClass}
                          />
                        )}
                      </div>
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Vessel ID
                      </label>
                      {mode === 'view' ? (
                        <div className="px-3 py-2 bg-white rounded-lg border text-sm">
                          {transaction.vessel_id || '-'}
                        </div>
                      ) : (
                        <input
                          type="text"
                          name="vessel_id"
                          value={formData.vessel_id || ''}
                          onChange={handleChange}
                          className={inputClass}
                        />
                      )}
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Remarks
                      </label>
                      {mode === 'view' ? (
                        <div className="px-3 py-2 bg-white rounded-lg border text-sm min-h-[80px]">
                          {transaction.remarks || '-'}
                        </div>
                      ) : (
                        <textarea
                          name="remarks"
                          value={formData.remarks || ''}
                          onChange={handleChange}
                          rows={3}
                          className={inputClass}
                        />
                      )}
                    </div>
                  </div>
                </div>

              </div>
            </div>
          </div>
        </div>

        {/* Footer - Fixed at bottom */}
        {mode === 'view' && (
          <div className="bg-gray-50 px-6 py-4 border-t border-gray-200 flex-shrink-0">
            <div className="flex justify-between items-center">
              <button
                onClick={() => setShowAuditLog(true)}
                className="flex items-center space-x-2 px-4 py-2 text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
              >
                <Clock className="w-4 h-4" />
                <span>View Activity Log</span>
              </button>
              <div className="flex space-x-3">
                {onEdit && (
                  <button
                    onClick={onEdit}
                    className="px-4 py-2 bg-neon-cyan-glow text-white rounded-lg hover:bg-neon-cyan-bright dark:shadow-neon-cyan transition-colors"
                  >
                    Edit Transaction
                  </button>
                )}
                <button
                  onClick={onClose}
                  className="px-4 py-2 text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        )}
        {mode === 'edit' && (
          <div className="bg-gray-50 px-6 py-4 border-t border-gray-200 flex-shrink-0">
            <div className="flex justify-end space-x-3">
              <button
                onClick={onClose}
                className="px-4 py-2 text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleSave}
                disabled={loading}
                className="flex items-center space-x-2 px-6 py-2 bg-gradient-to-r from-neon-cyan-glow to-teal-600 hover:from-neon-cyan-bright hover:to-teal-700 dark:shadow-neon-cyan text-white font-medium rounded-lg disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200"
              >
                {loading ? (
                  <>
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                    <span>Saving...</span>
                  </>
                ) : (
                  <span>Save Changes</span>
                )}
              </button>
            </div>
          </div>
        )}
      </div>
      
      {/* Audit Log Modal */}
      {showAuditLog && transaction && (
        <AuditLog 
          transactionId={transaction.id} 
          onClose={() => setShowAuditLog(false)} 
        />
      )}
    </div>
  );
}