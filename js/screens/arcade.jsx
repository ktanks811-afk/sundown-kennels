/* The arcade, the registries and the adoption centre.

   The games share one rule set rather than each inventing its own: a daily
   play cap, a streak that survives between visits, and a payout that scales
   with the streak. Without a cap these are a money printer; without a streak
   they are a slot machine you click while thinking about something else. */

const ARCADE_GAMES = [
  { id: "scramble", name: "Name That Breed", blurb: "A breed name with the letters shuffled.", cap: 12, pay: 45 },
  { id: "throw",    name: "Ball, Frisbee, Bone", blurb: "Three things to throw. The dog has opinions.", cap: 15, pay: 30 },
  { id: "genes",    name: "Gene Genie", blurb: "What the game's own genetics actually do.", cap: 12, pay: 60 },
  { id: "find",     name: "Lost and Found", blurb: "Something got dragged off. Find where.", cap: 10, pay: 35 },
];

function arcadeStateFor(state, id) {
  const all = state.arcade || {};
  const row = all[id];
  if (!row || row.day !== state.day) return { day: state.day, plays: 0, streak: (row && row.streak) || 0 };
  return row;
}
function playsLeft(state, id) {
  const def = ARCADE_GAMES.find((g) => g.id === id);
  return Math.max(0, def.cap - arcadeStateFor(state, id).plays);
}
/* Streak pays, but with a ceiling — a long run should feel rewarded without
   turning the arcade into the best-paying thing on the place. */
function arcadePayout(base, streak) {
  return Math.round(base * Math.min(3, 1 + streak * 0.15));
}

function ArcadeScreen({ game }) {
  const { tab, state, setTab } = game;
  const [open, setOpen] = useState(null);
  if (tab !== "arcade") return null;

  return (
    <section>
      <h2 className="kg-subhead">The Arcade</h2>
      <p className="kg-hint">
        Something to do between hunts. Every game has a daily limit and a streak
        that carries between visits — the money is real but it is never the reason
        to keep a kennel.
      </p>

      <div className="kg-shopgrid">
        {ARCADE_GAMES.map((g) => {
          const left = playsLeft(state, g.id);
          const streak = arcadeStateFor(state, g.id).streak;
          return (
            <div key={g.id} className="kg-shopitem">
              <div className="kg-shopitem__head">
                <strong>{g.name}</strong>
                <span className="kg-shopitem__price">{fmtMoney(arcadePayout(g.pay, streak))}</span>
              </div>
              <p className="kg-shopitem__desc">{g.blurb}</p>
              <div className="kg-shopitem__effects">
                <Badge tone={left ? "olive" : "rust"}>{left} of {g.cap} left today</Badge>
                {streak > 0 && <Badge tone="gold">{streak} in a row</Badge>}
              </div>
              <div className="kg-shopitem__foot">
                <button className="kg-btn kg-btn--sm" disabled={!left} onClick={() => setOpen(g.id)}>
                  {left ? "Play" : "Back tomorrow"}
                </button>
              </div>
            </div>
          );
        })}
      </div>

      {open === "scramble" && <ScrambleGame game={game} onClose={() => setOpen(null)} />}
      {open === "throw" && <ThrowGame game={game} onClose={() => setOpen(null)} />}
      {open === "genes" && <GeneGame game={game} onClose={() => setOpen(null)} />}
      {open === "find" && <FindGame game={game} onClose={() => setOpen(null)} />}
    </section>
  );
}

/* ------------------------------- the games --------------------------------- */

function shuffleWord(word, rnd) {
  const chars = word.split("");
  for (let i = chars.length - 1; i > 0; i--) {
    const j = Math.floor(rnd() * (i + 1));
    const t = chars[i]; chars[i] = chars[j]; chars[j] = t;
  }
  const out = chars.join("");
  return out === word && word.length > 2 ? shuffleWord(word, rnd) : out;
}

function ScrambleGame({ game, onClose }) {
  const { state, arcadePlay } = game;
  const [answer, setAnswer] = useState("");
  const [hinted, setHinted] = useState(false);
  const [result, setResult] = useState(null);
  const [target] = useState(() => BREED_NAMES[Math.floor(Math.random() * BREED_NAMES.length)]);
  const scrambled = useState(() => target.split(" ").map((w) => shuffleWord(w, Math.random)).join(" "))[0];

  const streak = arcadeStateFor(state, "scramble").streak;

  return (
    <Modal title="Name That Breed" onClose={onClose}
      footer={result
        ? <button className="kg-btn kg-btn--gold" onClick={onClose}>Done</button>
        : (
          <>
            {/* A hint costs the streak rather than costing money: the thing
                worth protecting is the run, so that is what it spends. */}
            <button className="kg-btn kg-btn--sm kg-btn--ghost" disabled={hinted}
              onClick={() => setHinted(true)}>Hint (breaks the streak)</button>
            <button className="kg-btn kg-btn--gold" disabled={!answer.trim()}
              onClick={() => {
                const right = answer.trim().toLowerCase() === target.toLowerCase();
                const paid = arcadePlay("scramble", right && !hinted);
                setResult({ right, paid, target });
              }}>Guess</button>
          </>
        )}>
      {result ? (
        <Notice tone={result.right ? "success" : "error"}>
          {result.right
            ? `${result.target}. ${result.paid ? "Paid " + fmtMoney(result.paid) + "." : "No pay — the hint cost you that."}`
            : `It was ${result.target}.`}
        </Notice>
      ) : (
        <>
          <p className="kg-hint" style={{ margin: "0 0 8px" }}>
            {streak > 0 ? `${streak} in a row so far.` : "Get it right to start a run."}
          </p>
          <p className="kg-arcade__word">{scrambled}</p>
          {hinted && <Note title="Hint">A {BREED_GROUP_LABELS[breedGroup(target)]} breed, {target.split(" ").length} word{target.split(" ").length > 1 ? "s" : ""}, starting with {target.charAt(0)}.</Note>}
          <label className="kg-ap__field" style={{ marginTop: 10 }}>
            <span>Which breed is it?</span>
            <input value={answer} autoFocus onChange={(e) => setAnswer(e.target.value)} />
          </label>
        </>
      )}
    </Modal>
  );
}

