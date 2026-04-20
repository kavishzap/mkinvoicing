"use client";

import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";
import {
  clearActiveCompanyCache,
  getActiveCompanyId,
} from "@/lib/active-company";
import { clearRoleFeaturesCache } from "@/lib/role-features-service";
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

export type UserChip = {
  name: string;
  email: string;
  avatarUrl: string | null;
};

/** Which control opened the account menu (popover anchors to that trigger). */
export type AccountAnchor = "closed" | "topbar" | "sidebar";

type AppAccountContextValue = {
  userChip: UserChip | null;
  /** From `user_profiles.system_role` (admin / owner / member). */
  systemRoleLabel: string | null;
  companyRoleLabel: string | null;
  companyName: string | null;
  /** Where the account popover is anchored; `closed` when not open. */
  accountAnchor: AccountAnchor;
  setAccountAnchor: (anchor: AccountAnchor) => void;
  openAccountFromTopbar: () => void;
  openAccountFromSidebar: () => void;
  closeAccountPanel: () => void;
  /** @deprecated use accountAnchor !== 'closed' */
  accountModalOpen: boolean;
  /** @deprecated use openAccountFromTopbar */
  openAccountModal: () => void;
  setAccountModalOpen: (open: boolean) => void;
  logoutOpen: boolean;
  setLogoutOpen: (open: boolean) => void;
};

const AppAccountContext = createContext<AppAccountContextValue | null>(null);

export function AppAccountProvider({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const [userChip, setUserChip] = useState<UserChip | null>(null);
  const [systemRoleLabel, setSystemRoleLabel] = useState<string | null>(null);
  const [companyRoleLabel, setCompanyRoleLabel] = useState<string | null>(null);
  const [companyName, setCompanyName] = useState<string | null>(null);
  const [accountAnchor, setAccountAnchor] = useState<AccountAnchor>("closed");
  const [logoutOpen, setLogoutOpen] = useState(false);

  const openAccountFromTopbar = useCallback(
    () => setAccountAnchor("topbar"),
    []
  );
  const openAccountFromSidebar = useCallback(
    () => setAccountAnchor("sidebar"),
    []
  );
  const closeAccountPanel = useCallback(() => setAccountAnchor("closed"), []);

  const setAccountModalOpen = useCallback((open: boolean) => {
    setAccountAnchor(open ? "topbar" : "closed");
  }, []);

  const openAccountModal = useCallback(openAccountFromTopbar, [
    openAccountFromTopbar,
  ]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (cancelled || !user) {
        if (!cancelled) {
          setUserChip(null);
          setSystemRoleLabel(null);
          setCompanyRoleLabel(null);
          setCompanyName(null);
        }
        return;
      }
      const email = user.email ?? "";
      const { data: row } = await supabase
        .from("user_profiles")
        .select("full_name, avatar_url, email, system_role, is_active")
        .eq("id", user.id)
        .maybeSingle();
      const meta = user.user_metadata as { full_name?: string } | undefined;
      const name =
        (row?.full_name as string | null)?.trim() ||
        meta?.full_name?.trim() ||
        email.split("@")[0] ||
        "User";
      if (!cancelled) {
        setUserChip({
          name,
          email: (row?.email as string | null) || email,
          avatarUrl: (row?.avatar_url as string | null) ?? null,
        });
      }

      const activeProfile = row?.is_active !== false;
      const sr = (row?.system_role as string | null | undefined)?.toLowerCase();
      let sysLabel: string | null = null;
      if (row && activeProfile) {
        if (sr === "admin") sysLabel = "Admin";
        else if (sr === "owner") sysLabel = "Owner";
        else if (sr === "member") sysLabel = "Member";
        else if (sr) sysLabel = sr.charAt(0).toUpperCase() + sr.slice(1);
      } else if (row && !activeProfile) {
        sysLabel = "Inactive";
      }
      if (!cancelled) setSystemRoleLabel(sysLabel);

      let role: string | null = null;
      const companyId = await getActiveCompanyId();
      if (!companyId || cancelled) {
        if (!cancelled) {
          setCompanyName(null);
          setCompanyRoleLabel(null);
        }
      } else {
        const { data: co } = await supabase
          .from("companies")
          .select("name")
          .eq("id", companyId)
          .eq("is_active", true)
          .maybeSingle();
        if (!cancelled) {
          setCompanyName(
            co?.name ? String(co.name).trim() || null : null
          );
        }

        const { data: mem } = await supabase
          .from("company_users")
          .select("is_owner, company_roles ( name )")
          .eq("user_id", user.id)
          .eq("company_id", companyId)
          .eq("is_active", true)
          .maybeSingle();
        if (!cancelled && mem) {
          if (mem.is_owner) {
            role = "Owner";
          } else {
            const cr = mem.company_roles as unknown as {
              name: string | null;
            } | null;
            role = cr?.name?.trim() || "Member";
          }
        }
        if (!cancelled) setCompanyRoleLabel(role);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const handleLogout = async () => {
    await supabase.auth.signOut();
    clearActiveCompanyCache();
    clearRoleFeaturesCache();
    localStorage.clear();
    sessionStorage.clear();
    setLogoutOpen(false);
    router.push("/main");
  };

  const accountModalOpen = accountAnchor !== "closed";

  const value = useMemo<AppAccountContextValue>(
    () => ({
      userChip,
      systemRoleLabel,
      companyRoleLabel,
      companyName,
      accountAnchor,
      setAccountAnchor,
      openAccountFromTopbar,
      openAccountFromSidebar,
      closeAccountPanel,
      accountModalOpen,
      openAccountModal,
      setAccountModalOpen,
      logoutOpen,
      setLogoutOpen,
    }),
    [
      userChip,
      systemRoleLabel,
      companyRoleLabel,
      companyName,
      accountAnchor,
      openAccountFromTopbar,
      openAccountFromSidebar,
      closeAccountPanel,
      accountModalOpen,
      openAccountModal,
      setAccountModalOpen,
      logoutOpen,
    ]
  );

  return (
    <AppAccountContext.Provider value={value}>
      {children}

      <AlertDialog open={logoutOpen} onOpenChange={setLogoutOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Log out</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to log out? You will need to sign in again
              to access your account.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleLogout}
              className="bg-red-600 hover:bg-red-700"
            >
              Log out
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </AppAccountContext.Provider>
  );
}

export function useAppAccount(): AppAccountContextValue {
  const ctx = useContext(AppAccountContext);
  if (!ctx) {
    throw new Error("useAppAccount must be used within <AppAccountProvider>");
  }
  return ctx;
}
