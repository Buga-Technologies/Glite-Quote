import React, { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { toast } from 'sonner';
import { Plus, Pencil, Trash2 } from 'lucide-react';

interface PackagingCost {
  id: string;
  size: string;
  cost: number;
}

const PackagingCosts: React.FC = () => {
  const [packagingCosts, setPackagingCosts] = useState<PackagingCost[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<PackagingCost | null>(null);
  const [formData, setFormData] = useState({
    size: '',
    cost: 0,
  });

  useEffect(() => {
    fetchPackagingCosts();
  }, []);

  const fetchPackagingCosts = async () => {
    try {
      const { data, error } = await supabase
        .from('packaging_costs')
        .select('*')
        .order('size', { ascending: true });

      if (error) throw error;
      setPackagingCosts(data || []);
    } catch (error) {
      toast.error('Failed to load packaging costs');
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      if (editingItem) {
        const { error } = await supabase
          .from('packaging_costs')
          .update(formData)
          .eq('id', editingItem.id);
        if (error) throw error;
        toast.success('Packaging cost updated successfully');
      } else {
        const { error } = await supabase
          .from('packaging_costs')
          .insert([formData]);
        if (error) throw error;
        toast.success('Packaging cost added successfully');
      }
      setDialogOpen(false);
      resetForm();
      fetchPackagingCosts();
    } catch (error) {
      toast.error('Failed to save packaging cost');
    }
  };

  const handleEdit = (item: PackagingCost) => {
    setEditingItem(item);
    setFormData({
      size: item.size,
      cost: item.cost,
    });
    setDialogOpen(true);
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this packaging cost?')) return;
    try {
      const { error } = await supabase
        .from('packaging_costs')
        .delete()
        .eq('id', id);
      if (error) throw error;
      toast.success('Packaging cost deleted successfully');
      fetchPackagingCosts();
    } catch (error) {
      toast.error('Failed to delete packaging cost');
    }
  };

  const resetForm = () => {
    setFormData({ size: '', cost: 0 });
    setEditingItem(null);
  };

  const handleDialogClose = () => {
    setDialogOpen(false);
    resetForm();
  };

  if (loading) {
    return <div>Loading...</div>;
  }

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle>Packaging Costs</CardTitle>
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button onClick={() => { resetForm(); setDialogOpen(true); }}>
              <Plus className="w-4 h-4 mr-2" />
              Add Packaging Cost
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{editingItem ? 'Edit' : 'Add'} Packaging Cost</DialogTitle>
            </DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <Label htmlFor="size">Size</Label>
                <Input
                  id="size"
                  value={formData.size}
                  onChange={(e) => setFormData({ ...formData, size: e.target.value })}
                  required
                />
              </div>
              <div>
                <Label htmlFor="cost">Cost (NGN)</Label>
                <Input
                  id="cost"
                  type="number"
                  step="0.01"
                  value={formData.cost}
                  onChange={(e) => setFormData({ ...formData, cost: parseFloat(e.target.value) })}
                  required
                />
              </div>
              <div className="flex gap-2">
                <Button type="submit">Save</Button>
                <Button type="button" variant="outline" onClick={handleDialogClose}>Cancel</Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Size</TableHead>
              <TableHead>Cost</TableHead>
              <TableHead>Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {packagingCosts.map((item) => (
              <TableRow key={item.id}>
                <TableCell>{item.size}</TableCell>
                <TableCell>NGN {item.cost.toFixed(2)}</TableCell>
                <TableCell>
                  <div className="flex gap-2">
                    <Button variant="ghost" size="icon" onClick={() => handleEdit(item)}>
                      <Pencil className="w-4 h-4" />
                    </Button>
                    <Button variant="ghost" size="icon" onClick={() => handleDelete(item.id)}>
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
};

export default PackagingCosts;
