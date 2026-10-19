// Re-export gmshelf implementation to completely replace LuminSDK with gmshelf (ugs)
export * from "./gmshelf";
import { fetchGmshelfGames } from "./gmshelf";
export default fetchGmshelfGames;
