/** @jsxImportSource react */
import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Content, TDocumentDefinitions } from 'pdfmake/interfaces';
import { useToast } from '@/hooks/use-toast';
import { Toaster } from '@/components/ui/toaster';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Separator } from '@/components/ui/separator';
import {
  Plus, Trash2, Calculator, Download, BookOpen,
  Maximize, Layers, FileText, Copy, FileStack,
  Palette, CheckSquare, Settings, PenTool, Book,
  Cpu, Percent, PlusCircle, Receipt, Wallet,
  User, UserCircle, Shield
} from 'lucide-react';
import { Link } from 'react-router-dom';
import pdfMake from 'pdfmake/build/pdfmake';
import pdfFonts from 'pdfmake/build/vfs_fonts';
import { supabase } from '@/integrations/supabase/client';

// Database types
interface PaperCost {
  id: string;
  paper_type: string;
  size: string;
  cost_per_page: number;
}

interface TonerCost {
  id: string;
  color_type: string;
  size: string;
  cost_per_page: number;
}

interface CoverCost {
  id: string;
  cover_type: string;
  size: string;
  cost: number;
}

interface FinishingCost {
  id: string;
  page_range_min: number;
  page_range_max: number | null;
  cost: number;
}

interface PackagingCost {
  id: string;
  size: string;
  cost: number;
}

interface BHRSetting {
  id: string;
  rate_per_hour: number;
}

interface AdditionalService {
  id: string;
  service_name: string;
  cost: number;
  is_default: boolean;
}

interface ProfitMargin {
  id: string;
  copies_min: number;
  copies_max: number | null;
  margin_percentage_1: number;
  margin_percentage_2: number | null;
}

interface OtherService {
  description: string;
  cost: number;
}

interface Quote {
  bookSize: string;
  paperType: string;
  interiorType: string;
  coverType: string;
  pageCount: number;
  copies: number;
  includeDesign: boolean;
  includeISBN: boolean;
  includeBHR: boolean;
  includeSpecialFinishing: boolean;
  applyBulkDiscount: boolean;
  profitMargin: number;
  others: OtherService[];
  customerName?: string;
  customerEmail?: string;
  customerPhone?: string;
  staffName?: string;
  staffId?: string;
}

interface Calculations {
  paperCost: number;
  tonerCost: number;
  coverCost: number;
  finishingCost: number;
  packagingCost: number;
  bhrCost: number;
  designCost: number;
  isbnCost: number;
  othersCost: number;
  bookSpecsTotal: number;
  additionalServicesTotal: number;
  rawCost: number;
  finalQuotation: number;
}

