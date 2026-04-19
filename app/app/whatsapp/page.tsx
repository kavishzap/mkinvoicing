"use client";

import { useRouter } from "next/navigation";
import { MessageCircle, Users, ImageIcon } from "lucide-react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { AppPageShell } from "@/components/app-page-shell";

const cards = [
  {
    title: "WhatsApp groups",
    description: "Name a group and attach customers from your company list.",
    icon: Users,
    href: "/app/whatsapp/groups",
  },
  {
    title: "WhatsApp catalogue",
    description: "Posts with image and description; share to a group via WhatsApp.",
    icon: ImageIcon,
    href: "/app/whatsapp/catalogue",
  },
];

export default function WhatsAppHubPage() {
  const router = useRouter();

  return (
    <AppPageShell subtitle="Set up broadcast groups and image posts, then share them to WhatsApp when you’re ready.">
      <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
        {cards.map((card) => {
          const Icon = card.icon;
          return (
            <Card
              key={card.title}
              className={cn(
                "cursor-pointer transition-colors hover:bg-accent/50"
              )}
              onClick={() => router.push(card.href)}
            >
              <CardHeader className="flex flex-row items-start justify-between space-y-0">
                <div className="space-y-1.5">
                  <CardTitle className="flex items-center gap-2 text-base">
                    <MessageCircle className="h-5 w-5 text-emerald-600" />
                    {card.title}
                  </CardTitle>
                  <CardDescription>{card.description}</CardDescription>
                </div>
                <div className="rounded-lg bg-primary/10 p-2">
                  <Icon className="h-5 w-5 text-primary" />
                </div>
              </CardHeader>
            </Card>
          );
        })}
      </div>
    </AppPageShell>
  );
}
