"use client";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { SupplierFormData } from "@/lib/supplier-form";

type Props = {
  formData: SupplierFormData;
  setFormData: React.Dispatch<React.SetStateAction<SupplierFormData>>;
  errors: Partial<Record<keyof SupplierFormData, string>>;
};

export function SupplierFormFields({ formData, setFormData, errors }: Props) {
  const err = (k: keyof SupplierFormData) =>
    errors[k] ? "border-destructive" : "";

  return (
    <div className="w-full text-left space-y-6">
      {/* Top row: details left, address right — matches invoice / SO two-column layout */}
      <div className="grid gap-6 lg:grid-cols-2 lg:items-start">
        <Card className="min-w-0">
          <CardHeader className="space-y-1">
            <CardTitle className="text-xl">Supplier details</CardTitle>
            <p className="text-sm text-muted-foreground font-normal">
              Type, name, and contact
            </p>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex flex-wrap gap-2">
              <Button
                type="button"
                size="sm"
                variant={formData.type === "company" ? "default" : "outline"}
                onClick={() => setFormData((f) => ({ ...f, type: "company" }))}
              >
                Company
              </Button>
              <Button
                type="button"
                size="sm"
                variant={
                  formData.type === "individual" ? "default" : "outline"
                }
                onClick={() =>
                  setFormData((f) => ({ ...f, type: "individual" }))
                }
              >
                Individual
              </Button>
            </div>

            {formData.type === "company" ? (
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2 sm:col-span-2">
                  <Label htmlFor="companyName">Company name *</Label>
                  <Input
                    id="companyName"
                    value={formData.companyName}
                    onChange={(e) =>
                      setFormData((f) => ({
                        ...f,
                        companyName: e.target.value,
                      }))
                    }
                    className={err("companyName")}
                  />
                  {errors.companyName && (
                    <p className="text-xs text-destructive">
                      {errors.companyName}
                    </p>
                  )}
                </div>
                <div className="space-y-2 sm:col-span-2">
                  <Label htmlFor="contactName">Contact name</Label>
                  <Input
                    id="contactName"
                    value={formData.contactName}
                    onChange={(e) =>
                      setFormData((f) => ({
                        ...f,
                        contactName: e.target.value,
                      }))
                    }
                  />
                </div>
              </div>
            ) : (
              <div className="space-y-2 max-w-xl">
                <Label htmlFor="fullName">Full name *</Label>
                <Input
                  id="fullName"
                  value={formData.fullName}
                  onChange={(e) =>
                    setFormData((f) => ({ ...f, fullName: e.target.value }))
                  }
                  className={err("fullName")}
                />
                {errors.fullName && (
                  <p className="text-xs text-destructive">{errors.fullName}</p>
                )}
              </div>
            )}

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  type="email"
                  value={formData.email}
                  onChange={(e) =>
                    setFormData((f) => ({ ...f, email: e.target.value }))
                  }
                  className={err("email")}
                />
                {errors.email && (
                  <p className="text-xs text-destructive">{errors.email}</p>
                )}
              </div>
              <div className="space-y-2">
                <Label htmlFor="phone">Phone</Label>
                <Input
                  id="phone"
                  value={formData.phone}
                  onChange={(e) =>
                    setFormData((f) => ({ ...f, phone: e.target.value }))
                  }
                />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="min-w-0">
          <CardHeader className="space-y-1">
            <CardTitle className="text-xl">Address</CardTitle>
            <p className="text-sm text-muted-foreground font-normal">
              Location and lines for correspondence
            </p>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="address_line_1">Address line 1</Label>
              <Input
                id="address_line_1"
                value={formData.address_line_1}
                onChange={(e) =>
                  setFormData((f) => ({
                    ...f,
                    address_line_1: e.target.value,
                  }))
                }
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="address_line_2">Address line 2</Label>
              <Input
                id="address_line_2"
                value={formData.address_line_2}
                onChange={(e) =>
                  setFormData((f) => ({
                    ...f,
                    address_line_2: e.target.value,
                  }))
                }
              />
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="street">Street</Label>
                <Input
                  id="street"
                  value={formData.street}
                  onChange={(e) =>
                    setFormData((f) => ({ ...f, street: e.target.value }))
                  }
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="city">City</Label>
                <Input
                  id="city"
                  value={formData.city}
                  onChange={(e) =>
                    setFormData((f) => ({ ...f, city: e.target.value }))
                  }
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="postal">Postal code</Label>
                <Input
                  id="postal"
                  value={formData.postal}
                  onChange={(e) =>
                    setFormData((f) => ({ ...f, postal: e.target.value }))
                  }
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="country">Country</Label>
                <Input
                  id="country"
                  value={formData.country}
                  onChange={(e) =>
                    setFormData((f) => ({ ...f, country: e.target.value }))
                  }
                />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Second row: commercial left, notes right */}
      <div className="grid gap-6 lg:grid-cols-2 lg:items-start">
        <Card className="min-w-0">
          <CardHeader className="space-y-1">
            <CardTitle className="text-xl">Commercial</CardTitle>
            <p className="text-sm text-muted-foreground font-normal">
              Codes and registration
            </p>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="supplierCode">Supplier code</Label>
                <Input
                  id="supplierCode"
                  value={formData.supplierCode}
                  onChange={(e) =>
                    setFormData((f) => ({
                      ...f,
                      supplierCode: e.target.value,
                    }))
                  }
                  placeholder="e.g. V-001"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="vatNumber">VAT / tax no.</Label>
                <Input
                  id="vatNumber"
                  value={formData.vatNumber}
                  onChange={(e) =>
                    setFormData((f) => ({ ...f, vatNumber: e.target.value }))
                  }
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="registrationId">Registration ID</Label>
              <Input
                id="registrationId"
                value={formData.registrationId}
                onChange={(e) =>
                  setFormData((f) => ({
                    ...f,
                    registrationId: e.target.value,
                  }))
                }
              />
            </div>
          </CardContent>
        </Card>

        <Card className="min-w-0 flex flex-col">
          <CardHeader className="space-y-1">
            <CardTitle className="text-xl">Notes</CardTitle>
            <p className="text-sm text-muted-foreground font-normal">
              Internal reference only
            </p>
          </CardHeader>
          <CardContent className="flex-1 flex flex-col">
            <Label htmlFor="notes" className="sr-only">
              Notes
            </Label>
            <Textarea
              id="notes"
              rows={8}
              className="min-h-[180px] resize-y"
              value={formData.notes}
              onChange={(e) =>
                setFormData((f) => ({ ...f, notes: e.target.value }))
              }
              placeholder="Internal notes…"
            />
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
