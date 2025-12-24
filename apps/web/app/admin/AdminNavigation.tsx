'use client';

import React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { cn } from '@/lib/utils';
import {
  CogIcon,
  CurrencyDollarIcon,
  ChartBarIcon,
  UserGroupIcon,
  DocumentTextIcon,
  ShieldCheckIcon
} from '@heroicons/react/24/outline';

const adminNavItems = [
  { name: 'Dashboard', href: '/admin/dashboard', icon: ChartBarIcon, description: 'Operational overview' },
  { name: 'Quotes', href: '/admin/quotes', icon: DocumentTextIcon, description: 'Manage customer quotes' },
  { name: 'Pricing Engine', href: '/admin/pricing', icon: CurrencyDollarIcon, description: 'Configure pricing rules' },
  { name: 'Queue Monitor', href: '/admin/queues', icon: ShieldCheckIcon, description: 'Job processing health' },
  { name: 'Metrics', href: '/admin/metrics', icon: ChartBarIcon, description: 'Prometheus & SLO charts' },
  { name: 'Users & Orgs', href: '/admin/users', icon: UserGroupIcon, description: 'Accounts and permissions' },
  { name: 'Content', href: '/admin/content', icon: DocumentTextIcon, description: 'CMS pages & docs' },
  { name: 'Security', href: '/admin/security', icon: ShieldCheckIcon, description: 'Audit & auth settings' }
];

export default function AdminNavigation() {
  const pathname = usePathname();

  return (
    <div className="fixed inset-y-0 left-0 z-50 w-64 bg-white shadow-lg">
      <div className="flex flex-col h-full">
        {/* Logo */}
        <div className="flex items-center px-6 py-4 border-b">
          <CogIcon className="h-8 w-8 text-blue-600" />
          <div className="ml-3">
            <h1 className="text-lg font-bold text-gray-900">Admin Panel</h1>
            <p className="text-xs text-gray-600">CNC Quote System</p>
          </div>
        </div>

        {/* Navigation */}
        <nav className="flex-1 px-4 py-6 space-y-2">
          {adminNavItems.map((item) => {
            const isActive = pathname === item.href;
            return (
              <Link
                key={item.name}
                href={item.href}
                className={cn(
                  'flex items-center px-3 py-2 rounded-lg text-sm font-medium transition-colors',
                  isActive
                    ? 'bg-blue-50 text-blue-700 border-r-2 border-blue-700'
                    : 'text-gray-700 hover:bg-gray-100 hover:text-gray-900'
                )}
              >
                <item.icon className="w-5 h-5 mr-3" />
                <div>
                  <div>{item.name}</div>
                  <div className="text-xs text-gray-500 mt-0.5">
                    {item.description}
                  </div>
                </div>
              </Link>
            );
          })}
        </nav>

        {/* Footer */}
        <div className="px-4 py-4 border-t">
          <Link
            href="/"
            className="flex items-center px-3 py-2 text-sm text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-lg"
          >
            ← Back to Public Site
          </Link>
        </div>
      </div>
    </div>
  );
}
