(() => {
  'use strict';
  const games = Object.freeze({
    'my-monster-and-dungeon': ['My Monster and Dungeon','Monster Adventure','Raise your monster companions and set off on a magical adventure.','🥚'],
    'my-hero-clash-with-monsters': ['My Hero Clash With Monsters','Hero Adventure','Gather your courage for a colorful new hero adventure.','⚔'],
    'please-defend-our-king': ['Please Defend Our King!','Team Battle','Gather your team, defend the throne and protect your king.','♛'],
    'community-and-friendship': ['Community & Friendship','Social Adventure','A welcoming world where adventures begin together.','♡'],
    'dungeoncraft-online': ['DungeonCraft Online','Online Dungeon RPG','Discover a new world of quests, dungeons and epic encounters.','◆']
  });
  const slug = location.pathname.replace(/\/+$/,'').split('/').pop();
  const game = Object.hasOwn(games, slug) ? games[slug] : null;
  if (!game) {
    document.getElementById('not-found').hidden = false;
    return;
  }
  const [title, category, description, emblem] = game;
  document.title = title + ' — Coming Soon | ABSZ RPG';
  document.getElementById('game-title').textContent = title;
  document.getElementById('game-category').textContent = category.toUpperCase();
  document.getElementById('game-description').textContent = description;
  document.getElementById('game-emblem').textContent = emblem;
  document.getElementById('game-panel').hidden = false;
})();