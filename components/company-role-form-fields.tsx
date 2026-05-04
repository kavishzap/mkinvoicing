"use client";

import { Fragment, useMemo } from "react";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import type { PlanAllowedFeature } from "@/lib/company-roles-service";
import {
  groupRoleFormFeaturesByNavSection,
  NAV_SECTION_LABELS,
  NAV_SECTION_ORDER,
  type NavSectionId,
} from "@/lib/app-nav";

type CompanyRoleFormFieldsProps = {
  name: string;
  onNameChange: (value: string) => void;
  description: string;
  onDescriptionChange: (value: string) => void;
  nameDisabled?: boolean;
  descriptionDisabled?: boolean;
  nameHint?: string;
  activeDisabled?: boolean;
  /** When false, new roles are created active in the database; no toggle is shown. */
  showActive?: boolean;
  isActive?: boolean;
  onActiveChange?: (value: boolean) => void;
  featuresDisabled?: boolean;
  featureHint?: string;
  /** Features the editor may assign (already filtered to plan ∩ editor access). */
  planFeatures: PlanAllowedFeature[];
  selectedFeatureIds: Set<string>;
  onToggleFeature: (id: string, checked: boolean) => void;
};

export function CompanyRoleFormFields({
  name,
  onNameChange,
  description,
  onDescriptionChange,
  nameDisabled,
  descriptionDisabled,
  nameHint,
  activeDisabled,
  showActive = false,
  isActive = true,
  onActiveChange,
  featuresDisabled,
  featureHint,
  planFeatures,
  selectedFeatureIds,
  onToggleFeature,
}: CompanyRoleFormFieldsProps) {
  const bySection = useMemo(
    () => groupRoleFormFeaturesByNavSection(planFeatures),
    [planFeatures]
  );

  return (
    <div className="grid gap-6 py-2 lg:grid-cols-2 lg:items-start">
      <div className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="role-name">Name</Label>
          <Input
            id="role-name"
            value={name}
            onChange={(e) => onNameChange(e.target.value)}
            disabled={nameDisabled}
            placeholder="e.g. Sales, Accountant"
          />
          {nameHint ? (
            <p className="text-xs text-muted-foreground">{nameHint}</p>
          ) : null}
        </div>
        <div className="space-y-2">
          <Label htmlFor="role-desc">Description</Label>
          <Textarea
            id="role-desc"
            value={description}
            onChange={(e) => onDescriptionChange(e.target.value)}
            disabled={descriptionDisabled}
            placeholder="Optional"
            rows={3}
          />
        </div>
        {showActive && onActiveChange ? (
          <div className="flex items-center justify-between gap-4 rounded-lg border p-3">
            <div>
              <p className="text-sm font-medium">Active</p>
              <p className="text-xs text-muted-foreground">
                Inactive roles cannot be assigned to new users.
              </p>
            </div>
            <Switch
              checked={isActive}
              onCheckedChange={onActiveChange}
              disabled={activeDisabled}
            />
          </div>
        ) : null}
      </div>
      <div className="space-y-2">
        <Label>Features</Label>
        <p className="text-xs text-muted-foreground -mt-1">
          Grouped like the app menu. Only features your account can use are listed.
        </p>
        <div className="max-h-[min(32rem,70vh)] overflow-y-auto rounded-md border p-3">
          {planFeatures.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              No features available to assign for this role.
            </p>
          ) : (
            <div className="space-y-5">
              {NAV_SECTION_ORDER.map((sectionId: NavSectionId) => {
                const rows = bySection.get(sectionId) ?? [];
                if (rows.length === 0) return null;
                let lastSub: string | undefined;
                return (
                  <section key={sectionId} className="space-y-2">
                    <h3 className="border-b border-border/70 pb-1 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                      {NAV_SECTION_LABELS[sectionId]}
                    </h3>
                    <div className="grid gap-3 sm:grid-cols-2">
                      {rows.map((row) => {
                        const f = row.feature;
                        const showSub =
                          Boolean(row.subsection?.trim()) &&
                          row.subsection !== lastSub;
                        const block = (
                          <Fragment key={f.id}>
                            {showSub ? (
                              <div className="col-span-full pt-1">
                                <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground/90">
                                  {row.subsection}
                                </p>
                              </div>
                            ) : null}
                            <div className="flex items-start gap-3 space-y-0">
                              <Checkbox
                                id={`feat-${f.id}`}
                                checked={selectedFeatureIds.has(f.id)}
                                onCheckedChange={(c) =>
                                  onToggleFeature(f.id, c === true)
                                }
                                className="mt-0.5"
                                disabled={featuresDisabled}
                              />
                              <label
                                htmlFor={`feat-${f.id}`}
                                className="flex cursor-pointer flex-col gap-0.5 text-sm leading-snug"
                              >
                                <span className="font-medium">{f.name}</span>
                                {f.description ? (
                                  <span className="text-xs text-muted-foreground">
                                    {f.description}
                                  </span>
                                ) : null}
                              </label>
                            </div>
                          </Fragment>
                        );
                        if (row.subsection) lastSub = row.subsection;
                        return block;
                      })}
                    </div>
                  </section>
                );
              })}
            </div>
          )}
        </div>
        {featureHint ? (
          <p className="text-xs text-muted-foreground">{featureHint}</p>
        ) : null}
      </div>
    </div>
  );
}
