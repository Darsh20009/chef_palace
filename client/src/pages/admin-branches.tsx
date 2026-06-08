import { useState, useCallback } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { useTranslate } from "@/lib/useTranslate";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from "@/components/ui/dialog";
import { Plus, MapPin, Phone, User, Store, ArrowRight, Loader2, Edit2, Trash2, Pentagon, Navigation, CheckCircle2, Map } from 'lucide-react';
import BranchMapPicker from '@/components/branch-map-picker';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { useLocation } from 'wouter';

interface Branch {
  id: string;
  nameAr: string;
  nameEn?: string;
  address?: string;
  phone?: string;
  managerName?: string;
  location?: { lat: number; lng: number };
  geofenceRadius?: number;
  geofenceBoundary?: Array<{ lat: number; lng: number }>;
  lateThresholdMinutes?: number;
  workingHours?: { open: string; close: string };
}

export default function AdminBranches() {
  const tc = useTranslate();
  const { toast } = useToast();
  const [, navigate] = useLocation();

  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [isMapDialogOpen, setIsMapDialogOpen] = useState(false);
  const [selectedBranch, setSelectedBranch] = useState<Branch | null>(null);

  const [formData, setFormData] = useState({
    nameAr: '',
    nameEn: '',
    address: '',
    phone: '',
    locationLat: '',
    locationLng: '',
    geofenceRadius: '200',
    lateThresholdMinutes: '15',
    workingHoursOpen: '08:00',
    workingHoursClose: '23:00',
  });
  const [geofenceBoundary, setGeofenceBoundary] = useState<Array<{ lat: number; lng: number }>>([]);

  const handleBoundaryChange = useCallback((points: Array<{ lat: number; lng: number }>) => {
    setGeofenceBoundary(points);
  }, []);

  const { data: branches = [], isLoading } = useQuery<Branch[]>({
    queryKey: ['/api/branches'],
  });

  const createMutation = useMutation({
    mutationFn: (data: any) => apiRequest('POST', '/api/branches', data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/branches'] });
      toast({ title: tc("تم إنشاء الفرع بنجاح", "Branch created successfully") });
      setIsAddDialogOpen(false);
      resetFormData();
    },
    onError: (error: any) => {
      toast({ title: tc("خطأ في إنشاء الفرع", "Error creating branch"), description: error?.message, variant: "destructive" });
    }
  });

  const updateMutation = useMutation({
    mutationFn: (data: { id: string; updates: any }) =>
      apiRequest('PUT', `/api/branches/${data.id}`, data.updates),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/branches'] });
      toast({ title: tc("تم تحديث الفرع بنجاح", "Branch updated successfully") });
      setIsEditDialogOpen(false);
      setSelectedBranch(null);
      resetFormData();
    },
    onError: (error: any) => {
      toast({ title: tc("خطأ في تحديث الفرع", "Error updating branch"), description: error?.message, variant: "destructive" });
    }
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => apiRequest('DELETE', `/api/branches/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/branches'] });
      toast({ title: tc("تم حذف الفرع بنجاح", "Branch deleted successfully") });
      setDeleteDialogOpen(false);
      setSelectedBranch(null);
    },
    onError: (error: any) => {
      toast({ title: tc("خطأ في حذف الفرع", "Error deleting branch"), description: error?.message, variant: "destructive" });
    }
  });

  const handleEdit = (branch: Branch) => {
    setSelectedBranch(branch);
    setFormData({
      nameAr: branch.nameAr || '',
      nameEn: branch.nameEn || '',
      address: branch.address || '',
      phone: branch.phone || '',
      locationLat: branch.location?.lat?.toString() || '',
      locationLng: branch.location?.lng?.toString() || '',
      geofenceRadius: branch.geofenceRadius?.toString() || '200',
      lateThresholdMinutes: branch.lateThresholdMinutes?.toString() || '15',
      workingHoursOpen: branch.workingHours?.open || '08:00',
      workingHoursClose: branch.workingHours?.close || '23:00',
    });
    setGeofenceBoundary(branch.geofenceBoundary || []);
    setIsEditDialogOpen(true);
  };

  const handleDelete = (branch: Branch) => {
    setSelectedBranch(branch);
    setDeleteDialogOpen(true);
  };

  const handleEditSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedBranch) return;
    const branchId = selectedBranch.id;
    if (!branchId) return;
    updateMutation.mutate({ id: branchId, updates: prepareSubmitData() });
  };

  const confirmDelete = () => {
    if (!selectedBranch) return;
    const branchId = selectedBranch.id;
    if (!branchId) return;
    deleteMutation.mutate(branchId);
  };

  const resetFormData = () => {
    setFormData({
      nameAr: '',
      nameEn: '',
      address: '',
      phone: '',
      locationLat: '',
      locationLng: '',
      geofenceRadius: '200',
      lateThresholdMinutes: '15',
      workingHoursOpen: '08:00',
      workingHoursClose: '23:00',
    });
    setGeofenceBoundary([]);
  };

  const prepareSubmitData = () => {
    return {
      nameAr: formData.nameAr,
      nameEn: formData.nameEn,
      address: formData.address,
      phone: formData.phone,
      location: formData.locationLat && formData.locationLng ? {
        lat: parseFloat(formData.locationLat),
        lng: parseFloat(formData.locationLng),
      } : undefined,
      geofenceRadius: parseInt(formData.geofenceRadius) || 200,
      geofenceBoundary: geofenceBoundary.length >= 3 ? geofenceBoundary : undefined,
      lateThresholdMinutes: parseInt(formData.lateThresholdMinutes) || 15,
      workingHours: {
        open: formData.workingHoursOpen,
        close: formData.workingHoursClose,
      },
    };
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.nameAr.trim()) {
      toast({ title: tc("خطأ", "Error"), description: tc("يجب إدخال اسم الفرع بالعربية", "Branch name in Arabic is required"), variant: "destructive" });
      return;
    }
    createMutation.mutate(prepareSubmitData());
  };

  const hasLocation = formData.locationLat && formData.locationLng;
  const hasGeofence = geofenceBoundary.length >= 3;

  function LocationCard() {
    return (
      <div className="border rounded-xl p-4 space-y-3 bg-muted/30">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <MapPin className="w-4 h-4 text-accent" />
            <span className="font-medium text-sm">{tc("موقع الفرع والجيوفينس", "Location & Geofence")}</span>
          </div>
          <Button
            type="button"
            size="sm"
            variant="outline"
            onClick={() => setIsMapDialogOpen(true)}
            className="flex items-center gap-1.5"
            data-testid="button-open-map"
          >
            <Map className="w-4 h-4" />
            {hasLocation ? tc("تعديل الخريطة", "Edit Map") : tc("تحديد على الخريطة", "Select on Map")}
          </Button>
        </div>

        {hasLocation ? (
          <div className="space-y-2">
            <div className="flex items-center gap-2 text-sm text-green-600 dark:text-green-400">
              <CheckCircle2 className="w-4 h-4" />
              <span>{tc("تم تحديد الموقع", "Location selected")}</span>
            </div>
            <div className="grid grid-cols-2 gap-2 text-xs text-muted-foreground bg-background rounded-lg px-3 py-2 border">
              <span>خط العرض: <strong className="text-foreground">{parseFloat(formData.locationLat).toFixed(5)}</strong></span>
              <span>خط الطول: <strong className="text-foreground">{parseFloat(formData.locationLng).toFixed(5)}</strong></span>
            </div>
            {hasGeofence && (
              <div className="flex items-center gap-2 text-sm text-blue-600 dark:text-blue-400">
                <Pentagon className="w-4 h-4" />
                <span>{tc(`تم رسم حدود الجيوفينس (${geofenceBoundary.length} نقطة)`, `Geofence drawn (${geofenceBoundary.length} points)`)}</span>
              </div>
            )}
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">
            {tc("لم يتم تحديد موقع بعد. اضغط على الزر لتحديد موقع الفرع على الخريطة.", "No location selected yet. Click the button to set the branch location on the map.")}
          </p>
        )}
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6 bg-white dark:bg-background min-h-screen">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => navigate('/admin/dashboard')}>
            <ArrowRight className="w-5 h-5" />
          </Button>
          <div>
            <h1 className="text-3xl font-bold">{tc("إدارة الفروع", "Branch Management")}</h1>
            <p className="text-muted-foreground mt-1">{tc("إضافة وتعديل فروع المقهى", "Add and edit cafe branches")}</p>
          </div>
        </div>
        <Button
          onClick={() => { resetFormData(); setIsAddDialogOpen(true); }}
          className="bg-accent hover:bg-accent"
          data-testid="button-add-branch"
        >
          <Plus className="w-4 h-4 ml-2" />
          {tc("إضافة فرع جديد", "Add New Branch")}
        </Button>
      </div>

      {/* ═══ Branches Grid ═══ */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {isLoading ? (
          <div className="col-span-full text-center py-12">
            <Loader2 className="w-8 h-8 animate-spin mx-auto text-accent" />
            <p className="mt-2 text-muted-foreground">{tc("جاري تحميل الفروع...", "Loading branches...")}</p>
          </div>
        ) : branches && branches.length > 0 ? (
          branches.map((branch) => {
            const branchId = branch.id;
            return (
              <Card key={branchId} className="hover:shadow-md transition-shadow border-border">
                <CardHeader className="pb-2">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-xl font-bold">{branch.nameAr}</CardTitle>
                    <Store className="w-5 h-5 text-accent" />
                  </div>
                  {branch.nameEn && <CardDescription>{branch.nameEn}</CardDescription>}
                </CardHeader>
                <CardContent className="space-y-3">
                  {branch.address && (
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <MapPin className="w-4 h-4" />
                      {branch.address}
                    </div>
                  )}
                  {branch.phone && (
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <Phone className="w-4 h-4" />
                      {branch.phone}
                    </div>
                  )}
                  {branch.managerName && (
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <User className="w-4 h-4" />
                      {tc("المدير:", "Manager:")} {branch.managerName}
                    </div>
                  )}
                  {branch.location && (
                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                      <Navigation className="w-3 h-3" />
                      <span>{branch.location.lat.toFixed(4)}, {branch.location.lng.toFixed(4)}</span>
                      {branch.geofenceBoundary && branch.geofenceBoundary.length >= 3 && (
                        <span className="bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 text-xs px-1.5 py-0.5 rounded">جيوفينس</span>
                      )}
                    </div>
                  )}
                  <div className="flex gap-2 pt-2 border-t">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleEdit(branch)}
                      className="flex-1"
                      data-testid={`button-edit-branch-${branchId}`}
                    >
                      <Edit2 className="w-4 h-4 ml-1" />
                      {tc("تعديل", "Edit")}
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleDelete(branch)}
                      className="flex-1 text-destructive hover:text-destructive"
                      data-testid={`button-delete-branch-${branchId}`}
                    >
                      <Trash2 className="w-4 h-4 ml-1" />
                      {tc("حذف", "Delete")}
                    </Button>
                  </div>
                </CardContent>
              </Card>
            );
          })
        ) : (
          <div className="col-span-full text-center py-12 bg-gray-50 dark:bg-card rounded-xl border-2 border-dashed border-gray-200 dark:border-slate-800">
            <Store className="w-12 h-12 mx-auto text-gray-300 mb-3" />
            <h3 className="text-lg font-semibold">{tc("لا توجد فروع مضافة", "No branches added")}</h3>
            <p className="text-muted-foreground">{tc("ابدأ بإضافة أول فرع للمقهى الخاص بك", "Start by adding your first branch")}</p>
          </div>
        )}
      </div>

      {/* ═══ Add Branch Dialog ═══ */}
      <Dialog open={isAddDialogOpen} onOpenChange={(v) => { setIsAddDialogOpen(v); if (!v) resetFormData(); }}>
        <DialogContent className="max-w-2xl flex flex-col max-h-[92vh]">
          <DialogHeader className="flex-shrink-0 border-b pb-4">
            <DialogTitle>{tc("إضافة فرع جديد", "Add New Branch")}</DialogTitle>
            <DialogDescription>
              {tc("سيتم إنشاء حساب مدير للفرع تلقائياً عند الحفظ", "A manager account will be created automatically upon saving")}
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleSubmit} className="flex flex-col flex-1 min-h-0">
            <div className="flex-1 overflow-y-auto py-4 px-1 space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="nameAr">{tc("اسم الفرع (بالعربية) *", "Branch Name (Arabic) *")}</Label>
                  <Input id="nameAr" required value={formData.nameAr} onChange={(e) => setFormData({ ...formData, nameAr: e.target.value })} placeholder="فرع المربع" data-testid="input-nameAr" />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="nameEn">{tc("اسم الفرع (بالإنجليزي)", "Branch Name (English)")}</Label>
                  <Input id="nameEn" value={formData.nameEn} onChange={(e) => setFormData({ ...formData, nameEn: e.target.value })} placeholder="Al-Murabba Branch" data-testid="input-nameEn" />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="address">{tc("العنوان", "Address")}</Label>
                  <Input id="address" value={formData.address} onChange={(e) => setFormData({ ...formData, address: e.target.value })} placeholder={tc("الرياض، طريق الملك فهد", "Riyadh, King Fahd Road")} data-testid="input-address" />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="phone">{tc("رقم الهاتف", "Phone Number")}</Label>
                  <Input id="phone" value={formData.phone} onChange={(e) => setFormData({ ...formData, phone: e.target.value })} placeholder="0501234567" data-testid="input-phone" />
                </div>
              </div>

              <LocationCard />

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="geofenceRadius">{tc("نطاق دائري (متر)", "Circle Radius (m)")}</Label>
                  <Input id="geofenceRadius" type="number" value={formData.geofenceRadius} onChange={(e) => setFormData({ ...formData, geofenceRadius: e.target.value })} placeholder="200" data-testid="input-geofenceRadius" />
                  <p className="text-xs text-muted-foreground">{tc("يُستخدم إذا لم ترسم حدود", "Used if no polygon drawn")}</p>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="lateThresholdMinutes">{tc("عتبة التأخير (دقيقة)", "Late Threshold (min)")}</Label>
                  <Input id="lateThresholdMinutes" type="number" value={formData.lateThresholdMinutes} onChange={(e) => setFormData({ ...formData, lateThresholdMinutes: e.target.value })} placeholder="15" data-testid="input-lateThreshold" />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="workingHoursOpen">{tc("وقت الافتتاح", "Opening Time")}</Label>
                  <Input id="workingHoursOpen" type="time" value={formData.workingHoursOpen} onChange={(e) => setFormData({ ...formData, workingHoursOpen: e.target.value })} data-testid="input-openTime" />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="workingHoursClose">{tc("وقت الإغلاق", "Closing Time")}</Label>
                  <Input id="workingHoursClose" type="time" value={formData.workingHoursClose} onChange={(e) => setFormData({ ...formData, workingHoursClose: e.target.value })} data-testid="input-closeTime" />
                </div>
              </div>
            </div>

            <DialogFooter className="flex-shrink-0 border-t pt-4">
              <Button type="button" variant="outline" onClick={() => setIsAddDialogOpen(false)}>{tc("إلغاء", "Cancel")}</Button>
              <Button type="submit" className="bg-accent hover:bg-accent" disabled={createMutation.isPending} data-testid="button-save-branch">
                {createMutation.isPending ? <><Loader2 className="w-4 h-4 animate-spin ml-2" />{tc("جاري الحفظ...", "Saving...")}</> : <><Plus className="w-4 h-4 ml-2" />{tc("حفظ الفرع", "Save Branch")}</>}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* ═══ Edit Branch Dialog ═══ */}
      <Dialog open={isEditDialogOpen} onOpenChange={(open) => { setIsEditDialogOpen(open); if (!open) { setSelectedBranch(null); resetFormData(); } }}>
        <DialogContent className="max-w-2xl flex flex-col max-h-[92vh]">
          <DialogHeader className="flex-shrink-0 border-b pb-4">
            <DialogTitle>{tc("تعديل الفرع", "Edit Branch")}</DialogTitle>
            <DialogDescription>{tc("تعديل بيانات الفرع", "Update branch details")}</DialogDescription>
          </DialogHeader>

          <form onSubmit={handleEditSubmit} className="flex flex-col flex-1 min-h-0">
            <div className="flex-1 overflow-y-auto py-4 px-1 space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="edit-nameAr">{tc("اسم الفرع (بالعربية) *", "Branch Name (Arabic) *")}</Label>
                  <Input id="edit-nameAr" required value={formData.nameAr} onChange={(e) => setFormData({ ...formData, nameAr: e.target.value })} placeholder="فرع المربع" data-testid="input-edit-nameAr" />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="edit-nameEn">{tc("اسم الفرع (بالإنجليزي)", "Branch Name (English)")}</Label>
                  <Input id="edit-nameEn" value={formData.nameEn} onChange={(e) => setFormData({ ...formData, nameEn: e.target.value })} placeholder="Al-Murabba Branch" data-testid="input-edit-nameEn" />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="edit-address">{tc("العنوان", "Address")}</Label>
                  <Input id="edit-address" value={formData.address} onChange={(e) => setFormData({ ...formData, address: e.target.value })} placeholder="الرياض، طريق الملك فهد" data-testid="input-edit-address" />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="edit-phone">{tc("رقم الهاتف", "Phone Number")}</Label>
                  <Input id="edit-phone" value={formData.phone} onChange={(e) => setFormData({ ...formData, phone: e.target.value })} placeholder="0501234567" data-testid="input-edit-phone" />
                </div>
              </div>

              <LocationCard />

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>{tc("نطاق دائري (متر)", "Circle Radius (m)")}</Label>
                  <Input type="number" value={formData.geofenceRadius} onChange={(e) => setFormData({ ...formData, geofenceRadius: e.target.value })} placeholder="200" data-testid="input-edit-radius" />
                  <p className="text-xs text-muted-foreground">{tc("يُستخدم إذا لم ترسم حدود", "Used if no polygon drawn")}</p>
                </div>
                <div className="space-y-2">
                  <Label>{tc("عتبة التأخير (دقيقة)", "Late Threshold (min)")}</Label>
                  <Input type="number" value={formData.lateThresholdMinutes} onChange={(e) => setFormData({ ...formData, lateThresholdMinutes: e.target.value })} placeholder="15" data-testid="input-edit-lateThreshold" />
                </div>
                <div className="space-y-2">
                  <Label>{tc("وقت الافتتاح", "Opening Time")}</Label>
                  <Input type="time" value={formData.workingHoursOpen} onChange={(e) => setFormData({ ...formData, workingHoursOpen: e.target.value })} data-testid="input-edit-openTime" />
                </div>
                <div className="space-y-2">
                  <Label>{tc("وقت الإغلاق", "Closing Time")}</Label>
                  <Input type="time" value={formData.workingHoursClose} onChange={(e) => setFormData({ ...formData, workingHoursClose: e.target.value })} data-testid="input-edit-closeTime" />
                </div>
              </div>
            </div>

            <DialogFooter className="flex-shrink-0 border-t pt-4">
              <Button type="button" variant="outline" onClick={() => setIsEditDialogOpen(false)}>{tc("إلغاء", "Cancel")}</Button>
              <Button type="submit" className="bg-accent hover:bg-accent" disabled={updateMutation.isPending} data-testid="button-save-edit">
                {updateMutation.isPending ? <><Loader2 className="w-4 h-4 animate-spin ml-2" />{tc("جاري الحفظ...", "Saving...")}</> : <><Edit2 className="w-4 h-4 ml-2" />{tc("حفظ التعديلات", "Save Changes")}</>}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* ═══ Map Dialog (Full Screen) ═══ */}
      <Dialog open={isMapDialogOpen} onOpenChange={setIsMapDialogOpen}>
        <DialogContent className="max-w-3xl w-full flex flex-col" style={{ height: '90vh', maxHeight: '90vh' }}>
          <DialogHeader className="flex-shrink-0 pb-2">
            <DialogTitle className="flex items-center gap-2">
              <Map className="w-5 h-5 text-accent" />
              {tc("تحديد موقع الفرع والحدود الجغرافية", "Set Branch Location & Geofence")}
            </DialogTitle>
            <DialogDescription>
              {tc("اضغط على الخريطة لتحديد الموقع، أو ارسم حدود الجيوفينس", "Click the map to set location, or draw geofence boundary")}
            </DialogDescription>
          </DialogHeader>

          <div className="flex-1 min-h-0 overflow-hidden">
            <BranchMapPicker
              initialLat={formData.locationLat ? parseFloat(formData.locationLat) : undefined}
              initialLng={formData.locationLng ? parseFloat(formData.locationLng) : undefined}
              initialPoints={geofenceBoundary}
              geofenceRadius={formData.geofenceRadius ? parseInt(formData.geofenceRadius) : undefined}
              onLocationSelect={(lat, lng) => setFormData(f => ({ ...f, locationLat: lat.toString(), locationLng: lng.toString() }))}
              onBoundaryChange={handleBoundaryChange}
            />
          </div>

          <DialogFooter className="flex-shrink-0 border-t pt-4">
            <div className="flex items-center gap-3 w-full">
              {hasLocation && (
                <span className="flex items-center gap-1.5 text-sm text-green-600 dark:text-green-400 ml-auto">
                  <CheckCircle2 className="w-4 h-4" />
                  {tc("تم تحديد الموقع", "Location set")}
                  {hasGeofence && ` · ${geofenceBoundary.length} ${tc("نقاط حدود", "boundary points")}`}
                </span>
              )}
              <Button
                type="button"
                onClick={() => setIsMapDialogOpen(false)}
                className="bg-accent hover:bg-accent mr-auto"
                data-testid="button-confirm-map"
              >
                <CheckCircle2 className="w-4 h-4 ml-2" />
                {tc("تأكيد وإغلاق", "Confirm & Close")}
              </Button>
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ═══ Delete Confirmation ═══ */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{tc("تأكيد حذف الفرع", "Confirm Branch Deletion")}</AlertDialogTitle>
            <AlertDialogDescription>
              {tc(`هل أنت متأكد من حذف فرع "${selectedBranch?.nameAr}"؟ هذا الإجراء لا يمكن التراجع عنه.`,
                `Are you sure you want to delete branch "${selectedBranch?.nameAr}"? This action cannot be undone.`)}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{tc("إلغاء", "Cancel")}</AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmDelete}
              className="bg-destructive hover:bg-destructive/90"
              data-testid="button-confirm-delete"
            >
              {deleteMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : tc("حذف", "Delete")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
