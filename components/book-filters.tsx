import type { FilterInputs } from "@/lib/types";
import { validateFilters } from "@/lib/workspace";
import { Icon } from "./icons";

export function BookFilters({
  value,
  languages,
  onChange,
}: {
  value: FilterInputs;
  languages: readonly string[];
  onChange: (value: FilterInputs) => void;
}) {
  const errors = validateFilters(value, languages);
  return (
    <section className="filters-section" aria-labelledby="filters-title">
      <h3 className="subsection-title" id="filters-title">
        <Icon name="sliders" />
        Practical details
      </h3>
      <p className="quiet">Only these limits and stock affect eligibility.</p>
      <div className="numeric-filters">
        <div className="field">
          <label className="field-label" htmlFor="max-price">
            Max price per copy
          </label>
          <div className="input-with-unit">
            <span aria-hidden="true">₹</span>
            <input
              id="max-price"
              type="number"
              min="0.01"
              step="0.01"
              inputMode="decimal"
              className="input"
              value={value.maxPrice}
              onChange={(event) =>
                onChange({ ...value, maxPrice: event.target.value })
              }
              required
              aria-invalid={!!errors.maxPrice}
              aria-describedby={`price-unit${errors.maxPrice ? " price-error" : ""}`}
            />
          </div>
          <span className="field-hint" id="price-unit">
            Indian rupees (INR)
          </span>
          {errors.maxPrice && (
            <p className="field-error" id="price-error">
              {errors.maxPrice}
            </p>
          )}
        </div>
        <div className="field">
          <label className="field-label" htmlFor="max-pages">
            Max page count
          </label>
          <input
            id="max-pages"
            type="number"
            min="1"
            step="1"
            inputMode="numeric"
            className="input"
            value={value.maxPages}
            onChange={(event) =>
              onChange({ ...value, maxPages: event.target.value })
            }
            required
            aria-invalid={!!errors.maxPages}
            aria-describedby={errors.maxPages ? "pages-error" : undefined}
          />
          <span className="field-hint">Pages per book</span>
          {errors.maxPages && (
            <p className="field-error" id="pages-error">
              {errors.maxPages}
            </p>
          )}
        </div>
      </div>
      <fieldset
        className="language-filter"
        aria-describedby={errors.languages ? "languages-error" : undefined}
      >
        <legend className="field-label">Languages</legend>
        <div className="language-options">
          {languages.map((language) => (
            <label className="language-option" key={language}>
              <input
                type="checkbox"
                checked={value.languages.includes(language)}
                onChange={(event) =>
                  onChange({
                    ...value,
                    languages: event.target.checked
                      ? [...value.languages, language]
                      : value.languages.filter((item) => item !== language),
                  })
                }
              />
              <span>{language}</span>
            </label>
          ))}
        </div>
        {errors.languages && (
          <p className="field-error" id="languages-error">
            {errors.languages}
          </p>
        )}
      </fieldset>
    </section>
  );
}
