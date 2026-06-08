import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { nanoid } from "nanoid";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Plus, X, ChevronDown, ChevronUp, Import, Layers } from "lucide-react";
import type { CoffeeItem } from "@shared/schema";

export interface AddonChoice {
  id: string;
  nameAr: string;
  nameEn?: string;
  price: number;
}

export interface AddonSubGroup {
  id: string;
  nameAr: string;
  nameEn?: string;
  required: boolean;
  selectionType: 'single' | 'multi';
  minSelect: number;
  maxSelect: number;
  choices: AddonChoice[];
}

export interface AddonOption {
  id: string;
  nameAr: string;
  nameEn?: string;
  price: number;
  imageUrl?: string;
  subGroups?: AddonSubGroup[];
}

export interface AddonGroup {
  id: string;
  nameAr: string;
  nameEn?: string;
  required: boolean;
  selectionType: 'single' | 'multi';
  minSelect: number;
  maxSelect: number;
  options: AddonOption[];
}

interface Props {
  value: AddonGroup[];
  onChange: (groups: AddonGroup[]) => void;
}

function newGroup(): AddonGroup {
  return { id: nanoid(8), nameAr: '', nameEn: '', required: false, selectionType: 'single', minSelect: 0, maxSelect: 1, options: [] };
}

function newOption(): AddonOption {
  return { id: nanoid(8), nameAr: '', nameEn: '', price: 0, imageUrl: '', subGroups: [] };
}

function newSubGroup(): AddonSubGroup {
  return { id: nanoid(8), nameAr: '', nameEn: '', required: false, selectionType: 'single', minSelect: 0, maxSelect: 1, choices: [] };
}

function newChoice(): AddonChoice {
  return { id: nanoid(8), nameAr: '', nameEn: '', price: 0 };
}

