export type BookLanguage = "English" | "Hindi" | "Bengali";

export type Book = {
  id: string;
  title: string;
  author: string;
  language: BookLanguage;
  priceInr: number;
  pages: number;
  stock: number;
  coverColor: string;
};

export type FilterInputs = {
  maxPrice: string;
  maxPages: string;
  languages: BookLanguage[];
};

export type AudienceFavourites = {
  books: string;
  films: string;
  musicians: string;
};

export type WorkspaceInputs = {
  audience: AudienceFavourites;
  filters: FilterInputs;
};
