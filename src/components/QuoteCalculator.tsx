/** @jsxImportSource react */
import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';
import { Toaster } from '@/components/ui/toaster';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Separator } from '@/components/ui/separator';
import { 
  Plus, 
  Trash2, 
  Calculator, 
  Download, 
  BookOpen,
  Maximize,
  Layers,
  FileText,
  Copy,
  FileStack,
  Palette,
  CheckSquare,
  Settings,
  PenTool,
  Book,
  Cpu,
  Percent,
  PlusCircle,
  Receipt,
  Wallet,
  User,
  UserCircle,
  Shield
} from 'lucide-react';
import { Link } from 'react-router-dom';
import pdfMake from 'pdfmake/build/pdfmake';
import pdfFonts from 'pdfmake/build/vfs_fonts';
import { supabase } from '@/integrations/supabase/client';

// Database types
interface PaperCost {
  paper_type: string;
  size: string;
  cost_per_page: number;
}

interface TonerCost {
  color_type: string;
  size: string;
  cost_per_page: number;
}

interface CoverCost {
  cover_type: string;
  size: string;
  cost: number;
}

interface FinishingCost {
  page_range_min: number;
  page_range_max: number | null;
  cost: number;
}

interface PackagingCost {
  size: string;
  cost: number;
}

interface AdditionalService {
  service_name: string;
  cost: number;
}

interface BHRSetting {
  rate_per_hour: number;
}

type BookSize = 'A6' | 'A5' | '6x9' | '7x10' | 'A4' | 'A3';
type PaperType = 'Cream 100gsm' | 'Cream 80gsm' | 'Cream 70gsm' | 'White 80gsm' | 'White 70gsm' | 'Gloss 135gsm' | 'Gloss 115gsm';
type InteriorType = 'B/W' | 'Colour';
type CoverType = 'Soft' | 'Hard' | 'Folded' | 'Hard + Folded';

interface OtherItem {
  id: string;
  description: string;
  cost: number;
}

interface QuoteData {
  bookSize: BookSize | '';
  paperType: PaperType | '';
  interiorType: InteriorType | '';
  pageCount: number;
  copies: number;
  coverType: CoverType | '';
  finishing: number;
  includeDesign: boolean;
  includeISBN: boolean;
  includeBHR: boolean;
  bhrAmount: number;
  others: OtherItem[];
  profitMargin: number;
  customerName: string;
  customerEmail: string;
  customerPhone: string;
  customerCompany: string;
  staffName: string;
  staffId: string;
}

// Cost matrices
const paperCosts: Record<PaperType, Record<BookSize, number>> = {
  'Cream 100gsm': { A6: 1.84375, A5: 3.6875, '6x9': 7.375, '7x10': 7.375, A4: 7.375, A3: 14.75 },
  'Cream 80gsm': { A6: 1.75, A5: 3.5, '6x9': 7, '7x10': 7, A4: 7, A3: 14 },
  'Cream 70gsm': { A6: 1.625, A5: 3.25, '6x9': 6.5, '7x10': 6.5, A4: 6.5, A3: 13 },
  'White 80gsm': { A6: 1.40625, A5: 2.8125, '6x9': 5.625, '7x10': 5.625, A4: 5.625, A3: 11.25 },
  'White 70gsm': { A6: 1.09375, A5: 2.1875, '6x9': 4.375, '7x10': 4.375, A4: 4.375, A3: 8.75 },
  'Gloss 135gsm': { A6: 4.0625, A5: 8.125, '6x9': 16.25, '7x10': 16.25, A4: 16.25, A3: 32.5 },
  'Gloss 115gsm': { A6: 3.75, A5: 7.5, '6x9': 15, '7x10': 15, A4: 15, A3: 30 }
};

const tonerCosts: Record<InteriorType, Record<BookSize, number>> = {
  'B/W': { A6: 0.5, A5: 1, '6x9': 2, '7x10': 2, A4: 2, A3: 4 },
  'Colour': { A6: 2.5, A5: 5, '6x9': 10, '7x10': 10, A4: 10, A3: 20 }
};

const coverCosts: Record<CoverType, Record<BookSize, number>> = {
  'Soft': { A6: 100, A5: 165, '6x9': 310, '7x10': 310, A4: 350, A3: 500 },
  'Hard': { A6: 250, A5: 500, '6x9': 800, '7x10': 800, A4: 1000, A3: 2000 },
  'Folded': { A6: 0, A5: 330, '6x9': 0, '7x10': 0, A4: 0, A3: 0 },
  'Hard + Folded': { A6: 0, A5: 700, '6x9': 0, '7x10': 0, A4: 0, A3: 0 }
};

const packagingCosts: Record<BookSize, number> = {
  A6: 7, A5: 14, '6x9': 15, '7x10': 15, A4: 25, A3: 50
};

const bhrFactors: Record<BookSize, number> = {
  A6: 8, A5: 4, '6x9': 2, '7x10': 2, A4: 2, A3: 1
};

const calculateFinishing = (pageCount: number): number => {
  if (pageCount < 50) return 0;
  if (pageCount <= 140) return 70;
  if (pageCount <= 320) return 120;
  return 300;
};

const calculateBHR = (pageCount: number, bookSize: BookSize, copies: number): number => {
  const factor = bhrFactors[bookSize];
  return (pageCount / factor / 48 * copies) * 3000;
};

