"use client";

import { LogOut } from "lucide-react";
import { initialsFromDisplayName } from "@/lib/user-display";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { useAppAccount } from "@/contexts/app-account-context";

export function AccountPopoverPanel() {
  const { userChip, companyRoleLabel, closeAccountPanel, setLogoutOpen } =
    useAppAccount();

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3 border-b border-border pb-3">
        <Avatar className="size-11 shrink-0 border border-border/60">
          {userChip?.avatarUrl ? (
            <AvatarImage src={userChip.avatarUrl} alt="" />
          ) : null}
          <AvatarFallback className="text-sm font-semibold bg-sky-100 text-sky-800 dark:bg-sky-950/50 dark:text-sky-200">
            {userChip ? initialsFromDisplayName(userChip.name) : "…"}
          </AvatarFallback>
        </Avatar>
        <div>
          <p className="text-sm font-semibold leading-tight text-foreground">
            Account
          </p>
          <p className="text-xs text-muted-foreground">Signed in</p>
        </div>
      </div>
      <dl className="space-y-3 text-sm">
        <div>
          <dt className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            Name
          </dt>
          <dd className="mt-0.5 break-words text-foreground">
            {userChip?.name ?? "—"}
          </dd>
        </div>
        <div>
          <dt className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            Role
          </dt>
          <dd className="mt-0.5 break-words text-foreground">
            {companyRoleLabel ?? "—"}
          </dd>
        </div>
        <div>
          <dt className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            Email
          </dt>
          <dd className="mt-0.5 break-all text-foreground">
            {userChip?.email ?? "—"}
          </dd>
        </div>
      </dl>
      <Button
        type="button"
        variant="destructive"
        className="w-full gap-2"
        onClick={() => {
          closeAccountPanel();
          setLogoutOpen(true);
        }}
      >
        <LogOut className="h-4 w-4" />
        Log out
      </Button>
    </div>
  );
}
