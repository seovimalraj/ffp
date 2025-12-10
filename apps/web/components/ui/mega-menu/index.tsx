'use client';

import React, { useEffect, useCallback, useRef, useState, useMemo } from 'react';
import Link from 'next/link';
import { X, Search } from 'lucide-react';
import { menuSections, MenuSection } from '@/lib/menu-data';
import { useActiveMenuSection } from '@/lib/hooks/use-active-menu-section';
import { useMegaMenu } from '@/hooks/use-mega-menu';

interface MegaMenuProps {
  isOpen: boolean;
  onClose: () => void;
}

export function MegaMenu({ isOpen, onClose }: MegaMenuProps) {
  const menuRef = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const { activeSection, activeItem } = useActiveMenuSection();

  // Filter sections and items based on search query
  const filteredSections = useMemo(() => {
    if (!searchQuery.trim()) return menuSections;
    
    const query = searchQuery.toLowerCase();
    return menuSections
      .map((section) => ({
        ...section,
        items: section.items.filter(
          (item) =>
            item.label.toLowerCase().includes(query) ||
            section.title.toLowerCase().includes(query)
        ),
      }))
      .filter((section) => section.items.length > 0);
  }, [searchQuery]);

  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
      // Focus search on "/" key press (if not already in an input)
      if (e.key === '/' && document.activeElement?.tagName !== 'INPUT') {
        e.preventDefault();
        searchInputRef.current?.focus();
      }
    },
    [onClose]
  );

  useEffect(() => {
    if (isOpen) {
      document.addEventListener('keydown', handleKeyDown);
      document.body.style.overflow = 'hidden';
      // Focus search input when menu opens
      setTimeout(() => searchInputRef.current?.focus(), 100);
      setSearchQuery('');
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      document.body.style.overflow = '';
    };
  }, [isOpen, handleKeyDown]);

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center"
      role="dialog"
      aria-modal="true"
      aria-label="Navigation menu"
    >
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-slate-900/20 backdrop-blur-sm animate-fade-in"
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Glass Panel */}
      <div
        ref={menuRef}
        className="relative w-full h-full flex flex-col animate-scale-in"
        style={{
          background: 'rgba(255, 255, 255, 0.05)',
          backdropFilter: 'blur(24px) saturate(200%)',
          WebkitBackdropFilter: 'blur(24px) saturate(200%)',
          border: '1px solid rgba(255, 255, 255, 0.4)',
          boxShadow: '0 8px 32px rgba(31, 38, 135, 0.15), inset 0 4px 30px rgba(255, 255, 255, 0.25)',
        }}
      >
        {/* Glass overlay layer - creates depth and refraction */}
        <div
          className="absolute inset-0 pointer-events-none z-0"
          style={{
            background: 'rgba(255, 255, 255, 0.08)',
            backdropFilter: 'blur(2px)',
            WebkitBackdropFilter: 'blur(2px)',
            boxShadow: 'inset -10px -8px 0px -11px rgba(255, 255, 255, 1), inset 0px -9px 0px -8px rgba(255, 255, 255, 1)',
            opacity: 0.7,
            filter: 'blur(1px) brightness(120%)',
          }}
        />

        {/* Refraction highlight - top edge */}
        <div
          className="absolute top-0 left-0 right-0 h-[1px] z-10"
          style={{
            background: 'linear-gradient(90deg, transparent 0%, rgba(255,255,255,0.8) 20%, rgba(255,255,255,1) 50%, rgba(255,255,255,0.8) 80%, transparent 100%)',
          }}
        />

        {/* Refraction highlight - left edge */}
        <div
          className="absolute top-0 left-0 bottom-0 w-[1px] z-10"
          style={{
            background: 'linear-gradient(180deg, rgba(255,255,255,0.9) 0%, rgba(255,255,255,0.4) 50%, transparent 100%)',
          }}
        />

        {/* Inner glow - top left corner */}
        <div
          className="absolute inset-0 pointer-events-none z-0"
          style={{
            background: 'radial-gradient(ellipse at 10% 5%, rgba(255,255,255,0.6) 0%, transparent 35%)',
          }}
        />

        {/* Inner glow - center */}
        <div
          className="absolute inset-0 pointer-events-none z-0"
          style={{
            background: 'radial-gradient(ellipse at 50% 50%, rgba(255,255,255,0.15) 0%, transparent 60%)',
          }}
        />

        {/* Subtle tint glow */}
        <div
          className="absolute inset-0 pointer-events-none z-0"
          style={{
            background: 'radial-gradient(ellipse at 80% 90%, rgba(220,225,235,0.25) 0%, transparent 45%)',
          }}
        />

        {/* Logo - Top Left */}
        <div className="absolute top-6 left-6 md:top-8 md:left-8 z-20">
          <Link 
            href="/"
            className="flex items-center gap-3 group"
            onClick={onClose}
          >
            <div className="w-10 h-10 md:w-12 md:h-12 rounded-xl bg-gradient-to-br from-blue-600 to-blue-700 flex items-center justify-center transition-all duration-300 group-hover:scale-105 shadow-lg shadow-blue-500/30">
              <span className="text-white font-bold text-base md:text-lg">FFP</span>
            </div>
            <span className="hidden md:block text-2xl font-bold text-gray-900">Frigate Fast Parts</span>
          </Link>
        </div>

        {/* Close button */}
        <button
          onClick={onClose}
          className="absolute top-6 right-6 md:top-8 md:right-8 z-20 p-2.5 rounded-xl bg-white/95 text-gray-600 hover:bg-white hover:text-gray-900 transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-gray-400/40 shadow-lg hover:shadow-xl"
          aria-label="Close menu"
        >
          <X className="w-6 h-6" />
        </button>

        {/* Search Bar - Top Center */}
        <div className="absolute top-6 md:top-8 left-1/2 -translate-x-1/2 z-20 w-full max-w-xl px-20 md:px-4">
          <div
            className="relative overflow-hidden rounded-2xl bg-white/95 border border-gray-200/50 shadow-xl"
            style={{
              backdropFilter: 'blur(20px) saturate(180%)',
              WebkitBackdropFilter: 'blur(20px) saturate(180%)',
            }}
          >
            {/* Search bar top highlight */}
            <div
              className="absolute top-0 left-0 right-0 h-px pointer-events-none"
              style={{
                background: 'linear-gradient(90deg, transparent 0%, rgba(255,255,255,0.9) 20%, rgba(255,255,255,1) 50%, rgba(255,255,255,0.9) 80%, transparent 100%)',
              }}
            />
            {/* Search bar inner glow */}
            <div
              className="absolute inset-0 pointer-events-none"
              style={{
                background: 'radial-gradient(ellipse at 50% 0%, rgba(255,255,255,0.4) 0%, transparent 60%)',
              }}
            />
            <div className="relative flex items-center">
              <Search className="absolute left-5 w-5 h-5 text-gray-400" />
              <input
                ref={searchInputRef}
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search modules, features, settings..."
                className="w-full py-4 pl-14 pr-12 bg-transparent text-gray-900 placeholder-gray-400 text-base focus:outline-none"
              />
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery('')}
                  className="absolute right-4 p-1.5 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors"
                >
                  <X className="w-4 h-4" />
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Scrollable Content Area */}
        <div className="flex-1 overflow-auto scrollbar-hidden">
          <div className="relative z-10 w-full min-h-full flex items-start md:items-center justify-center px-6 md:px-12 py-24 md:py-28 pb-10 md:pb-16">
            <div className="w-full max-w-[1400px]">
              {filteredSections.length > 0 ? (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 md:gap-5">
                  {filteredSections.map((section, sectionIndex) => (
                    <div
                      key={section.title}
                      className="animate-slide-up"
                      style={{ animationDelay: `${sectionIndex * 50}ms` }}
                    >
                      <MenuSectionCard 
                        section={section} 
                        activeSection={activeSection}
                        activeItem={activeItem}
                      />
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-12">
                  <p className="text-slate-500 text-lg">No results found for &quot;{searchQuery}&quot;</p>
                  <p className="text-slate-400 text-sm mt-2">Try searching for something else</p>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Footer - Desktop only (Fixed at bottom) */}
        <div 
          className="hidden md:block flex-shrink-0 z-20 px-12 py-5"
          style={{
            background: 'rgba(255, 255, 255, 0.15)',
            backdropFilter: 'blur(20px) saturate(180%)',
            WebkitBackdropFilter: 'blur(20px) saturate(180%)',
            borderTop: '1px solid rgba(255, 255, 255, 0.3)',
          }}
        >
          <div className="max-w-7xl mx-auto flex items-center justify-center gap-8">
            <div className="flex items-center gap-2.5 text-gray-700 text-sm">
              <kbd className="px-3 py-1.5 rounded-lg text-xs font-semibold font-mono text-gray-800 bg-white/90 border border-gray-300 shadow-md">
                ESC
              </kbd>
              <span className="font-medium">to close</span>
            </div>
            <div className="w-px h-5 bg-gray-300/50" />
            <div className="flex items-center gap-2.5 text-gray-700 text-sm">
              <kbd className="px-3 py-1.5 rounded-lg text-xs font-semibold font-mono text-gray-800 bg-white/90 border border-gray-300 shadow-md">
                /
              </kbd>
              <span className="font-medium">to search</span>
            </div>
            <div className="w-px h-5 bg-gray-300/50" />
          </div>
        </div>
      </div>
    </div>
  );
}

function MenuSectionCard({ 
  section, 
  activeSection, 
  activeItem 
}: { 
  section: MenuSection;
  activeSection?: string;
  activeItem?: string;
}) {
  const SectionIcon = section.icon;
  const isActiveSection = activeSection === section.slug;
  const { setIsOpen } = useMegaMenu()
  return (
    <div
      className="group relative p-4 md:p-5 rounded-2xl transition-all duration-300 md:hover:scale-[1.02] overflow-hidden"
      style={{
        background: isActiveSection ? 'rgba(255, 255, 255, 0.98)' : 'rgba(255, 255, 255, 0.75)',
        backdropFilter: 'blur(20px) saturate(180%)',
        WebkitBackdropFilter: 'blur(20px) saturate(180%)',
        border: isActiveSection ? '2px solid rgba(255, 255, 255, 0.9)' : '1px solid rgba(255, 255, 255, 0.5)',
        boxShadow: isActiveSection 
          ? '0 12px 40px rgba(0, 0, 0, 0.15), inset 0 2px 20px rgba(255, 255, 255, 0.5)'
          : '0 8px 32px rgba(31, 38, 135, 0.12), inset 0 2px 16px rgba(255, 255, 255, 0.25)',
      }}
    >
      {/* Card glass overlay - top highlight */}
      <div
        className="absolute top-0 left-0 right-0 h-px pointer-events-none"
        style={{
          background: 'linear-gradient(90deg, transparent 0%, rgba(255,255,255,0.7) 30%, rgba(255,255,255,0.9) 50%, rgba(255,255,255,0.7) 70%, transparent 100%)',
        }}
      />
      {/* Card inner glow */}
      <div
        className="absolute inset-0 rounded-2xl pointer-events-none"
        style={{
          background: 'radial-gradient(ellipse at 30% 0%, rgba(255,255,255,0.3) 0%, transparent 50%)',
        }}
      />
      {/* Card refraction layer */}
      <div
        className="absolute inset-0 rounded-2xl pointer-events-none"
        style={{
          background: 'rgba(255, 255, 255, 0.05)',
          boxShadow: 'inset -8px -8px 0px -10px rgba(255, 255, 255, 0.8), inset 0px -8px 0px -7px rgba(255, 255, 255, 0.5)',
          opacity: 0.6,
        }}
      />
      {/* Section Header */}
      <div className="relative flex items-center gap-3 mb-4">
        <div className={`p-2 rounded-lg transition-all duration-300 ${
          isActiveSection 
            ? 'bg-gradient-to-br from-blue-500 to-blue-600 text-white shadow-lg shadow-blue-500/30' 
            : 'bg-gray-100 text-gray-600 group-hover:bg-gray-200'
        }`}>
          <SectionIcon className="w-5 h-5" />
        </div>
        <h3 className={`font-bold text-sm tracking-tight ${
          isActiveSection ? 'text-gray-900' : 'text-gray-800'
        }`}>
          {section.title}
        </h3>
      </div>

      {/* Menu Items */}
      <ul className="relative space-y-0.5">
        {section.items.map((item) => {
          const ItemIcon = item.icon;
          const isActiveItem = activeItem === item.slug && isActiveSection;
          return (
            <li key={item.slug}>
              <Link
                href={item.route}
                onClick={() => setIsOpen(false)}
                className={`flex items-center gap-2.5 px-3 py-2 rounded-lg transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-blue-500/30 ${
                  isActiveItem
                    ? 'bg-gradient-to-r from-blue-50 to-blue-100/50 text-blue-900 shadow-sm border border-blue-200/50'
                    : 'text-gray-700 hover:text-gray-900 hover:bg-white/70 hover:shadow-sm'
                }`}
              >
                <ItemIcon className={`w-4 h-4 shrink-0 ${
                  isActiveItem ? 'text-blue-600' : 'text-gray-400'
                }`} />
                <span className="text-sm font-medium">{item.label}</span>
              </Link>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

export default MegaMenu;
