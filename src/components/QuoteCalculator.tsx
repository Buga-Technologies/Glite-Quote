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
import jsPDF from 'jspdf';
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
    const doc = new jsPDF();
    const pageWidth = doc.internal.pageSize.width;
    let yPosition = 25;

    // Header - Royal Blue container with white text
    doc.setFillColor(37, 99, 235); // Royal Blue
    doc.rect(0, 0, pageWidth, 35, 'F');
    
    doc.setTextColor(255, 255, 255); // White text
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(18);
    doc.text('Glit Publisher Quote', pageWidth / 2, 18, { align: 'center' });
    
    doc.setFontSize(10);
    doc.text('Contact: +234 902 655 7129', pageWidth / 2, 28, { align: 'center' });
    
    // Reset text color for rest of document
    doc.setTextColor(0, 0, 0);
    yPosition = 50;
    
    // Quote ID and Date
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(10);
    const currentDate = new Date().toLocaleDateString('en-GB', { 
      day: '2-digit', 
      month: 'short', 
      year: 'numeric' 
    });
    const quotationId = `QT-${new Date().getFullYear()}-${String(Date.now()).slice(-3)}`;
    doc.text(`Quotation ID: ${quotationId}`, 20, yPosition);
    doc.text(`Date: ${currentDate}`, pageWidth - 20, yPosition, { align: 'right' });
    
    yPosition += 15;

    // Customer & Staff Info in light-gray/blue container
    if (quote.customerName || quote.customerEmail || quote.customerPhone || quote.customerCompany || quote.staffName || quote.staffId) {
      // Light blue container
      doc.setFillColor(240, 248, 255);
      doc.rect(15, yPosition - 5, pageWidth - 30, 35, 'F');
      doc.setDrawColor(200, 220, 240);
      doc.rect(15, yPosition - 5, pageWidth - 30, 35, 'S');

      // Customer Details (Left Column)
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(11);
      doc.text('Customer Details', 20, yPosition + 5);
      
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(9);
      let customerY = yPosition + 12;
      
      if (quote.customerName) {
        doc.text(`Name: ${quote.customerName}`, 20, customerY);
        customerY += 4;
      }
      if (quote.customerPhone) {
        doc.text(`Phone: ${quote.customerPhone}`, 20, customerY);
        customerY += 4;
      }
      if (quote.customerEmail) {
        doc.text(`Email: ${quote.customerEmail}`, 20, customerY);
        customerY += 4;
      }

      // Staff Details (Right Column)
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(11);
      doc.text('Generated By', pageWidth / 2 + 10, yPosition + 5);
      
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(9);
      let staffY = yPosition + 12;
      
      if (quote.staffName) {
        doc.text(`Staff: ${quote.staffName}`, pageWidth / 2 + 10, staffY);
        staffY += 4;
      }
      if (quote.staffId) {
        doc.text(`ID: ${quote.staffId}`, pageWidth / 2 + 10, staffY);
        staffY += 4;
      }
      doc.text(`Date: ${currentDate}`, pageWidth / 2 + 10, staffY);
      
      yPosition += 45;
    }

    // Book Specifications Section with light-gray background
    doc.setFillColor(248, 250, 252);
    doc.rect(15, yPosition - 3, pageWidth - 30, 50, 'F');
    doc.setDrawColor(226, 232, 240);
    doc.rect(15, yPosition - 3, pageWidth - 30, 50, 'S');

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(12);
    doc.text('Book Specifications', 20, yPosition + 8);
    yPosition += 15;

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(10);
    
    const specs = [
      `Book Size: ${quote.bookSize}`,
      `Cover Type: ${quote.coverType}`,
      `Page Count: ${quote.pageCount}`,
      `Copies: ${quote.copies}`,
      `Total Pages: ${(quote.pageCount * quote.copies).toLocaleString()}`
    ];

    specs.forEach((spec) => {
      doc.text(spec, 20, yPosition);
      yPosition += 5;
    });

    // Book Specifications Total - Royal Blue strip
    yPosition += 5;
    doc.setFillColor(37, 99, 235);
    doc.rect(15, yPosition - 3, pageWidth - 30, 12, 'F');
    doc.setTextColor(255, 255, 255);
    doc.setFont('helvetica', 'bold');
    const bookTotal = `NGN ${calculations.bookSpecsTotal.toLocaleString()}`;
    doc.text('Book Specifications Total:', 20, yPosition + 5);
    doc.text(bookTotal, pageWidth - 20, yPosition + 5, { align: 'right' });
    
    doc.setTextColor(0, 0, 0);
    yPosition += 20;

    // Paper & Interior Section with border and shadow
    doc.setDrawColor(200, 200, 200);
    doc.setLineWidth(0.5);
    doc.rect(15, yPosition - 3, pageWidth - 30, 25, 'S');

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(12);
    doc.text('Specifications', 20, yPosition + 8);
    yPosition += 15;

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(10);
    doc.text(`Paper Type: ${quote.paperType}`, 20, yPosition);
    yPosition += 5;
    doc.text(`Interior Type: ${quote.interiorType}`, 20, yPosition);
    yPosition += 15;

    // Additional Services Section
    if (calculations.additionalServicesTotal > 0) {
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(12);
      doc.text('Additional Services', 20, yPosition);
      yPosition += 10;

      doc.setFont('helvetica', 'normal');
      doc.setFontSize(10);

      if (quote.includeDesign) {
        const designCost = `NGN ${calculations.designCost.toLocaleString()}`;
        doc.text('Design:', 20, yPosition);
        doc.text(designCost, pageWidth - 20, yPosition, { align: 'right' });
        yPosition += 5;
      }

      if (quote.includeISBN) {
        const isbnCost = `NGN ${calculations.isbnCost.toLocaleString()}`;
        doc.text('ISBN:', 20, yPosition);
        doc.text(isbnCost, pageWidth - 20, yPosition, { align: 'right' });
        yPosition += 5;
      }

      if (quote.includeBHR && calculations.bhrCost > 0) {
        const bhrAmount = `NGN ${calculations.bhrCost.toLocaleString()}`;
        doc.text('BHR:', 20, yPosition);
        doc.text(bhrAmount, pageWidth - 20, yPosition, { align: 'right' });
        yPosition += 5;
      }

      quote.others.forEach(item => {
        if (item.description && item.cost > 0) {
          const itemCost = `NGN ${item.cost.toLocaleString()}`;
          doc.text(`Others: ${item.description}`, 20, yPosition);
          doc.text(itemCost, pageWidth - 20, yPosition, { align: 'right' });
          yPosition += 5;
        }
      });

      // Additional Services Total - Royal Blue strip
      yPosition += 5;
      doc.setFillColor(37, 99, 235);
      doc.rect(15, yPosition - 3, pageWidth - 30, 12, 'F');
      doc.setTextColor(255, 255, 255);
      doc.setFont('helvetica', 'bold');
      const servicesTotal = `NGN ${calculations.additionalServicesTotal.toLocaleString()}`;
      doc.text('Additional Services Total:', 20, yPosition + 5);
      doc.text(servicesTotal, pageWidth - 20, yPosition + 5, { align: 'right' });
      
      doc.setTextColor(0, 0, 0);
      yPosition += 20;
    }

    // Bulk Discount (if applied)
    if (bulkDiscount.apply && bulkDiscount.amount > 0) {
      doc.setTextColor(220, 38, 38); // Red color
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(10);
      const discountAmount = `-NGN ${bulkDiscount.amount.toLocaleString()}`;
      doc.text('Bulk Discount:', 20, yPosition);
      doc.text(discountAmount, pageWidth - 20, yPosition, { align: 'right' });
      yPosition += 15;
      doc.setTextColor(0, 0, 0); // Reset to black
    }

    // Final Quotation - Royal Blue container with white text
    yPosition += 10;
    doc.setFillColor(37, 99, 235); // Royal Blue
    doc.rect(15, yPosition - 5, pageWidth - 30, 18, 'F');
    
    doc.setTextColor(255, 255, 255); // White text
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(16);
    const finalAmount = `NGN ${calculations.finalQuotation.toLocaleString()}`;
    doc.text('Final Quotation:', 20, yPosition + 8);
    doc.text(finalAmount, pageWidth - 20, yPosition + 8, { align: 'right' });
    
    doc.setTextColor(0, 0, 0); // Reset text color

    // Footer
    yPosition += 30;
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);
    
    doc.text('This quotation is valid for 7 days.', 20, yPosition);
    yPosition += 8;
    
    doc.setFont('helvetica', 'bold');
    doc.text('Contact Details:', 20, yPosition);
    yPosition += 5;
    
    doc.setFont('helvetica', 'normal');
    doc.text('📞 +234 902 655 7129', 20, yPosition);
    yPosition += 4;
    doc.text('✉ info@glitquote.com', 20, yPosition);

    // Save the PDF
    const fileName = `Glit-Quote-${quotationId.replace(/\s+/g, '-')}.pdf`;
    doc.save(fileName);

    // Show success toast
    toast({
      title: "Success!",
      description: "Quotation PDF downloaded successfully!",
      variant: "default",
      className: "bg-primary text-primary-foreground border-0",
    });
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
                    onClick={generatePDF}
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
