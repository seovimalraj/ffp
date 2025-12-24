import { usePathname } from "next/navigation";
import { findSectionBySlug, getSectionByItemSlugFast } from "../menu-data";

export function useActiveMenuSection() {
  const pathname = usePathname();

  const [sectionSlug, itemSlug] = (pathname || "").split("/").filter(Boolean);

  console.log({ sectionSlug, itemSlug });

  // Try to find section by section slug first
  let section = findSectionBySlug(sectionSlug);

  // Fallback: find by item slug if section not found
  if (!section && itemSlug) {
    section = getSectionByItemSlugFast(itemSlug);
  }

  return {
    activeSection: section?.slug,
    activeItem: itemSlug,
    section,
  };
}
