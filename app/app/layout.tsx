import type React from "react"
import { AppSidebar } from "@/components/app-sidebar"
import { AppShellFooter } from "@/components/app-shell-footer"
import { AppTopbar } from "@/components/app-topbar"
import { AppFeaturesProvider } from "@/contexts/app-features-context"
import { AppAccountProvider } from "@/contexts/app-account-context"
import { SidebarCollapseProvider } from "@/contexts/sidebar-collapse-context"
import { AppFeatureRouteGuard } from "@/components/app-feature-route-guard"
import { AppPageActionsProvider } from "@/contexts/app-page-actions-context"

export default function AppLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <AppFeaturesProvider>
      <AppAccountProvider>
        <SidebarCollapseProvider>
        <AppPageActionsProvider>
        <div className="flex h-screen overflow-hidden text-sm print:h-auto print:min-h-0 print:overflow-visible">
          <AppSidebar />
          <div className="flex min-h-0 flex-1 flex-col overflow-hidden print:overflow-visible">
            <AppTopbar />
            <main className="flex min-h-0 flex-1 flex-col overflow-y-auto bg-background print:overflow-visible">
              <AppFeatureRouteGuard>{children}</AppFeatureRouteGuard>
            </main>
            <AppShellFooter />
          </div>
        </div>
        </AppPageActionsProvider>
        </SidebarCollapseProvider>
      </AppAccountProvider>
    </AppFeaturesProvider>
  )
}