export const QuoteCalculator: React.FC = () => {
  const { toast } = useToast();
  
  // Database costs state
  const [paperCosts, setPaperCosts] = useState<PaperCost[]>([]);
  const [tonerCosts, setTonerCosts] = useState<TonerCost[]>([]);
  const [coverCosts, setCoverCosts] = useState<CoverCost[]>([]);
  const [finishingCosts, setFinishingCosts] = useState<FinishingCost[]>([]);
  const [packagingCosts, setPackagingCosts] = useState<PackagingCost[]>([]);
  const [additionalServices, setAdditionalServices] = useState<AdditionalService[]>([]);
  const [bhrSettings, setBhrSettings] = useState<BHRSetting>({ rate_per_hour: 3000 });
  
  // Load all cost data from database
  useEffect(() => {
    const fetchAllCosts = async () => {
      try {
        const [
          paperResult,
          tonerResult,
          coverResult,
          finishingResult,
          packagingResult,
          servicesResult,
          bhrResult
        ] = await Promise.all([
          supabase.from('paper_costs').select('*'),
          supabase.from('toner_costs').select('*'),
          supabase.from('cover_costs').select('*'),
          supabase.from('finishing_costs').select('*').order('page_range_min'),
          supabase.from('packaging_costs').select('*'),
          supabase.from('additional_services').select('*'),
          supabase.from('bhr_settings').select('*').single()
        ]);

        setPaperCosts(paperResult.data || []);
        setTonerCosts(tonerResult.data || []);
        setCoverCosts(coverResult.data || []);
        setFinishingCosts(finishingResult.data || []);
        setPackagingCosts(packagingResult.data || []);
        setAdditionalServices(servicesResult.data || []);
        setBhrSettings(bhrResult.data || { rate_per_hour: 3000 });
      } catch (error) {
        console.error('Error loading cost data:', error);
        // Keep fallback values
        setBhrSettings({ rate_per_hour: 3000 });
      }
    };

    fetchAllCosts();
  }, []);
  
  // Helper functions using database data
  const getPaperCost = (paperType: string, size: string): number => {
    const cost = paperCosts.find(p => p.paper_type === paperType && p.size === size);
    return cost ? cost.cost_per_page : 0;
  };

  const getTonerCost = (colorType: string, size: string): number => {
    const cost = tonerCosts.find(t => t.color_type === colorType && t.size === size);
    return cost ? cost.cost_per_page : 0;
  };

  const getCoverCost = (coverType: string, size: string): number => {
    const cost = coverCosts.find(c => c.cover_type === coverType && c.size === size);
    return cost ? cost.cost : 0;
  };

  const getFinishingCost = (pageCount: number): number => {
    const finishing = finishingCosts.find(f => 
      pageCount >= f.page_range_min && 
      (f.page_range_max === null || pageCount <= f.page_range_max)
    );
    return finishing ? finishing.cost : 0;
  };

  const getPackagingCost = (size: string): number => {
    const cost = packagingCosts.find(p => p.size === size);
    return cost ? cost.cost : 0;
  };

  const getAdditionalServiceCost = (serviceName: string): number => {
    const service = additionalServices.find(s => s.service_name === serviceName);
    return service ? service.cost : 0;
  };

  const calculateBHR = (pageCount: number, bookSize: BookSize, copies: number): number => {
    const factors: Record<BookSize, number> = {
      A6: 8, A5: 4, '6x9': 2, '7x10': 2, A4: 2, A3: 1
    };
    const factor = factors[bookSize];
    return (pageCount / factor / 48 * copies) * bhrSettings.rate_per_hour;
  };
  const [quote, setQuote] = useState<QuoteData>({
    bookSize: '',
    paperType: '',
    interiorType: '',
    pageCount: 0,
    copies: 0,
    coverType: '',
    finishing: 0,
    includeDesign: false,
    includeISBN: false,
    includeBHR: false,
    bhrAmount: 0,
    others: [],
    profitMargin: 0,
    customerName: '',
    customerEmail: '',
    customerPhone: '',
    customerCompany: '',
    staffName: '',
    staffId: ''
  });

  const [bulkDiscount, setBulkDiscount] = useState({
    apply: false,
    amount: 0
  });

  const [calculations, setCalculations] = useState({
    paperCost: 0,
    tonerCost: 0,
    coverCost: 0,
    finishingCost: 0,
    packagingCost: 0,
    bhrCost: 0,
    designCost: 0,
    isbnCost: 0,
    othersCost: 0,
    bookSpecsTotal: 0,
    additionalServicesTotal: 0,
    rawCost: 0,
    finalQuotation: 0
  });

  // Auto-calculate finishing based on page count
  useEffect(() => {
    if (quote.pageCount > 0) {
      const autoFinishing = getFinishingCost(quote.pageCount);
      setQuote(prev => ({ ...prev, finishing: autoFinishing }));
    }
  }, [quote.pageCount, finishingCosts]);

  // Auto-calculate BHR
  useEffect(() => {
    if (quote.includeBHR && quote.pageCount > 0 && quote.bookSize && quote.copies > 0) {
      const autoBHR = calculateBHR(quote.pageCount, quote.bookSize as BookSize, quote.copies);
      setQuote(prev => ({ ...prev, bhrAmount: autoBHR }));
    }
  }, [quote.includeBHR, quote.pageCount, quote.bookSize, quote.copies, bhrSettings]);

  // Calculate all costs
  useEffect(() => {
    if (!quote.bookSize || !quote.paperType || !quote.interiorType) {
      return;
    }

    const paperCost = getPaperCost(quote.paperType, quote.bookSize) * quote.pageCount * quote.copies;
    const tonerCost = getTonerCost(quote.interiorType, quote.bookSize) * quote.pageCount * quote.copies;
    const coverCost = quote.coverType ? getCoverCost(quote.coverType, quote.bookSize) * quote.copies : 0;
    const finishingCost = quote.finishing * quote.copies;
    const packagingCost = getPackagingCost(quote.bookSize) * quote.copies;
    const bhrCost = quote.includeBHR ? quote.bhrAmount : 0;
    const designCost = quote.includeDesign ? getAdditionalServiceCost('Design') : 0;
    const isbnCost = quote.includeISBN ? getAdditionalServiceCost('ISBN') : 0;
    const othersCost = quote.others.reduce((sum, item) => sum + item.cost, 0);

    const bookSpecsTotal = paperCost + tonerCost + coverCost + finishingCost + packagingCost;
    const additionalServicesTotal = designCost + isbnCost + bhrCost + othersCost;
    const rawCost = bookSpecsTotal + additionalServicesTotal;
    const subtotalWithMargin = rawCost * (1 + quote.profitMargin / 100);
    const finalQuotation = subtotalWithMargin - (bulkDiscount.apply ? bulkDiscount.amount : 0);

    setCalculations({
      paperCost,
      tonerCost,
      coverCost,
      finishingCost,
      packagingCost,
      bhrCost,
      designCost,
      isbnCost,
      othersCost,
      bookSpecsTotal,
      additionalServicesTotal,
      rawCost,
      finalQuotation
    });
  }, [quote, bulkDiscount, paperCosts, tonerCosts, coverCosts, packagingCosts, additionalServices]);

  const addOtherItem = () => {
    const newItem: OtherItem = {
      id: Date.now().toString(),
      description: '',
      cost: 0
    };
    setQuote(prev => ({ ...prev, others: [...prev.others, newItem] }));
  };

  const updateOtherItem = (id: string, field: 'description' | 'cost', value: string | number) => {
    setQuote(prev => ({
      ...prev,
      others: prev.others.map(item => 
        item.id === id ? { ...item, [field]: value } : item
      )
    }));
  };

  const removeOtherItem = (id: string) => {
    setQuote(prev => ({
      ...prev,
      others: prev.others.filter(item => item.id !== id)
    }));
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-NG', {
      style: 'currency',
      currency: 'NGN',
      minimumFractionDigits: 2
    }).format(amount);
  };

  const generatePDF = () => {
    try {
      // Validate required fields
      if (!quote.bookSize || !quote.paperType || !quote.interiorType || !quote.coverType) {
        toast({
          title: "Error",
          description: "Please fill in all required fields",
          variant: "destructive",
        });
        return;
      }

      // Register fonts
      pdfMake.vfs = pdfFonts.pdfMake.vfs;

      // Generate quotation details
      const quotationId = `QT-${new Date().getFullYear()}-${String(Date.now()).slice(-3)}`;
      const currentDate = new Date().toLocaleDateString('en-GB');
      
      // Create document definition
      const docDefinition = {
        pageSize: 'A4',
        pageMargins: [25, 25, 25, 25],
        
        styles: {
          header: {
            fontSize: 24,
            bold: true,
            color: 'white',
            alignment: 'center',
            margin: [0, 12, 0, 12],
          },
          sectionHeader: {
            fontSize: 14,
            bold: true,
            margin: [0, 0, 0, 10],
          },
          label: {
            bold: true,
            fontSize: 10,
          },
          value: {
            fontSize: 10,
          },
          amount: {
            fontSize: 10,
            alignment: 'right',
          },
          total: {
            fontSize: 12,
            bold: true,
            alignment: 'right',
          },
          footer: {
            fontSize: 10,
            bold: true,
            alignment: 'center',
          },
          validity: {
            fontSize: 9,
            italics: true,
            alignment: 'center',
            color: '#666666',
          }
        },

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
                padding: [16, 12, 16, 12],
              }]]
            },
            margin: [0, 0, 0, 10]
          },

          // Quote ID and Date
          {
            columns: [
              { text: `Quotation ID: ${quotationId}`, style: 'value' },
              { text: `Date: ${currentDate}`, style: 'value', alignment: 'right' }
            ],
            margin: [0, 0, 0, 20]
          },

          // Customer & Staff Information
          ...(quote.customerName || quote.customerEmail || quote.customerPhone || quote.staffName || quote.staffId ? [{
            layout: 'noBorders',
            table: {
              widths: ['*'],
              body: [[{
                columns: [
                  {
                    width: '*',
                    stack: [
                      { text: 'Customer Information', style: 'sectionHeader' },
                      ...(quote.customerName ? [{ text: `Name: ${quote.customerName}`, style: 'value', margin: [0, 0, 0, 6] }] : []),
                      ...(quote.customerPhone ? [{ text: `Phone: ${quote.customerPhone}`, style: 'value', margin: [0, 0, 0, 6] }] : []),
                      ...(quote.customerEmail ? [{ text: `Email: ${quote.customerEmail}`, style: 'value', margin: [0, 0, 0, 6] }] : [])
                    ]
                  },
                  {
                    width: '*',
                    stack: [
                      { text: 'Prepared By', style: 'sectionHeader' },
                      ...(quote.staffName ? [{ text: `Staff Name: ${quote.staffName}`, style: 'value', margin: [0, 0, 0, 6] }] : []),
                      ...(quote.staffId ? [{ text: `Staff ID: ${quote.staffId}`, style: 'value', margin: [0, 0, 0, 6] }] : [])
                    ]
                  }
                ],
                fillColor: '#F8FAFC',
                padding: 10
              }]]
            },
            margin: [0, 0, 0, 20]
          }] : []),

          // Book Specifications
          {
            layout: 'noBorders',
            table: {
              widths: ['*'],
              body: [[{
                stack: [
                  { text: 'Book Specifications', style: 'sectionHeader' },
                  {
                    style: 'tableStyle',
                    table: {
                      widths: ['50%', '50%'],
                      body: [
                        [{ text: 'Book Size:', style: 'label' }, { text: quote.bookSize, style: 'value' }],
                        [{ text: 'Cover Type:', style: 'label' }, { text: quote.coverType, style: 'value' }],
                        [{ text: 'Page Count:', style: 'label' }, { text: quote.pageCount.toString(), style: 'value' }],
                        [{ text: 'Copies:', style: 'label' }, { text: quote.copies.toString(), style: 'value' }],
                        [{ text: 'Total Pages:', style: 'label' }, { text: (quote.pageCount * quote.copies).toLocaleString(), style: 'value' }],
                        [{ text: 'Paper Type:', style: 'label' }, { text: quote.paperType, style: 'value' }],
                        [{ text: 'Interior Type:', style: 'label' }, { text: quote.interiorType, style: 'value' }],
                        [
                          { text: 'Printing Cost Total:', style: 'label' },
                          { text: `NGN ${calculations.bookSpecsTotal.toLocaleString()}`, style: 'total' }
                        ]
                      ]
                    },
                    layout: {
                      hLineWidth: (i) => 0.5,
                      vLineWidth: (i) => 0.5,
                      hLineColor: () => '#E2E8F0',
                      vLineColor: () => '#E2E8F0',
                      paddingLeft: () => 12,
                      paddingRight: () => 12,
                      paddingTop: () => 8,
                      paddingBottom: () => 8
                    }
                  }
                ]
              }]]
            },
            margin: [0, 0, 0, 20]
          },

          // Additional Services
          ...(quote.includeDesign || quote.includeISBN || quote.others.length > 0 ? [{
            layout: 'noBorders',
            table: {
              widths: ['*'],
              body: [[{
                stack: [
                  { text: 'Additional Services', style: 'sectionHeader' },
                  {
                    style: 'tableStyle',
                    table: {
                      widths: ['*', 'auto'],
                      body: [
                        ...(quote.includeDesign ? [[{ text: 'Design:', style: 'label' }, { text: `NGN ${calculations.designCost.toLocaleString()}`, style: 'amount' }]] : []),
                        ...(quote.includeISBN ? [[{ text: 'ISBN:', style: 'label' }, { text: `NGN ${calculations.isbnCost.toLocaleString()}`, style: 'amount' }]] : []),
                        ...quote.others.map(item => [
                          { text: `Others: ${item.description}`, style: 'label' },
                          { text: `NGN ${item.cost.toLocaleString()}`, style: 'amount' }
                        ]),
                        [
                          { text: 'Additional Services Total:', style: 'label' },
                          { text: `NGN ${calculations.additionalServicesTotal.toLocaleString()}`, style: 'total' }
                        ]
                      ]
                    },
                    layout: {
                      hLineWidth: (i) => 0.5,
                      vLineWidth: (i) => 0.5,
                      hLineColor: () => '#E2E8F0',
                      vLineColor: () => '#E2E8F0',
                      paddingLeft: () => 12,
                      paddingRight: () => 12,
                      paddingTop: () => 8,
                      paddingBottom: () => 8
                    }
                  }
                ],
                fillColor: '#F8FAFC',
                padding: 10
              }]]
            },
            margin: [0, 0, 0, 20]
          }] : []),

          // Bulk Discount
          ...(bulkDiscount.apply && bulkDiscount.amount > 0 ? [{
            text: `Bulk Discount: -NGN ${bulkDiscount.amount.toLocaleString()}`,
            style: 'label',
            color: '#DC2626',
            margin: [0, 0, 0, 10]
          }] : []),

          // Final Quotation
          {
            layout: 'noBorders',
            table: {
              widths: ['*'],
              body: [[{
                text: `Final Quotation: NGN ${calculations.finalQuotation.toLocaleString()}`,
                style: 'header',
                fillColor: '#254BE3',
                padding: [16, 16, 16, 16],
              }]]
            },
            margin: [0, 20, 0, 20]
          },

          // Footer
          {
            canvas: [{ type: 'line', x1: 0, y1: 0, x2: 515, y2: 0, lineWidth: 1, lineColor: '#254BE3' }],
            margin: [0, 0, 0, 12]
          },
          {
            stack: [
              { text: '08026978666', style: 'footer' },
              { text: '09026557129', style: 'footer' },
              { text: 'glitworkspaces@gmail.com', style: 'footer', margin: [0, 0, 0, 12] },
              { text: 'Thank you for choosing Glit Publishers. This quotation is valid for 30 days.', style: 'validity' }
            ]
          }
        ]
      };

      // Create and download PDF
      const fileName = `Glit-Quote-${quotationId.replace(/\s+/g, '-')}.pdf`;
      pdfMake.createPdf(docDefinition).download(fileName);

      // Show success toast
      toast({
        title: "Success!",
        description: "Quotation PDF downloaded successfully!",
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
      
      // Generate quotation ID and date
      const quotationId = `QT-${new Date().getFullYear()}-${String(Date.now()).slice(-3)}`;
      const currentDate = new Date().toLocaleDateString('en-GB', { 
        day: '2-digit', 
        month: 'numeric', 
        year: 'numeric' 
      });

      // Define document styles
      const styles = {
        header: {
          fontSize: 24,
          bold: true,
          color: 'white',
          alignment: 'center',
          margin: [0, 12, 0, 12],
        },
        sectionHeader: {
          fontSize: 14,
          bold: true,
          margin: [0, 0, 0, 10],
        },
        label: {
          bold: true,
          fontSize: 10,
        },
        value: {
          fontSize: 10,
        },
        amount: {
          fontSize: 10,
          alignment: 'right',
        },
        total: {
          fontSize: 12,
          bold: true,
          alignment: 'right',
        },
        footer: {
          fontSize: 10,
          bold: true,
          alignment: 'center',
        },
        validity: {
          fontSize: 9,
          italics: true,
          alignment: 'center',
          color: '#666666',
        }
      };

      // Build document definition
      const docDefinition = {
        pageSize: 'A4',
        pageMargins: [25, 25, 25, 25],
        content: [
          // Header section
          {
            layout: 'noBorders',
            table: {
              widths: ['*'],
              body: [[
                {
                  text: 'Glit Publisher Quote',
                  style: 'header',
                  fillColor: '#254BE3',
                  padding: [16, 12, 16, 12],
                }
              ]]
            },
          },
          {
            columns: [
              { text: `Quotation ID: ${quotationId}`, style: 'value' },
              { text: `Date: ${currentDate}`, style: 'value', alignment: 'right' }
            ],
            margin: [0, 10, 0, 20]
          },

          // Customer & Staff Information
          ...(quote.customerName || quote.customerEmail || quote.customerPhone || quote.staffName || quote.staffId ? [{
            layout: 'noBorders',
            table: {
              widths: ['*'],
              body: [[{
                columns: [
                  // Customer Information
                  {
                    width: '*',
                    stack: [
                      { text: 'Customer Information', style: 'sectionHeader' },
                      ...(quote.customerName ? [{ text: `Name: ${quote.customerName}`, style: 'value', margin: [0, 0, 0, 6] }] : []),
                      ...(quote.customerPhone ? [{ text: `Phone: ${quote.customerPhone}`, style: 'value', margin: [0, 0, 0, 6] }] : []),
                      ...(quote.customerEmail ? [{ text: `Email: ${quote.customerEmail}`, style: 'value', margin: [0, 0, 0, 6] }] : [])
                    ]
                  },
                  // Staff Information
                  {
                    width: '*',
                    stack: [
                      { text: 'Prepared By', style: 'sectionHeader' },
                      ...(quote.staffName ? [{ text: `Staff Name: ${quote.staffName}`, style: 'value', margin: [0, 0, 0, 6] }] : []),
                      ...(quote.staffId ? [{ text: `Staff ID: ${quote.staffId}`, style: 'value', margin: [0, 0, 0, 6] }] : [])
                    ]
                  }
                ],
                fillColor: '#F8FAFC',
                padding: 10
              }]]
            },
            margin: [0, 0, 0, 20]
          }] : []),

          // Book Specifications
          {
            layout: 'noBorders',
            table: {
              widths: ['*'],
              body: [[{
                stack: [
                  { text: 'Book Specifications', style: 'sectionHeader' },
                  {
                    layout: {
                      defaultBorder: false,
                      hLineWidth: () => 1,
                      vLineWidth: () => 1,
                      hLineColor: () => '#E2E8F0',
                      vLineColor: () => '#E2E8F0',
                      paddingLeft: () => 12,
                      paddingRight: () => 12,
                      paddingTop: () => 8,
                      paddingBottom: () => 8
                    },
                    table: {
                      widths: ['*', 'auto'],
                      body: [
                        [{ text: 'Book Size:', style: 'label' }, { text: quote.bookSize, style: 'value' }],
                        [{ text: 'Cover Type:', style: 'label' }, { text: quote.coverType, style: 'value' }],
                        [{ text: 'Page Count:', style: 'label' }, { text: quote.pageCount.toString(), style: 'value' }],
                        [{ text: 'Copies:', style: 'label' }, { text: quote.copies.toString(), style: 'value' }],
                        [{ text: 'Total Pages:', style: 'label' }, { text: (quote.pageCount * quote.copies).toLocaleString(), style: 'value' }],
                        [{ text: 'Paper Type:', style: 'label' }, { text: quote.paperType, style: 'value' }],
                        [{ text: 'Interior Type:', style: 'label' }, { text: quote.interiorType, style: 'value' }],
                        [
                          { text: 'Printing Cost Total:', style: 'label' },
                          { text: `NGN ${calculations.bookSpecsTotal.toLocaleString()}`, style: 'total' }
                        ]
                      ]
                    }
                  }
                ],
                border: [1, 1, 1, 1],
                borderColor: ['#E2E8F0', '#E2E8F0', '#E2E8F0', '#E2E8F0']
              }]]
            },
            margin: [0, 0, 0, 20]
          },
    // Header - Royal Blue container with white text

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(24);
    doc.text('Glit Publisher Quote', pageWidth / 2, headerHeight/2 - 2, { align: 'center' });
    
    // Quote ID and Date
    doc.setFontSize(10);
    const currentDate = new Date().toLocaleDateString('en-GB', { 
      day: '2-digit', 
      month: 'numeric', 
      year: 'numeric' 
    });
    const quotationId = `QT-${new Date().getFullYear()}-${String(Date.now()).slice(-3)}`;
    doc.text(`Quotation ID: ${quotationId}`, margin.left + padding.large, headerHeight - padding.large);
    doc.text(`Date: ${currentDate}`, pageWidth - margin.right - padding.large, headerHeight - padding.large, { align: 'right' });
    
    // Reset text color for rest of document
    doc.setTextColor(0, 0, 0);
    yPosition = headerHeight + padding.large * 2;

    // Customer & Staff Info sections
    const hasCustomerInfo = quote.customerName || quote.customerEmail || quote.customerPhone;
    const hasStaffInfo = quote.staffName || quote.staffId;

    if (hasCustomerInfo || hasStaffInfo) {
      // Background container
      const containerHeight = hasCustomerInfo && hasStaffInfo ? 70 : 45;
      
      // Draw filled and stroked rectangle
      doc.setDrawColor(226, 232, 240);
      doc.setFillColor(248, 250, 252);
      doc.setLineWidth(0.5);
      
      // Draw rectangle path
      doc.lines(
        [
          [contentWidth, 0], // right
          [0, containerHeight], // down
          [-contentWidth, 0], // left
          [0, -containerHeight], // up
        ],
        margin.left,
        yPosition - 5,
        [1, 1],
        'FD'
      );

      if (hasCustomerInfo) {
        // Customer Details
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(12);
        doc.text('Customer Information', margin.left + padding.medium, yPosition + 5);
        
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(10);
        let detailY = yPosition + 15;
        
        if (quote.customerName) {
          doc.text(`Name: ${quote.customerName}`, margin.left + padding.medium, detailY);
          detailY += padding.large;
        }
        if (quote.customerPhone) {
          doc.text(`Phone: ${quote.customerPhone}`, margin.left + padding.medium, detailY);
          detailY += padding.large;
        }
        if (quote.customerEmail) {
          doc.text(`Email: ${quote.customerEmail}`, margin.left + padding.medium, detailY);
          detailY += padding.large;
        }
        
        yPosition = detailY + padding.medium;
      }

      if (hasStaffInfo) {
        // Staff Details
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(12);
        const staffX = hasCustomerInfo ? pageWidth / 2 + padding.medium : margin.left + padding.medium;
        doc.text('Prepared By', staffX, hasCustomerInfo ? yPosition - 25 : yPosition + 5);
        
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(10);
        let staffY = hasCustomerInfo ? yPosition - 15 : yPosition + 15;
        
        if (quote.staffName) {
          doc.text(`Staff Name: ${quote.staffName}`, staffX, staffY);
          staffY += padding.large;
        }
        if (quote.staffId) {
          doc.text(`Staff ID: ${quote.staffId}`, staffX, staffY);
          staffY += padding.large;
        }
      }
      
      yPosition += hasCustomerInfo && hasStaffInfo ? 15 : 45;
    }

    // Book Specifications Section
    yPosition += sectionSpacing;
    
    // Draw filled and stroked rectangle
    doc.setDrawColor(226, 232, 240);
    doc.setFillColor(248, 250, 252);
    doc.setLineWidth(0.5);
    
    // Draw rectangle path
    doc.lines(
      [
        [contentWidth, 0], // right
        [0, 90], // down
        [-contentWidth, 0], // left
        [0, -90], // up
      ],
      margin.left,
      yPosition - padding.small,
      [1, 1],
      'FD'
    );

    // Section Header
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(14);
    doc.text('Book Specifications', margin.left + padding.medium, yPosition + padding.large);
    yPosition += padding.large * 2;

    // Specifications
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(10);
    
    const specs = [
      ['Book Size:', quote.bookSize],
      ['Cover Type:', quote.coverType],
      ['Page Count:', quote.pageCount.toString()],
      ['Copies:', quote.copies.toString()],
      ['Total Pages:', (quote.pageCount * quote.copies).toLocaleString()],
      ['Paper Type:', quote.paperType],
      ['Interior Type:', quote.interiorType]
    ];

    const labelOffset = margin.left + padding.medium;
    const valueOffset = margin.left + padding.large * 2;

    specs.forEach(([label, value]) => {
      doc.setFont('helvetica', 'bold');
      doc.text(label, labelOffset, yPosition);
      doc.setFont('helvetica', 'normal');
      doc.text(value || '', valueOffset, yPosition);
      yPosition += padding.large;
    });

    // Printing Cost Total - Royal Blue strip
    yPosition += padding.medium;
    doc.setFillColor(37, 99, 235);
    doc.rect(margin.left, yPosition - padding.small, contentWidth, padding.large * 2, 'F');
    doc.setTextColor(255, 255, 255);
    doc.setFont('helvetica', 'bold');
    const printingTotal = `NGN ${calculations.bookSpecsTotal.toLocaleString()}`;
    doc.text('Printing Cost Total:', margin.left + padding.medium, yPosition + padding.medium);
    doc.text(printingTotal, pageWidth - margin.right - padding.medium, yPosition + padding.medium, { align: 'right' });
    
    doc.setTextColor(0, 0, 0);
    yPosition += padding.large * 2;

    // Additional Services Section
    const hasAdditionalServices = quote.includeDesign || quote.includeISBN || quote.others.length > 0;
    
    if (hasAdditionalServices) {
      yPosition += sectionSpacing;
      
      // Calculate section height
      const sectionHeaderHeight = padding.large * 2;
      const itemHeight = padding.large;
      const totalItems = (quote.includeDesign ? 1 : 0) + 
                        (quote.includeISBN ? 1 : 0) + 
                        quote.others.length;
      const sectionHeight = sectionHeaderHeight + (totalItems * itemHeight) + padding.large * 2;
      
      // Container
      doc.setFillColor(248, 250, 252);
      doc.rect(margin.left, yPosition - padding.small, contentWidth, sectionHeight);
      doc.setDrawColor(226, 232, 240);
      doc.setFillColor(248, 250, 252);
      doc.rect(margin.left, yPosition - padding.small, contentWidth, sectionHeight);

      // Section Header
      doc.setTextColor(0, 0, 0);
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(14);
      doc.text('Additional Services', margin.left + padding.medium, yPosition + padding.large);
      yPosition += padding.large * 2;

      // Services List
      doc.setFontSize(10);
      doc.setFont('helvetica', 'normal');

      if (quote.includeDesign) {
        doc.text('Design:', margin.left + padding.medium, yPosition);
        doc.text(`NGN ${calculations.designCost.toLocaleString()}`, 
                pageWidth - margin.right - padding.medium, yPosition, { align: 'right' });
        yPosition += padding.large;
      }

      if (quote.includeISBN) {
        doc.text('ISBN:', margin.left + padding.medium, yPosition);
        doc.text(`NGN ${calculations.isbnCost.toLocaleString()}`, 
                pageWidth - margin.right - padding.medium, yPosition, { align: 'right' });
        yPosition += padding.large;
      }

      quote.others.forEach(item => {
        if (item.description && item.cost > 0) {
          doc.text(`Others: ${item.description}`, margin.left + padding.medium, yPosition);
          doc.text(`NGN ${item.cost.toLocaleString()}`, 
                  pageWidth - margin.right - padding.medium, yPosition, { align: 'right' });
          yPosition += padding.large;
        }
      });

      // Additional Services Total
      yPosition += 7;
      doc.setFillColor(37, 99, 235);
      doc.rect(margin, yPosition - 3, pageWidth - (margin * 2), 12, 'F');
      doc.setTextColor(255, 255, 255);
      doc.setFont('helvetica', 'bold');
      doc.text('Additional Services Total:', margin + 5, yPosition + 5);
      doc.text(`NGN ${calculations.additionalServicesTotal.toLocaleString()}`, 
              pageWidth - margin - 5, yPosition + 5, { align: 'right' });
      
      doc.setTextColor(0, 0, 0);
      yPosition += 20;
    }

    // Bulk Discount (if applied)
    if (bulkDiscount.apply && bulkDiscount.amount > 0) {
      yPosition += padding.medium;
      doc.setTextColor(220, 38, 38); // Red color
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(12);
      doc.text('Bulk Discount:', margin.left + padding.medium, yPosition);
      doc.text(`-NGN ${bulkDiscount.amount.toLocaleString()}`, 
              pageWidth - margin.right - padding.medium, yPosition, { align: 'right' });
      yPosition += padding.large * 1.5;
      doc.setTextColor(0, 0, 0);
    }

    // Final Quotation
    yPosition += padding.large;
    
    // Draw filled rectangle
    doc.setDrawColor(37, 99, 235);
    doc.setFillColor(37, 99, 235);
    doc.setLineWidth(0);
    
    const finalHeight = padding.large * 2.5;
    // Draw rectangle path
    doc.lines(
      [
        [contentWidth, 0], // right
        [0, finalHeight], // down
        [-contentWidth, 0], // left
        [0, -finalHeight], // up
      ],
      margin.left,
      yPosition - padding.small,
      [1, 1],
      'F'
    );
    
    // Text
    doc.setTextColor(255, 255, 255);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(16);
    doc.text('Final Quotation:', margin.left + padding.medium, yPosition + padding.large);
    doc.setFontSize(18);
    doc.text(`NGN ${calculations.finalQuotation.toLocaleString()}`, 
            pageWidth - margin.right - padding.medium, yPosition + padding.large, { align: 'right' });

    // Footer
    yPosition = pageHeight - margin.bottom - (padding.large * 6);
    
    // Separator line
    doc.setDrawColor(37, 99, 235);
    doc.setLineWidth(0.5);
    doc.line(margin.left, yPosition, pageWidth - margin.right, yPosition);
    
    // Contact Details
    yPosition += padding.large;
    doc.setTextColor(0, 0, 0);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(10);
    const contactCenter = pageWidth / 2;
    
    doc.text('08026978666', contactCenter, yPosition, { align: 'center' });
    yPosition += padding.medium;
    doc.text('09026557129', contactCenter, yPosition, { align: 'center' });
    yPosition += padding.medium;
    doc.text('glitworkspaces@gmail.com', contactCenter, yPosition, { align: 'center' });
    
    // Validity Text
    yPosition += padding.large;
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);
    doc.setTextColor(100, 100, 100);
    doc.text('Thank you for choosing Glit Publishers. This quotation is valid for 30 days.', 
            contactCenter, yPosition, { align: 'center' });

    // Save the PDF
      console.log('Preparing to save PDF...');
      const fileName = `Glit-Quote-${quotationId.replace(/\s+/g, '-')}.pdf`;
      doc.save(fileName);
      console.log('PDF saved as:', fileName);

      // Show success toast
      toast({
        title: "Success!",
        description: "Quotation PDF downloaded successfully!",
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

  return (
    <div className="min-h-screen bg-gradient-to-br from-background to-primary-light p-4 relative">
      <Toaster />
      <div className="max-w-7xl mx-auto relative">
        {/* Admin Link */}
        <Link
          to="/admin/login"
          className="absolute top-0 right-0 p-2 flex items-center gap-2 text-primary hover:text-primary/80 transition-colors font-medium"
          title="Admin Access"
        >
          <Shield className="w-5 h-5" />
          <span>Admin</span>
        </Link>

        <div className="text-center mb-8">
          <h1 className="text-4xl font-bold text-primary mb-2">Glit Quote</h1>
          <p className="text-muted-foreground text-lg">Internal Staff Quotation Calculator</p>
        </div>
        
        <div className="grid lg:grid-cols-2 gap-8">
          {/* Form Section */}
          <div className="space-y-6">
            {/* Customer Details Card */}
            <Card className="shadow-[var(--shadow-card)]">
              <CardHeader className="bg-primary text-primary-foreground">
                <CardTitle className="flex items-center gap-2">
                  <User className="h-5 w-5" />
                  Customer Information
                </CardTitle>
              </CardHeader>
              <CardContent className="p-6 space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="customerName" className="flex items-center gap-2 mb-2">
                      <User className="h-4 w-4 text-primary" />
                      Customer Name
                    </Label>
                    <Input
                      id="customerName"
                      type="text"
                      value={quote.customerName}
                      onChange={(e) => setQuote(prev => ({ ...prev, customerName: e.target.value }))}
                      placeholder="Enter customer name"
                    />
                  </div>

                  <div>
                    <Label htmlFor="customerEmail" className="flex items-center gap-2 mb-2">
                      Customer Email
                    </Label>
                    <Input
                      id="customerEmail"
                      type="email"
                      value={quote.customerEmail}
                      onChange={(e) => setQuote(prev => ({ ...prev, customerEmail: e.target.value }))}
                      placeholder="Enter customer email"
                    />
                  </div>

                  <div>
                    <Label htmlFor="customerPhone" className="flex items-center gap-2 mb-2">
                      Customer Phone
                    </Label>
                    <Input
                      id="customerPhone"
                      type="tel"
                      value={quote.customerPhone}
                      onChange={(e) => setQuote(prev => ({ ...prev, customerPhone: e.target.value }))}
                      placeholder="Enter customer phone"
                    />
                  </div>

                  <div>
                    <Label htmlFor="customerCompany" className="flex items-center gap-2 mb-2">
                      Company (Optional)
                    </Label>
                    <Input
                      id="customerCompany"
                      type="text"
                      value={quote.customerCompany}
                      onChange={(e) => setQuote(prev => ({ ...prev, customerCompany: e.target.value }))}
                      placeholder="Enter company name"
                    />
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Staff Details Card */}
            <Card className="shadow-[var(--shadow-card)]">
              <CardHeader className="bg-primary text-primary-foreground">
                <CardTitle className="flex items-center gap-2">
                  <UserCircle className="h-5 w-5" />
                  Staff Information
                </CardTitle>
              </CardHeader>
              <CardContent className="p-6 space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="staffName" className="flex items-center gap-2 mb-2">
                      <UserCircle className="h-4 w-4 text-primary" />
                      Staff Name
                    </Label>
                    <Input
                      id="staffName"
                      type="text"
                      value={quote.staffName}
                      onChange={(e) => setQuote(prev => ({ ...prev, staffName: e.target.value }))}
                      placeholder="Enter your name"
                    />
                  </div>

                  <div>
                    <Label htmlFor="staffId" className="flex items-center gap-2 mb-2">
                      Staff ID / Initials
                    </Label>
                    <Input
                      id="staffId"
                      type="text"
                      value={quote.staffId}
                      onChange={(e) => setQuote(prev => ({ ...prev, staffId: e.target.value }))}
                      placeholder="e.g., ST001 or MO"
                    />
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Book Specifications Card */}
            <Card className="shadow-[var(--shadow-card)]">
              <CardHeader className="bg-primary text-primary-foreground">
                <CardTitle className="flex items-center gap-2">
                  <BookOpen className="h-5 w-5" />
                  Book Specifications
                </CardTitle>
              </CardHeader>
              <CardContent className="p-6 space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="bookSize" className="flex items-center gap-2 mb-2">
                      <Maximize className="h-4 w-4 text-primary" />
                      Book Size
                    </Label>
                    <Select value={quote.bookSize} onValueChange={(value) => setQuote(prev => ({ ...prev, bookSize: value as BookSize }))}>
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
                    <Label htmlFor="coverType" className="flex items-center gap-2 mb-2">
                      <Layers className="h-4 w-4 text-primary" />
                      Cover Type
                    </Label>
                    <Select value={quote.coverType} onValueChange={(value) => setQuote(prev => ({ ...prev, coverType: value as CoverType }))}>
                      <SelectTrigger>
                        <SelectValue placeholder="Select cover" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="Soft">Soft</SelectItem>
                        <SelectItem value="Hard">Hard</SelectItem>
                        <SelectItem value="Folded">Folded</SelectItem>
                        <SelectItem value="Hard + Folded">Hard + Folded</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div>
                    <Label htmlFor="pageCount" className="flex items-center gap-2 mb-2">
                      <FileText className="h-4 w-4 text-primary" />
                      Page Count
                    </Label>
                    <Input
                      id="pageCount"
                      type="number"
                      min="1"
                      value={quote.pageCount || ''}
                      onChange={(e) => setQuote(prev => ({ ...prev, pageCount: parseInt(e.target.value) || 0 }))}
                      placeholder="Enter page count"
                    />
                  </div>

                  <div>
                    <Label htmlFor="copies" className="flex items-center gap-2 mb-2">
                      <Copy className="h-4 w-4 text-primary" />
                      Copies
                    </Label>
                    <Input
                      id="copies"
                      type="number"
                      min="1"
                      value={quote.copies || ''}
                      onChange={(e) => setQuote(prev => ({ ...prev, copies: parseInt(e.target.value) || 0 }))}
                      placeholder="Enter number of copies"
                    />
                  </div>
                </div>

                {/* Total Pages to Print Badge */}
                {quote.pageCount > 0 && quote.copies > 0 && (
                  <div className="bg-accent rounded-lg p-3 mt-4">
                    <div className="flex items-center justify-between gap-2">
                      <span className="flex items-center gap-2 font-medium">
                        <Calculator className="h-4 w-4 text-primary" />
                        Total Pages to Print:
                      </span>
                      <span className="font-bold text-primary">
                        {(quote.pageCount * quote.copies).toLocaleString()}
                      </span>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Paper & Interior Card */}
            <Card className="shadow-[var(--shadow-card)]">
              <CardHeader className="bg-primary text-primary-foreground">
                <CardTitle className="flex items-center gap-2">
                  <FileStack className="h-5 w-5" />
                  Paper & Interior
                </CardTitle>
              </CardHeader>
              <CardContent className="p-6 space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="paperType" className="flex items-center gap-2 mb-2">
                      <FileText className="h-4 w-4 text-primary" />
                      Paper Type
                    </Label>
                    <Select value={quote.paperType} onValueChange={(value) => setQuote(prev => ({ ...prev, paperType: value as PaperType }))}>
                      <SelectTrigger>
                        <SelectValue placeholder="Select paper" />
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
                    <Label htmlFor="interiorType" className="flex items-center gap-2 mb-2">
                      <Palette className="h-4 w-4 text-primary" />
                      Interior Type
                    </Label>
                    <Select value={quote.interiorType} onValueChange={(value) => setQuote(prev => ({ ...prev, interiorType: value as InteriorType }))}>
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

                <div>
                  <Label htmlFor="finishing" className="flex items-center gap-2 mb-2">
                    <CheckSquare className="h-4 w-4 text-primary" />
                    Finishing Cost (₦)
                  </Label>
                  <Input
                    id="finishing"
                    type="number"
                    min="0"
                    value={quote.finishing || ''}
                    onChange={(e) => setQuote(prev => ({ ...prev, finishing: parseFloat(e.target.value) || 0 }))}
                    placeholder="Auto-calculated"
                  />
                </div>
              </CardContent>
            </Card>

            {/* Additional Services Card */}
            <Card className="shadow-[var(--shadow-card)]">
              <CardHeader className="bg-primary text-primary-foreground">
                <CardTitle className="flex items-center gap-2">
                  <Settings className="h-5 w-5" />
                  Additional Services
                </CardTitle>
              </CardHeader>
              <CardContent className="p-6 space-y-6">
                <div className="space-y-4">
                  <div className="flex items-center justify-between gap-2">
                    <Label htmlFor="includeDesign" className="flex items-center gap-2">
                      <PenTool className="h-4 w-4 text-primary" />
                      Include Design (₦10,000)
                    </Label>
                    <Switch
                      id="includeDesign"
                      checked={quote.includeDesign}
                      onCheckedChange={(checked) => setQuote(prev => ({ ...prev, includeDesign: checked }))}
                    />
                  </div>

                  <div className="flex items-center justify-between gap-2">
                    <Label htmlFor="includeISBN" className="flex items-center gap-2">
                      <Book className="h-4 w-4 text-primary" />
                      Include ISBN (₦8,000)
                    </Label>
                    <Switch
                      id="includeISBN"
                      checked={quote.includeISBN}
                      onCheckedChange={(checked) => setQuote(prev => ({ ...prev, includeISBN: checked }))}
                    />
                  </div>

                  <div className="space-y-2">
                    <div className="flex items-center justify-between gap-2">
                      <Label htmlFor="includeBHR" className="flex items-center gap-2">
                        <Cpu className="h-4 w-4 text-primary" />
                        Apply BHR
                      </Label>
                      <Switch
                        id="includeBHR"
                        checked={quote.includeBHR}
                        onCheckedChange={(checked) => setQuote(prev => ({ ...prev, includeBHR: checked }))}
                      />
                    </div>
                    {quote.includeBHR && (
                      <Input
                        type="number"
                        min="0"
                        value={quote.bhrAmount || ''}
                        onChange={(e) => setQuote(prev => ({ ...prev, bhrAmount: parseFloat(e.target.value) || 0 }))}
                        placeholder="BHR amount"
                      />
                    )}
                  </div>

                  <div className="space-y-2">
                    <div className="flex items-center justify-between gap-2">
                      <Label htmlFor="applyBulkDiscount" className="flex items-center gap-2">
                        <Percent className="h-4 w-4 text-primary" />
                        Apply Bulk Discount
                      </Label>
                      <Switch
                        id="applyBulkDiscount"
                        checked={bulkDiscount.apply}
                        onCheckedChange={(checked) => setBulkDiscount(prev => ({ ...prev, apply: checked }))}
                      />
                    </div>
                    {bulkDiscount.apply && (
                      <Input
                        type="number"
                        min="0"
                        value={bulkDiscount.amount || ''}
                        onChange={(e) => setBulkDiscount(prev => ({ ...prev, amount: parseFloat(e.target.value) || 0 }))}
                        placeholder="Discount amount (NGN)"
                      />
                    )}
                  </div>
                </div>

                <Separator />

                {/* Others Section */}
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <h3 className="text-lg font-semibold text-primary flex items-center gap-2">
                      <PlusCircle className="h-4 w-4" />
                      Others (Manual Adjustments)
                    </h3>
                    <Button onClick={addOtherItem} size="sm" variant="outline">
                      <Plus className="h-4 w-4 mr-2" />
                      Add Item
                    </Button>
                  </div>

                  {quote.others.map((item) => (
                    <div key={item.id} className="flex gap-2">
                      <Input
                        placeholder="Description"
                        value={item.description}
                        onChange={(e) => updateOtherItem(item.id, 'description', e.target.value)}
                      />
                      <Input
                        type="number"
                        placeholder="Cost"
                        value={item.cost || ''}
                        onChange={(e) => updateOtherItem(item.id, 'cost', parseFloat(e.target.value) || 0)}
                      />
                      <Button onClick={() => removeOtherItem(item.id)} size="sm" variant="destructive">
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Calculation Results */}
          <Card className="shadow-[var(--shadow-card)]">
            <CardHeader className="bg-primary text-primary-foreground">
              <CardTitle className="flex items-center gap-2">
                <Receipt className="h-5 w-5" />
                Quotation Breakdown
              </CardTitle>
            </CardHeader>
            <CardContent className="p-6 space-y-4">
              <div className="space-y-3">
                <h3 className="font-semibold text-primary flex items-center gap-2">
                  <BookOpen className="h-4 w-4" />
                  Book Specifications
                </h3>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span>Paper Cost:</span>
                    <span>{formatCurrency(calculations.paperCost)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Toner Cost:</span>
                    <span>{formatCurrency(calculations.tonerCost)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Cover Cost:</span>
                    <span>{formatCurrency(calculations.coverCost)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Finishing:</span>
                    <span>{formatCurrency(calculations.finishingCost)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Packaging:</span>
                    <span>{formatCurrency(calculations.packagingCost)}</span>
                  </div>
                  <Separator />
                  <div className="flex justify-between font-semibold">
                    <span className="flex items-center gap-2">
                      <BookOpen className="h-3 w-3" />
                      Book Specifications Total:
                    </span>
                    <span>{formatCurrency(calculations.bookSpecsTotal)}</span>
                  </div>
                </div>
              </div>

              <div className="space-y-3">
                <h3 className="font-semibold text-primary flex items-center gap-2">
                  <Settings className="h-4 w-4" />
                  Additional Services
                </h3>
                <div className="space-y-2 text-sm">
                  {quote.includeDesign && (
                    <div className="flex justify-between">
                      <span className="flex items-center gap-2">
                        <PenTool className="h-3 w-3" />
                        Design:
                      </span>
                      <span>{formatCurrency(calculations.designCost)}</span>
                    </div>
                  )}
                  {quote.includeISBN && (
                    <div className="flex justify-between">
                      <span className="flex items-center gap-2">
                        <Book className="h-3 w-3" />
                        ISBN:
                      </span>
                      <span>{formatCurrency(calculations.isbnCost)}</span>
                    </div>
                  )}
                  {quote.includeBHR && (
                    <div className="flex justify-between">
                      <span className="flex items-center gap-2">
                        <Cpu className="h-3 w-3" />
                        BHR:
                      </span>
                      <span>{formatCurrency(calculations.bhrCost)}</span>
                    </div>
                  )}
                  {calculations.othersCost > 0 && (
                    <div className="flex justify-between">
                      <span className="flex items-center gap-2">
                        <PlusCircle className="h-3 w-3" />
                        Others:
                      </span>
                      <span>{formatCurrency(calculations.othersCost)}</span>
                    </div>
                  )}
                  <Separator />
                  <div className="flex justify-between font-semibold">
                    <span className="flex items-center gap-2">
                      <Settings className="h-3 w-3" />
                      Additional Services Total:
                    </span>
                    <span>{formatCurrency(calculations.additionalServicesTotal)}</span>
                  </div>
                </div>
              </div>

              <Separator />
              
              <div className="space-y-4">
                <div className="flex justify-between text-lg font-semibold">
                  <span className="flex items-center gap-2">
                    <Calculator className="h-4 w-4" />
                    Raw Cost:
                  </span>
                  <span>{formatCurrency(calculations.rawCost)}</span>
                </div>

                <div className="space-y-4">
                  <div className="flex justify-between items-center">
                    <Label htmlFor="profitMargin" className="flex items-center gap-2">
                      <Percent className="h-4 w-4 text-primary" />
                      Profit Margin:
                    </Label>
                    <div className="flex gap-2 items-center">
                      <div className="w-24">
                        <Input
                          id="profitMargin"
                          type="number"
                          min="0"
                          max="100"
                          step="0.1"
                          value={quote.profitMargin || ''}
                          onChange={(e) => {
                            const percentage = parseFloat(e.target.value) || 0;
                            setQuote(prev => ({ ...prev, profitMargin: percentage }));
                          }}
                          placeholder="Enter %"
                        />
                      </div>
                      <span className="text-muted-foreground">%</span>
                    </div>
                  </div>
                  <div className="flex justify-between items-center">
                    <Label htmlFor="profitAmountNGN" className="flex items-center gap-2">
                      <Wallet className="h-4 w-4 text-primary" />
                      Profit (NGN):
                    </Label>
                    <div className="w-36">
                      <Input
                        id="profitAmountNGN"
                        type="number"
                        min="0"
                        step="100"
                        value={calculations.rawCost > 0 ? ((calculations.rawCost * quote.profitMargin) / 100) || '' : ''}
                        onChange={(e) => {
                          const ngnAmount = parseFloat(e.target.value) || 0;
                          const newPercentage = calculations.rawCost > 0 ? (ngnAmount / calculations.rawCost) * 100 : 0;
                          setQuote(prev => ({ ...prev, profitMargin: newPercentage }));
                        }}
                        placeholder="Enter amount"
                      />
                    </div>
                  </div>
                </div>

                {bulkDiscount.apply && bulkDiscount.amount > 0 && (
                  <div className="flex justify-between text-lg text-destructive">
                    <span className="flex items-center gap-2">
                      <Percent className="h-4 w-4" />
                      Bulk Discount:
                    </span>
                    <span>-{formatCurrency(bulkDiscount.amount)}</span>
                  </div>
                )}

                <div className="p-4 bg-primary-light rounded-lg">
                  <div className="flex justify-between items-center mb-4">
                    <span className="text-xl font-bold text-primary flex items-center gap-2">
                      <Wallet className="h-5 w-5" />
                      Final Quotation:
                    </span>
                    <span className="text-2xl font-bold text-primary">{formatCurrency(calculations.finalQuotation)}</span>
                  </div>
                  
                  <Button 
                    onClick={(e) => {
                      e.preventDefault();
                      console.log('Download button clicked');
                      generatePDF();
                    }}
                    className="w-full"
                    disabled={!quote.bookSize || !quote.paperType || !quote.interiorType || !quote.coverType}
                  >
                    <Download className="h-4 w-4 mr-2" />
                    Download PDF
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
};