const THROW_OPTIONS = [
  { id: "ball", label: "Ball", beats: "bone" },
  { id: "frisbee", label: "Frisbee", beats: "ball" },
  { id: "bone", label: "Bone", beats: "frisbee" },
];

function ThrowGame({ game, onClose }) {
  const { arcadePlay } = game;
  const [result, setResult] = useState(null);

  return (
    <Modal title="Ball, Frisbee, Bone" onClose={onClose}
      footer={result && <button className="kg-btn kg-btn--gold" onClick={onClose}>Done</button>}>
      {result ? (
        <Notice tone={result.won ? "success" : result.drew ? "info" : "error"}>
          You threw the {result.mine}, the dog wanted the {result.theirs}.{" "}
          {result.won ? `Paid ${fmtMoney(result.paid)}.` : result.drew ? "A draw — nothing either way." : "Not this time."}
        </Notice>
      ) : (
        <>
          <p style={{ margin: "0 0 10px" }}>Ball beats bone, frisbee beats ball, bone beats frisbee.</p>
          <div className="kg-arcade__throws">
            {THROW_OPTIONS.map((o) => (
              <button key={o.id} className="kg-ui-tile"
                onClick={() => {
                  const theirs = THROW_OPTIONS[Math.floor(Math.random() * 3)];
                  const won = o.beats === theirs.id;
                  const drew = o.id === theirs.id;
                  const paid = arcadePlay("throw", won);
                  setResult({ won, drew, paid, mine: o.label.toLowerCase(), theirs: theirs.label.toLowerCase() });
                }}>
                {o.label}
              </button>
            ))}
          </div>
        </>
      )}
    </Modal>
  );
}

/* Questions come from the rules the game actually runs, so a player who does
   well here has learned something that pays off in the breeding pen. */
const GENE_QUESTIONS = [
  { q: "Two merle dogs bred together — what is the risk?",
    a: ["Double merle pups, often deaf or blind", "Nothing, merle is harmless", "The litter comes out smaller", "All pups are merle"], right: 0 },
  { q: "A dog carries a hidden colour gene. What does that mean?",
    a: ["It can appear in the pups even though the dog does not show it", "The dog will change colour with age",
        "It makes the dog worth less", "It only matters for registration"], right: 0 },
  { q: "What does crossing two different breeds tend to give the pups?",
    a: ["Hybrid vigour", "Guaranteed higher stats", "A registry title", "Nothing at all"], right: 0 },
  { q: "Where does a pup's height come from?",
    a: ["Both parents, with some variation", "Only the sire", "Only the dam", "It is fixed by breed"], right: 0 },
  { q: "A dog with two copies of the muscling gene is:",
    a: ["Double muscled — stronger but less enduring", "Exactly the same as one copy",
        "Unable to breed", "Always disqualified"], right: 0 },
  { q: "Registered parents matter because:",
    a: ["Papers and a registry entry raise what the pups are worth", "They breed faster",
        "Their pups are always merle", "It removes hidden genes"], right: 0 },
];

function GeneGame({ game, onClose }) {
  const { state, arcadePlay } = game;
  const [q] = useState(() => GENE_QUESTIONS[Math.floor(Math.random() * GENE_QUESTIONS.length)]);
  const [order] = useState(() => q.a.map((text, i) => ({ text, i })).sort(() => Math.random() - 0.5));
  const [result, setResult] = useState(null);
  const streak = arcadeStateFor(state, "genes").streak;

  return (
    <Modal title="Gene Genie" onClose={onClose}
      footer={result && <button className="kg-btn kg-btn--gold" onClick={onClose}>Done</button>}>
      {result ? (
        <Notice tone={result.right ? "success" : "error"}>
          {result.right ? `Right. Paid ${fmtMoney(result.paid)}.` : `Not quite — it was "${q.a[q.right]}".`}
        </Notice>
      ) : (
        <>
          <p className="kg-hint" style={{ margin: "0 0 8px" }}>{streak > 0 ? `${streak} in a row.` : "Straight questions about how this game breeds dogs."}</p>
          <p style={{ margin: "0 0 10px", fontWeight: 600 }}>{q.q}</p>
          <div className="kg-arcade__answers">
            {order.map((opt) => (
              <button key={opt.i} className="kg-btn kg-btn--sm kg-btn--ghost"
                onClick={() => {
                  const right = opt.i === q.right;
                  setResult({ right, paid: arcadePlay("genes", right) });
                }}>{opt.text}</button>
            ))}
          </div>
        </>
      )}
    </Modal>
  );
}

