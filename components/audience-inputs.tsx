import type { AudienceFavourites } from "@/lib/types";
import { Icon } from "./icons";

const groups = [
  { key: "books", label: "Books", icon: "book", placeholder: "e.g. The Namesake" },
  { key: "films", label: "Films", icon: "film", placeholder: "e.g. The Lunchbox" },
  {
    key: "musicians",
    label: "Musicians",
    icon: "music",
    placeholder: "e.g. A. R. Rahman",
  },
] as const;

export function AudienceInputs({
  value,
  onChange,
}: {
  value: AudienceFavourites;
  onChange: (value: AudienceFavourites) => void;
}) {
  return (
    <section aria-labelledby="audience-title">
      <div className="section-heading">
        <div>
          <p className="eyebrow">01 / SET THE SCENE</p>
          <h2 id="audience-title">Your audience</h2>
        </div>
        <span className="small-tag">Optional</span>
      </div>
      <p className="quiet audience-intro" id="audience-help">
        What do your readers love? Add one favourite per line.
      </p>
      <div className="audience-fields">
        {groups.map(({ key, label, icon, placeholder }) => (
          <div className="field" key={key}>
            <label className="field-label" htmlFor={`favourite-${key}`}>
              <Icon name={icon} />
              {label}
            </label>
            <textarea
              id={`favourite-${key}`}
              className="textarea favourites-input"
              rows={2}
              value={value[key]}
              placeholder={placeholder}
              aria-describedby="audience-help audience-limit"
              onChange={(event) =>
                onChange({ ...value, [key]: event.target.value })
              }
            />
          </div>
        ))}
      </div>
      <p className="input-note" id="audience-limit">
        <span className="note-dot" />
        Collected for future taste matching. These inputs do not influence sample
        results yet.
      </p>
    </section>
  );
}
