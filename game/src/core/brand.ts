/**
 * The game's name and the colony ship's name, kept in one place. Both are translated like any other
 * text (the Greek is in the translation table), so the logo reads «Αργοναύτες του Γαλαξία» in Greek.
 */
export const GAME_NAME = 'Argonauts of the Galaxy';

/** The colony ship Jason lives on. Story text refers to it as {ship}. */
export const SHIP = 'Syracusia';

/** Who made the game, shown under Settings → About. */
export const CREATOR = { name: 'Kitsos Orfanopoulos', email: 'kitsorfan@protonmail.com', site: 'www.kitsorfan.com' };

declare const __APP_VERSION__: string | undefined;

/** The app's version (app.json's `expo.version`, stamped in by game/build.mjs; 'dev' outside a build). */
export const VERSION = typeof __APP_VERSION__ === 'string' ? __APP_VERSION__ : 'dev';
