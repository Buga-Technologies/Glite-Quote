import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Separator } from '@/components/ui/separator';
import { Plus, Trash2, Calculator } from 'lucide-react';

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
  const [quote, setQuote] = useState<QuoteData>({
    bookSize: '',
    paperType: '',
    interiorType: '',
    pageCount: 0,
    copies: 1,
    coverType: '',
    finishing: 0,
    includeDesign: false,
    includeISBN: false,
    includeBHR: false,
    bhrAmount: 0,
    others: [],
    profitMargin: 20
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
      const autoFinishing = calculateFinishing(quote.pageCount);
      setQuote(prev => ({ ...prev, finishing: autoFinishing }));
    }
  }, [quote.pageCount]);

  // Auto-calculate BHR
  useEffect(() => {
    if (quote.includeBHR && quote.pageCount > 0 && quote.bookSize && quote.copies > 0) {
      const autoBHR = calculateBHR(quote.pageCount, quote.bookSize as BookSize, quote.copies);
      setQuote(prev => ({ ...prev, bhrAmount: autoBHR }));
    }
  }, [quote.includeBHR, quote.pageCount, quote.bookSize, quote.copies]);

  // Calculate all costs
  useEffect(() => {
    if (!quote.bookSize || !quote.paperType || !quote.interiorType) {
      return;
    }

    const paperCost = paperCosts[quote.paperType as PaperType][quote.bookSize as BookSize] * quote.pageCount * quote.copies;
    const tonerCost = tonerCosts[quote.interiorType as InteriorType][quote.bookSize as BookSize] * quote.pageCount * quote.copies;
    const coverCost = quote.coverType ? coverCosts[quote.coverType as CoverType][quote.bookSize as BookSize] * quote.copies : 0;
    const finishingCost = quote.finishing * quote.copies;
    const packagingCost = packagingCosts[quote.bookSize as BookSize] * quote.copies;
    const bhrCost = quote.includeBHR ? quote.bhrAmount : 0;
    const designCost = quote.includeDesign ? 10000 : 0;
    const isbnCost = quote.includeISBN ? 8000 : 0;
    const othersCost = quote.others.reduce((sum, item) => sum + item.cost, 0);

    const bookSpecsTotal = paperCost + tonerCost + coverCost + finishingCost + packagingCost;
    const additionalServicesTotal = designCost + isbnCost + bhrCost + othersCost;
    const rawCost = bookSpecsTotal + additionalServicesTotal;
    const finalQuotation = rawCost * (1 + quote.profitMargin / 100);

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
  }, [quote]);

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

  return (
    <div className="min-h-screen bg-gradient-to-br from-background to-primary-light p-4">
      <div className="max-w-7xl mx-auto">
        <div className="text-center mb-8">
          <h1 className="text-4xl font-bold text-primary mb-2">Glit Quote</h1>
          <p className="text-muted-foreground text-lg">Internal Staff Quotation Calculator</p>
        </div>
        
        <div className="grid lg:grid-cols-2 gap-8">
          {/* Form Section */}
          <Card className="shadow-[var(--shadow-card)]">
            <CardHeader className="bg-primary text-primary-foreground">
              <CardTitle className="flex items-center gap-2">
                <Calculator className="h-5 w-5" />
                Book Specifications
              </CardTitle>
            </CardHeader>
            <CardContent className="p-6 space-y-6">
              {/* Basic Info */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="bookSize">Book Size</Label>
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
                  <Label htmlFor="paperType">Paper Type</Label>
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
                  <Label htmlFor="interiorType">Interior Type</Label>
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

                <div>
                  <Label htmlFor="coverType">Cover Type</Label>
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
                  <Label htmlFor="pageCount">Page Count</Label>
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
                  <Label htmlFor="copies">Copies</Label>
                  <Input
                    id="copies"
                    type="number"
                    min="1"
                    value={quote.copies || ''}
                    onChange={(e) => setQuote(prev => ({ ...prev, copies: parseInt(e.target.value) || 1 }))}
                    placeholder="Enter copies"
                  />
                </div>
              </div>

              <div>
                <Label htmlFor="finishing">Finishing Cost (₦)</Label>
                <Input
                  id="finishing"
                  type="number"
                  min="0"
                  value={quote.finishing || ''}
                  onChange={(e) => setQuote(prev => ({ ...prev, finishing: parseFloat(e.target.value) || 0 }))}
                  placeholder="Auto-calculated"
                />
              </div>

              <Separator />

              {/* Additional Services */}
              <div className="space-y-4">
                <h3 className="text-lg font-semibold text-primary">Additional Services</h3>
                
                <div className="flex items-center justify-between">
                  <Label htmlFor="includeDesign">Include Design (₦10,000)</Label>
                  <Switch
                    id="includeDesign"
                    checked={quote.includeDesign}
                    onCheckedChange={(checked) => setQuote(prev => ({ ...prev, includeDesign: checked }))}
                  />
                </div>

                <div className="flex items-center justify-between">
                  <Label htmlFor="includeISBN">Include ISBN (₦8,000)</Label>
                  <Switch
                    id="includeISBN"
                    checked={quote.includeISBN}
                    onCheckedChange={(checked) => setQuote(prev => ({ ...prev, includeISBN: checked }))}
                  />
                </div>

                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <Label htmlFor="includeBHR">Include BHR</Label>
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
              </div>

              <Separator />

              {/* Others Section */}
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="text-lg font-semibold text-primary">Others</h3>
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

          {/* Calculation Results */}
          <Card className="shadow-[var(--shadow-card)]">
            <CardHeader className="bg-primary text-primary-foreground">
              <CardTitle>Quote Breakdown</CardTitle>
            </CardHeader>
            <CardContent className="p-6 space-y-4">
              <div className="space-y-3">
                <h3 className="font-semibold text-primary">Book Specifications</h3>
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
                    <span>Subtotal:</span>
                    <span>{formatCurrency(calculations.bookSpecsTotal)}</span>
                  </div>
                </div>
              </div>

              <div className="space-y-3">
                <h3 className="font-semibold text-primary">Additional Services</h3>
                <div className="space-y-2 text-sm">
                  {quote.includeDesign && (
                    <div className="flex justify-between">
                      <span>Design:</span>
                      <span>{formatCurrency(calculations.designCost)}</span>
                    </div>
                  )}
                  {quote.includeISBN && (
                    <div className="flex justify-between">
                      <span>ISBN:</span>
                      <span>{formatCurrency(calculations.isbnCost)}</span>
                    </div>
                  )}
                  {quote.includeBHR && (
                    <div className="flex justify-between">
                      <span>BHR:</span>
                      <span>{formatCurrency(calculations.bhrCost)}</span>
                    </div>
                  )}
                  {calculations.othersCost > 0 && (
                    <div className="flex justify-between">
                      <span>Others:</span>
                      <span>{formatCurrency(calculations.othersCost)}</span>
                    </div>
                  )}
                  <Separator />
                  <div className="flex justify-between font-semibold">
                    <span>Subtotal:</span>
                    <span>{formatCurrency(calculations.additionalServicesTotal)}</span>
                  </div>
                </div>
              </div>

              <Separator />
              
              <div className="space-y-4">
                <div className="flex justify-between text-lg font-semibold">
                  <span>Raw Cost:</span>
                  <span>{formatCurrency(calculations.rawCost)}</span>
                </div>

                <div className="flex items-center gap-2">
                  <Label htmlFor="profitMargin">Profit Margin (%):</Label>
                  <Input
                    id="profitMargin"
                    type="number"
                    min="0"
                    max="100"
                    value={quote.profitMargin || ''}
                    onChange={(e) => setQuote(prev => ({ ...prev, profitMargin: parseFloat(e.target.value) || 0 }))}
                    className="w-20"
                  />
                </div>

                <div className="p-4 bg-primary-light rounded-lg">
                  <div className="flex justify-between items-center">
                    <span className="text-xl font-bold text-primary">Final Quotation:</span>
                    <span className="text-2xl font-bold text-primary">{formatCurrency(calculations.finalQuotation)}</span>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
};