export const QuoteCalculator: React.FC = () => {
  const { toast } = useToast();

  // State for all costs from database
  const [paperCosts, setPaperCosts] = useState<PaperCost[]>([]);
  const [tonerCosts, setTonerCosts] = useState<TonerCost[]>([]);
  const [coverCosts, setCoverCosts] = useState<CoverCost[]>([]);
  const [finishingCosts, setFinishingCosts] = useState<FinishingCost[]>([]);
  const [packagingCosts, setPackagingCosts] = useState<PackagingCost[]>([]);
  const [bhrSettings, setBhrSettings] = useState<BHRSetting[]>([]);
  const [additionalServices, setAdditionalServices] = useState<AdditionalService[]>([]);
  const [profitMargins, setProfitMargins] = useState<ProfitMargin[]>([]);

  // Quote state
  const [quote, setQuote] = useState<Quote>({
    bookSize: '',
    paperType: '',
    interiorType: '',
    coverType: '',
    pageCount: 0,
    copies: 0,
    includeDesign: false,
    includeISBN: false,
    includeBHR: false,
    includeSpecialFinishing: false,
    applyBulkDiscount: false,
    profitMargin: 100,
    others: [],
    customerName: '',
    customerEmail: '',
    customerPhone: '',
    staffName: '',
    staffId: ''
  });

  // New other service form
  const [newOther, setNewOther] = useState<OtherService>({
    description: '',
    cost: 0
  });

  // Load all costs from database
  useEffect(() => {
    loadAllCosts();
  }, []);

  const loadAllCosts = async () => {
    try {
      const [paperRes, tonerRes, coverRes, finishingRes, packagingRes, bhrRes, additionalRes, profitRes] = await Promise.all([
        supabase.from('paper_costs').select('*'),
        supabase.from('toner_costs').select('*'),
        supabase.from('cover_costs').select('*'),
        supabase.from('finishing_costs').select('*'),
        supabase.from('packaging_costs').select('*'),
        supabase.from('bhr_settings').select('*'),
        supabase.from('additional_services').select('*'),
        supabase.from('profit_margins').select('*')
      ]);

      if (paperRes.data) setPaperCosts(paperRes.data);
      if (tonerRes.data) setTonerCosts(tonerRes.data);
      if (coverRes.data) setCoverCosts(coverRes.data);
      if (finishingRes.data) setFinishingCosts(finishingRes.data);
      if (packagingRes.data) setPackagingCosts(packagingRes.data);
      if (bhrRes.data) setBhrSettings(bhrRes.data);
      if (additionalRes.data) setAdditionalServices(additionalRes.data);
      if (profitRes.data) setProfitMargins(profitRes.data);
    } catch (error) {
      console.error('Error loading costs:', error);
    }
  };

  // Calculate all costs
  const calculations: Calculations = React.useMemo(() => {
    const paperCost = paperCosts.find(p => 
      p.paper_type === quote.paperType && p.size === quote.bookSize
    )?.cost_per_page || 0;

    const tonerCost = tonerCosts.find(t => 
      t.color_type === quote.interiorType && t.size === quote.bookSize
    )?.cost_per_page || 0;

    const coverCost = coverCosts.find(c => 
      c.cover_type === quote.coverType && c.size === quote.bookSize
    )?.cost || 0;

    const finishingCost = finishingCosts.find(f => 
      quote.pageCount >= f.page_range_min && 
      (f.page_range_max === null || quote.pageCount <= f.page_range_max)
    )?.cost || 0;

    const packagingCost = packagingCosts.find(p => p.size === quote.bookSize)?.cost || 0;

    const bhrRate = bhrSettings[0]?.rate_per_hour || 3000;
    const factor = quote.bookSize === 'A6' ? 5 : quote.bookSize === 'A5' ? 10 : 20;
    const bhrCost = quote.includeBHR ? (quote.pageCount / factor / 48 * quote.copies * bhrRate) : 0;

    const designService = additionalServices.find(s => s.service_name === 'Design');
    const isbnService = additionalServices.find(s => s.service_name === 'ISBN');
    
    const designCost = quote.includeDesign ? (designService?.cost || 10000) : 0;
    const isbnCost = quote.includeISBN ? (isbnService?.cost || 8000) : 0;
    const othersCost = quote.others.reduce((sum, item) => sum + item.cost, 0);

    const totalPaperCost = paperCost * quote.pageCount * quote.copies;
    const totalTonerCost = tonerCost * quote.pageCount * quote.copies;
    const totalCoverCost = coverCost * quote.copies;
    const totalFinishingCost = finishingCost * quote.copies;
    const totalPackagingCost = packagingCost * quote.copies;

    const bookSpecsTotal = totalPaperCost + totalTonerCost + totalCoverCost + totalFinishingCost + totalPackagingCost;
    const additionalServicesTotal = designCost + isbnCost + bhrCost + othersCost;
    const rawCost = bookSpecsTotal + additionalServicesTotal;

    const profitAmount = (rawCost * quote.profitMargin) / 100;
    const finalQuotation = rawCost + profitAmount;

    return {
      paperCost: totalPaperCost,
      tonerCost: totalTonerCost,
      coverCost: totalCoverCost,
      finishingCost: totalFinishingCost,
      packagingCost: totalPackagingCost,
      bhrCost,
      designCost,
      isbnCost,
      othersCost,
      bookSpecsTotal,
      additionalServicesTotal,
      rawCost,
      finalQuotation
    };
  }, [quote, paperCosts, tonerCosts, coverCosts, finishingCosts, packagingCosts, bhrSettings, additionalServices]);

  const bulkDiscount = React.useMemo(() => {
    if (!quote.applyBulkDiscount) return { apply: false, amount: 0 };
    
    const discountPercentage = quote.copies >= 1000 ? 0.15 : 
                              quote.copies >= 500 ? 0.10 : 
                              quote.copies >= 250 ? 0.05 : 0;
    
    const amount = calculations.finalQuotation * discountPercentage;
    return { apply: discountPercentage > 0, amount };
  }, [quote.applyBulkDiscount, quote.copies, calculations.finalQuotation]);

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-NG', {
      style: 'currency',
      currency: 'NGN',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0
    }).format(amount);
  };

  const generatePDF = async (): Promise<void> => {
    // Input validation
    if (!quote.bookSize || !quote.paperType || !quote.interiorType || !quote.coverType) {
      toast({
        title: "Error",
        description: "Please fill in all required fields",
        variant: "destructive",
      });
      return;
    }

    try {
      // Configure pdfMake with fonts
      pdfMake.vfs = pdfFonts.vfs;

      // Generate quote details
      const quotationId = `QT-${new Date().getFullYear()}-${String(Date.now()).slice(-3)}`;
      const fileName = `GlitPrints-Quote-${quotationId}.pdf`;
      const currentDate = new Date().toLocaleDateString('en-GB', {
        day: '2-digit',
        month: 'numeric',
        year: 'numeric'
      });

      // Calculate additional services total
      const additionalServicesTotal = 
        (quote.includeDesign ? calculations.designCost : 0) +
        (quote.includeISBN ? calculations.isbnCost : 0) +
        quote.others.reduce((sum, item) => sum + item.cost, 0);

      // Document definition
      const docDefinition: TDocumentDefinitions = {
        pageSize: 'A4',
        pageMargins: [40, 60, 40, 60],
        content: [
          // Header
          {
            layout: 'noBorders',
            table: {
              widths: ['*'],
              body: [[{
                text: 'Glit Publisher Quote',
                style: 'header',
                fillColor: '#254BE3',
                color: 'white',
                bold: true,
                fontSize: 24,
                alignment: 'center',
                margin: [16, 16, 16, 16]
              }]]
            },
            margin: [0, 0, 0, 10]
          },

          // Quote ID and Date
          {
            columns: [
              { text: `Quotation ID: ${quotationId}`, fontSize: 12, bold: true },
              { text: `Date: ${currentDate}`, fontSize: 12, bold: true, alignment: 'right' }
            ],
            margin: [0, 0, 0, 20]
          },

          // Customer & Staff Information (only show if filled)
          ...(quote.customerName || quote.customerEmail || quote.customerPhone || quote.staffName || quote.staffId ? [{
            layout: 'noBorders',
            table: {
              widths: ['*'],
              body: [[{
                stack: [
                  // Customer Information
                  ...(quote.customerName || quote.customerEmail || quote.customerPhone ? [
                    { text: 'Customer Information', style: 'sectionHeader', margin: [0, 0, 0, 8] },
                    ...(quote.customerName ? [{ text: `Name: ${quote.customerName}`, fontSize: 10, margin: [0, 2] }] : []),
                    ...(quote.customerPhone ? [{ text: `Phone: ${quote.customerPhone}`, fontSize: 10, margin: [0, 2] }] : []),
                    ...(quote.customerEmail ? [{ text: `Email: ${quote.customerEmail}`, fontSize: 10, margin: [0, 2] }] : [])
                  ] : []),
                  
                  // Staff Information
                  ...(quote.staffName || quote.staffId ? [
                    { text: 'Prepared By', style: 'sectionHeader', margin: [0, 10, 0, 8] },
                    ...(quote.staffName ? [{ text: `Staff Name: ${quote.staffName}`, fontSize: 10, margin: [0, 2] }] : []),
                    ...(quote.staffId ? [{ text: `Staff ID: ${quote.staffId}`, fontSize: 10, margin: [0, 2] }] : [])
                  ] : [])
                ],
                fillColor: '#F7FAFC',
                margin: [12, 12, 12, 12]
              }]]
            },
            margin: [0, 0, 0, 20]
          }] : []),

          // Book Specifications Section
          {
            stack: [
              { text: 'Book Specifications', style: 'sectionHeader', margin: [0, 0, 0, 10] },
              {
                layout: {
                  hLineWidth: () => 0.5,
                  vLineWidth: () => 0.5,
                  hLineColor: () => '#E2E8F0', 
                  vLineColor: () => '#E2E8F0'
                },
                table: {
                  widths: ['*', '*'],
                  body: [
                    ['Book Size:', quote.bookSize],
                    ['Cover Type:', quote.coverType],
                    ['Page Count:', quote.pageCount.toString()],
                    ['Copies:', quote.copies.toString()],
                    ['Total Pages:', (quote.pageCount * quote.copies).toLocaleString()],
                    ['Paper Type:', quote.paperType],
                    ['Interior Type:', quote.interiorType]
                  ]
                }
              },
              // Printing Cost Total
              {
                layout: 'noBorders',
                table: {
                  widths: ['*'],
                  body: [[{
                    text: `Printing Cost Total: ${formatCurrency(calculations.rawCost)}`,
                    style: 'totalLabel',
                    fillColor: '#254BE3',
                    color: 'white',
                    bold: true,
                    alignment: 'center',
                    margin: [12, 8, 12, 8]
                  }]]
                },
                margin: [0, 10, 0, 0]
              }
            ],
            margin: [0, 0, 0, 20]
          },

          // Additional Services Section (only show if any services are selected)
          ...(quote.includeDesign || quote.includeISBN || quote.others.length > 0 ? [{
            stack: [
              { text: 'Additional Services', style: 'sectionHeader', margin: [0, 0, 0, 10] },
              {
                layout: {
                  hLineWidth: () => 0.5,
                  vLineWidth: () => 0.5,
                  hLineColor: () => '#E2E8F0',
                  vLineColor: () => '#E2E8F0'
                },
                table: {
                  widths: ['*', 'auto'],
                  body: [
                    ...(quote.includeDesign ? [['Design', `${formatCurrency(calculations.designCost)}`]] : []),
                    ...(quote.includeISBN ? [['ISBN', `${formatCurrency(calculations.isbnCost)}`]] : []),
                    ...quote.others.map(item => [item.description, `${formatCurrency(item.cost)}`])
                  ]
                }
              },
              // Additional Services Total
              {
                layout: 'noBorders',
                table: {
                  widths: ['*'],
                  body: [[{
                    text: `Additional Services Total: ${formatCurrency(additionalServicesTotal)}`,
                    style: 'totalLabel',
                    fillColor: '#254BE3',
                    color: 'white',
                    bold: true,
                    alignment: 'center',
                    margin: [12, 8, 12, 8]
                  }]]
                },
                margin: [0, 10, 0, 0]
              }
            ],
            margin: [0, 0, 0, 20]
          }] : []),

          // Bulk Discount (only show if applied)
          ...(bulkDiscount.apply && bulkDiscount.amount > 0 ? [{
            text: `Bulk Discount: -${formatCurrency(bulkDiscount.amount)}`,
            color: '#DC2626',
            bold: true,
            fontSize: 12,
            margin: [0, 0, 0, 10]
          }] : []),

          // Final Quotation
          {
            layout: 'noBorders',
            table: {
              widths: ['*'],
              body: [[{
                text: `Final Quotation: ${formatCurrency(calculations.finalQuotation - (bulkDiscount.apply ? bulkDiscount.amount : 0))}`,
                fillColor: '#254BE3',
                color: 'white',
                bold: true,
                fontSize: 18,
                alignment: 'center',
                margin: [16, 16, 16, 16]
              }]]
            },
            margin: [0, 20, 0, 40]
          },

          // Footer
          {
            canvas: [{ 
              type: 'line', 
              x1: 0, 
              y1: 0, 
              x2: 515, 
              y2: 0, 
              lineWidth: 1, 
              lineColor: '#254BE3' 
            }],
            margin: [0, 0, 0, 12]
          },
          {
            stack: [
              { text: '08026978666', fontSize: 12, bold: true, alignment: 'center' },
              { text: '09026557129', fontSize: 12, bold: true, alignment: 'center' },
              { text: 'glitworkspaces@gmail.com', fontSize: 12, bold: true, alignment: 'center', margin: [0, 0, 0, 12] },
              { text: 'Thank you for choosing Glit Publishers. This quotation is valid for 30 days.', fontSize: 10, italics: true, alignment: 'center', color: '#666666' }
            ]
          }
        ],
        styles: {
          sectionHeader: {
            fontSize: 14,
            bold: true,
            color: '#2d3748',
            margin: [0, 0, 0, 5]
          },
          totalLabel: {
            fontSize: 12,
            bold: true
          }
        },
        defaultStyle: {
          fontSize: 10,
          color: '#4a5568'
        }
      };

      // Create and get PDF as blob
      const pdfDoc = pdfMake.createPdf(docDefinition);
      
      await new Promise<void>((resolve, reject) => {
        pdfDoc.getBlob((blob) => {
          try {
            // Download the PDF
            const url = URL.createObjectURL(blob);
            const link = document.createElement('a');
            link.href = url;
            link.download = fileName;
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            URL.revokeObjectURL(url);
            resolve();
          } catch (error) {
            reject(error);
          }
        }, (error) => {
          reject(error);
        });
      });

      // Show success message
      toast({
        title: "Success!",
        description: "PDF Quote generated successfully!",
        variant: "default",
        className: "bg-primary text-primary-foreground border-0",
      });
    } catch (error) {
      console.error('Error generating PDF:', error);
      toast({
        title: "Error",
        description: "Failed to generate PDF. Please try again.",
        variant: "destructive",
      });
    }
  };

  const addOtherService = () => {
    if (newOther.description && newOther.cost > 0) {
      setQuote({ ...quote, others: [...quote.others, newOther] });
      setNewOther({ description: '', cost: 0 });
    }
  };

  const removeOtherService = (index: number) => {
    const updatedOthers = quote.others.filter((_, i) => i !== index);
    setQuote({ ...quote, others: updatedOthers });
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 p-4">
      <div className="mx-auto max-w-6xl space-y-8">
        {/* Header */}
        <div className="text-center">
          <h1 className="text-4xl font-bold text-gray-900 mb-2">Glit Quote Calculator</h1>
          <p className="text-gray-600">Professional Printing Cost Estimation</p>
          <div className="flex justify-center mt-4">
            <Link 
              to="/admin" 
              className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
            >
              <Shield className="w-4 h-4" />
              Admin Dashboard
            </Link>
          </div>
        </div>

        <div className="grid lg:grid-cols-3 gap-8">
          {/* Quote Form */}
          <div className="lg:col-span-2 space-y-6">
            {/* Customer Information */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <User className="w-5 h-5" />
                  Customer Information
                </CardTitle>
              </CardHeader>
              <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="customerName">Customer Name</Label>
                  <Input
                    id="customerName"
                    value={quote.customerName || ''}
                    onChange={(e) => setQuote({ ...quote, customerName: e.target.value })}
                    placeholder="Enter customer name"
                  />
                </div>
                <div>
                  <Label htmlFor="customerEmail">Email</Label>
                  <Input
                    id="customerEmail"
                    type="email"
                    value={quote.customerEmail || ''}
                    onChange={(e) => setQuote({ ...quote, customerEmail: e.target.value })}
                    placeholder="Enter customer email"
                  />
                </div>
                <div className="md:col-span-2">
                  <Label htmlFor="customerPhone">Phone Number</Label>
                  <Input
                    id="customerPhone"
                    value={quote.customerPhone || ''}
                    onChange={(e) => setQuote({ ...quote, customerPhone: e.target.value })}
                    placeholder="Enter customer phone"
                  />
                </div>
              </CardContent>
            </Card>

            {/* Staff Information */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <UserCircle className="w-5 h-5" />
                  Staff Information
                </CardTitle>
              </CardHeader>
              <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="staffName">Staff Name</Label>
                  <Input
                    id="staffName"
                    value={quote.staffName || ''}
                    onChange={(e) => setQuote({ ...quote, staffName: e.target.value })}
                    placeholder="Enter staff name"
                  />
                </div>
                <div>
                  <Label htmlFor="staffId">Staff ID</Label>
                  <Input
                    id="staffId"
                    value={quote.staffId || ''}
                    onChange={(e) => setQuote({ ...quote, staffId: e.target.value })}
                    placeholder="Enter staff ID"
                  />
                </div>
              </CardContent>
            </Card>

            {/* Book Specifications */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <BookOpen className="w-5 h-5" />
                  Book Specifications
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="bookSize" className="flex items-center gap-2">
                      <Maximize className="w-4 h-4" />
                      Book Size
                    </Label>
                    <Select value={quote.bookSize} onValueChange={(value) => setQuote({ ...quote, bookSize: value })}>
                      <SelectTrigger>
                        <SelectValue placeholder="Select size" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="A6">A6</SelectItem>
                        <SelectItem value="A5">A5</SelectItem>
                        <SelectItem value="6x9">6x9</SelectItem>
                        <SelectItem value="7x10">7x10</SelectItem>
                        <SelectItem value="A4">A4</SelectItem>
                        <SelectItem value="A3">A3</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div>
                    <Label htmlFor="coverType" className="flex items-center gap-2">
                      <Layers className="w-4 h-4" />
                      Cover Type
                    </Label>
                    <Select value={quote.coverType} onValueChange={(value) => setQuote({ ...quote, coverType: value })}>
                      <SelectTrigger>
                        <SelectValue placeholder="Select cover" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="Soft Cover">Soft Cover</SelectItem>
                        <SelectItem value="Hard Cover (Casebound)">Hard Cover (Casebound)</SelectItem>
                        <SelectItem value="Folded Cover (300gsm)">Folded Cover (300gsm)</SelectItem>
                        <SelectItem value="Casebound with Folded Gloss Cover">Casebound with Folded Gloss Cover</SelectItem>
                        <SelectItem value="Special Finishing (Hard/Folded)">Special Finishing (Hard/Folded)</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div>
                    <Label htmlFor="pageCount" className="flex items-center gap-2">
                      <FileText className="w-4 h-4" />
                      Page Count
                    </Label>
                    <Input
                      id="pageCount"
                      type="number"
                      value={quote.pageCount || ''}
                      onChange={(e) => setQuote({ ...quote, pageCount: parseInt(e.target.value) || 0 })}
                      placeholder="Enter page count"
                    />
                  </div>

                  <div>
                    <Label htmlFor="copies" className="flex items-center gap-2">
                      <Copy className="w-4 h-4" />
                      Copies
                    </Label>
                    <Input
                      id="copies"
                      type="number"
                      value={quote.copies || ''}
                      onChange={(e) => setQuote({ ...quote, copies: parseInt(e.target.value) || 0 })}
                      placeholder="Enter copies"
                    />
                  </div>
                </div>

                <div className="bg-blue-50 p-4 rounded-lg">
                  <div className="flex items-center justify-between">
                    <span className="font-medium text-blue-900">Total Pages to Print:</span>
                    <span className="text-xl font-bold text-blue-700">
                      {(quote.pageCount * quote.copies).toLocaleString()}
                    </span>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Paper & Interior */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <FileStack className="w-5 h-5" />
                  Paper & Interior
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="paperType">Paper Type</Label>
                    <Select value={quote.paperType} onValueChange={(value) => setQuote({ ...quote, paperType: value })}>
                      <SelectTrigger>
                        <SelectValue placeholder="Select paper type" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="Cream 100gsm">Cream 100gsm</SelectItem>
                        <SelectItem value="Cream 80gsm">Cream 80gsm</SelectItem>
                        <SelectItem value="Cream 70gsm">Cream 70gsm</SelectItem>
                        <SelectItem value="White 80gsm">White 80gsm</SelectItem>
                        <SelectItem value="White 70gsm">White 70gsm</SelectItem>
                        <SelectItem value="Gloss 135gsm">Gloss 135gsm</SelectItem>
                        <SelectItem value="Gloss 115gsm">Gloss 115gsm</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div>
                    <Label htmlFor="interiorType" className="flex items-center gap-2">
                      <Palette className="w-4 h-4" />
                      Interior Type
                    </Label>
                    <Select value={quote.interiorType} onValueChange={(value) => setQuote({ ...quote, interiorType: value })}>
                      <SelectTrigger>
                        <SelectValue placeholder="Select interior" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="B/W">B/W</SelectItem>
                        <SelectItem value="Colour">Colour</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="bg-gray-50 p-4 rounded-lg">
                  <div className="flex items-center justify-between">
                    <span className="font-medium">Finishing Cost (auto-calculated):</span>
                    <span className="font-bold">{formatCurrency(calculations.finishingCost * quote.copies)}</span>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Additional Services */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Settings className="w-5 h-5" />
                  Additional Services
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="flex items-center space-x-2">
                    <Switch
                      id="includeDesign"
                      checked={quote.includeDesign}
                      onCheckedChange={(checked) => setQuote({ ...quote, includeDesign: checked })}
                    />
                    <Label htmlFor="includeDesign" className="flex items-center gap-2">
                      <PenTool className="w-4 h-4" />
                      Include Design
                    </Label>
                  </div>

                  <div className="flex items-center space-x-2">
                    <Switch
                      id="includeISBN"
                      checked={quote.includeISBN}
                      onCheckedChange={(checked) => setQuote({ ...quote, includeISBN: checked })}
                    />
                    <Label htmlFor="includeISBN" className="flex items-center gap-2">
                      <Book className="w-4 h-4" />
                      Include ISBN
                    </Label>
                  </div>

                  <div className="flex items-center space-x-2">
                    <Switch
                      id="includeBHR"
                      checked={quote.includeBHR}
                      onCheckedChange={(checked) => setQuote({ ...quote, includeBHR: checked })}
                    />
                    <Label htmlFor="includeBHR" className="flex items-center gap-2">
                      <Cpu className="w-4 h-4" />
                      Apply BHR
                    </Label>
                  </div>

                  <div className="flex items-center space-x-2">
                    <Switch
                      id="applyBulkDiscount"
                      checked={quote.applyBulkDiscount}
                      onCheckedChange={(checked) => setQuote({ ...quote, applyBulkDiscount: checked })}
                    />
                    <Label htmlFor="applyBulkDiscount" className="flex items-center gap-2">
                      <Percent className="w-4 h-4" />
                      Apply Bulk Discount
                    </Label>
                  </div>
                </div>

                <Separator />
                
                {/* Others Section */}
                <div>
                  <Label className="flex items-center gap-2 mb-3">
                    <PlusCircle className="w-4 h-4" />
                    Others (Custom Services)
                  </Label>
                  
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
                    <div className="md:col-span-2">
                      <Input
                        placeholder="Service description"
                        value={newOther.description}
                        onChange={(e) => setNewOther({ ...newOther, description: e.target.value })}
                      />
                    </div>
                    <div className="flex gap-2">
                      <Input
                        type="number"
                        placeholder="Cost"
                        value={newOther.cost || ''}
                        onChange={(e) => setNewOther({ ...newOther, cost: parseInt(e.target.value) || 0 })}
                      />
                      <Button onClick={addOtherService} size="sm">
                        <Plus className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>

                  {quote.others.length > 0 && (
                    <div className="space-y-2">
                      {quote.others.map((other, index) => (
                        <div key={index} className="flex items-center justify-between bg-gray-50 p-3 rounded-lg">
                          <span>{other.description}</span>
                          <div className="flex items-center gap-2">
                            <span className="font-medium">{formatCurrency(other.cost)}</span>
                            <Button variant="ghost" size="sm" onClick={() => removeOtherService(index)}>
                              <Trash2 className="w-4 h-4" />
                            </Button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Quote Summary */}
          <div className="space-y-6">
            <Card className="sticky top-4">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Calculator className="w-5 h-5" />
                  Quote Breakdown
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="bg-yellow-50 p-4 rounded-lg border border-yellow-200">
                  <div className="flex items-center justify-between mb-2">
                    <span className="font-medium text-yellow-800">Raw Cost:</span>
                    <span className="font-bold text-yellow-900">{formatCurrency(calculations.rawCost)}</span>
                  </div>
                  <div className="space-y-2">
                    <div className="flex items-center gap-2">
                      <Label htmlFor="profitMargin" className="text-sm">Profit Margin (%):</Label>
                      <Input
                        id="profitMargin"
                        type="number"
                        value={quote.profitMargin}
                        onChange={(e) => setQuote({ ...quote, profitMargin: parseInt(e.target.value) || 0 })}
                        className="w-20 h-8"
                      />
                    </div>
                    <div className="flex items-center justify-between text-sm">
                      <span>Profit Amount:</span>
                      <span className="text-right">{formatCurrency((calculations.rawCost * quote.profitMargin) / 100)}</span>
                    </div>
                  </div>
                </div>

                <Separator />

                <div className="space-y-2">
                  {quote.includeDesign && (
                    <div className="flex items-center justify-between text-sm">
                      <span>Design:</span>
                      <span className="text-right">{formatCurrency(calculations.designCost)}</span>
                    </div>
                  )}
                  {quote.includeISBN && (
                    <div className="flex items-center justify-between text-sm">
                      <span>ISBN:</span>
                      <span className="text-right">{formatCurrency(calculations.isbnCost)}</span>
                    </div>
                  )}
                  {quote.includeBHR && (
                    <div className="flex items-center justify-between text-sm">
                      <span>BHR:</span>
                      <span className="text-right">{formatCurrency(calculations.bhrCost)}</span>
                    </div>
                  )}
                  {quote.others.map((other, index) => (
                    <div key={index} className="flex items-center justify-between text-sm">
                      <span>{other.description}:</span>
                      <span className="text-right">{formatCurrency(other.cost)}</span>
                    </div>
                  ))}
                </div>

                {bulkDiscount.apply && (
                  <>
                    <Separator />
                    <div className="flex items-center justify-between text-sm text-green-600">
                      <span>Bulk Discount:</span>
                      <span className="text-right">-{formatCurrency(bulkDiscount.amount)}</span>
                    </div>
                  </>
                )}

                <Separator />

                <div className="bg-blue-50 p-4 rounded-lg border border-blue-200">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-blue-900 flex items-center gap-2">
                      <Receipt className="w-4 h-4" />
                      Final Quotation:
                    </span>
                    <span className="text-xl font-bold text-blue-700">
                      {formatCurrency(calculations.finalQuotation - (bulkDiscount.apply ? bulkDiscount.amount : 0))}
                    </span>
                  </div>
                </div>

                <Button 
                  onClick={generatePDF} 
                  size="lg" 
                  className="w-full"
                  disabled={!quote.bookSize || !quote.paperType || !quote.interiorType || !quote.coverType}
                >
                  <Download className="w-4 h-4 mr-2" />
                  Generate PDF Quote
                </Button>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
      <Toaster />
    </div>
  );
};
