"use client";
import React, { useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import AppHeader from '@/layout/AppHeader';
import { cn } from '@/lib/utils';
import { 
  LayoutDashboard, 
  FileText, 
  ShoppingCart, 
  FolderOpen, 
  FileCheck, 
  User, 
  Zap 
} from 'lucide-react';

interface CustomerLayoutProps { readonly children: React.ReactNode }

const primaryNav = [
  { label: 'Dashboard', href: '/portal/dashboard', icon: LayoutDashboard },
  { label: 'Quotes', href: '/portal/quotes', icon: FileText },
  { label: 'Orders', href: '/portal/orders', icon: ShoppingCart },
  { label: 'Files', href: '/portal/files', icon: FolderOpen },
  { label: 'Documents', href: '/portal/documents', icon: FileCheck },
  { label: 'Account', href: '/portal/account', icon: User },
  { label: 'Instant Quote', href: '/instant-quote', icon: Zap },
];

export default function CustomerLayout({ children }: Readonly<CustomerLayoutProps>) {
  const pathname = usePathname();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [desktopOpen, setDesktopOpen] = useState(true);

  return (
    <div className="flex h-screen w-full overflow-hidden bg-gradient-to-br from-blue-50 via-indigo-50 to-purple-50 dark:from-gray-950 dark:via-blue-950 dark:to-indigo-950">
      {/* Sidebar */}
      <aside className={cn(
        'bg-white/80 backdrop-blur-xl dark:bg-gray-900/80 border-r border-gray-200/50 dark:border-gray-800/50 flex flex-col fixed top-0 left-0 h-full z-40 transition-all duration-300 shadow-xl',
        'lg:static lg:h-full',
        mobileOpen ? 'translate-x-0 w-64' : '-translate-x-64 w-64 lg:translate-x-0',
        desktopOpen ? 'lg:w-64' : 'lg:w-0 lg:overflow-hidden'
      )}>
        {/* Header */}
        <div className="h-16 flex items-center px-6 font-bold text-lg tracking-tight border-b border-gray-200/50 dark:border-gray-800/50 bg-gradient-to-r from-blue-600 to-indigo-600 whitespace-nowrap">
          <Link href="/portal/dashboard" className="text-white flex items-center gap-2">
            <LayoutDashboard size={24} />
            <span>Frigate Fast Parts</span>
          </Link>
        </div>
        
        <nav className="flex-1 overflow-y-auto py-4 text-sm scrollbar-thin scrollbar-thumb-gray-300 dark:scrollbar-thumb-gray-700 invisible-scrollbar">
          <ul className="space-y-1 px-3">
            {primaryNav.map(item => {
              const active = pathname === item.href || pathname?.startsWith(item.href + '/');
              const Icon = item.icon;
              
              return (
                <li key={item.href}>
                  <Link href={item.href} className={cn(
                    'flex items-center gap-3 rounded-lg px-4 py-2.5 font-medium transition-all duration-200',
                    active 
                      ? 'bg-gradient-to-r from-blue-600 to-indigo-600 text-white shadow-lg shadow-blue-500/30' 
                      : 'text-gray-700 hover:bg-white dark:text-gray-300 dark:hover:bg-gray-800/50 hover:shadow-md'
                  )}>
                    <Icon size={18} className="size-5" />
                    {item.label}
                  </Link>
                </li>
              );
            })}
          </ul>
        </nav>
        
        <div className="p-4 border-t border-gray-200/50 dark:border-gray-800/50 text-xs text-gray-500 dark:text-gray-400 bg-gray-50/50 dark:bg-gray-900/50">
          <p className="font-semibold">&copy; {new Date().getFullYear()} CNC Quote</p>
          <p className="mt-2 space-x-2">
            <Link href="/legal/privacy" className="hover:text-blue-600 transition-colors">Privacy</Link>
            <span>·</span>
            <Link href="/legal/terms" className="hover:text-blue-600 transition-colors">Terms</Link>
          </p>
        </div>
      </aside>
      
      {/* Main */}
      <div className="flex flex-1 flex-col min-w-0 w-full">
        <AppHeader setOpen={() => setDesktopOpen(o => !o)} />
        <main className="flex-1 overflow-y-auto w-full p-6 md:p-8">{children}</main>
      </div>
      
      {/* Mobile Menu Toggle */}
      <button 
        onClick={() => setMobileOpen(o => !o)} 
        className="fixed bottom-6 left-6 z-50 rounded-full bg-gradient-to-r from-blue-600 to-indigo-600 text-white shadow-2xl px-6 py-3 lg:hidden hover:shadow-blue-500/50 transition-all duration-300 hover:scale-105 font-medium"
      >
        {mobileOpen ? 'Close' : 'Menu'}
      </button>
      
      {/* Desktop Sidebar Toggle */}
      <button
        onClick={() => setDesktopOpen(o => !o)}
        className="hidden lg:fixed lg:flex bottom-6 right-6 z-50 rounded-full bg-gradient-to-r from-blue-600 to-indigo-600 text-white shadow-2xl px-4 py-3 hover:shadow-blue-500/50 transition-all duration-300 hover:scale-105"
        title="Toggle sidebar"
      >
        {desktopOpen ? '→' : '←'}
      </button>
    </div>
  );
}
