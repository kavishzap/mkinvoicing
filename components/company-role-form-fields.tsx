"use client";

import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import type { PlanAllowedFeature } from "@/lib/company-roles-service";

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
        <Label>Features (from your plan)</Label>
        <div className="rounded-md border p-3">
          {planFeatures.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              No features available for your plan.
            </p>
          ) : (
            <div className="grid gap-3 xl:grid-cols-2">
              {planFeatures.map((f) => (
                <div key={f.id} className="flex items-start gap-3 space-y-0">
                  <Checkbox
                    id={`feat-${f.id}`}
                    checked={selectedFeatureIds.has(f.id)}
                    onCheckedChange={(c) => onToggleFeature(f.id, c === true)}
                    className="mt-0.5"
                    disabled={featuresDisabled}
                  />
                  <label
                    htmlFor={`feat-${f.id}`}
                    className="flex flex-col gap-0.5 text-sm leading-snug cursor-pointer"
                  >
                    <span className="font-medium">{f.name}</span>
                    {f.description ? (
                      <span className="text-xs text-muted-foreground">
                        {f.description}
                      </span>
                    ) : null}
                  </label>
                </div>
              ))}
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
