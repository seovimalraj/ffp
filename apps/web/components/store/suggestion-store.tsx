import { Suggestion } from "@/utils/suggestion-utils";
import { useContext, createContext, ReactNode, useState, useMemo } from "react";

type SuggestionContextType = {
  isOpen: boolean;
  setIsOpen: React.Dispatch<React.SetStateAction<boolean>>;
  suggestions: Suggestion[];
  setSuggestions: React.Dispatch<React.SetStateAction<Suggestion[]>>;
  suggestionCountMap: Map<string, number>;
  resetSuggestion: () => void;
};

const SuggestionContext = createContext<SuggestionContextType | undefined>(
  undefined,
);

export function SuggestionProvider({ children }: { children: ReactNode }) {
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [isOpen, setIsOpen] = useState<boolean>(false);
  const suggestionCountMap = useMemo(() => {
    const map = new Map<string, number>();
    for (const s of suggestions) {
      map.set(s.partId, (map.get(s.partId) || 0) + 1);
    }
    return map;
  }, [suggestions]);

  const resetSuggestion = () => {
    setSuggestions([]);
  };

  return (
    <SuggestionContext.Provider
      value={{
        isOpen,
        setIsOpen,
        suggestions,
        setSuggestions,
        suggestionCountMap,
        resetSuggestion,
      }}
    >
      {children}
    </SuggestionContext.Provider>
  );
}

export function useSuggestionContext() {
  const ctx = useContext(SuggestionContext);
  if (!ctx) {
    throw new Error(
      "useSuggestionContext must be used inside SuggestionProvider",
    );
  }
  return ctx;
}
