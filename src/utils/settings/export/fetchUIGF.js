const axios = require("axios");

/**
 * Translate item IDs to Simplified Chinese names using UIGF API.
 * @param {Array<number>} itemIds - List of item IDs to translate.
 * @param {string} game - The game name, e.g., 'genshin'.
 * @returns {Promise<Array<string>>} - A promise that resolves to a list of translated item names.
 */

async function translateItemIdsToNames(itemIds, game) {
  if (!game) {
    throw new Error("The game parameter is required.");
  }

  const apiUrl = "https://api.uigf.org/translate/";

  try {
    const response = await axios.post(apiUrl, {
      lang: "chs",
      type: "reverse",
      game: game,
      item_id: itemIds,
    });

    if (response.data && response.data.item_name) {
      return response.data.item_name;
    } else {
      throw new Error("Unexpected API response format");
    }
  } catch (error) {
    console.error("Error translating item IDs:", error);
    throw error;
  }
}

module.exports = { translateItemIdsToNames };
