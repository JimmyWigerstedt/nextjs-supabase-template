"use client";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "~/components/ui/card";
import { Badge } from "~/components/ui/badge";
import { Button } from "~/components/ui/button";
import { AppHeader } from "~/components/layout/AppHeader";
import Link from "next/link";

// Template card data
const TEMPLATE_CARDS = [
  {
    title: "Order Management",
    description: "Process e-commerce orders with N8N automation",
    icon: "🛒",
    href: "/template-page",
    badge: "Available",
    badgeVariant: "default" as const,
  },
  {
    title: "Support Tickets", 
    description: "Handle customer support with automated workflows",
    icon: "🎧",
    href: "#",
    badge: "Coming Soon",
    badgeVariant: "secondary" as const,
  },
  {
    title: "Inventory Tracking",
    description: "Manage inventory with automated restocking",
    icon: "📦",
    href: "#",
    badge: "Coming Soon",
    badgeVariant: "secondary" as const,
  },
  {
    title: "Lead Management",
    description: "Process sales leads with CRM automation",
    icon: "👥",
    href: "#",
    badge: "Coming Soon", 
    badgeVariant: "secondary" as const,
  },
  {
    title: "Content Publishing",
    description: "Automate content creation and publishing workflows",
    icon: "📝",
    href: "#",
    badge: "Coming Soon",
    badgeVariant: "secondary" as const,
  },
  {
    title: "Invoice Processing",
    description: "Handle invoices and payments automatically",
    icon: "💰",
    href: "#",
    badge: "Coming Soon",
    badgeVariant: "secondary" as const,
  },
];

export function DashboardClient() {
  return (
    <div className="min-h-screen bg-gray-50">
      {/* Global Header */}
      <AppHeader currentPage="Dashboard" />

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Hero Section */}
        <div className="text-center mb-12">
          <h1 className="text-4xl font-bold text-gray-900 mb-4">
            N8N Integration Templates
          </h1>
          <p className="text-xl text-gray-600 max-w-3xl mx-auto">
            Ready-to-use templates for building N8N-integrated applications. 
            Each template demonstrates real-world automation patterns with full database integration.
          </p>
        </div>

        {/* Template Cards Gallery */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {TEMPLATE_CARDS.map((template) => (
            <Card key={template.title} className="relative group hover:shadow-lg transition-shadow">
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div className="text-3xl mb-2">{template.icon}</div>
                  <Badge variant={template.badgeVariant}>
                    {template.badge}
                  </Badge>
                </div>
                <CardTitle className="text-lg">{template.title}</CardTitle>
                <CardDescription>{template.description}</CardDescription>
              </CardHeader>
              <CardContent>
                {template.badge === "Available" ? (
                  <Link href={template.href}>
                    <Button className="w-full" size="sm">
                      View Template
                    </Button>
                  </Link>
                ) : (
                  <Button className="w-full" size="sm" disabled>
                    Coming Soon
                  </Button>
                )}
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Footer Section */}
        <div className="mt-16 text-center">
          <div className="max-w-2xl mx-auto">
            <h2 className="text-2xl font-bold text-gray-900 mb-4">
              Template Architecture
            </h2>
            <p className="text-gray-600 mb-6">
              Each template uses a field-driven architecture that automatically handles form inputs, 
              database operations, N8N payload structure, and real-time UI updates.
            </p>
            <div className="bg-gray-100 rounded-lg p-4">
              <div className="text-sm text-gray-700 font-mono">
                User Input → N8N Processing → Database Update → Real-time UI Update
              </div>
            </div>
          </div>
        </div>
      </main>

    </div>
  );
} 