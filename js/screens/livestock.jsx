/* Horses and cattle, both driven by LivestockPanel.

   Split out of game.jsx, which carried every screen inline in one
   3,200-line component. The JSX is unchanged — only its home moved.

   Everything a screen needs arrives on one `game` object rather than
   through a long prop list: these are sections of a single stateful
   component, not reusable pieces with an interface worth designing. The
   destructure below is the honest record of what this file depends on. */
function LivestockScreens({ game }) {
  const { acceptAnimalChallenge, acceptAnimalStudRequestAction, buyAnimalListing,
    cancelAnimalChallenge, cancelAnimalListing, cancelAnimalStudOffer, cloudAuthEl,
    createAnimalChallenge, declineAnimalStudRequest, doBreedAnimal, doBuyAnimal, doEnterShow,
    doSellAnimal, listAnimalForSale, patchPvp2, postAnimalStud, pvp2, requestAnimalStud,
    scoutAnimalMarket, session, setViewAnimal, state, tab } = game;
  return (
    <>
        {tab === "horses" && (
          <LivestockPanel kind="horse" state={state} session={session} pvp={pvp2.horse} patch={(p) => patchPvp2("horse", p)} cloudAuthEl={cloudAuthEl} setViewAnimal={setViewAnimal}
            doBuyAnimal={doBuyAnimal} scoutAnimalMarket={scoutAnimalMarket} doSellAnimal={doSellAnimal} doBreedAnimal={doBreedAnimal} doEnterShow={doEnterShow}
            listAnimalForSale={listAnimalForSale} cancelAnimalListing={cancelAnimalListing} buyAnimalListing={buyAnimalListing}
            createAnimalChallenge={createAnimalChallenge} cancelAnimalChallenge={cancelAnimalChallenge} acceptAnimalChallenge={acceptAnimalChallenge}
            postAnimalStud={postAnimalStud} cancelAnimalStudOffer={cancelAnimalStudOffer} requestAnimalStud={requestAnimalStud}
            declineAnimalStudRequest={declineAnimalStudRequest} acceptAnimalStudRequestAction={acceptAnimalStudRequestAction} />
        )}
        {tab === "cattle" && (
          <LivestockPanel kind="cattle" state={state} session={session} pvp={pvp2.cattle} patch={(p) => patchPvp2("cattle", p)} cloudAuthEl={cloudAuthEl} setViewAnimal={setViewAnimal}
            doBuyAnimal={doBuyAnimal} scoutAnimalMarket={scoutAnimalMarket} doSellAnimal={doSellAnimal} doBreedAnimal={doBreedAnimal} doEnterShow={doEnterShow}
            listAnimalForSale={listAnimalForSale} cancelAnimalListing={cancelAnimalListing} buyAnimalListing={buyAnimalListing}
            createAnimalChallenge={createAnimalChallenge} cancelAnimalChallenge={cancelAnimalChallenge} acceptAnimalChallenge={acceptAnimalChallenge}
            postAnimalStud={postAnimalStud} cancelAnimalStudOffer={cancelAnimalStudOffer} requestAnimalStud={requestAnimalStud}
            declineAnimalStudRequest={declineAnimalStudRequest} acceptAnimalStudRequestAction={acceptAnimalStudRequestAction} />
        )}
    </>
  );
}
