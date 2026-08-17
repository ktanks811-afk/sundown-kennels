/* The shared building blocks for the homestead layout.

   Phase 3 of the rebuild. Everything here is chrome — a panel, a tab strip, a
   banner, a meter — with no knowledge of dogs, hunts or money. Screens compose
   these rather than hand-rolling their own markup, which is what stops the
   twelfth table from looking slightly unlike the other eleven.

   Class names are all prefixed kg-ui- so they cannot collide with the frame or
   sidebar layouts, which keep their own styles untouched. */

/* ------------------------------- section card ------------------------------ */
/* Dark header bar over a cream body. The workhorse: it is the animal profile's
   Interact/Status/Breed stack, the kennel's Places/Earnings list, and most
   sidebar furniture. `collapsible` adds the [+]/[-] toggle on the right. */
function Panel({ title, children, collapsible, defaultOpen = true, right, tone, className = "" }) {
  const [open, setOpen] = useState(defaultOpen);
  const bodyId = useRef("kg-panel-" + Math.random().toString(36).slice(2, 9)).current;
  return (
    <section className={"kg-ui-panel " + (tone ? "kg-ui-panel--" + tone + " " : "") + className}>
      <div className="kg-ui-panel__bar">
        {collapsible ? (
          <button type="button" className="kg-ui-panel__toggle" aria-expanded={open} aria-controls={bodyId}
            onClick={() => setOpen((v) => !v)}>
            <span className="kg-ui-panel__title">{title}</span>
            <span className="kg-ui-panel__sign" aria-hidden="true">{open ? "−" : "+"}</span>
          </button>
        ) : (
          <>
            <span className="kg-ui-panel__title">{title}</span>
            {right && <span className="kg-ui-panel__right">{right}</span>}
          </>
        )}
      </div>
      {(!collapsible || open) && <div className="kg-ui-panel__body" id={bodyId}>{children}</div>}
    </section>
  );
}

/* -------------------------------- tab strip -------------------------------- */
/* One continuous bordered strip of pills directly under a page title. Active is
   dark brown on cream; the rest are muted tan. */
function TabStrip({ tabs, active, onPick, ariaLabel = "Sections" }) {
  return (
    <div className="kg-ui-tabs" role="tablist" aria-label={ariaLabel}>
      {tabs.map((t) => {
        const id = typeof t === "string" ? t : t.id;
        const label = typeof t === "string" ? t : t.label;
        const isActive = id === active;
        return (
          <button key={id} type="button" role="tab" aria-selected={isActive}
            className={"kg-ui-tabs__tab " + (isActive ? "kg-ui-tabs__tab--active" : "")}
            onClick={() => onPick(id)}>
            {label}
            {typeof t === "object" && t.count != null && <span className="kg-ui-tabs__count">{t.count}</span>}
          </button>
        );
      })}
    </div>
  );
}

/* --------------------------------- banners --------------------------------- */
/* Three tones, one component. The `fix` prop is the important part: a blocked
   action is never allowed to be a dead end, so an error banner carries the link
   that resolves it — "must be vaccinated" points at the clinic. */
const NOTICE_ICONS = { info: "i", success: "✓", error: "!", warn: "!" };

function Notice({ tone = "info", children, fix, onDismiss }) {
  return (
    <div className={"kg-ui-notice kg-ui-notice--" + tone} role={tone === "error" ? "alert" : undefined}>
      <span className="kg-ui-notice__icon" aria-hidden="true">{NOTICE_ICONS[tone] || "i"}</span>
      <div className="kg-ui-notice__body">
        <span>{children}</span>
        {fix && (
          <button type="button" className="kg-ui-notice__fix" onClick={fix.onClick}>{fix.label}</button>
        )}
      </div>
      {onDismiss && (
        <button type="button" className="kg-ui-notice__x" onClick={onDismiss} aria-label="Dismiss">×</button>
      )}
    </div>
  );
}

/* Neutral tan panel for flavour text, tips and long explanations. */
function Note({ title, children }) {
  return (
    <div className="kg-ui-note">
      {title && <p className="kg-ui-note__title">{title}</p>}
      <div className="kg-ui-note__body">{children}</div>
    </div>
  );
}

/* --------------------------------- meters ---------------------------------- */
/* A bar plus its number, always together — a bar with no readout is a shrug.
   The label carries the explanation of what moves it, because "Energy 60%" does
   not tell a new player what spends energy. */
const METER_TONES = { energy: "energy", condition: "good", happiness: "good", grooming: "good", comfort: "good" };

