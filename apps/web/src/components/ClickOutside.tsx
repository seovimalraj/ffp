'use client';

import { useEffect, useRef } from 'react';

interface ClickOutsideProps {
  children: React.ReactNode;
  onClick: () => void;
}

const ClickOutside = ({ children, onClick }: ClickOutsideProps) => {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (ref.current && !ref.current.contains(event.target as Node)) {
        onClick();
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [onClick]);

  return <div ref={ref}>{children}</div>;
};

export default ClickOutside;
