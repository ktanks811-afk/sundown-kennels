/* The market shell, the two-step purchase, the bank and the clinics.

   Like the ranch, this is split so the sidebar can sit above whatever market
   screen is showing while the new screens render in the ordinary flow.
   MarketSidebar goes first in the screen list, MarketPanels last. */

function inMarket(tab) { return MARKET_TAB_IDS.indexOf(tab) !== -1; }

function MarketSidebar({ game }) {
  const { tab, setTab, state } = game;
  if (!inMarket(tab)) return null;
  return (
    <div className="kg-mk__head">
      <nav className="kg-mk__nav" aria-label="Market">
        {MARKET_NAV.map((group) => (
          <div key={group.heading} className="kg-mk__group">
            <p className="kg-mk__heading">{group.heading}</p>
            {group.items.map((it) => (
              <button key={it.id}
                className={"kg-mk__link " + (tab === it.id ? "kg-mk__link--on" : "")}
                onClick={() => setTab(it.id)}>{it.label}</button>
            ))}
          </div>
        ))}
      </nav>
      <div className="kg-mk__purse">
        <span>On hand</span><strong>{fmtMoney(state.cash)}</strong>
        <span>Banked</span><strong>{fmtMoney(state.savings || 0)}</strong>
      </div>
    </div>
  );
}

/* ---------------------------- the purchase modal --------------------------- */
/* Two steps on purpose: quantity, then a receipt that says what happened and
   offers the three things a player actually wants next. Buying used to be a
   single click with no confirmation at all, which made a misclick expensive
   and gave no route from "bought it" to "used it". */
function PurchaseModal({ game, itemId, onClose }) {
  const { state, doBuyItem, setTab } = game;
  const [qty, setQty] = useState(1);
  const [bought, setBought] = useState(null);

  const item = ITEMS[itemId];
  if (!item) return null;

  const LIMIT = 25;
  const affordable = Math.max(0, Math.floor(state.cash / item.price));
  const max = Math.min(LIMIT, affordable);
  const total = item.price * qty;

  if (bought) {
    return (
      <Modal title="Bought" onClose={onClose}>
        <Notice tone="success">
          {bought.qty}× {item.name} — {fmtMoney(bought.total)}.
        </Notice>
        <p className="kg-hint" style={{ margin: "10px 0 0" }}>
          {fmtMoney(state.cash)} left on hand.
        </p>
        <div className="kg-mk__after">
          <button className="kg-btn kg-btn--sm" onClick={() => { onClose(); setTab("inventory"); }}>
            Use it now
          </button>
          <button className="kg-btn kg-btn--sm kg-btn--ghost" onClick={() => { onClose(); setTab("inventory"); }}>
            Go to inventory
          </button>
          <button className="kg-btn kg-btn--sm kg-btn--ghost" onClick={onClose}>Keep shopping</button>
        </div>
      </Modal>
    );
  }

  return (
    <Modal title={"Buy " + item.name} onClose={onClose}
      footer={
        <>
          <button className="kg-btn kg-btn--sm kg-btn--ghost" onClick={onClose}>Cancel</button>
          <button className="kg-btn kg-btn--gold" disabled={max < 1 || qty < 1}
            onClick={() => { doBuyItem(itemId, qty); setBought({ qty, total }); }}>
            Buy for {fmtMoney(total)}
          </button>
        </>
      }>
      <div className="kg-mk__buyhead">
        <ItemIcon id={itemId} item={item} size={64} />
        <div>
          <p style={{ margin: 0 }}>{item.desc}</p>
          <p className="kg-hint" style={{ margin: "4px 0 0" }}>{fmtMoney(item.price)} each</p>
        </div>
      </div>

      {max < 1 ? (
        <Notice tone="error" fix={{ label: "Visit the bank", onClick: () => { onClose(); setTab("bank"); } }}>
          Not enough on hand for even one.
        </Notice>
      ) : (
        <label className="kg-ap__field" style={{ marginTop: 12 }}>
          <span>How many? (up to {max})</span>
          <input type="number" min="1" max={max} value={qty}
            onChange={(e) => setQty(Math.max(1, Math.min(max, Number(e.target.value) || 1)))} />
        </label>
      )}
    </Modal>
  );
}

/* --------------------------------- panels ---------------------------------- */

function MarketPanels({ game }) {
  const { tab } = game;
  if (!inMarket(tab)) return null;
  if (tab === "bank") return <BankScreen game={game} />;
  if (tab === "clinic") return <ClinicScreen game={game} />;
  return null;
}

/* The bank exists for one decision: the feed bill is only ever taken from cash,
   never from savings. Money put away survives a bad week and cannot pay for
   one. The interest is small enough that it is never the reason to use it. */
