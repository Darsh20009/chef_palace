import { useState, useEffect } from "react";
import { useTranslation } from "react-i18next";
import type { AddonGroup, AddonOption, AddonSubGroup, AddonChoice } from "./addon-groups-editor";

export interface SelectedAddonGroupOption {
  optionId: string;
  optionNameAr: string;
  optionNameEn?: string;
  price: number;
  subSelections?: Array<{
    subGroupId: string;
    subGroupNameAr: string;
    choiceId: string;
    choiceNameAr: string;
    choiceNameEn?: string;
    price: number;
  }>;
}

export interface SelectedAddonGroup {
  groupId: string;
  groupNameAr: string;
  groupNameEn?: string;
  selectedOptions: SelectedAddonGroupOption[];
}

interface Props {
  groups: AddonGroup[];
  value: SelectedAddonGroup[];
  onChange: (val: SelectedAddonGroup[]) => void;
}

export function AddonGroupsSelector({ groups, value, onChange }: Props) {
  const { i18n } = useTranslation();
  const isAr = i18n.language === 'ar';

  const getGroupSelection = (groupId: string): SelectedAddonGroup | undefined =>
    value.find(v => v.groupId === groupId);

  const getSelectedOptions = (groupId: string): SelectedAddonGroupOption[] =>
    getGroupSelection(groupId)?.selectedOptions || [];

  const isOptionSelected = (groupId: string, optionId: string) =>
    getSelectedOptions(groupId).some(o => o.optionId === optionId);

  const toggleOption = (group: AddonGroup, option: AddonOption) => {
    const curGroup = getGroupSelection(group.id);
    const curOptions = curGroup?.selectedOptions || [];
    const alreadySelected = curOptions.some(o => o.optionId === option.id);

    let newOptions: SelectedAddonGroupOption[];

    if (group.selectionType === 'single') {
      newOptions = alreadySelected ? [] : [{ optionId: option.id, optionNameAr: option.nameAr, optionNameEn: option.nameEn, price: option.price, subSelections: [] }];
    } else {
      if (alreadySelected) {
        newOptions = curOptions.filter(o => o.optionId !== option.id);
      } else {
        if (curOptions.length >= group.maxSelect) return;
        newOptions = [...curOptions, { optionId: option.id, optionNameAr: option.nameAr, optionNameEn: option.nameEn, price: option.price, subSelections: [] }];
      }
    }

    const newVal = value.filter(v => v.groupId !== group.id);
    if (newOptions.length > 0) {
      newVal.push({ groupId: group.id, groupNameAr: group.nameAr, groupNameEn: group.nameEn, selectedOptions: newOptions });
    }
    onChange(newVal);
  };

  const toggleSubChoice = (group: AddonGroup, option: AddonOption, subGroup: AddonSubGroup, choice: AddonChoice) => {
    const curGroup = getGroupSelection(group.id);
    const curOptions = [...(curGroup?.selectedOptions || [])];
    const optIdx = curOptions.findIndex(o => o.optionId === option.id);
    if (optIdx < 0) return;

    const curSubs = [...(curOptions[optIdx].subSelections || [])];
    const alreadySel = curSubs.some(s => s.subGroupId === subGroup.id && s.choiceId === choice.id);

    let newSubs: typeof curSubs;
    if (subGroup.selectionType === 'single') {
      newSubs = alreadySel
        ? curSubs.filter(s => s.subGroupId !== subGroup.id)
        : [...curSubs.filter(s => s.subGroupId !== subGroup.id), { subGroupId: subGroup.id, subGroupNameAr: subGroup.nameAr, choiceId: choice.id, choiceNameAr: choice.nameAr, choiceNameEn: choice.nameEn, price: choice.price }];
    } else {
      const subGroupSels = curSubs.filter(s => s.subGroupId === subGroup.id);
      if (alreadySel) {
        newSubs = curSubs.filter(s => !(s.subGroupId === subGroup.id && s.choiceId === choice.id));
      } else {
        if (subGroupSels.length >= subGroup.maxSelect) return;
        newSubs = [...curSubs, { subGroupId: subGroup.id, subGroupNameAr: subGroup.nameAr, choiceId: choice.id, choiceNameAr: choice.nameAr, choiceNameEn: choice.nameEn, price: choice.price }];
      }
    }

    curOptions[optIdx] = { ...curOptions[optIdx], subSelections: newSubs };
    const newGroupVal: SelectedAddonGroup = { groupId: group.id, groupNameAr: group.nameAr, groupNameEn: group.nameEn, selectedOptions: curOptions };
    onChange([...value.filter(v => v.groupId !== group.id), newGroupVal]);
  };

  const isSubChoiceSelected = (group: AddonGroup, optionId: string, subGroupId: string, choiceId: string) => {
    const optSel = getSelectedOptions(group.id).find(o => o.optionId === optionId);
    return optSel?.subSelections?.some(s => s.subGroupId === subGroupId && s.choiceId === choiceId) || false;
  };

  if (!groups || groups.length === 0) return null;

  return (
    <div className="space-y-4">
      {groups.map(group => {
        const selectedOpts = getSelectedOptions(group.id);
        const isMulti = group.selectionType === 'multi';
        const canSelectMore = isMulti ? selectedOpts.length < group.maxSelect : selectedOpts.length === 0;

        return (
          <div key={group.id} className="space-y-2">
            <div className="flex items-center gap-2">
              <span className="text-sm font-semibold text-foreground">
                {isAr ? group.nameAr : group.nameEn || group.nameAr}
              </span>
              {group.required && (
                <span className="text-[10px] bg-red-100 text-red-600 px-1.5 py-0.5 rounded-full font-medium">مطلوب</span>
              )}
              {isMulti && (
                <span className="text-[10px] text-muted-foreground border border-border rounded-full px-2 py-0.5">
                  {isAr ? `اختر ${group.minSelect > 0 ? `${group.minSelect}–` : 'حتى '}${group.maxSelect}` : `Choose up to ${group.maxSelect}`}
                </span>
              )}
              {isMulti && selectedOpts.length > 0 && (
                <span className="text-[10px] text-primary font-bold">{selectedOpts.length}/{group.maxSelect}</span>
              )}
            </div>

            <div className="flex flex-wrap gap-2">
              {group.options.map(option => {
                const selected = isOptionSelected(group.id, option.id);
                const disabled = !selected && !canSelectMore;
                return (
                  <button
                    key={option.id}
                    type="button"
                    onClick={() => !disabled && toggleOption(group, option)}
                    disabled={disabled}
                    className={`rounded-xl text-xs font-medium transition-all flex items-center gap-2 px-3 py-2 ${
                      selected
                        ? "bg-primary text-white shadow-md ring-2 ring-primary/30"
                        : disabled
                        ? "bg-muted text-muted-foreground border border-border opacity-50 cursor-not-allowed"
                        : "bg-secondary text-foreground border border-border hover:border-primary/50"
                    }`}
                    data-testid={`btn-group-option-${group.id}-${option.id}`}
                  >
                    {option.imageUrl && (
                      <img
                        src={option.imageUrl.startsWith('/') ? option.imageUrl : '/' + option.imageUrl}
                        alt={option.nameAr}
                        className="w-6 h-6 rounded object-cover"
                      />
                    )}
                    <span>{isAr ? option.nameAr : option.nameEn || option.nameAr}</span>
                    {option.price > 0 && (
                      <span className={selected ? "text-white/80" : "text-primary font-bold"}>
                        +{option.price}
                      </span>
                    )}
                  </button>
                );
              })}
            </div>

            {group.options.map(option => {
              const selected = isOptionSelected(group.id, option.id);
              if (!selected || !option.subGroups || option.subGroups.length === 0) return null;
              return (
                <div key={`sub-${option.id}`} className="mr-2 pr-3 border-r-2 border-primary/30 space-y-3">
                  {option.subGroups.map(sg => {
                    const subSels = getSelectedOptions(group.id).find(o => o.optionId === option.id)?.subSelections?.filter(s => s.subGroupId === sg.id) || [];
                    const canPickMore = sg.selectionType === 'multi' ? subSels.length < sg.maxSelect : subSels.length === 0;
                    return (
                      <div key={sg.id} className="space-y-1.5">
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-medium text-foreground">
                            {isAr ? sg.nameAr : sg.nameEn || sg.nameAr}
                          </span>
                          {sg.required && (
                            <span className="text-[10px] bg-red-100 text-red-600 px-1.5 py-0.5 rounded-full">مطلوب</span>
                          )}
                          {sg.selectionType === 'multi' && (
                            <span className="text-[10px] text-muted-foreground border border-border rounded-full px-2 py-0.5">
                              حتى {sg.maxSelect}
                            </span>
                          )}
                        </div>
                        <div className="flex flex-wrap gap-1.5">
                          {sg.choices.map(choice => {
                            const chSel = isSubChoiceSelected(group, option.id, sg.id, choice.id);
                            const chDisabled = !chSel && !canPickMore;
                            return (
                              <button
                                key={choice.id}
                                type="button"
                                onClick={() => !chDisabled && toggleSubChoice(group, option, sg, choice)}
                                disabled={chDisabled}
                                className={`rounded-lg text-xs px-2.5 py-1.5 transition-all flex items-center gap-1 ${
                                  chSel
                                    ? "bg-primary text-white"
                                    : chDisabled
                                    ? "bg-muted text-muted-foreground border border-border opacity-50 cursor-not-allowed"
                                    : "bg-secondary text-foreground border border-border hover:border-primary/50"
                                }`}
                                data-testid={`btn-sub-choice-${sg.id}-${choice.id}`}
                              >
                                <span>{isAr ? choice.nameAr : choice.nameEn || choice.nameAr}</span>
                                {choice.price > 0 && (
                                  <span className={chSel ? "text-white/80" : "text-primary font-bold"}>+{choice.price}</span>
                                )}
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    );
                  })}
                </div>
              );
            })}
          </div>
        );
      })}
    </div>
  );
}

export function validateAddonGroups(groups: AddonGroup[], selected: SelectedAddonGroup[]): string | null {
  for (const group of groups) {
    if (!group.required) continue;
    const sel = selected.find(s => s.groupId === group.id);
    const count = sel?.selectedOptions.length || 0;
    const min = group.selectionType === 'single' ? 1 : (group.minSelect || 1);
    if (count < min) {
      return `يرجى اختيار خيار من "${group.nameAr}"`;
    }
    if (sel) {
      for (const opt of sel.selectedOptions) {
        const optDef = group.options.find(o => o.id === opt.optionId);
        if (!optDef?.subGroups) continue;
        for (const sg of optDef.subGroups) {
          if (!sg.required) continue;
          const subCount = opt.subSelections?.filter(s => s.subGroupId === sg.id).length || 0;
          if (subCount < 1) {
            return `يرجى الإجابة على "${sg.nameAr}" في "${optDef.nameAr}"`;
          }
        }
      }
    }
  }
  return null;
}

export function calcAddonGroupsPrice(selected: SelectedAddonGroup[]): number {
  let total = 0;
  for (const group of selected) {
    for (const opt of group.selectedOptions) {
      total += opt.price;
      for (const sub of (opt.subSelections || [])) {
        total += sub.price;
      }
    }
  }
  return total;
}