function Meter({ label, value, max = 100, tone, hint, unit = "%" }) {
  const pct = max > 0 ? Math.max(0, Math.min(100, (value / max) * 100)) : 0;
  const empty = value <= 0;
  const cls = "kg-ui-meter__fill kg-ui-meter__fill--" + (tone || METER_TONES[String(label).toLowerCase()] || "good");
  return (
    <div className={"kg-ui-meter " + (empty ? "kg-ui-meter--empty" : "")}>
      <div className="kg-ui-meter__head">
        <span className="kg-ui-meter__label" title={hint || undefined} tabIndex={hint ? 0 : undefined}>
          {label}{hint && <span className="kg-ui-meter__q" aria-hidden="true">?</span>}
        </span>
        <span className="kg-ui-meter__value">
          {Math.round(value)}{unit === "%" ? "%" : unit ? " " + unit : ""}
          {max !== 100 && unit !== "%" ? " / " + max : ""}
        </span>
      </div>
      <div className="kg-ui-meter__track" role="progressbar" aria-label={String(label)}
        aria-valuenow={Math.round(value)} aria-valuemin={0} aria-valuemax={max}>
        {!empty && <div className={cls} style={{ width: pct + "%" }} />}
      </div>
    </div>
  );
}

/* --------------------------------- tables ---------------------------------- */
/* Sortable headers render as plain-text links with the current sort underlined,
   which is the convention the rest of this shell follows. Wide tables scroll
   inside their own container so the page never moves sideways. */
function DataTable({ columns, rows, sort, onSort, empty = "Nothing here yet.", rowKey }) {
  if (!rows.length) return <p className="kg-ui-empty">{empty}</p>;
  return (
    <div className="kg-ui-tablewrap">
      <table className="kg-ui-table">
        <thead>
          <tr>
            {columns.map((c) => (
              <th key={c.key} style={c.width ? { width: c.width } : undefined}
                className={c.align === "right" ? "kg-ui-table__right" : ""}>
                {c.sortable && onSort ? (
                  <button type="button"
                    className={"kg-ui-table__sort " + (sort === c.key ? "kg-ui-table__sort--on" : "")}
                    onClick={() => onSort(c.key)}>{c.label}</button>
                ) : c.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((r, i) => (
            <tr key={rowKey ? rowKey(r, i) : i}>
              {columns.map((c) => (
                <td key={c.key} className={c.align === "right" ? "kg-ui-table__right" : ""}>
                  {c.render ? c.render(r, i) : r[c.key]}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/* --------------------------------- modal ----------------------------------- */
/* Purchases, competition entry and use-item flows open here rather than
   navigating, so the player keeps their place in whatever list they were
   reading. Escape and a backdrop click both close. */
function Modal({ title, onClose, children, footer, wide }) {
  useEffect(() => {
    const onKey = (e) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <div className="kg-ui-backdrop" onClick={onClose}>
      <div className={"kg-ui-modal " + (wide ? "kg-ui-modal--wide" : "")} role="dialog" aria-modal="true"
        aria-label={typeof title === "string" ? title : undefined}
        onClick={(e) => e.stopPropagation()}>
        <div className="kg-ui-modal__bar">
          <span className="kg-ui-modal__title">{title}</span>
          <button type="button" className="kg-ui-modal__x" onClick={onClose} aria-label="Close">×</button>
        </div>
        <div className="kg-ui-modal__body">{children}</div>
        {footer && <div className="kg-ui-modal__foot">{footer}</div>}
      </div>
    </div>
  );
}

/* ------------------------------ sidebar boxes ------------------------------ */
function SideBox({ title, children, className = "" }) {
  return (
    <div className={"kg-ui-sidebox " + className}>
      {title && <p className="kg-ui-sidebox__title">{title}</p>}
      <div className="kg-ui-sidebox__body">{children}</div>
    </div>
  );
}

/* A stack of plain text links. The current page shows muted and inert rather
   than vanishing, so the list never changes shape as you move around it. */
function LinkStack({ links, current, onPick }) {
  return (
    <ul className="kg-ui-links">
      {links.map((l) => (
        <li key={l.id}>
          {l.id === current ? (
            <span className="kg-ui-links__here">{l.label}</span>
          ) : (
            <button type="button" className="kg-ui-links__link" onClick={() => onPick(l.id)}>{l.label}</button>
          )}
        </li>
      ))}
    </ul>
  );
}

/* A level gate that stays visible instead of hiding what it guards — a locked
   thing you can see is a goal, a thing that is not rendered is nothing. */
function LockedTile({ label, requirement, children, unlocked, onClick }) {
  if (unlocked) {
    return <button type="button" className="kg-ui-tile" onClick={onClick}>{children || label}</button>;
  }
  return (
    <div className="kg-ui-tile kg-ui-tile--locked" aria-disabled="true">
      <span className="kg-ui-tile__lock" aria-hidden="true">🔒</span>
      <span className="kg-ui-tile__label">{label}</span>
      <span className="kg-ui-tile__req">{requirement}</span>
    </div>
  );
}