function BankScreen({ game }) {
  const { state, bankMove } = game;
  const [amount, setAmount] = useState("");
  const [dir, setDir] = useState("deposit");
  const [msg, setMsg] = useState(null);

  const cash = state.cash;
  const savings = state.savings || 0;
  const value = Math.max(0, Math.round(Number(amount) || 0));
  const ceiling = dir === "deposit" ? Math.floor(cash) : Math.floor(savings);

  return (
    <section>
      <h2 className="kg-subhead">Bank</h2>
      <div className="kg-mk__balances">
        <div><span>On hand</span><strong>{fmtMoney(cash)}</strong></div>
        <div><span>Banked</span><strong>{fmtMoney(savings)}</strong></div>
        <div><span>Daily wage</span><strong>{fmtMoney(dailySalary(state))}</strong></div>
        <div><span>Interest</span><strong>{(BANK_INTEREST_PER_DAY * 100).toFixed(2)}% a day</strong></div>
      </div>

      <Note title="Why bother">
        The feed bill comes out of cash and never out of savings. Money in here
        is money a bad week cannot eat — and money that cannot cover one either.
        Interest is small on purpose; this is a decision, not a strategy.
      </Note>

      <Panel title="Move money">
        <div className="kg-mk__dirs">
          <button className={"kg-ui-tabs__tab " + (dir === "deposit" ? "kg-ui-tabs__tab--active" : "")}
            onClick={() => { setDir("deposit"); setMsg(null); }}>Deposit</button>
          <button className={"kg-ui-tabs__tab " + (dir === "withdraw" ? "kg-ui-tabs__tab--active" : "")}
            onClick={() => { setDir("withdraw"); setMsg(null); }}>Withdraw</button>
        </div>

        <label className="kg-ap__field" style={{ marginTop: 12 }}>
          <span>Amount (up to {fmtMoney(ceiling)})</span>
          <input type="number" min="0" value={amount} placeholder="0"
            onChange={(e) => { setAmount(e.target.value); setMsg(null); }} />
        </label>

        <button className="kg-btn kg-btn--gold" disabled={value < 1 || value > ceiling}
          onClick={() => {
            bankMove(dir, value);
            setMsg({ tone: "success", text: `${dir === "deposit" ? "Deposited" : "Withdrew"} ${fmtMoney(value)}.` });
            setAmount("");
          }}>
          {dir === "deposit" ? "Deposit" : "Withdraw"}
        </button>

        {value > ceiling && (
          <p className="kg-warn" style={{ margin: "8px 0 0" }}>
            That is more than you have {dir === "deposit" ? "on hand" : "banked"}.
          </p>
        )}
        {msg && <div style={{ marginTop: 10 }}><Notice tone={msg.tone} onDismiss={() => setMsg(null)}>{msg.text}</Notice></div>}
      </Panel>
    </section>
  );
}

/* Vaccination routes here rather than having one price, which is the point:
   the question is which clinic, not whether to click. */
function ClinicScreen({ game }) {
  const { state, vaccinateAt, setTab } = game;
  const [dogId, setDogId] = useState("");
  const [msg, setMsg] = useState(null);

  const dogs = state.dogs || [];
  const chosen = dogs.find((d) => d.id === dogId) || dogs[0];

  return (
    <section>
      <h2 className="kg-subhead">Clinics</h2>
      <p className="kg-hint">
        Vaccination has no single price — every practice charges what it charges,
        and the dearer ones certify for longer. Pick the dog, then pick who takes it.
      </p>

      {dogs.length === 0 ? (
        <p className="kg-empty">No dogs to take anywhere.</p>
      ) : (
        <>
          <div className="kg-pairpick">
            <select value={chosen ? chosen.id : ""} onChange={(e) => { setDogId(e.target.value); setMsg(null); }}>
              {dogs.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.name} — {breedShort(d.breed)}
                  {isVaccinated(d, state.day) ? ` (good to day ${d.vaccinatedUntilDay})` : " (lapsed)"}
                </option>
              ))}
            </select>
          </div>

          {msg && <div style={{ margin: "10px 0" }}><Notice tone={msg.tone} onDismiss={() => setMsg(null)}>{msg.text}</Notice></div>}

          <div className="kg-shopgrid" style={{ marginTop: 12 }}>
            {CLINICS.map((c) => {
              const days = 365 + c.bonusDays;
              const afford = state.cash >= c.price;
              return (
                <div key={c.id} className="kg-shopitem">
                  <div className="kg-shopitem__head">
                    <strong>{c.name}</strong>
                    <span className="kg-shopitem__price">{fmtMoney(c.price)}</span>
                  </div>
                  <p className="kg-shopitem__desc">{c.blurb}</p>
                  <div className="kg-shopitem__effects">
                    <Badge tone="olive">Certifies {days} days</Badge>
                    {c.bonusDays > 0 && <Badge tone="denim">+{c.bonusDays} over the county rate</Badge>}
                  </div>
                  <div className="kg-shopitem__foot">
                    <button className="kg-btn kg-btn--sm" disabled={!chosen || !afford}
                      onClick={() => {
                        vaccinateAt(c.id, chosen.id);
                        setMsg({ tone: "success", text: `${chosen.name} vaccinated at ${c.name} — good for ${days} days.` });
                      }}>
                      {!afford ? "Can't afford" : "Take " + (chosen ? chosen.name : "a dog")}
                    </button>
                  </div>
                </div>
              );
            })}
          </div>

          <Note title="Coming with the player economy">
            These are county practices. Player-run clinics — your own prices, your
            own customers — need a table of their own in the database; when that
            lands they appear in this same list and nothing else changes.
          </Note>

          <p style={{ marginTop: 12 }}>
            <button className="kg-ui-links__link" onClick={() => setTab("shop")}>
              Or buy a vaccination off the shelf and give it yourself →
            </button>
          </p>
        </>
      )}
    </section>
  );
}
