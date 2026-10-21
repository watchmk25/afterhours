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
    <details className="audience-notes">
      <summary>Optional audience notes</summary>
      <p className="quiet audience-intro" id="audience-help">
        Add one favourite per line for your own reference. These unconfirmed
        notes do not influence matching or event planning. Use the confirmed
        interests above as your audience input.
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
        Free text is not sent to Qloo and never becomes a matching signal.
        Confirm films or musicians in Live Qloo matching to use them for ranking.
        These notes do not change eligibility.
      </p>
    </details>
  );
}
