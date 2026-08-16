/* First-run onboarding: name the kennel and pick two starter dogs. */

/* First-time setup: name the kennel, then pick exactly 2 starter dogs from
   a fresh set of candidates to found the roster with. */
function KennelSetup({ onComplete, cloudAuth, themeToggle }) {
  const [step, setStep] = useState(0);
  const [name, setName] = useState("");
  const [candidates] = useState(() => generateStarterCandidates());
  const [chosen, setChosen] = useState([]);

  function toggle(dogId) {
    setChosen((prev) => {
      if (prev.includes(dogId)) return prev.filter((id) => id !== dogId);
      if (prev.length >= 2) return prev;
      return [...prev, dogId];
    });
  }

  const chosenDogs = candidates.filter((d) => chosen.includes(d.id));
  const sameSexPair = chosenDogs.length === 2 && chosenDogs[0].sex === chosenDogs[1].sex;

  // Title screen. The game used to open straight onto a text input, which told
  // a first-time visitor nothing about what they'd opened.
  if (step === 0) {
    return (
      <div className="kg-app kg-title">
        <div className="kg-title__controls">{themeToggle}{cloudAuth}</div>
        <div className="kg-title__inner">
          <img className="kg-title__logo" src="assets/logo.png" alt="Sundown Kennels" width="400" height="400" />
          <p className="kg-title__pitch">
            Build a line of working dogs from the ground up. Breed for nose, grit and grip,
            run them on hogs and coon, take them to trials — and see how far a bloodline can carry your name.
          </p>
          <ul className="kg-title__points">
            <li><b>30 real working breeds</b>, each with its own strengths</li>
            <li><b>Genuine coat genetics</b> — hidden carriers surface generations later</li>
            <li><b>Hunt, trial, trade</b> against eight rival kennels and real players</li>
          </ul>
          <div className="kg-title__actions">
            <button className="kg-btn kg-btn--gold kg-btn--lg" onClick={() => setStep(1)}>Start a kennel</button>
          </div>
          <p className="kg-title__note">Already have one? Use <b>Cloud Save</b> above to sign in and load it.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="kg-app">
      <div style={{ display: "flex", justifyContent: "flex-end", gap: 8, maxWidth: 640, margin: "0 auto" }}>{themeToggle}{cloudAuth}</div>
      <div className="kg-onboard">
        <div className="kg-onboard__hero">
          <img className="kg-onboard__logo" src="assets/logo.png" alt="Sundown Kennels" width="400" height="400" />
          <h1>Found Your Kennel</h1>
          <p>Every stud book starts with a name and a pair of dogs.</p>
        </div>
        <div className="kg-onboard__card">
          {step === 1 && (
            <>
              <p className="kg-onboard__step">Step 1 of 2</p>
              <h2 className="kg-onboard__title">Name your kennel</h2>
              <p className="kg-hint">This is what other kennels, buyers, and the stud book will know you by. You can rename it later from the header if you change your mind.</p>
              <input className="kg-onboard__input" type="text" placeholder="e.g. Sundown Kennels" value={name} maxLength={28}
                onChange={(e) => setName(e.target.value)} onKeyDown={(e) => e.key === "Enter" && name.trim() && setStep(2)} autoFocus />
              <div className="kg-onboard__actions">
                <button className="kg-btn kg-btn--gold" disabled={!name.trim()} onClick={() => setStep(2)}>Continue</button>
              </div>
            </>
          )}
          {step === 2 && (
            <>
              <p className="kg-onboard__step">Step 2 of 2</p>
              <h2 className="kg-onboard__title">Pick 2 starter dogs</h2>
              <p className="kg-hint">Six dogs are available this time only. Choose the pair {name} will be built on — think about breed, sex (you'll want one of each to breed later), and stats.</p>
              <p className="kg-onboard__count">{chosen.length} / 2 selected</p>
              {sameSexPair && (
                <p className="kg-warn kg-onboard__warn">
                  Both of these are {chosenDogs[0].sex === "M" ? "males" : "females"} — you won't be able to breed
                  until you buy or adopt the opposite sex. You can start this way if you want the challenge.
                </p>
              )}
              <div className="kg-grid">
                {candidates.map((dog) => {
                  const isChosen = chosen.includes(dog.id);
                  return (
                    <div key={dog.id} className={"kg-pickcard " + (isChosen ? "kg-pickcard--chosen" : "")} onClick={() => toggle(dog.id)} style={{ cursor: "pointer" }}>
                      {isChosen && <div className="kg-pickcard__check">✓</div>}
                      <DogCard dog={dog} />
                    </div>
                  );
                })}
              </div>
              <div className="kg-onboard__actions">
                <button className="kg-btn kg-btn--ghost" onClick={() => setStep(1)}>Back</button>
                <button className="kg-btn kg-btn--gold" disabled={chosen.length !== 2} onClick={() => onComplete(name, candidates.filter((d) => chosen.includes(d.id)))}>
                  {chosen.length !== 2 ? "Pick 2 dogs" : `Found ${name}`}
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