export function AddonGroupsEditor({ value, onChange }: Props) {
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set());
  const [expandedOptions, setExpandedOptions] = useState<Set<string>>(new Set());
  const [importDialogOpen, setImportDialogOpen] = useState(false);
  const [selectedProductId, setSelectedProductId] = useState<string | null>(null);
  const [selectedGroupIds, setSelectedGroupIds] = useState<Set<string>>(new Set());

  const { data: allProducts = [] } = useQuery<CoffeeItem[]>({
    queryKey: ["/api/coffee-items"],
    enabled: importDialogOpen,
  });

  const productsWithGroups = allProducts.filter(p => (p as any).addonGroups?.length > 0);
  const selectedProduct = productsWithGroups.find(p => p.id === selectedProductId);
  const selectedProductGroups: AddonGroup[] = (selectedProduct as any)?.addonGroups || [];

  const toggleGroup = (id: string) => {
    setExpandedGroups(prev => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n; });
  };
  const toggleOption = (id: string) => {
    setExpandedOptions(prev => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n; });
  };

  const updateGroup = (gIdx: number, patch: Partial<AddonGroup>) => {
    const next = [...value];
    next[gIdx] = { ...next[gIdx], ...patch };
    onChange(next);
  };

  const updateOption = (gIdx: number, oIdx: number, patch: Partial<AddonOption>) => {
    const next = [...value];
    const opts = [...next[gIdx].options];
    opts[oIdx] = { ...opts[oIdx], ...patch };
    next[gIdx] = { ...next[gIdx], options: opts };
    onChange(next);
  };

  const updateSubGroup = (gIdx: number, oIdx: number, sgIdx: number, patch: Partial<AddonSubGroup>) => {
    const next = [...value];
    const opts = [...next[gIdx].options];
    const sgs = [...(opts[oIdx].subGroups || [])];
    sgs[sgIdx] = { ...sgs[sgIdx], ...patch };
    opts[oIdx] = { ...opts[oIdx], subGroups: sgs };
    next[gIdx] = { ...next[gIdx], options: opts };
    onChange(next);
  };

  const updateChoice = (gIdx: number, oIdx: number, sgIdx: number, cIdx: number, patch: Partial<AddonChoice>) => {
    const next = [...value];
    const opts = [...next[gIdx].options];
    const sgs = [...(opts[oIdx].subGroups || [])];
    const choices = [...sgs[sgIdx].choices];
    choices[cIdx] = { ...choices[cIdx], ...patch };
    sgs[sgIdx] = { ...sgs[sgIdx], choices };
    opts[oIdx] = { ...opts[oIdx], subGroups: sgs };
    next[gIdx] = { ...next[gIdx], options: opts };
    onChange(next);
  };

  const addGroup = () => {
    const g = newGroup();
    onChange([...value, g]);
    setExpandedGroups(prev => new Set([...prev, g.id]));
  };

  const removeGroup = (gIdx: number) => {
    onChange(value.filter((_, i) => i !== gIdx));
  };

  const addOption = (gIdx: number) => {
    const o = newOption();
    const next = [...value];
    next[gIdx] = { ...next[gIdx], options: [...next[gIdx].options, o] };
    onChange(next);
  };

  const removeOption = (gIdx: number, oIdx: number) => {
    const next = [...value];
    next[gIdx] = { ...next[gIdx], options: next[gIdx].options.filter((_, i) => i !== oIdx) };
    onChange(next);
  };

  const addSubGroup = (gIdx: number, oIdx: number) => {
    const sg = newSubGroup();
    const next = [...value];
    const opts = [...next[gIdx].options];
    opts[oIdx] = { ...opts[oIdx], subGroups: [...(opts[oIdx].subGroups || []), sg] };
    next[gIdx] = { ...next[gIdx], options: opts };
    onChange(next);
    setExpandedOptions(prev => new Set([...prev, opts[oIdx].id]));
  };

  const removeSubGroup = (gIdx: number, oIdx: number, sgIdx: number) => {
    const next = [...value];
    const opts = [...next[gIdx].options];
    opts[oIdx] = { ...opts[oIdx], subGroups: (opts[oIdx].subGroups || []).filter((_, i) => i !== sgIdx) };
    next[gIdx] = { ...next[gIdx], options: opts };
    onChange(next);
  };

  const addChoice = (gIdx: number, oIdx: number, sgIdx: number) => {
    const c = newChoice();
    const next = [...value];
    const opts = [...next[gIdx].options];
    const sgs = [...(opts[oIdx].subGroups || [])];
    sgs[sgIdx] = { ...sgs[sgIdx], choices: [...sgs[sgIdx].choices, c] };
    opts[oIdx] = { ...opts[oIdx], subGroups: sgs };
    next[gIdx] = { ...next[gIdx], options: opts };
    onChange(next);
  };

  const removeChoice = (gIdx: number, oIdx: number, sgIdx: number, cIdx: number) => {
    const next = [...value];
    const opts = [...next[gIdx].options];
    const sgs = [...(opts[oIdx].subGroups || [])];
    sgs[sgIdx] = { ...sgs[sgIdx], choices: sgs[sgIdx].choices.filter((_, i) => i !== cIdx) };
    opts[oIdx] = { ...opts[oIdx], subGroups: sgs };
    next[gIdx] = { ...next[gIdx], options: opts };
    onChange(next);
  };

  const handleImport = () => {
    const groupsToImport = selectedProductGroups
      .filter(g => selectedGroupIds.has(g.id))
      .map(g => ({ ...g, id: nanoid(8), options: g.options.map(o => ({ ...o, id: nanoid(8), subGroups: (o.subGroups || []).map(sg => ({ ...sg, id: nanoid(8), choices: sg.choices.map(c => ({ ...c, id: nanoid(8) })) })) })) }));
    onChange([...value, ...groupsToImport]);
    setImportDialogOpen(false);
    setSelectedProductId(null);
    setSelectedGroupIds(new Set());
  };

  const TypeBtn = ({ active, onClick, label }: { active: boolean; onClick: () => void; label: string }) => (
    <button type="button" onClick={onClick}
      className={`text-xs px-2.5 py-1 rounded border transition-colors ${active ? 'bg-primary text-white border-primary' : 'bg-white text-gray-500 border-gray-300 hover:border-primary/50'}`}>
      {label}
    </button>
  );

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <Label className="text-gray-700 font-semibold flex items-center gap-2">
          <Layers className="w-4 h-4 text-primary" />
          مجموعات الإضافات المتقدمة
        </Label>
        <div className="flex gap-2">
          <Button type="button" size="sm" variant="outline" onClick={() => setImportDialogOpen(true)}
            className="border-blue-400/40 text-blue-600 text-xs h-7 px-2" data-testid="button-import-addon-groups">
            <Import className="w-3.5 h-3.5 ml-1" />
            استيراد من منتج
          </Button>
          <Button type="button" size="sm" variant="outline" onClick={addGroup}
            className="border-primary/40 text-primary text-xs h-7 px-2" data-testid="button-add-addon-group">
            <Plus className="w-3.5 h-3.5 ml-1" />
            إضافة مجموعة
          </Button>
        </div>
      </div>

      {value.length === 0 && (
        <p className="text-xs text-gray-400 text-center py-3 border border-dashed border-gray-200 rounded-lg">
          لا توجد مجموعات إضافات — اضغط "إضافة مجموعة" لإنشاء واحدة
        </p>
      )}

      {value.map((group, gIdx) => (
        <div key={group.id} className="border border-primary/30 rounded-xl bg-white shadow-sm overflow-hidden">
          <div className="flex items-center gap-2 px-3 py-2 bg-primary/5 cursor-pointer select-none" onClick={() => toggleGroup(group.id)}>
            <span className="text-primary text-sm">📂</span>
            <span className="flex-1 text-sm font-semibold text-gray-800 truncate">{group.nameAr || 'مجموعة جديدة'}</span>
            <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${group.required ? 'bg-red-100 text-red-600' : 'bg-gray-100 text-gray-500'}`}>
              {group.required ? 'إلزامي' : 'اختياري'}
            </span>
            <span className="text-[10px] text-gray-400">
              {group.selectionType === 'single' ? '◉ واحد' : `☑ ${group.minSelect}–${group.maxSelect}`}
            </span>
            <span className="text-[10px] text-gray-400">{group.options.length} خيار</span>
            {expandedGroups.has(group.id) ? <ChevronUp className="w-3.5 h-3.5 text-gray-400 shrink-0" /> : <ChevronDown className="w-3.5 h-3.5 text-gray-400 shrink-0" />}
            <button type="button" onClick={(e) => { e.stopPropagation(); removeGroup(gIdx); }} className="text-red-400 hover:text-red-600 shrink-0" data-testid={`btn-remove-group-${gIdx}`}>
              <X className="w-3.5 h-3.5" />
            </button>
          </div>

          {expandedGroups.has(group.id) && (
            <div className="p-3 space-y-3">
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <Label className="text-xs text-gray-500 mb-1">اسم المجموعة (عربي) *</Label>
                  <Input value={group.nameAr} onChange={e => updateGroup(gIdx, { nameAr: e.target.value })}
                    placeholder="مثال: إضافة المنجا" className="h-8 text-sm border-gray-300" data-testid={`input-group-name-ar-${gIdx}`} />
                </div>
                <div>
                  <Label className="text-xs text-gray-500 mb-1">اسم المجموعة (إنجليزي)</Label>
                  <Input value={group.nameEn || ''} onChange={e => updateGroup(gIdx, { nameEn: e.target.value })}
                    placeholder="e.g. Mango Add-on" className="h-8 text-sm border-gray-300" dir="ltr" data-testid={`input-group-name-en-${gIdx}`} />
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-3">
                <div className="flex items-center gap-1">
                  <Label className="text-xs text-gray-500">نوع الاختيار:</Label>
                  <TypeBtn active={group.selectionType === 'single'} onClick={() => updateGroup(gIdx, { selectionType: 'single', minSelect: 0, maxSelect: 1 })} label="◉ واحد فقط" />
                  <TypeBtn active={group.selectionType === 'multi'} onClick={() => updateGroup(gIdx, { selectionType: 'multi' })} label="☑ متعدد" />
                </div>
                {group.selectionType === 'multi' && (
                  <div className="flex items-center gap-1.5">
                    <Label className="text-xs text-gray-500">الحد:</Label>
                    <Input type="number" min={0} value={group.minSelect} onChange={e => updateGroup(gIdx, { minSelect: parseInt(e.target.value) || 0 })}
                      className="w-14 h-7 text-xs text-center border-gray-300" data-testid={`input-group-min-${gIdx}`} />
                    <span className="text-xs text-gray-400">إلى</span>
                    <Input type="number" min={1} value={group.maxSelect} onChange={e => updateGroup(gIdx, { maxSelect: parseInt(e.target.value) || 1 })}
                      className="w-14 h-7 text-xs text-center border-gray-300" data-testid={`input-group-max-${gIdx}`} />
                  </div>
                )}
                <div className="flex items-center gap-1">
                  <Label className="text-xs text-gray-500">إلزامي:</Label>
                  <TypeBtn active={group.required} onClick={() => updateGroup(gIdx, { required: true })} label="نعم" />
                  <TypeBtn active={!group.required} onClick={() => updateGroup(gIdx, { required: false })} label="لا" />
                </div>
              </div>

              <div className="space-y-2">
                <Label className="text-xs font-semibold text-gray-600">الخيارات</Label>
                {group.options.map((option, oIdx) => (
                  <div key={option.id} className="border border-gray-200 rounded-lg bg-gray-50/50 overflow-hidden">
                    <div className="flex items-center gap-2 px-2.5 py-1.5">
                      <div className="flex-1 grid grid-cols-2 gap-1.5">
                        <Input value={option.nameAr} onChange={e => updateOption(gIdx, oIdx, { nameAr: e.target.value })}
                          placeholder="اسم الخيار (عربي)" className="h-7 text-xs border-gray-300" data-testid={`input-opt-ar-${gIdx}-${oIdx}`} />
                        <Input value={option.nameEn || ''} onChange={e => updateOption(gIdx, oIdx, { nameEn: e.target.value })}
                          placeholder="Option name (EN)" className="h-7 text-xs border-gray-300" dir="ltr" data-testid={`input-opt-en-${gIdx}-${oIdx}`} />
                      </div>
                      <div className="flex items-center gap-1 shrink-0">
                        <span className="text-xs text-gray-400">+</span>
                        <Input type="number" min={0} value={option.price} onChange={e => updateOption(gIdx, oIdx, { price: parseFloat(e.target.value) || 0 })}
                          className="w-16 h-7 text-xs text-center border-gray-300" data-testid={`input-opt-price-${gIdx}-${oIdx}`} />
                        <span className="text-xs text-gray-400">ر.س</span>
                      </div>
                      <button type="button" onClick={() => toggleOption(option.id)}
                        className="text-blue-400 hover:text-blue-600 shrink-0 text-[10px] border border-blue-200 rounded px-1.5 py-0.5" data-testid={`btn-toggle-opt-${gIdx}-${oIdx}`}>
                        {(option.subGroups?.length || 0) > 0 ? `${option.subGroups!.length} سؤال` : 'سؤال فرعي'}
                      </button>
                      <button type="button" onClick={() => removeOption(gIdx, oIdx)} className="text-red-400 hover:text-red-600 shrink-0" data-testid={`btn-remove-opt-${gIdx}-${oIdx}`}>
                        <X className="w-3.5 h-3.5" />
                      </button>
                    </div>

                    {expandedOptions.has(option.id) && (
                      <div className="border-t border-gray-200 bg-blue-50/30 p-2.5 space-y-2">
                        <div className="flex items-center justify-between">
                          <Label className="text-[11px] font-semibold text-blue-700">أسئلة فرعية لـ "{option.nameAr || 'هذا الخيار'}"</Label>
                          <button type="button" onClick={() => addSubGroup(gIdx, oIdx)}
                            className="text-[11px] text-blue-600 hover:underline flex items-center gap-0.5" data-testid={`btn-add-subgroup-${gIdx}-${oIdx}`}>
                            <Plus className="w-3 h-3" /> إضافة سؤال
                          </button>
                        </div>
                        {(option.subGroups || []).map((sg, sgIdx) => (
                          <div key={sg.id} className="border border-blue-200 rounded-lg bg-white p-2 space-y-2">
                            <div className="flex items-center gap-2">
                              <Input value={sg.nameAr} onChange={e => updateSubGroup(gIdx, oIdx, sgIdx, { nameAr: e.target.value })}
                                placeholder="نص السؤال الفرعي (عربي)" className="h-7 text-xs border-gray-300 flex-1" data-testid={`input-sg-ar-${gIdx}-${oIdx}-${sgIdx}`} />
                              <Input value={sg.nameEn || ''} onChange={e => updateSubGroup(gIdx, oIdx, sgIdx, { nameEn: e.target.value })}
                                placeholder="Sub-question (EN)" className="h-7 text-xs border-gray-300 flex-1" dir="ltr" data-testid={`input-sg-en-${gIdx}-${oIdx}-${sgIdx}`} />
                              <button type="button" onClick={() => removeSubGroup(gIdx, oIdx, sgIdx)} className="text-red-400 hover:text-red-600 shrink-0" data-testid={`btn-remove-sg-${gIdx}-${oIdx}-${sgIdx}`}>
                                <X className="w-3 h-3" />
                              </button>
                            </div>
                            <div className="flex flex-wrap gap-2 items-center">
                              <div className="flex gap-0.5">
                                <TypeBtn active={sg.selectionType === 'single'} onClick={() => updateSubGroup(gIdx, oIdx, sgIdx, { selectionType: 'single', maxSelect: 1 })} label="◉ واحد" />
                                <TypeBtn active={sg.selectionType === 'multi'} onClick={() => updateSubGroup(gIdx, oIdx, sgIdx, { selectionType: 'multi' })} label="☑ متعدد" />
                              </div>
                              {sg.selectionType === 'multi' && (
                                <div className="flex items-center gap-1">
                                  <Input type="number" min={0} value={sg.minSelect} onChange={e => updateSubGroup(gIdx, oIdx, sgIdx, { minSelect: parseInt(e.target.value) || 0 })}
                                    className="w-12 h-6 text-xs text-center border-gray-300" />
                                  <span className="text-xs text-gray-400">–</span>
                                  <Input type="number" min={1} value={sg.maxSelect} onChange={e => updateSubGroup(gIdx, oIdx, sgIdx, { maxSelect: parseInt(e.target.value) || 1 })}
                                    className="w-12 h-6 text-xs text-center border-gray-300" />
                                </div>
                              )}
                              <TypeBtn active={sg.required} onClick={() => updateSubGroup(gIdx, oIdx, sgIdx, { required: true })} label="إلزامي" />
                              <TypeBtn active={!sg.required} onClick={() => updateSubGroup(gIdx, oIdx, sgIdx, { required: false })} label="اختياري" />
                            </div>
                            <div className="space-y-1">
                              {sg.choices.map((ch, cIdx) => (
                                <div key={ch.id} className="flex gap-1.5 items-center">
                                  <Input value={ch.nameAr} onChange={e => updateChoice(gIdx, oIdx, sgIdx, cIdx, { nameAr: e.target.value })}
                                    placeholder="خيار (عربي)" className="h-6 text-xs border-gray-300 flex-1" data-testid={`input-ch-ar-${gIdx}-${oIdx}-${sgIdx}-${cIdx}`} />
                                  <Input value={ch.nameEn || ''} onChange={e => updateChoice(gIdx, oIdx, sgIdx, cIdx, { nameEn: e.target.value })}
                                    placeholder="Choice (EN)" className="h-6 text-xs border-gray-300 flex-1" dir="ltr" data-testid={`input-ch-en-${gIdx}-${oIdx}-${sgIdx}-${cIdx}`} />
                                  <Input type="number" min={0} value={ch.price} onChange={e => updateChoice(gIdx, oIdx, sgIdx, cIdx, { price: parseFloat(e.target.value) || 0 })}
                                    className="w-14 h-6 text-xs text-center border-gray-300" placeholder="0" data-testid={`input-ch-price-${gIdx}-${oIdx}-${sgIdx}-${cIdx}`} />
                                  <button type="button" onClick={() => removeChoice(gIdx, oIdx, sgIdx, cIdx)} className="text-red-400 hover:text-red-600 shrink-0">
                                    <X className="w-3 h-3" />
                                  </button>
                                </div>
                              ))}
                              <button type="button" onClick={() => addChoice(gIdx, oIdx, sgIdx)}
                                className="text-[11px] text-blue-500 hover:underline flex items-center gap-0.5 pr-0.5" data-testid={`btn-add-choice-${gIdx}-${oIdx}-${sgIdx}`}>
                                <Plus className="w-3 h-3" /> إضافة خيار
                              </button>
                            </div>
                          </div>
                        ))}
                        {(option.subGroups || []).length === 0 && (
                          <p className="text-[11px] text-gray-400 text-center">لا توجد أسئلة فرعية — اضغط "إضافة سؤال" لتوليد خيارات مثل "مقطع؟"</p>
                        )}
                      </div>
                    )}
                  </div>
                ))}
                <button type="button" onClick={() => addOption(gIdx)}
                  className="w-full text-xs text-primary hover:underline flex items-center justify-center gap-1 py-1.5 border border-dashed border-primary/30 rounded-lg" data-testid={`btn-add-option-${gIdx}`}>
                  <Plus className="w-3.5 h-3.5" /> إضافة خيار لهذه المجموعة
                </button>
              </div>
            </div>
          )}
        </div>
      ))}

      <Dialog open={importDialogOpen} onOpenChange={open => { setImportDialogOpen(open); if (!open) { setSelectedProductId(null); setSelectedGroupIds(new Set()); } }}>
        <DialogContent className="max-w-lg bg-white text-gray-900">
          <DialogHeader>
            <DialogTitle className="text-gray-800 flex items-center gap-2">
              <Import className="w-4 h-4 text-primary" />
              استيراد مجموعات إضافات من منتج آخر
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 max-h-[60vh] overflow-y-auto">
            {productsWithGroups.length === 0 ? (
              <p className="text-sm text-gray-500 text-center py-6">لا توجد منتجات بها مجموعات إضافات متقدمة حتى الآن</p>
            ) : (
              <>
                <div>
                  <Label className="text-sm text-gray-600 mb-1.5">اختر المنتج</Label>
                  <div className="grid grid-cols-2 gap-2">
                    {productsWithGroups.map(p => (
                      <button key={p.id} type="button"
                        onClick={() => { setSelectedProductId(p.id); setSelectedGroupIds(new Set()); }}
                        className={`text-sm px-3 py-2 rounded-lg border transition-all text-right ${selectedProductId === p.id ? 'bg-primary text-white border-primary' : 'bg-gray-50 border-gray-200 hover:border-primary/50 text-gray-700'}`}
                        data-testid={`btn-import-product-${p.id}`}>
                        {p.nameAr}
                        <span className={`text-[10px] block ${selectedProductId === p.id ? 'text-white/70' : 'text-gray-400'}`}>
                          {((p as any).addonGroups || []).length} مجموعة
                        </span>
                      </button>
                    ))}
                  </div>
                </div>

                {selectedProduct && selectedProductGroups.length > 0 && (
                  <div>
                    <Label className="text-sm text-gray-600 mb-1.5">اختر المجموعات للاستيراد</Label>
                    <div className="space-y-2">
                      {selectedProductGroups.map(g => (
                        <label key={g.id} className={`flex items-start gap-3 p-2.5 rounded-lg border cursor-pointer transition-all ${selectedGroupIds.has(g.id) ? 'border-primary bg-primary/5' : 'border-gray-200 hover:border-primary/30'}`}>
                          <input type="checkbox" checked={selectedGroupIds.has(g.id)}
                            onChange={e => { const n = new Set(selectedGroupIds); e.target.checked ? n.add(g.id) : n.delete(g.id); setSelectedGroupIds(n); }}
                            className="mt-0.5" data-testid={`check-import-group-${g.id}`} />
                          <div className="flex-1 min-w-0">
                            <div className="font-medium text-sm text-gray-800">{g.nameAr}</div>
                            {g.nameEn && <div className="text-xs text-gray-400 dir-ltr">{g.nameEn}</div>}
                            <div className="text-xs text-gray-500 mt-0.5">
                              {g.options.length} خيار · {g.selectionType === 'single' ? 'اختيار واحد' : `اختيار ${g.minSelect}–${g.maxSelect}`} · {g.required ? 'إلزامي' : 'اختياري'}
                            </div>
                            <div className="flex flex-wrap gap-1 mt-1">
                              {g.options.slice(0, 4).map(o => (
                                <span key={o.id} className="text-[10px] bg-gray-100 text-gray-600 px-1.5 py-0.5 rounded">{o.nameAr}{o.price > 0 ? ` +${o.price}` : ''}</span>
                              ))}
                              {g.options.length > 4 && <span className="text-[10px] text-gray-400">+{g.options.length - 4}</span>}
                            </div>
                          </div>
                        </label>
                      ))}
                    </div>
                  </div>
                )}
              </>
            )}
          </div>
          <div className="flex gap-2 pt-2 border-t border-gray-100">
            <Button variant="outline" onClick={() => setImportDialogOpen(false)} className="flex-1">إلغاء</Button>
            <Button onClick={handleImport} disabled={selectedGroupIds.size === 0}
              className="flex-1 bg-primary hover:bg-primary/90" data-testid="btn-confirm-import">
              استيراد {selectedGroupIds.size > 0 ? `(${selectedGroupIds.size})` : ''}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
