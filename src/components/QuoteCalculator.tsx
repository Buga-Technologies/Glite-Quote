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
  User, UserCircle2, Shield, Users, Phone, Mail,
  Bookmark, Printer, Palette as PaletteIcon
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
  is_default?: boolean;
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
  applyBulkDiscount: number;
  profitMargin: number;
  others: OtherService[];
  customerName?: string;
  customerEmail?: string;
  customerPhone?: string;
  staffName?: string;
  staffId?: string;
  bhrHours?: number;
  finishingCostOverride?: number;
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
  rawCost: number;
  profitAmount: number;
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

  // Quote state - no default values for page count, copies and profit margin
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
    applyBulkDiscount: 0,
    profitMargin: 0,
    others: [],
    customerName: '',
    customerEmail: '',
    customerPhone: '',
    staffName: '',
    staffId: '',
    bhrHours: 0
  });

  // State for profit margin two-way binding and empty field inputs
  const [profitMarginPercent, setProfitMarginPercent] = useState<string>('');
  const [profitMarginNGN, setProfitMarginNGN] = useState<string>('');
  const [copiesValue, setCopiesValue] = useState<string>('');
  const [pageCountValue, setPageCountValue] = useState<string>('');
  const [bulkDiscountEnabled, setBulkDiscountEnabled] = useState<boolean>(false);
  const [bulkDiscountValue, setBulkDiscountValue] = useState<string>('');

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
      const [paperRes, tonerRes, coverRes, finishingRes, packagingRes, bhrRes, additionalRes] = await Promise.all([
        supabase.from('paper_costs').select('*'),
        supabase.from('toner_costs').select('*'),
        supabase.from('cover_costs').select('*'),
        supabase.from('finishing_costs').select('*'),
        supabase.from('packaging_costs').select('*'),
        supabase.from('bhr_config').select('*'),
        supabase.from('additional_services').select('*')
      ]);

      if (paperRes.data) setPaperCosts(paperRes.data);
      if (tonerRes.data) setTonerCosts(tonerRes.data.map((t: any) => ({ id: t.id, color_type: t.type, size: t.size, cost_per_page: t.cost_per_page })));
      if (coverRes.data) setCoverCosts(coverRes.data);
      if (finishingRes.data) setFinishingCosts(finishingRes.data);
      if (packagingRes.data) setPackagingCosts(packagingRes.data);
      if (bhrRes.data) setBhrSettings(bhrRes.data.map((b: any) => ({ id: b.id, rate_per_hour: Number(b.rate_per_hour) })));
      if (additionalRes.data) setAdditionalServices(additionalRes.data);
    } catch (error) {
      console.error('Error loading costs:', error);
      toast({
        title: "Error",
        description: "Failed to load pricing data",
        variant: "destructive",
      });
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

    const bhrCost = quote.includeBHR && quote.bhrHours ? quote.bhrHours : 0;

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

    const rawCost = totalPaperCost + totalTonerCost + totalCoverCost + totalFinishingCost + totalPackagingCost + designCost + isbnCost + bhrCost + othersCost;
    const profitAmount = (rawCost * quote.profitMargin) / 100;
    const finalQuotation = rawCost + profitAmount - quote.applyBulkDiscount;

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
      rawCost,
      profitAmount,
      finalQuotation
    };
  }, [quote, paperCosts, tonerCosts, coverCosts, finishingCosts, packagingCosts, bhrSettings, additionalServices]);

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-NG', {
      style: 'currency',
      currency: 'NGN',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0
    }).format(amount);
  };

  // Handle profit margin percentage change
  const handleProfitMarginPercentChange = (value: string) => {
    setProfitMarginPercent(value);
    const numericValue = parseFloat(value) || 0;
    setQuote(prev => ({...prev, profitMargin: numericValue}));
    
    // Auto-calculate NGN amount
    if (calculations.rawCost > 0) {
      const ngnAmount = (calculations.rawCost * numericValue) / 100;
      setProfitMarginNGN(ngnAmount.toString());
    }
  };

  // Handle profit margin NGN amount change
  const handleProfitMarginNGNChange = (value: string) => {
    setProfitMarginNGN(value);
    const numericValue = parseFloat(value) || 0;
    
    // Auto-calculate percentage
    if (calculations.rawCost > 0) {
      const percentage = (numericValue / calculations.rawCost) * 100;
      setProfitMarginPercent(percentage.toFixed(2));
      setQuote(prev => ({...prev, profitMargin: percentage}));
    }
  };

  // Handle copies change
  const handleCopiesChange = (value: string) => {
    setCopiesValue(value);
    const numericValue = parseInt(value) || 0;
    setQuote(prev => ({...prev, copies: numericValue}));
  };

  // Handle page count change
  const handlePageCountChange = (value: string) => {
    setPageCountValue(value);
    const numericValue = parseInt(value) || 0;
    setQuote(prev => ({...prev, pageCount: numericValue}));
  };

  // Handle bulk discount change
  const handleBulkDiscountChange = (value: string) => {
    setBulkDiscountValue(value);
    const numericValue = parseFloat(value) || 0;
    setQuote(prev => ({...prev, applyBulkDiscount: numericValue}));
  };

  // Handle bulk discount toggle
  const handleBulkDiscountToggle = (checked: boolean) => {
    setBulkDiscountEnabled(checked);
    if (!checked) {
      setBulkDiscountValue('');
      setQuote(prev => ({...prev, applyBulkDiscount: 0}));
    }
  };

  const addOtherService = () => {
    if (newOther.description && newOther.cost > 0) {
      setQuote(prev => ({
        ...prev,
        others: [...prev.others, newOther]
      }));
      setNewOther({ description: '', cost: 0 });
    }
  };

  const removeOtherService = (index: number) => {
    setQuote(prev => ({
      ...prev,
      others: prev.others.filter((_, i) => i !== index)
    }));
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

      // Calculate additional services total (excluding BHR for display)
      const additionalServicesTotal = calculations.designCost + calculations.isbnCost + calculations.othersCost;
      
      // Calculate printing cost total
      const printingCostTotal = calculations.paperCost + calculations.tonerCost + calculations.coverCost + calculations.finishingCost + calculations.packagingCost;

      // Document definition
      const docDefinition: any = {
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
                    ...(quote.customerName ? [{ text: `Name: ${quote.customerName}`, fontSize: 10, margin: [0, 2, 0, 0] }] : []),
                    ...(quote.customerPhone ? [{ text: `Phone: ${quote.customerPhone}`, fontSize: 10, margin: [0, 2, 0, 0] }] : []),
                    ...(quote.customerEmail ? [{ text: `Email: ${quote.customerEmail}`, fontSize: 10, margin: [0, 2, 0, 0] }] : [])
                  ] : []),
                  
                  // Staff Information
                  ...(quote.staffName || quote.staffId ? [
                    { text: 'Prepared By', style: 'sectionHeader', margin: [0, 10, 0, 8] },
                    ...(quote.staffName ? [{ text: `Staff Name: ${quote.staffName}`, fontSize: 10, margin: [0, 2, 0, 0] }] : []),
                    ...(quote.staffId ? [{ text: `Staff ID: ${quote.staffId}`, fontSize: 10, margin: [0, 2, 0, 0] }] : [])
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
                layout: {
                  hLineWidth: () => 0.5,
                  vLineWidth: () => 0.5,
                  hLineColor: () => '#E2E8F0',
                  vLineColor: () => '#E2E8F0'
                },
                table: {
                  widths: ['*', 'auto'],
                  body: [
                    [{
                      text: 'Printing Cost Total',
                      style: 'totalLabel',
                      fillColor: '#254BE3',
                      color: 'white',
                      bold: true,
                      margin: [12, 8, 12, 8]
                    }, {
                      text: formatCurrency(printingCostTotal),
                      style: 'totalLabel',
                      fillColor: '#254BE3',
                      color: 'white',
                      bold: true,
                      alignment: 'right',
                      margin: [12, 8, 12, 8]
                    }]
                  ]
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
                layout: {
                  hLineWidth: () => 0.5,
                  vLineWidth: () => 0.5,
                  hLineColor: () => '#E2E8F0',
                  vLineColor: () => '#E2E8F0'
                },
                table: {
                  widths: ['*', 'auto'],
                  body: [
                    [{
                      text: 'Additional Services Total',
                      style: 'totalLabel',
                      fillColor: '#254BE3',
                      color: 'white',
                      bold: true,
                      margin: [12, 8, 12, 8]
                    }, {
                      text: formatCurrency(additionalServicesTotal),
                      style: 'totalLabel',
                      fillColor: '#254BE3',
                      color: 'white',
                      bold: true,
                      alignment: 'right',
                      margin: [12, 8, 12, 8]
                    }]
                  ]
                },
                margin: [0, 10, 0, 0]
              }
            ],
            margin: [0, 0, 0, 20]
          }] : []),

          // Bulk Discount (only show if applied)
          ...(quote.applyBulkDiscount > 0 ? [{
            layout: {
              hLineWidth: () => 0.5,
              vLineWidth: () => 0.5,
              hLineColor: () => '#E2E8F0',
              vLineColor: () => '#E2E8F0'
            },
            table: {
              widths: ['*', 'auto'],
              body: [
                ['Bulk Discount', `-${formatCurrency(quote.applyBulkDiscount)}`]
              ]
            },
            margin: [0, 0, 0, 10]
          }] : []),

          // Final Quotation
          {
            layout: 'noBorders',
            table: {
              widths: ['*'],
              body: [[{
                layout: {
                  hLineWidth: () => 0.5,
                  vLineWidth: () => 0.5,
                  hLineColor: () => '#E2E8F0',
                  vLineColor: () => '#E2E8F0'
                },
                table: {
                  widths: ['*', 'auto'],
                  body: [
                    [{
                      text: 'Final Quotation',
                      style: 'finalQuotationLabel',
                      fillColor: '#254BE3',
                      color: 'white',
                      bold: true,
                      fontSize: 16,
                      margin: [12, 8, 12, 8]
                    }, {
                      text: formatCurrency(calculations.finalQuotation),
                      style: 'finalQuotationAmount',
                      fillColor: '#254BE3',
                      color: 'white',
                      bold: true,
                      fontSize: 16,
                      alignment: 'right',
                      margin: [12, 8, 12, 8]
                    }]
                  ]
                }
              }]]
            },
            margin: [0, 20, 0, 20]
          },

          // Contact Details (immediately below Final Quotation)
          {
            stack: [
              { text: '08026978666', fontSize: 12, bold: true, alignment: 'center' },
              { text: '09026557129', fontSize: 12, bold: true, alignment: 'center' },
              { text: 'glitworkspaces@gmail.com', fontSize: 12, bold: true, alignment: 'center', margin: [0, 0, 0, 12] }
            ],
            margin: [0, 10, 0, 20]
          },

          // Footer with line separator
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
            text: 'Thank you for choosing Glit Publishers. This quotation is valid for 30 days.',
            fontSize: 10,
            italics: true,
            alignment: 'center'
          }
        ],
        styles: {
          header: {
            fontSize: 24,
            bold: true,
            color: 'white'
          },
          sectionHeader: {
            fontSize: 14,
            bold: true,
            color: '#254BE3',
            margin: [0, 10, 0, 5]
          },
          totalLabel: {
            fontSize: 12,
            bold: true
          }
        }
      };

      // Generate and download PDF
      pdfMake.createPdf(docDefinition).download(fileName);

      toast({
        title: "Success",
        description: "Quote PDF generated successfully!",
      });

    } catch (error) {
      console.error('PDF generation error:', error);
      toast({
        title: "Error",
        description: "Failed to generate PDF. Please try again.",
        variant: "destructive",
      });
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-royal-blue-light via-background to-royal-blue-light/50">
      <div className="container mx-auto px-4 py-8">
        {/* Header with Admin Icon */}
        <div className="mb-8">
          <div className="flex items-center justify-between mb-4">
            <div></div>
            {/* Admin icon at top right */}
            <Link to="/admin">
              <Button variant="outline" className="border-royal-blue text-royal-blue hover:bg-royal-blue-light">
                <Settings className="w-4 h-4 mr-2" />
                Admin Dashboard
              </Button>
            </Link>
          </div>
          
          <div className="text-center">
            <div className="inline-flex items-center justify-center w-16 h-16 bg-gradient-to-br from-royal-blue to-royal-blue-dark rounded-full mb-4 shadow-lg">
              <Calculator className="w-8 h-8 text-white" />
            </div>
            <h1 className="text-4xl font-bold bg-gradient-to-r from-royal-blue to-royal-blue-dark bg-clip-text text-transparent mb-2">
              Glit Quote Staff Console
            </h1>
            <p className="text-muted-foreground">Professional printing quotation system</p>
          </div>
        </div>

        {/* Two-column layout */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* Left Column - Form */}
          <div className="space-y-6">
            
            {/* Customer Information */}
            <Card className="border-royal-blue/20 shadow-lg">
              <CardHeader className="bg-gradient-to-r from-royal-blue to-royal-blue-dark text-white rounded-t-lg">
                <CardTitle className="flex items-center gap-2 p-2">
                  <User className="w-5 h-5" />
                  Customer Information
                </CardTitle>
              </CardHeader>
              <CardContent className="p-6 space-y-4">
                <div className="grid grid-cols-1 gap-4">
                  <div>
                    <Label htmlFor="customerName" className="flex items-center gap-2 mb-3">
                      <User className="w-4 h-4" />
                      Customer Name
                    </Label>
                    <Input
                      id="customerName"
                      value={quote.customerName}
                      onChange={(e) => setQuote(prev => ({...prev, customerName: e.target.value}))}
                      placeholder="Enter customer name"
                    />
                  </div>
                  <div>
                    <Label htmlFor="customerPhone" className="flex items-center gap-2 mb-3">
                      <Phone className="w-4 h-4" />
                      Customer Phone
                    </Label>
                    <Input
                      id="customerPhone"
                      value={quote.customerPhone}
                      onChange={(e) => setQuote(prev => ({...prev, customerPhone: e.target.value}))}
                      placeholder="Enter phone number"
                    />
                  </div>
                  <div>
                    <Label htmlFor="customerEmail" className="flex items-center gap-2 mb-3">
                      <Mail className="w-4 h-4" />
                      Customer Email
                    </Label>
                    <Input
                      id="customerEmail"
                      type="email"
                      value={quote.customerEmail}
                      onChange={(e) => setQuote(prev => ({...prev, customerEmail: e.target.value}))}
                      placeholder="Enter email address"
                    />
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Staff Information */}
            <Card className="border-royal-blue/20 shadow-lg">
              <CardHeader className="bg-gradient-to-r from-royal-blue to-royal-blue-dark text-white rounded-t-lg">
                <CardTitle className="flex items-center gap-2 p-2">
                  <Users className="w-5 h-5" />
                  Staff Information
                </CardTitle>
              </CardHeader>
              <CardContent className="p-6 space-y-4">
                <div className="grid grid-cols-1 gap-4">
                  <div>
                    <Label htmlFor="staffName" className="flex items-center gap-2 mb-3">
                      <UserCircle2 className="w-4 h-4" />
                      Prepared By (Staff Name)
                    </Label>
                    <Input
                      id="staffName"
                      value={quote.staffName}
                      onChange={(e) => setQuote(prev => ({...prev, staffName: e.target.value}))}
                      placeholder="Enter staff name"
                    />
                  </div>
                  <div>
                    <Label htmlFor="staffId" className="flex items-center gap-2 mb-3">
                      <Shield className="w-4 h-4" />
                      Staff ID
                    </Label>
                    <Input
                      id="staffId"
                      value={quote.staffId}
                      onChange={(e) => setQuote(prev => ({...prev, staffId: e.target.value}))}
                      placeholder="Enter staff ID"
                    />
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Book Specifications */}
            <Card className="border-royal-blue/20 shadow-lg">
              <CardHeader className="bg-gradient-to-r from-royal-blue to-royal-blue-dark text-white rounded-t-lg">
                <CardTitle className="flex items-center gap-2 p-2">
                  <BookOpen className="w-5 h-5" />
                  Book Specifications
                </CardTitle>
              </CardHeader>
              <CardContent className="p-6 space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="bookSize" className="flex items-center gap-2 mb-3">
                      <Maximize className="w-4 h-4" />
                      Book Size
                    </Label>
                    <Select value={quote.bookSize} onValueChange={(value) => setQuote(prev => ({...prev, bookSize: value}))}>
                      <SelectTrigger>
                        <SelectValue placeholder="Select book size" />
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
                    <Label htmlFor="coverType" className="flex items-center gap-2 mb-3">
                      <Book className="w-4 h-4" />
                      Cover Type
                    </Label>
                    <Select value={quote.coverType} onValueChange={(value) => setQuote(prev => ({...prev, coverType: value}))}>
                      <SelectTrigger>
                        <SelectValue placeholder="Select cover type" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="Soft">Soft</SelectItem>
                        <SelectItem value="Hard">Hard</SelectItem>
                        <SelectItem value="Folded">Folded</SelectItem>
                        <SelectItem value="Hard+Folded">Hard+Folded</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label htmlFor="pageCount" className="flex items-center gap-2 mb-3">
                      <FileText className="w-4 h-4" />
                      Page Count
                    </Label>
                    <Input
                      id="pageCount"
                      type="number"
                      value={pageCountValue}
                      onChange={(e) => handlePageCountChange(e.target.value)}
                      placeholder="Enter page count"
                    />
                  </div>
                  <div>
                    <Label htmlFor="copies" className="flex items-center gap-2 mb-3">
                      <Copy className="w-4 h-4" />
                      Copies
                    </Label>
                    <Input
                      id="copies"
                      type="number"
                      value={copiesValue}
                      onChange={(e) => handleCopiesChange(e.target.value)}
                      placeholder="Enter number of copies"
                    />
                  </div>
                </div>
                <div className="bg-royal-blue-light p-4 rounded-lg border border-royal-blue/20">
                  <div className="flex items-center gap-2 text-royal-blue font-semibold">
                    <FileStack className="w-4 h-4" />
                    Total Pages to Print: <span className="font-bold">{(quote.pageCount * quote.copies).toLocaleString()}</span>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Paper & Interior */}
            <Card className="border-royal-blue/20 shadow-lg">
              <CardHeader className="bg-gradient-to-r from-royal-blue to-royal-blue-dark text-white rounded-t-lg">
                <CardTitle className="flex items-center gap-2 p-2">
                  <Printer className="w-5 h-5" />
                  Paper & Interior
                </CardTitle>
              </CardHeader>
              <CardContent className="p-6 space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="paperType" className="flex items-center gap-2 mb-3">
                      <Layers className="w-4 h-4" />
                      Paper Type
                    </Label>
                    <Select value={quote.paperType} onValueChange={(value) => setQuote(prev => ({...prev, paperType: value}))}>
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
                    <Label htmlFor="interiorType" className="flex items-center gap-2 mb-3">
                      <PaletteIcon className="w-4 h-4" />
                      Interior Type
                    </Label>
                    <Select value={quote.interiorType} onValueChange={(value) => setQuote(prev => ({...prev, interiorType: value}))}>
                      <SelectTrigger>
                        <SelectValue placeholder="Select interior type" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="B/W">B/W</SelectItem>
                        <SelectItem value="Colour">Colour</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="md:col-span-2">
                    <div className="bg-royal-blue-light p-4 rounded-lg border border-royal-blue/20">
                      <div className="flex items-center gap-2 text-royal-blue font-semibold">
                        <Settings className="w-4 h-4" />
                        Finishing Cost: <span className="font-bold">{formatCurrency(calculations.finishingCost)}</span>
                        <span className="text-sm text-muted-foreground ml-2">(Auto-calculated)</span>
                      </div>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Additional Services */}
            <Card className="border-royal-blue/20 shadow-lg">
              <CardHeader className="bg-gradient-to-r from-royal-blue to-royal-blue-dark text-white rounded-t-lg">
                <CardTitle className="flex items-center gap-2 p-2">
                  <PlusCircle className="w-5 h-5" />
                  Additional Services
                </CardTitle>
              </CardHeader>
              <CardContent className="p-6 space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="flex items-center space-x-2">
                    <Switch
                      id="includeDesign"
                      checked={quote.includeDesign}
                      onCheckedChange={(checked) => setQuote(prev => ({...prev, includeDesign: checked}))}
                    />
                    <Label htmlFor="includeDesign" className="flex items-center gap-2">
                      <PenTool className="w-4 h-4" />
                      Include Design (NGN 10,000)
                    </Label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <Switch
                      id="includeISBN"
                      checked={quote.includeISBN}
                      onCheckedChange={(checked) => setQuote(prev => ({...prev, includeISBN: checked}))}
                    />
                    <Label htmlFor="includeISBN" className="flex items-center gap-2">
                      <Bookmark className="w-4 h-4" />
                      Include ISBN (NGN 8,000)
                    </Label>
                  </div>
                </div>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="flex items-center space-x-2">
                    <Switch
                      id="includeBHR"
                      checked={quote.includeBHR}
                      onCheckedChange={(checked) => setQuote(prev => ({...prev, includeBHR: checked}))}
                    />
                    <Label htmlFor="includeBHR" className="flex items-center gap-2">
                      <Cpu className="w-4 h-4" />
                      Apply BHR
                    </Label>
                  </div>
                  {quote.includeBHR && (
                    <div>
                      <Label htmlFor="bhrAmount" className="flex items-center gap-2 mb-3">
                        <Cpu className="w-4 h-4" />
                        BHR Amount (NGN)
                      </Label>
                      <Input
                        id="bhrAmount"
                        type="number"
                        value={quote.bhrHours || ''}
                        onChange={(e) => setQuote(prev => ({...prev, bhrHours: parseFloat(e.target.value) || 0}))}
                        placeholder="Enter BHR amount"
                      />
                    </div>
                  )}
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="flex items-center space-x-2">
                    <Switch
                      id="bulkDiscountToggle"
                      checked={bulkDiscountEnabled}
                      onCheckedChange={handleBulkDiscountToggle}
                    />
                    <Label htmlFor="bulkDiscountToggle" className="flex items-center gap-2">
                      <Percent className="w-4 h-4" />
                      Apply Bulk Discount
                    </Label>
                  </div>
                  {bulkDiscountEnabled && (
                    <div>
                      <Label htmlFor="bulkDiscount" className="flex items-center gap-2 mb-3">
                        <Percent className="w-4 h-4" />
                        Discount Amount (NGN)
                      </Label>
                      <Input
                        id="bulkDiscount"
                        type="number"
                        value={bulkDiscountValue}
                        onChange={(e) => handleBulkDiscountChange(e.target.value)}
                        placeholder="Enter discount amount"
                      />
                    </div>
                  )}
                </div>


                <Separator />

                <div>
                  <Label className="text-base font-semibold mb-3 flex items-center gap-2">
                    <Plus className="w-4 h-4" />
                    Others
                  </Label>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-2 mt-2">
                    <Input
                      placeholder="Description"
                      value={newOther.description}
                      onChange={(e) => setNewOther(prev => ({...prev, description: e.target.value}))}
                    />
                    <Input
                      type="number"
                      placeholder="Cost (NGN)"
                      value={newOther.cost === 0 ? '' : newOther.cost}
                      onChange={(e) => setNewOther(prev => ({...prev, cost: parseFloat(e.target.value) || 0}))}
                    />
                    <Button onClick={addOtherService} className="bg-royal-blue hover:bg-royal-blue-hover">
                      <Plus className="w-4 h-4 mr-2" />
                      Add
                    </Button>
                  </div>
                  
                  {quote.others.length > 0 && (
                    <div className="mt-4 space-y-2">
                      {quote.others.map((item, index) => (
                        <div key={index} className="flex items-center justify-between bg-muted p-3 rounded-lg">
                          <span>{item.description} - {formatCurrency(item.cost)}</span>
                          <Button
                            size="sm"
                            variant="destructive"
                            onClick={() => removeOtherService(index)}
                          >
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Right Column - Quote Breakdown */}
          <div className="space-y-6">
            <Card className="border-royal-blue/20 shadow-lg">
              <CardHeader className="bg-gradient-to-r from-royal-blue to-royal-blue-dark text-white rounded-t-lg">
                <CardTitle className="flex items-center gap-2 p-2">
                  <Receipt className="w-5 h-5" />
                  Quote Breakdown
                </CardTitle>
              </CardHeader>
              <CardContent className="p-6">
                <div className="space-y-4">
                  {/* Line Items */}
                  <div className="space-y-3">
                    <div className="flex justify-between">
                      <span>Paper Cost:</span>
                      <span className="font-semibold text-right">{formatCurrency(calculations.paperCost)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Toner Cost:</span>
                      <span className="font-semibold text-right">{formatCurrency(calculations.tonerCost)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Cover Cost:</span>
                      <span className="font-semibold text-right">{formatCurrency(calculations.coverCost)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Finishing Cost:</span>
                      <span className="font-semibold text-right">{formatCurrency(calculations.finishingCost)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Packaging Cost:</span>
                      <span className="font-semibold text-right">{formatCurrency(calculations.packagingCost)}</span>
                    </div>
                    {quote.includeDesign && (
                      <div className="flex justify-between">
                        <span>Design:</span>
                        <span className="font-semibold text-right">{formatCurrency(calculations.designCost)}</span>
                      </div>
                    )}
                    {quote.includeISBN && (
                      <div className="flex justify-between">
                        <span>ISBN:</span>
                        <span className="font-semibold text-right">{formatCurrency(calculations.isbnCost)}</span>
                      </div>
                    )}
                    {quote.includeBHR && calculations.bhrCost > 0 && (
                      <div className="flex justify-between">
                        <span>BHR:</span>
                        <span className="font-semibold text-right">{formatCurrency(calculations.bhrCost)}</span>
                      </div>
                    )}
                    {quote.others.map((item, index) => (
                      <div key={index} className="flex justify-between">
                        <span>{item.description}:</span>
                        <span className="font-semibold text-right">{formatCurrency(item.cost)}</span>
                      </div>
                    ))}
                  </div>

                  <Separator />

                   {/* Totals - Staff Console View */}
                   <div className="space-y-3">
                     {/* Profit Margin Controls */}
                     <div className="bg-royal-blue-light p-4 rounded-lg border border-royal-blue/20 space-y-3">
                       <div className="flex items-center gap-2 text-royal-blue font-semibold">
                         <Percent className="w-4 h-4" />
                         Profit Margin
                       </div>
                       <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                         <div>
                           <Label htmlFor="profitMarginPercent">Percentage (%)</Label>
                           <Input
                             id="profitMarginPercent"
                             type="number"
                             step="0.01"
                             value={profitMarginPercent}
                             onChange={(e) => handleProfitMarginPercentChange(e.target.value)}
                             placeholder="Enter profit margin %"
                           />
                         </div>
                         <div>
                           <Label htmlFor="profitMarginNGN">Amount (NGN)</Label>
                           <Input
                             id="profitMarginNGN"
                             type="number"
                             value={profitMarginNGN}
                             onChange={(e) => handleProfitMarginNGNChange(e.target.value)}
                             placeholder="Enter profit amount"
                           />
                         </div>
                       </div>
                     </div>
                     
                     <div className="flex justify-between text-lg">
                       <span className="font-semibold">Raw Cost:</span>
                       <span className="font-bold text-right">{formatCurrency(calculations.rawCost)}</span>
                     </div>
                     <div className="flex justify-between text-lg">
                       <span className="font-semibold">Profit Margin ({quote.profitMargin.toFixed(2)}%):</span>
                       <span className="font-bold text-right">{formatCurrency(calculations.profitAmount)}</span>
                     </div>
                    {quote.applyBulkDiscount > 0 && (
                      <div className="flex justify-between text-lg text-destructive">
                        <span className="font-semibold">Bulk Discount:</span>
                        <span className="font-bold text-right">-{formatCurrency(quote.applyBulkDiscount)}</span>
                      </div>
                    )}
                  </div>

                  <Separator />

                  {/* Final Quotation */}
                  <div className="bg-gradient-to-r from-royal-blue to-royal-blue-dark text-white p-4 rounded-lg">
                    <div className="flex justify-between items-center text-xl">
                      <span className="font-bold">Final Quotation:</span>
                      <span className="font-bold text-right">{formatCurrency(calculations.finalQuotation)}</span>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Action Buttons */}
            <div className="space-y-4">
              <Button 
                onClick={generatePDF} 
                className="w-full bg-royal-blue hover:bg-royal-blue-hover text-white font-semibold py-3 text-lg"
                size="lg"
              >
                <Download className="w-5 h-5 mr-2" />
                Generate PDF Quote
              </Button>
            </div>
          </div>
        </div>
      </div>
      
      <Toaster />
    </div>
  );
};