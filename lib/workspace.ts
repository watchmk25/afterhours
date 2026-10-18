import type {
  Book,
  BookLanguage,
  FilterInputs,
  WorkspaceInputs,
} from "./types.ts";

export const LANGUAGES: readonly BookLanguage[] = [
  "English",
  "Hindi",
  "Bengali",
];

export function createDefaultInputs(): WorkspaceInputs {
  return {
    audience: { books: "", films: "", musicians: "" },
    filters: {
      maxPrice: "600",
      maxPages: "400",
      languages: [...LANGUAGES],
    },
  };
}

export function createExampleInputs(): WorkspaceInputs {
  return {
    audience: {
      books: "The Namesake\nMalgudi Days",
      films: "The Lunchbox\nPiku",
      musicians: "Prateek Kuhad\nNorah Jones",
    },
    filters: { maxPrice: "450", maxPages: "300", languages: ["English"] },
  };
}

export type FilterErrors = {
  maxPrice?: string;
  maxPages?: string;
  languages?: string;
};

export function validateFilters(inputs: FilterInputs): FilterErrors {
  const errors: FilterErrors = {};
  const price = inputs.maxPrice.trim();
  const pages = inputs.maxPages.trim();

  if (
    !/^(?:\d+(?:\.\d{1,2})?|\.\d{1,2})$/.test(price) ||
    !Number.isFinite(Number(price)) ||
    Number(price) <= 0
  ) {
    errors.maxPrice = "Enter a price greater than zero, with up to 2 decimal places.";
  }

  if (
    !/^\d+$/.test(pages) ||
    !Number.isSafeInteger(Number(pages)) ||
    Number(pages) <= 0
  ) {
    errors.maxPages = "Enter a whole page count greater than zero.";
  }

  if (
    inputs.languages.length === 0 ||
    inputs.languages.some((language) => !LANGUAGES.includes(language))
  ) {
    errors.languages = "Choose at least one supported language.";
  }

  return errors;
}

export function filterBooks(
  catalogue: readonly Book[],
  filters: FilterInputs,
): Book[] {
  if (Object.keys(validateFilters(filters)).length > 0) return [];

  return catalogue
    .filter(
      (book) =>
        book.stock > 0 &&
        book.priceInr <= Number(filters.maxPrice) &&
        book.pages <= Number(filters.maxPages) &&
        filters.languages.includes(book.language),
    )
    .sort((first, second) => first.title.localeCompare(second.title, "en"));
}

export function getEligibleSelection(
  selectedId: string | null,
  eligibleBooks: readonly Book[],
): Book | null {
  return eligibleBooks.find((book) => book.id === selectedId) ?? null;
}
