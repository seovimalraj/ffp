'use client';

import { useState, useEffect } from 'react';
import { useTheme } from 'next-themes';

const ThemeToggler = () => {
  const { theme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) {
    return null;
  }

  return (
    <button
      aria-label="theme toggler"
      onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
      className="bg-gray-2 dark:bg-dark-bg flex h-8.5 w-8.5 cursor-pointer items-center justify-center rounded-full text-black hover:bg-gray-3 hover:text-primary dark:text-white dark:hover:bg-dark-2 dark:hover:text-primary"
    >
      <svg
        className="hidden h-4 w-4 dark:block"
        width="16"
        height="16"
        viewBox="0 0 16 16"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
      >
        <path
          d="M14.3536 10.8537L14.3536 10.8537C13.0049 12.204 11.1995 13 9.19172 13C5.88394 13 3.19172 10.3078 3.19172 7C3.19172 4.99219 4.00489 3.18681 5.35359 1.83811L5.35359 1.83811C4.80661 2.38509 4.19172 3.19172 4.19172 4.5C4.19172 6.98528 6.20644 9 8.69172 9C10.0001 9 10.8067 8.38511 11.3536 7.83811L11.3536 7.83811C12.7023 9.18681 13.5 10.9922 13.5 13C13.5 14.3083 12.7023 15.1149 12.1553 15.6619L12.1553 15.6619C13.504 14.3132 14.3083 12.5078 14.3083 10.5C14.3083 9.19172 13.6934 8.38509 13.1464 7.83811L13.1464 7.83811C13.6934 8.38509 14.3536 9.19172 14.3536 10.5C14.3536 11.8083 13.6934 12.6149 13.1464 13.1619L13.1464 13.1619C13.6934 12.6149 14.3536 11.8083 14.3536 10.8537Z"
          fill="currentColor"
        />
      </svg>

      <svg
        className="h-4 w-4 dark:hidden"
        width="18"
        height="18"
        viewBox="0 0 18 18"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
      >
        <path
          d="M8.99981 11.625C10.7255 11.625 12.1243 10.2262 12.1243 8.50056C12.1243 6.77494 10.7255 5.37616 8.99981 5.37616C7.27419 5.37616 5.87541 6.77494 5.87541 8.50056C5.87541 10.2262 7.27419 11.625 8.99981 11.625Z"
          fill="currentColor"
        />
        <path
          d="M14.7812 8.5C14.7812 5.57582 12.4242 3.21875 9.5 3.21875C6.57582 3.21875 4.21875 5.57582 4.21875 8.5C4.21875 11.4242 6.57582 13.7812 9.5 13.7812C12.4242 13.7812 14.7812 11.4242 14.7812 8.5Z"
          stroke="currentColor"
          strokeWidth="1.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <path
          d="M3.05298 13.1355L4.46973 11.7188"
          stroke="currentColor"
          strokeWidth="1.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <path
          d="M13.1355 13.1355L11.7188 11.7188"
          stroke="currentColor"
          strokeWidth="1.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <path
          d="M13.1355 3.05298L11.7188 4.46973"
          stroke="currentColor"
          strokeWidth="1.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <path
          d="M3.05298 3.05298L4.46973 4.46973"
          stroke="currentColor"
          strokeWidth="1.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    </button>
  );
};

export default ThemeToggler;
