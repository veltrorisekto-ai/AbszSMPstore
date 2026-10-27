/* Homepage for ABSZRPG.SHOP. The Minecraft store, checkout, and admin routes are untouched. */
home=function(){
  app.innerHTML=`<div class="studio-home">
    <section class="studio-home-hero" aria-labelledby="studio-hero-title">
      <div class="studio-home-hero-inner">
        <div class="studio-eyebrow">WELCOME TO ABSZRPG.SHOP</div>
        <h1 id="studio-hero-title">Play the worlds <em>I created.</em></h1>
        <p class="studio-home-hero-lede">Adventure starts here.</p>
        <p class="studio-home-hero-text">Discover original games by ABSZ | Projects &amp; Studios. Explore fantasy adventures, battle monsters, collect gear and play together with friends.</p>
        <div class="studio-home-actions">
          <a class="studio-home-button gold" href="/games/">Explore Our Games <span aria-hidden="true">→</span></a>
          <a class="studio-home-button green" href="/games/my-hero-clash-with-monsters/">Play Now <span aria-hidden="true">→</span></a>
        </div>
      </div>
    </section>
    <section class="studio-featured studio-home-shell" aria-labelledby="studio-featured-heading">
      <div class="studio-heading-row">
        <div><span class="studio-section-kicker">ADVENTURES BY ABSZ</span><h2 id="studio-featured-heading">Featured Games</h2></div>
        <a class="studio-view-all" href="/games/">View All Games →</a>
      </div>
      <div class="studio-games-grid">
        <article class="studio-game-card">
          <a class="studio-game-art hero-clash-art" href="/games/my-hero-clash-with-monsters/" aria-label="View My Hero Clash With Monster"></a>
          <div class="studio-game-card-body">
            <div class="studio-game-meta">ONLINE HERO RPG <span class="studio-game-badge">PUBLIC BETA</span></div>
            <h3>My Hero Clash With Monster</h3>
            <p>Explore Aegis, battle monsters, collect equipment and pets, and join friends in shared party dungeons.</p>
            <a class="studio-card-cta play" href="/games/my-hero-clash-with-monsters/">Download &amp; Play Free →</a>
          </div>
        </article>
        <article class="studio-game-card">
          <a class="studio-game-art dungeon-art" href="/downloads/" aria-label="View ABSZ Dungeon GO!"></a>
          <div class="studio-game-card-body">
            <div class="studio-game-meta">FANTASY DUNGEON RPG <span class="studio-game-badge">PLAYABLE ALPHA</span></div>
            <h3>ABSZ Dungeon GO!</h3>
            <p>Explore an evolving fantasy world, fight monsters and discover dungeons on Android and Windows.</p>
            <a class="studio-card-cta dungeon" href="/downloads/">Explore &amp; Download →</a>
          </div>
        </article>
        <article class="studio-game-card">
          <a class="studio-game-art monsters-art" href="/games/my-monster-and-dungeon/" aria-label="Learn about My Monster and Dungeon"></a>
          <div class="studio-game-card-body">
            <div class="studio-game-meta">MONSTER ADVENTURE <span class="studio-game-badge soon">COMING SOON</span></div>
            <h3>My Monster and Dungeon</h3>
            <p>Raise monster companions, venture into new lands and build your party for future adventures.</p>
            <a class="studio-card-cta" href="/games/my-monster-and-dungeon/">Discover the Game →</a>
          </div>
        </article>
      </div>
    </section>
    <section class="studio-minecraft studio-home-shell" aria-labelledby="studio-minecraft-heading">
      <div><span class="studio-section-kicker">ALSO FROM OUR COMMUNITY</span>
        <h2 id="studio-minecraft-heading">Welcome to AbszoluteCraft</h2>
        <p>Looking for Minecraft? Our worlds, community servers and official store are still here. Explore the adventures you love without leaving ABSZRPG.SHOP.</p>
      </div>
      <div class="studio-minecraft-actions">
        <a class="studio-home-button outline" href="/join/">Join Servers →</a>
        <a class="studio-home-button gold" href="/store" data-nav>Visit Store →</a>
      </div>
    </section>
  </div>`;
};
if(location.pathname==='/' && state.loaded) home();