const FIND_SPOTS = ["Under the porch", "Behind the feed shed", "In the truck bed", "Down by the creek", "In the hay", "Back of the kennel run"];

function FindGame({ game, onClose }) {
  const { arcadePlay } = game;
  const [hidden] = useState(() => Math.floor(Math.random() * FIND_SPOTS.length));
  const [tried, setTried] = useState([]);
  const [result, setResult] = useState(null);

  return (
    <Modal title="Lost and Found" onClose={onClose}
      footer={result && <button className="kg-btn kg-btn--gold" onClick={onClose}>Done</button>}>
      {result ? (
        <Notice tone="success">
          Found it {FIND_SPOTS[hidden].toLowerCase()} after {result.tries} look{result.tries > 1 ? "s" : ""}.
          Paid {fmtMoney(result.paid)}.
        </Notice>
      ) : (
        <>
          <p style={{ margin: "0 0 10px" }}>
            One of them has dragged a toy off again. Fewer looks, better pay.
          </p>
          <div className="kg-arcade__spots">
            {FIND_SPOTS.map((spot, i) => (
              <button key={spot} className="kg-ui-tile" disabled={tried.includes(i)}
                onClick={() => {
                  if (i === hidden) {
                    const tries = tried.length + 1;
                    // Faster finds pay more; the streak still applies on top.
                    setResult({ tries, paid: arcadePlay("find", true, Math.max(0.4, 1 - (tries - 1) * 0.18)) });
                  } else setTried((t) => t.concat(i));
                }}>
                {tried.includes(i) ? "Nothing here" : spot}
              </button>
            ))}
          </div>
        </>
      )}
    </Modal>
  );
}

/* ------------------------------- registries -------------------------------- */

function RegistriesScreen({ game }) {
  const { tab, state, registerInRegistry, setViewDog } = game;
  const [pick, setPick] = useState({});
  if (tab !== "registries") return null;

  const dogs = state.dogs || [];

  return (
    <section>
      <h2 className="kg-subhead">Breed Registries</h2>
      <p className="kg-hint">
        Separate from the papers a dog already carries. Papers say what a dog is;
        a registry entry says the line is being kept — and the value of that lands
        on its pups rather than on the dog in front of you.
      </p>

      {REGISTRY_KEYS.map((key) => {
        const reg = REGISTRIES[key];
        const eligible = dogs.filter((d) => breedGroup(d.breed) === key && d.registered && !d.registryKey);
        const enrolled = dogs.filter((d) => d.registryKey === key);
        const chosen = pick[key] || (eligible[0] && eligible[0].id) || "";
        return (
          <Panel key={key} title={reg.name} right={`${enrolled.length} on the book`}>
            <p className="kg-ranch__profblurb" style={{ margin: "0 0 8px" }}>{reg.blurb}</p>
            <p className="kg-hint" style={{ margin: "0 0 10px" }}>
              {BREED_GROUP_LABELS[key]} · {fmtMoney(reg.fee)} to enter ·
              pups worth {Math.round(reg.offspringBonus * 100)}% more
            </p>

            {enrolled.length > 0 && (
              <p style={{ margin: "0 0 10px", fontSize: 13 }}>
                On the book:{" "}
                {enrolled.map((d, i) => (
                  <span key={d.id}>
                    {i > 0 && ", "}
                    <button className="kg-ui-links__link" onClick={() => setViewDog(d)}>{d.name}</button>
                  </span>
                ))}
              </p>
            )}

            {eligible.length === 0 ? (
              <Notice tone="info" fix={{ label: "The yard", onClick: () => game.setTab("kennel") }}>
                Nothing eligible. A dog needs papers of its own before a registry will
                take it, and it has to be a {BREED_GROUP_LABELS[key].toLowerCase()} breed.
              </Notice>
            ) : (
              <div className="kg-pairpick">
                <select value={chosen} onChange={(e) => setPick((p) => ({ ...p, [key]: e.target.value }))}>
                  {eligible.map((d) => <option key={d.id} value={d.id}>{d.name} — {breedShort(d.breed)}</option>)}
                </select>
                <button className="kg-btn kg-btn--sm" disabled={state.cash < reg.fee}
                  onClick={() => registerInRegistry(key, chosen)}>
                  {state.cash < reg.fee ? "Can't afford" : `Enter — ${fmtMoney(reg.fee)}`}
                </button>
              </div>
            )}
          </Panel>
        );
      })}
    </section>
  );
}
