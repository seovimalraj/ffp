import { cn } from "@/lib/utils";
import { useTheme } from "next-themes";
import { useEffect, useState } from "react";
import { Moon, Sun } from "./theme-icons";

const THEMES = [
  {
    name: "light",
    Icon: Sun,
  },
  {
    name: "dark",
    Icon: Moon,
  },
];

export function ThemeToggleSwitch() {
  const { theme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) {
    return null;
  }

  return (
    <div className="flex items-center gap-2">
      {THEMES.map(({ name, Icon }) => (
        <button
          key={name}
          onClick={() => setTheme(name)}
          className={cn(
            "flex h-10 w-10 items-center justify-center rounded-lg transition-colors hover:bg-gray-100 dark:hover:bg-gray-800",
            theme === name && "bg-primary text-white hover:bg-primary/90"
          )}
          aria-label={`Switch to ${name} theme`}
        >
          <Icon className="h-5 w-5" />
        </button>
      ))}
    </div>
  );
}
